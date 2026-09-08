import { describe, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { PROLOGUE_CATALOG } from "../../game-runtime/prologue-context";
import { LOOP_CATALOG } from "../../game-runtime/loop-context";
import { validateD5Catalog } from "../../game-core/contracts";
import { GameStorageError } from "../contracts";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../index";

async function fixture(contentVersion=4) {
  const db=new MemoryGameDatabase<AnyGameRecord,AnyReceipt>(),store=new MemoryGameStore(db);
  let seq=0;
  const runtime=createPlayerRuntime(store,{newId:()=>`request-${++seq}`,newSeed:()=>19,close(){}});
  expect(await runtime.application.create({...runtime.defaultCreation,contentVersion,saveId:"opening",epoch:"epoch",clientRequestId:"create"})).toMatchObject({ok:true});
  const read=async()=>{const opened=await runtime.application.open("opening");if(!opened.ok)throw Error(JSON.stringify(opened));return opened.record as D5GameRecord;};
  const send=async(command:D5Command)=>{
    const record=await read(),request={protocolVersion:4,saveId:"opening",expectedHead:record.head,clientRequestId:`test-${++seq}`,command};
    return {result:await runtime.application.dispatch(request),request};
  };
  return {db,store,runtime,read,send};
}
describe("durable CG prologue",()=>{
  it("plays the full shot sequence exactly once without advancing the world clock or granting anything",async()=>{
    const f=await fixture(),initial=(await f.read()).snapshot.campaign;
    const {prologue:_,...world}=initial;
    expect(initial.prologue).toEqual({shotId:"A1-01",status:"playing"});
    const shots=PROLOGUE_CATALOG.data.prologue!.shotIds;
    for(const shotId of shots.slice(0,-1))expect((await f.send({type:"advance-prologue",shotId})).result).toMatchObject({ok:true});
    const completion=await f.send({type:"complete-prologue",shotId:"title-card",choice:"continue"});
    expect(completion.result).toMatchObject({ok:true});
    expect(await f.runtime.application.dispatch(completion.request)).toMatchObject({ok:true,replayed:true});
    const {prologue,...after}=(await f.read()).snapshot.campaign;
    expect(prologue).toEqual({shotId:"title-card",status:"viewed"});expect(after).toEqual(world);
    expect((await f.send({type:"complete-prologue",shotId:"title-card",choice:"continue"})).result.ok).toBe(false);
    const archive=await f.runtime.application.exportSave("opening");if(!archive.ok)throw Error("export");
    expect(await f.runtime.application.importSave({saveId:"copy",epoch:"copy-epoch",clientRequestId:"copy",archive:archive.archive})).toMatchObject({ok:true});
  });
  it("rejects a fabricated title cursor, stale shot commands and expeditions while opening",async()=>{
    const f=await fixture();
    for(const command of [
      {type:"complete-prologue",shotId:"title-card",choice:"continue"},
      {type:"complete-prologue",shotId:"A1-01",choice:"continue"},
      {type:"advance-prologue",shotId:"A3-01"},
      {type:"start-expedition",runId:"too-early",routeId:"old-manor.first-clear",partyIds:PROLOGUE_CATALOG.data.initialParty,itemIds:[],seed:1},
    ] as D5Command[])expect((await f.send(command)).result.ok).toBe(false);
    expect((await f.read()).head.revision).toBe(0);
    expect((await f.send({type:"advance-prologue",shotId:"A1-01"})).result.ok).toBe(true);
    expect((await f.send({type:"advance-prologue",shotId:"A1-01"})).result.ok).toBe(false);
  });
  it("preserves the current shot across import and records an explicit skip before gameplay",async()=>{
    const f=await fixture();await f.send({type:"advance-prologue",shotId:"A1-01"});
    const archive=await f.runtime.application.exportSave("opening");if(!archive.ok)throw Error("export");
    expect(await f.runtime.application.importSave({saveId:"resume",epoch:"resume-epoch",clientRequestId:"resume",archive:archive.archive})).toMatchObject({ok:true});
    const copy=await f.runtime.application.open("resume");if(!copy.ok || copy.record.schemaVersion!==4)throw Error("copy");
    expect(copy.record.snapshot.campaign.prologue).toEqual({shotId:"A1-02",status:"playing"});
    expect((await f.send({type:"complete-prologue",shotId:"A1-02",choice:"skip"})).result.ok).toBe(true);
    expect((await f.send({type:"start-expedition",runId:"after-opening",routeId:"old-manor.first-clear",partyIds:PROLOGUE_CATALOG.data.initialParty,itemIds:[],seed:1})).result).toMatchObject({ok:true});
  });
  it("keeps the shot on a storage failure and serializes two competing readers",async()=>{
    const f=await fixture(),commit=f.store.commit.bind(f.store);
    f.store.commit=async()=>{throw new GameStorageError("storage-quota","injected");};
    const failed=await f.send({type:"advance-prologue",shotId:"A1-01"});
    expect(failed.result).toMatchObject({ok:false,error:{code:"storage-quota"}});expect((await f.read()).head.revision).toBe(0);
    f.store.commit=commit;
    const outcomes=await Promise.all([f.runtime.application.dispatch(failed.request),f.runtime.application.dispatch({...failed.request,clientRequestId:"racing-tab"})]);
    expect(outcomes.filter(r=>r.ok)).toHaveLength(1);
    expect((await f.read()).snapshot.campaign.prologue?.shotId).toBe("A1-02");
  });
  it("keeps the existing catalog immutable and upgrades old saves without replaying the prologue",async()=>{
    const before=validateD5Catalog(LOOP_CATALOG.data).ref, f=await fixture(3),source=await f.read();
    expect(source.snapshot.campaign.prologue).toBeUndefined();
    expect(await f.runtime.application.continueSave({sourceSaveId:"opening",expectedSourceHead:source.head,saveId:"upgraded",epoch:"next-epoch",clientRequestId:"upgrade",kind:"upgrade"})).toMatchObject({ok:true});
    const result=await f.runtime.application.open("upgraded");if(!result.ok || result.record.schemaVersion!==4)throw Error("upgrade");
    expect(result.record.snapshot.campaign.prologue).toEqual({shotId:"title-card",status:"skipped"});
    const {prologue:_,opening,...campaign}=result.record.snapshot.campaign;
    expect(opening).toEqual({step:119,status:"skipped",choices:[]});
    expect(campaign).toEqual(source.snapshot.campaign);expect(await f.read()).toEqual(source);
    expect(validateD5Catalog(LOOP_CATALOG.data).ref).toEqual(before);
  });
});
