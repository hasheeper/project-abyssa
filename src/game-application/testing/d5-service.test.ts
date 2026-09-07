import { describe, it, expect } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { d5Catalog } from "../../game-core/session/testing/d5-fixtures";
import { createD5Application } from "../versions/d5-service";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import { nextD5PlayCommand } from "./d5-playthrough";
import { validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import { mkdirSync, writeFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { GameStorageError } from "../contracts";
import type { D5Store } from "../versions/d5-contracts";

async function fixture() {
  const db = new MemoryGameDatabase<D5GameRecord, D5Receipt>(), store = new MemoryGameStore(db), app = createD5Application(d5Catalog, store);
  const created = await app.create({ protocolVersion: 4, saveId: "d5-d", epoch: "epoch", clientRequestId: "create", profileId: d5Catalog.data.journey!.defaultProfileId });
  expect(created.ok).toBe(true);
  let id = 0;
  const read = async () => { const result = await app.open("d5-d"); if (!result.ok) throw Error(JSON.stringify(result)); return result.record; };
  async function send(command: D5Command) {
    await setImmediate();
    const record = await read();
    const request = { protocolVersion: 4, saveId: "d5-d", expectedHead: record.head, clientRequestId: `request:${++id}`, command };
    const result = command.type === "resume-run" ? await app.resumeRun(request) : await app.dispatch(request);
    return { result, request };
  }
  return { db, store, app, read, send };
}
describe("D5-D application transactions", () => {
  it("plays first clear, failed memory, retry, return and unlocked maintenance through durable commands", async () => {
    const f = await fixture(), checkpoints: Record<string, D5GameRecord> = {};
    async function accept(command: D5Command) {
      const step = await f.send(command);
      if (!step.result.ok) throw Error(JSON.stringify({command, result: step.result}));
      return step;
    }
    await accept({type: "start-expedition", runId: "manor-full", routeId: "old-manor.first-clear", partyIds: d5Catalog.data.initialParty, itemIds: d5Catalog.data.journey!.defaultItems, seed: 19});
    let record = await f.read(), steps = 0;
    while (record.snapshot.run && steps++ < 1000) {
      await accept(nextD5PlayCommand(d5Catalog, record)); record = await f.read();
    }
    expect(steps).toBeLessThan(1000);
    expect(record.snapshot.campaign.settlements.at(-1)?.outcome).toBe("cleared");
    await accept({type: "acknowledge-story", terminalId: record.snapshot.campaign.manor.story!.terminalId, step: 0, choice: "skip"});
    checkpoints.firstClear = await f.read();
    const ordinary = ({snapshot: {campaign: c}}: D5GameRecord) => ({funds:c.funds,clock:c.clock,supplies:c.supplies,settlements:c.settlements,progress:c.progress,inventory:c.inventory});
    const beforeMemory = ordinary(await f.read());
    await accept({type: "begin-memory", chapterId: d5Catalog.data.progression.chapter.id});
    let m = (await f.read()).snapshot.campaign.memory!;
    const ref = {kind: "memory" as const,id:m.id,attempt:1};
    await accept({type:"read-memory",runRef:ref,node:"present-intro",step:0});
    expect((await f.read()).snapshot.campaign.memory?.step).toBe(1);
    for (const node of ["history-opening","teaching","battle"] as const) await accept({type:"advance-memory",runRef:ref,node,choice:"skip"});
    checkpoints.memory = await f.read();
    record = await f.read(); steps = 0;
    while(record.snapshot.campaign.memory?.node === "battle" && steps++ < 300) {await accept(nextD5PlayCommand(d5Catalog,record,true));record=await f.read();}
    expect(record.snapshot.campaign.memory?.node).toBe("failed");
    expect(record.snapshot.campaign.chapterCompletion).toBeNull();
    expect(ordinary(record)).toEqual(beforeMemory);
    checkpoints.failed = record;
    await accept({type:"retry-memory",runRef:ref});
    m = (await f.read()).snapshot.campaign.memory!;
    expect(m).toMatchObject({seed:checkpoints.memory.snapshot.campaign.memory!.seed,attempt:2,node:"teaching"});
    const retry = {...ref,attempt:2};
    expect((await f.send({type:"advance-memory",runRef:ref,node:"battle",choice:"skip"})).result.ok).toBe(false);
    await accept({type:"advance-memory",runRef:retry,node:"battle",choice:"skip"});
    record = await f.read(); steps = 0;
    while(record.snapshot.campaign.memory?.node === "battle" && steps++ < 400) { checkpoints.preTerminal = record; await accept(nextD5PlayCommand(d5Catalog,record));record=await f.read();}
    expect(record.snapshot.campaign.memory?.node).toBe("history-complete");
    expect(record.snapshot.campaign.availableCharacterIds).not.toContain("marietta");
    expect(record.commits.at(-1)?.factIds).toHaveLength(2);
    checkpoints.complete = record;
    await accept({type:"advance-memory",runRef:retry,node:"return-pending",choice:"skip"});
    await accept({type:"begin-story",eventId:"story.marietta.return",basisId:record.snapshot.campaign.chapterCompletion!.id});
    let story = (await f.read()).snapshot.campaign.stories[0];
    await accept({type:"advance-story",sessionId:story.id,step:0,choice:"later"});
    record = await f.read(); expect(record.snapshot.campaign.activeStoryId).toBeNull();
    await accept({type:"begin-story",eventId:"story.marietta.return",basisId:record.snapshot.campaign.chapterCompletion!.id});
    story = (await f.read()).snapshot.campaign.stories[0];
    await accept({type:"advance-story",sessionId:story.id,step:0,choice:"skip"});
    checkpoints.returnPending = await f.read();
    const committed = await accept({type:"complete-story",sessionId:story.id});
    expect(await f.app.dispatch(committed.request)).toMatchObject({ok:true,replayed:true});
    record = await f.read();
    expect(record.snapshot.campaign.availableCharacterIds.filter(id=>id==="marietta")).toHaveLength(1);
    expect(ordinary(record)).toEqual(beforeMemory);
    expect(record.snapshot.run).toBeNull();
    expect(validateD5Record(JSON.parse(JSON.stringify(record)),d5Catalog,D5_RUN_READERS)).toEqual(record);
    checkpoints.unlocked = record;
    await accept({type:"start-expedition",runId:"marietta-maintenance",routeId:"old-manor.maintenance",partyIds:["kael","eustice","elora","kororo","marietta"],itemIds:d5Catalog.data.journey!.defaultItems,seed:2});
    expect((await f.read()).snapshot.run?.kind).toBe("expedition");
    checkpoints.maintenance = await f.read();
    record = await f.read(); steps = 0;
    while (record.snapshot.run && steps++ < 1000) {
      const command = nextD5PlayCommand(d5Catalog, record);
      await accept(command.type === "choose-exit" ? {...command,choice:"leave"} : command); record = await f.read();
    }
    expect(record.snapshot.campaign.settlements.at(-1)?.outcome).toBe("extracted");
    expect(record.snapshot.campaign.settlements.at(-1)?.partyIds).toContain("marietta");
    expect(record.snapshot.campaign.chapterClaim).toEqual(checkpoints.unlocked.snapshot.campaign.chapterClaim);
    checkpoints.maintenanceReturned = record;
    await verifyAtomic(checkpoints.returnPending, {type:"complete-story",sessionId:story.id});
    const terminalCommand = nextD5PlayCommand(d5Catalog, checkpoints.preTerminal);
    await verifyAtomic(checkpoints.preTerminal, terminalCommand);
    const repeated = await accept({type:"begin-memory",chapterId:d5Catalog.data.progression.chapter.id});
    expect(repeated.result.ok).toBe(true);
    const repeatedMemory = (await f.read()).snapshot.campaign.memory!;
    await accept({type:"leave-memory",runRef:{kind:"memory",id:repeatedMemory.id,attempt:repeatedMemory.attempt}});
    expect((await f.read()).snapshot.campaign.chapterClaim).toEqual(checkpoints.unlocked.snapshot.campaign.chapterClaim);
    mkdirSync("dist/reports/demo-d5-d",{recursive:true});
    writeFileSync("dist/reports/demo-d5-d/played-checkpoints.json",JSON.stringify(checkpoints));
  }, 360000);
  it("persists a real departure, battle action and exact undo, rejecting a skipped journey", async () => {
    const f = await fixture();
    expect((await f.send({ type: "begin-memory", chapterId: d5Catalog.data.progression.chapter.id })).result.ok).toBe(false);
    const start = await f.send({ type: "start-expedition", runId: "first", routeId: "old-manor.first-clear", partyIds: d5Catalog.data.initialParty, itemIds: d5Catalog.data.journey!.defaultItems, seed: 1 });
    expect(start.result, JSON.stringify(start.result)).toMatchObject({ ok: true });
    const ref = { kind: "expedition" as const, id: "first" };
    for (const command of [{ type: "roll" }, { type: "toggle-load", actorId: "kael" }] as const) {
      const step = await f.send({ type: "battle-command", runRef: ref, command });
      expect(step.result, JSON.stringify(step.result)).toMatchObject({ ok: true });
    }
    const undo = await f.send({ type: "undo", runRef: ref });
    expect(undo.result, JSON.stringify(undo.result)).toMatchObject({ ok: true });
    expect((await f.read()).retractedFactIds).toHaveLength(1);
    expect(await f.app.dispatch(undo.request)).toMatchObject({ ok: true, replayed: true });
    const stale = { ...start.request, clientRequestId: "stale" };
    expect(await f.app.dispatch(stale)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect((await f.read()).head.revision).toBe(4);
  });
  it("revalidates a changed prefix, snapshot, reader or content identity", async () => {
    const f = await fixture(), prefix = await f.read();
    await f.send({type:"start-expedition",runId:"cache",routeId:"old-manor.first-clear",partyIds:d5Catalog.data.initialParty,itemIds:[],seed:1});
    const next = await f.read();
    expect(validateD5Record(structuredClone(next),d5Catalog,D5_RUN_READERS,prefix)).toEqual(validateD5Record(structuredClone(next),d5Catalog,D5_RUN_READERS));
    const alteredFact = structuredClone(next); alteredFact.facts[0].worldTime.day = 2;
    expect(() => validateD5Record(alteredFact,d5Catalog,D5_RUN_READERS,prefix)).toThrow();
    const alteredSnapshot = structuredClone(next); alteredSnapshot.snapshot.campaign.funds.party++;
    expect(() => validateD5Record(alteredSnapshot,d5Catalog,D5_RUN_READERS,prefix)).toThrow();
    const alteredCatalog = {...d5Catalog,ref:{...d5Catalog.ref,digest:"0".repeat(64)}};
    expect(() => validateD5Record(next,alteredCatalog,D5_RUN_READERS,prefix)).toThrow();
    let called = 0;
    const readers = {...D5_RUN_READERS,expedition: ((...args: Parameters<NonNullable<typeof D5_RUN_READERS.expedition>>) => {called++; return D5_RUN_READERS.expedition!(...args);})};
    expect(validateD5Record(next,d5Catalog,readers,prefix)).toEqual(next);
    expect(called).toBeGreaterThan(0);
  });
});

/** The same public transaction is retried through independent service/store connections. */
async function verifyAtomic(before: D5GameRecord, command: D5Command) {
  for (const fault of ["before", "after"] as const) {
    await setImmediate();
    const db = new MemoryGameDatabase<D5GameRecord,D5Receipt>(); db.records.set(before.head.saveId, structuredClone(before));
    const base = new MemoryGameStore(db); let armed = true;
    const store: D5Store = {
      read: id => base.read(id), receipt: (...args) => base.receipt(...args), listSaveIds: () => base.listSaveIds(),
      async commit(proposal) {
        if (armed && fault === "before") {armed = false; throw new GameStorageError("storage-aborted", "injected before commit");}
        const result = await base.commit(proposal);
        if (armed && fault === "after") {armed = false; throw new GameStorageError("storage-unavailable", "injected lost receipt");}
        return result;
      },
    };
    const request = {protocolVersion:4,saveId:before.head.saveId,expectedHead:before.head,clientRequestId:"fault-test",command};
    const first = createD5Application(d5Catalog,store);
    const submit = (app: ReturnType<typeof createD5Application>) => command.type === "resume-run" ? app.resumeRun(request) : app.dispatch(request);
    expect((await submit(first)).ok).toBe(false);
    expect((await base.read(before.head.saveId))!.head.revision).toBe(before.head.revision + (fault === "after" ? 1 : 0));
    const second = createD5Application(d5Catalog,new MemoryGameStore(db));
    expect(await submit(second)).toMatchObject({ok:true,replayed:fault === "after"});
    const after = (await base.read(before.head.saveId))!;
    expect(after.head.revision).toBe(before.head.revision+1);
    if (command.type === "complete-story") {
      expect(after.snapshot.campaign.availableCharacterIds.filter(id=>id==="marietta")).toHaveLength(1);
      expect(await second.dispatch({...request,expectedHead:after.head,clientRequestId:"same-business"})).toMatchObject({ok:false});
    } else expect(after.commits.at(-1)?.factIds).toHaveLength(2);
    expect(await submit(second)).toMatchObject({ok:true,replayed:true});
    expect(await (command.type === "resume-run" ? second.resumeRun : second.dispatch)({...request, clientRequestId:"other-tab"})).toMatchObject({ok:false,error:{code:"conflict"}});
    expect((await base.read(before.head.saveId))!.head).toEqual(after.head);
  }
}
