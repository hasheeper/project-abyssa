import { describe, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { FIRST_MORNING_CATALOG, FIRST_MORNING_V1_CATALOG } from "../../game-runtime/first-morning-context";
import { PROLOGUE_CATALOG } from "../../game-runtime/prologue-context";
import { GameStorageError } from "../contracts";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../index";

async function fixture(contentVersion=6) {
  const db=new MemoryGameDatabase<AnyGameRecord,AnyReceipt>(),store=new MemoryGameStore(db);
  let seq=0;
  const runtime=createPlayerRuntime(store,{newId:()=>`req-${++seq}`,newSeed:()=>19,close(){}});
  expect(await runtime.application.create({...runtime.defaultCreation,contentVersion,saveId:"morning",epoch:"epoch",clientRequestId:"create"})).toMatchObject({ok:true});
  const read=async()=>{const r=await runtime.application.open("morning");if(!r.ok)throw Error(JSON.stringify(r));return r.record as D5GameRecord;};
  const send=async(command:D5Command)=> {
    const r=await read(),request={protocolVersion:4,saveId:"morning",expectedHead:r.head,clientRequestId:`test-${++seq}`,command};
    return {result:await runtime.application.dispatch(request),request};
  };
  return {db,store,runtime,read,send};
}
describe("the first morning",()=> {
  it("enforces CG → S1 → S2 and commits five choices without economic or clock effects",async()=> {
    const f=await fixture();
    expect((await f.read()).contentRef).toEqual(FIRST_MORNING_CATALOG.ref);
    expect((await f.send({type:"advance-opening",step:0,choice:"continue"})).result.ok).toBe(false);
    await f.send({type:"complete-prologue",shotId:"A1-01",choice:"skip"});
    const initial=(await f.read()).snapshot.campaign,{opening:_,...world}=initial;
    const depart:D5Command={type:"start-expedition",runId:"run",routeId:"old-manor.first-clear",partyIds:FIRST_MORNING_CATALOG.data.initialParty,itemIds:[],seed:1};
    expect((await f.send(depart)).result.ok).toBe(false);
    const spec=FIRST_MORNING_CATALOG.data.opening!,expected=[];
    for(let step=0;step<=spec.lastStep;step++) {
      const choice=spec.choiceSteps.includes(step) ? (["B","A","C","C","B"] as const)[spec.choiceSteps.indexOf(step)] : "continue";
      if(step===96) {
        expect((await f.send({type:"advance-opening",step,choice:"C"})).result.ok).toBe(false);
        expect((await f.send({type:"advance-opening",step,choice:"continue"})).result.ok).toBe(false);
      }
      if(choice!=="continue") expected.push({step,choice});
      const sent=await f.send({type:"advance-opening",step,choice});
      expect(sent.result).toMatchObject({ok:true});
      if(step===6) {
        expect(await f.runtime.application.dispatch(sent.request)).toMatchObject({ok:true,replayed:true});
        const archive=await f.runtime.application.exportSave("morning");if(!archive.ok)throw Error("export");
        expect(await f.runtime.application.importSave({saveId:"copy",epoch:"copy",clientRequestId:"copy",archive:archive.archive})).toMatchObject({ok:true});
        const copy=await f.runtime.application.open("copy");if(!copy.ok || copy.record.schemaVersion!==4)throw Error("copy");
        expect(copy.record.snapshot.campaign.opening).toEqual({step:7,status:"playing",choices:[{step:6,choice:"B"}]});
      }
    }
    const {opening,...after}=(await f.read()).snapshot.campaign;
    expect(opening).toEqual({step:spec.lastStep,status:"viewed",choices:expected});expect(after).toEqual(world);
    expect((await f.send({type:"advance-opening",step:spec.lastStep,choice:"continue"})).result.ok).toBe(false);
    expect((await f.send(depart)).result.ok).toBe(true);
    expect(PROLOGUE_CATALOG.data).not.toHaveProperty("opening");
  },15000); // Full 120-command replay validates the growing ledger at every step.
  it("extends v5 mid-scene and at the old ending without replaying choices or overwriting the original",async()=> {
    const f=await fixture(5);
    await f.send({type:"complete-prologue",shotId:"A1-01",choice:"skip"});
    const spec=FIRST_MORNING_V1_CATALOG.data.opening!;
    for(let step=0;step<66;step++) {
      await f.send({type:"advance-opening",step,choice:spec.choiceSteps.includes(step)?"B":"continue"});
      if(step===6) {
        const before=await f.read();
        const result=await f.runtime.application.extendOpening("morning",before.head);
        expect(result).toMatchObject({ok:true});if(!result.ok)throw Error("extension");
        const target=await f.runtime.application.open(result.receipt.after!.saveId);
        expect(target).toMatchObject({ok:true,record:{contentRef:FIRST_MORNING_CATALOG.ref,snapshot:{campaign:{opening:before.snapshot.campaign.opening}}}});
        expect(await f.read()).toEqual(before);
        const listing=await f.runtime.application.list();
        expect(listing).toMatchObject({ok:true,saves:expect.arrayContaining([{status:"ready",saveId:result.receipt.after!.saveId,summary:expect.objectContaining({supersedes:before.head}),clock:expect.any(Object)}])});
      }
    }
    const before=await f.read(),commit=f.store.commit.bind(f.store);
    f.store.commit=async()=>{throw new GameStorageError("storage-quota","injected");};
    expect(await f.runtime.application.extendOpening("morning",before.head,true)).toMatchObject({ok:false,error:{code:"storage-quota"}});
    expect(await f.read()).toEqual(before);f.store.commit=commit;
    const [one,two]=await Promise.all([f.runtime.application.extendOpening("morning",before.head,true),f.runtime.application.extendOpening("morning",before.head,true)]);
    expect(one).toMatchObject({ok:true});expect(two).toMatchObject({ok:true});if(!one.ok || !two.ok)throw Error("extension");
    expect(one.receipt.after).toEqual(two.receipt.after);
    const target=await f.runtime.application.open(one.receipt.after!.saveId);
    expect(target).toMatchObject({ok:true,record:{snapshot:{campaign:{opening:{step:67,status:"playing",choices:before.snapshot.campaign.opening!.choices}}}}});
    expect(await f.read()).toEqual(before);
    // A completed v5 ending also starts at S2-1; its original digest remains readable.
    await f.send({type:"advance-opening",step:66,choice:"continue"});
    const finished=await f.read();expect(finished.contentRef).toEqual(FIRST_MORNING_V1_CATALOG.ref);
    const extended=await f.runtime.application.extendOpening("morning",finished.head);
    if(!extended.ok)throw Error("completed extension");
    expect(await f.runtime.application.open(extended.receipt.after!.saveId)).toMatchObject({ok:true,record:{snapshot:{campaign:{opening:{step:67,status:"playing"}}}}});
  });
  it("rejects skipped choices, forged options, stale cursors and preserves state on failed commits",async()=> {
    const f=await fixture();await f.send({type:"complete-prologue",shotId:"A1-01",choice:"skip"});
    expect((await f.send({type:"advance-opening",step:0,choice:"A"})).result.ok).toBe(false);
    expect((await f.send({type:"advance-opening",step:66,choice:"continue"})).result.ok).toBe(false);
    for(let step=0;step<6;step++) await f.send({type:"advance-opening",step,choice:"continue"});
    expect((await f.send({type:"advance-opening",step:6,choice:"continue"})).result.ok).toBe(false);
    const source=await f.read();
    expect(await f.runtime.application.continueSave({sourceSaveId:"morning",expectedSourceHead:source.head,saveId:"up",epoch:"up",clientRequestId:"up",kind:"upgrade"})).toMatchObject({ok:false});
    const commit=f.store.commit.bind(f.store);
    f.store.commit=async()=>{throw new GameStorageError("storage-quota","injected");};
    const failed=await f.send({type:"advance-opening",step:6,choice:"B"});
    expect(failed.result).toMatchObject({ok:false,error:{code:"storage-quota"}});
    expect(await f.read()).toEqual(source);f.store.commit=commit;
    const results=await Promise.all([f.runtime.application.dispatch(failed.request),f.runtime.application.dispatch({...failed.request,clientRequestId:"race",command:{type:"advance-opening",step:6,choice:"C"}})]);
    expect(results.filter(r=>r.ok)).toHaveLength(1);
    expect((await f.read()).snapshot.campaign.opening?.choices).toEqual([{step:6,choice:"B"}]);
  });
});
