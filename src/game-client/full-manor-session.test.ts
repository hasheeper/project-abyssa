import { expect, it } from "vitest";
import { validateDemoRecord } from "../game-application";
import { writeVersionedPending } from "./versioned-pending-request";
import { manorClientFixture } from "./testing/manor";
import { FULL_MANOR_CATALOG } from "../game-runtime/full-manor-context";
import { manorBattlePlan } from "../game-core/testing/manor-policy";
import { asDemoBattle } from "../game-core/session";
import type { DemoGameRecord } from "../game-application";

it("plays five layers, imports intermediate states, grants once, resumes story and completes maintenance", async () => {
  const f = await manorClientFixture(19,3), read = () => f.session.getSnapshot().record as DemoGameRecord;
  const visited = new Set<string>();
  const commit=f.store.commit.bind(f.store);
  let settlementFault=0;
  f.store.commit=async proposal=>{
    const paying=proposal.receipt.version !== 4 && proposal.receipt.events.some(e=>e.type==="manor-takeover-completed");
    if(paying && settlementFault===0) {settlementFault++;throw new Error("Before atomic commit");}
    const result=await commit(proposal);
    if(paying && settlementFault===1) {settlementFault++;throw new Error("Lost acknowledgement after commit");}
    return result;
  };
  let copy = 0;
  const verifyImport = async () => {
    const exported = await f.runtime.application.exportSave("manor-save");
    if (!exported.ok) throw new Error(exported.error.message);
    const id = `copy-${++copy}`;
    const result = await f.runtime.application.importSave({protocolVersion:3,saveId:id,epoch:id,clientRequestId:id,format:"application",archive:exported.archive});
    expect(result.ok,JSON.stringify(result)).toBe(true);
    const opened = await f.runtime.application.open(id);
    if (!opened.ok || opened.record.schemaVersion !== 3) throw new Error("Full manor required");
    expect(opened.record.snapshot.campaign.funds).toEqual(read().snapshot.campaign.funds);
    expect(opened.record.snapshot.expedition?.node).toBe(read().snapshot.expedition?.node);
    return {id, record: opened.record};
  };
  const play = async () => {
    for (let n=0;n<700 && read().snapshot.expedition;n++) {
      // The in-memory port resolves synchronously; let the test runner service its RPC/timers.
      await new Promise(resolve=>setTimeout(resolve,0));
      const e = read().snapshot.expedition!, v=f.runtime.queries.journey(read())!, runRef={kind:"expedition" as const,id:e.run.id};
      const key=`${e.run.routeId}:${e.run.layer}:${e.node}${e.encounter?.manor?.summoned ? `:summoned-${e.encounter.manor.summoned}` : ""}`;
      if (!visited.has(key)) {
        visited.add(key);
        const imported = await verifyImport();
        if (e.node === "exit") {
          // Exercise the alternative exit on the imported branch; the main run continues.
          const branch = imported.record.snapshot.expedition!;
          const request = {protocolVersion: 3, saveId: imported.id, expectedHead: imported.record.head,
            clientRequestId: `leave-${imported.id}`, command: {type: "choose-exit",
              runRef: {kind: "expedition", id: branch.run.id}, roomId: branch.run.roomIds[2][branch.run.room], choice: "leave"}};
          expect((await f.runtime.application.dispatch(request)).ok).toBe(true);
          const left = await f.runtime.application.open(imported.id);
          if (!left.ok || left.record.schemaVersion !== 3) throw new Error("Missing exit branch");
          const ended = left.record.snapshot.expedition!;
          expect(ended.result!.outcome).toBe("extracted");
          expect((await f.runtime.application.dispatch({protocolVersion: 3, saveId: imported.id,
            expectedHead: left.record.head, clientRequestId: `settle-${imported.id}`,
            command: {type: "settle-expedition", runRef: {kind: "expedition", id: ended.run.id}, terminalRef: ended.result!.id}})).ok).toBe(true);
          const settled = await f.runtime.application.open(imported.id);
          if (!settled.ok || settled.record.schemaVersion !== 3) throw new Error("Missing settled exit branch");
          expect(settled.record.snapshot.expedition).toBeNull();
          expect(settled.record.snapshot.campaign.manor).toEqual(imported.record.snapshot.campaign.manor);
          expect(settled.record.facts.filter(f => f.kind === "reward-granted")).toHaveLength(imported.record.facts.filter(f => f.kind === "reward-granted").length);
        }
        await f.session.refresh();
      }
      const supply=v.supplies.find(s=>["food","potion","holy-water"].includes(s.definition.kind) && s.targets.some(t=>t.kind==="member" && (s.definition.kind==="holy-water" || v.party.find(p=>p.id===t.id)!.hp<=1)));
      if(supply) await f.session.dispatch({type:"use-item",runRef,instanceId:supply.instanceId,target:supply.targets.find(t=>t.kind==="member" && (supply.definition.kind==="holy-water" || v.party.find(p=>p.id===t.id)!.hp<=1))!});
      else if(e.node==="event") await f.session.dispatch({type:"choose-event",runRef,roomId:v.roomId!,choiceId:e.run.layer===2?"skip":"read",actorId:null});
      else if(e.node==="room-complete") await f.session.dispatch({type:"advance-room",runRef,roomId:v.roomId!});
      else if(e.node==="exit") await f.session.dispatch({type:"choose-exit",runRef,roomId:v.roomId!,choice:"continue"});
      else if(e.node==="finished") throw new Error(`Unexpected terminal ${e.result.outcome}`);
      else {
        const plan=manorBattlePlan(FULL_MANOR_CATALOG,asDemoBattle(e)!,"survival");
        expect(plan.length).toBeGreaterThan(0);
        for(const command of plan) await f.session.dispatch({type:"battle-command",runRef,command});
      }
      if(f.session.getSnapshot().status==="error" && settlementFault===1) {
        expect(read().snapshot.campaign.manor!.takeover).toBeNull();
        expect(read().snapshot.expedition!.node).toBe("finished");
        await verifyImport();
        await f.session.refresh();
        expect(f.session.getSnapshot().status).toBe("error");
        await f.session.refresh();
      }
      expect(f.session.getSnapshot().status,JSON.stringify(f.session.getSnapshot().error)).toBe("ready");
    }
    expect(read().snapshot.expedition).toBeNull();
  };
  try {
    await play();
    const c=read().snapshot.campaign;
    expect(c.settlements[0].outcome).toBe("cleared");
    expect(c.manor!.takeover!.gold).toBe(20);
    expect(settlementFault).toBe(2);
    expect(c.funds.party).toBe(c.settlements[0].totalGold+20);
    expect(read().facts.filter(f=>f.kind==="reward-granted")).toHaveLength(1);
    expect(f.runtime.queries.journey(read())!.defaultRouteId).toBe("old-manor.maintenance");
    await verifyImport();
    for (const alter of [
      (r:DemoGameRecord)=>{r.snapshot.campaign.manor!.takeover!.gold++;},
      (r:DemoGameRecord)=>{r.snapshot.campaign.manor!.story!.step=3;},
      (r:DemoGameRecord)=>{const f=r.facts.find(f=>f.kind==="encounter-completed")!;(f.payload as {outcome:string}).outcome="wipe";},
      (r:DemoGameRecord)=>{r.snapshot.campaign.settlements[0].completion!.encounterIds.pop();},
    ]) {const forged=structuredClone(read());alter(forged);expect(()=>validateDemoRecord(forged,FULL_MANOR_CATALOG)).toThrow();}
    const before=read(), story=c.manor!.story!;
    const req={protocolVersion:3,saveId:before.head.saveId,expectedHead:before.head,clientRequestId:"story-once",command:{type:"acknowledge-story",terminalId:story.terminalId,step:story.step,choice:"continue"}};
    const first=await f.runtime.application.dispatch(req),replay=await f.runtime.application.dispatch(req);
    expect(first.ok,JSON.stringify(first)).toBe(true);expect(replay.ok).toBe(true);
    if(first.ok&&replay.ok) expect(replay.receipt).toEqual(first.receipt);
    writeVersionedPending(f.storage,req as Parameters<typeof writeVersionedPending>[1]);
    await f.session.refresh();await verifyImport();
    expect(read().snapshot.campaign.manor!.story!.step).toBe(1);
    await f.session.dispatch({type:"acknowledge-story",terminalId:story.terminalId,step:1,choice:"skip"});
    expect(read().snapshot.campaign.funds).toEqual(c.funds);
    expect(read().snapshot.campaign.clock).toEqual(c.clock);
    expect(read().snapshot.campaign.manor!.story!.status).toBe("skipped");
    const v=f.runtime.queries.journey(read())!;
    f.session.locator.expeditionId = "maintenance";
    await f.session.dispatch({type:"start-expedition",runId:"maintenance",routeId:v.defaultRouteId,partyIds:v.initialParty,itemIds:v.defaultItems,seed:19});
    await play();await verifyImport();
    expect(read().snapshot.campaign.settlements).toHaveLength(2);
    expect(read().snapshot.campaign.settlements[1].outcome).toBe("cleared");
    expect(read().facts.filter(f=>f.kind==="reward-granted")).toHaveLength(1);
    expect(read().snapshot.campaign.funds.party).toBe(read().snapshot.campaign.settlements.reduce((n,t)=>n+t.totalGold,20));
    expect([...visited]).toContain("old-manor.first-clear:4:event");
  } finally {f.session.dispose();}
},180000);
