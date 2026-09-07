import { setImmediate } from "node:timers/promises";
import { beforeAll, expect, it } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { LOOP_CATALOG } from "../../game-runtime/loop-context";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createD5Application } from "../versions/d5-service";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import type { AnyGameRecord, AnyReceipt } from "../versions/demo-contracts";
import { GameStorageError } from "../contracts";
import { nextD5PlayCommand } from "./d5-playthrough";
import { projectCharacterHistory } from "../character-history";

const catalog=LOOP_CATALOG;
const records:Record<string,D5GameRecord>={};
const environment={newId:()=>crypto.randomUUID(),newSeed:()=>19,close:()=>{}};
beforeAll(async()=>{
  if(process.env.ABYSSA_LOOP_FIXTURE){Object.assign(records,JSON.parse(readFileSync(process.env.ABYSSA_LOOP_FIXTURE,"utf8")));return;}
  const db=new MemoryGameDatabase<D5GameRecord,D5Receipt>(), app=createD5Application(catalog,new MemoryGameStore(db));
  expect((await app.create({protocolVersion:4,saveId:"loop",epoch:"loop-epoch",clientRequestId:"create",profileId:catalog.data.journey!.defaultProfileId})).ok).toBe(true);
  const read=async()=>{const r=await app.open("loop");if(!r.ok)throw Error(JSON.stringify(r));return r.record;};
  let request=0;
  const send=async(command:D5Command)=>{
    await setImmediate();
    const result=await (command.type==="resume-run"?app.resumeRun:app.dispatch)({protocolVersion:4,saveId:"loop",expectedHead:(await read()).head,clientRequestId:`play:${++request}`,command});
    if(!result.ok)throw Error(JSON.stringify({command,result}));
    return read();
  };
  records.new=await read();
  let r=records.departure=await send({type:"start-expedition",runId:"initial",routeId:"old-manor.first-clear",partyIds:catalog.data.initialParty,itemIds:catalog.data.journey!.defaultItems,seed:19});
  let steps=0;
  while(r.snapshot.run && steps++<1000){
    if(r.snapshot.run.kind==="expedition" && r.snapshot.run.state.node==="exit")records.exit=r;
    r=await send(nextD5PlayCommand(catalog,r));
  }
  expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe("cleared");
  records.pendingManor=r;
  records.firstClear=r=await send({type:"acknowledge-story",terminalId:r.snapshot.campaign.manor.story!.terminalId,step:0,choice:"skip"});
  records.intro=r=await send({type:"begin-memory",chapterId:catalog.data.progression.chapter.id});
  const ref={kind:"memory" as const,id:r.snapshot.campaign.memory!.id,attempt:1};
  for(const node of ["history-opening","teaching","battle"] as const)r=await send({type:"advance-memory",runRef:ref,node,choice:"skip"});
  records.memory=r;
  steps=0;
  while(r.snapshot.campaign.memory?.node==="battle" && steps++<400){
    r=await send(nextD5PlayCommand(catalog,r));
    if(r.snapshot.run?.kind==="memory" && r.snapshot.run.battle?.undo.length)records.memoryUndo=r;
  }
  expect(r.snapshot.campaign.memory?.node).toBe("history-complete");
  records.memoryComplete=r;
  r=await send({type:"advance-memory",runRef:ref,node:"return-pending",choice:"skip"});
  records.returnPending=r;
  r=await send({type:"begin-story",eventId:"story.marietta.return",basisId:r.snapshot.campaign.chapterCompletion!.id});
  const storyId=r.snapshot.campaign.activeStoryId!;
  await send({type:"advance-story",sessionId:storyId,step:0,choice:"skip"});
  records.unlocked=r=await send({type:"complete-story",sessionId:storyId});
  records.maintenance=r=await send({type:"start-expedition",runId:"maintenance",routeId:"old-manor.maintenance",partyIds:["kael","marietta","elora","kororo","norma"],itemIds:["item.food","item.potion"],seed:19});
  steps=0;
  while(r.snapshot.run && steps++<1000){
    if(r.snapshot.run.kind==="expedition" && r.snapshot.run.state.run.layer===5 && r.snapshot.run.state.node==="battle")records.clockBoss??=r;
    r=await send(nextD5PlayCommand(catalog,r));
  }
  records.returned=r;
  expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe("cleared");
  mkdirSync("dist/reports/loop-implementation",{recursive:true});
  writeFileSync("dist/reports/loop-implementation/played-checkpoints.json",JSON.stringify(records));
},180000);

function setup(record:D5GameRecord=records.firstClear){
  const db=new MemoryGameDatabase<AnyGameRecord,AnyReceipt>();db.records.set(record.head.saveId,structuredClone(record));
  const store=new MemoryGameStore(db), runtime=createPlayerRuntime(store,environment);
  let id=0;
  const read=async(saveId=record.head.saveId)=>{const r=await runtime.application.open(saveId);if(!r.ok)throw Error(JSON.stringify(r));return r.record as D5GameRecord;};
  const request=async(command:D5Command)=>({protocolVersion:4,saveId:record.head.saveId,expectedHead:(await read()).head,clientRequestId:`check:${++id}`,command});
  return {db,store,runtime,read,request};
}
const buy={type:"purchase-supply" as const,shopId:"shop.mansion",definitionId:"item.ward",quantity:1,quoteVersion:1};

it("projects the first-clear milestone for its party and Marietta once, without treating maintenance as another takeover",()=>{
  const before=JSON.stringify(records.firstClear);
  for(const id of [...catalog.data.initialParty,"marietta"]) {
    expect(projectCharacterHistory(records.firstClear,id).filter(e=>e.kind==="manor-takeover-completed")).toHaveLength(1);
    expect(projectCharacterHistory(records.returned,id).filter(e=>e.kind==="manor-takeover-completed")).toHaveLength(1);
  }
  expect(projectCharacterHistory(records.exit,"norma").filter(e=>e.kind==="manor-takeover-completed")).toHaveLength(0);
  expect(projectCharacterHistory(records.firstClear,"lenore").filter(e=>e.kind==="manor-takeover-completed")).toHaveLength(0);
  expect(projectCharacterHistory(records.firstClear,"norma").some(e=>e.kind==="enemy-defeated")).toBe(true);
  expect(JSON.stringify(records.firstClear)).toBe(before);
});

it("clears initial, opens memory and maintenance independently, and uses only clock beasts after initial",async()=>{
  const f=setup();const r=await f.read();
  expect(f.runtime.queries.memory(r)?.canBegin).toBe(true);
  expect(f.runtime.queries.journey(r)?.defaultRouteId).toBe("old-manor.maintenance");
  expect(records.memory.snapshot.run?.kind==="memory" && records.memory.snapshot.run.battle?.encounter.enemies.map(e=>e.definitionId)).toEqual(["enemy.memory.clockwork-beast"]);
  expect(records.clockBoss.snapshot.run?.kind==="expedition" && records.clockBoss.snapshot.run.state.encounter?.enemies.map(e=>e.definitionId)).toEqual(["enemy.old-manor.clockwork-beast"]);
  expect(records.unlocked.snapshot.campaign.availableCharacterIds).toContain("marietta");
  expect(records.unlocked.snapshot.campaign.funds).toEqual(records.firstClear.snapshot.campaign.funds);
  expect(records.unlocked.snapshot.campaign.clock).toEqual(records.firstClear.snapshot.campaign.clock);
},30000);

it("retains initial mode after a third-floor exit, and allows a zero-gold departure",async()=>{
  const f=setup(records.exit),r=await f.read();
  if(r.snapshot.run?.kind!=="expedition")throw Error("exit fixture");
  const state=r.snapshot.run.state;
  expect((await f.runtime.application.dispatch(await f.request({type:"choose-exit",runRef:{kind:"expedition",id:state.run.id},roomId:state.run.roomIds[state.run.layer-1][state.run.room],choice:"leave"}))).ok).toBe(true);
  const ended=await f.read();if(ended.snapshot.run?.kind!=="expedition" || ended.snapshot.run.state.node!=="finished")throw Error("terminal");
  expect((await f.runtime.application.dispatch(await f.request({type:"settle-expedition",runRef:{kind:"expedition",id:state.run.id},terminalRef:ended.snapshot.run.state.result.id}))).ok).toBe(true);
  expect(f.runtime.queries.journey(await f.read())?.defaultRouteId).toBe("old-manor.first-clear");
  const zero=setup(records.new);
  expect(await zero.runtime.application.dispatch(await zero.request(buy))).toMatchObject({ok:false,error:{code:"insufficient-funds"}});
  expect((await zero.runtime.application.dispatch(await zero.request({type:"start-expedition",runId:"zero",routeId:"old-manor.first-clear",partyIds:catalog.data.initialParty,itemIds:["item.food","item.potion"],seed:19}))).ok).toBe(true);
},30000);

it("purchases once, rejects stale/forged/over-capacity/active purchases and carries the same paid charges",async()=>{
  const f=setup(),before=await f.read(),req=await f.request({...buy,quantity:2});
  expect(await f.runtime.application.dispatch(req)).toMatchObject({ok:true,replayed:false});
  expect(await f.runtime.application.dispatch(req)).toMatchObject({ok:true,replayed:true});
  expect(await f.runtime.application.dispatch({...req,clientRequestId:"stale"})).toMatchObject({ok:false,error:{code:"conflict"}});
  expect(await f.runtime.application.dispatch(await f.request(buy))).toMatchObject({ok:false,error:{code:"inventory-full"}});
  expect(await f.runtime.application.dispatch(await f.request({...buy,quoteVersion:2}))).toMatchObject({ok:false,error:{code:"quote-expired"}});
  expect((await f.runtime.application.dispatch({...await f.request(buy),command:{...buy,total:0}})).ok).toBe(false);
  let r=await f.read();expect(r.snapshot.campaign.funds.party).toBe(before.snapshot.campaign.funds.party-8);
  const purchased=r.snapshot.campaign.supplies.find(s=>s.definitionId==="item.ward")!;
  expect((await f.runtime.application.dispatch(await f.request({type:"start-expedition",runId:"paid",routeId:"old-manor.maintenance",partyIds:catalog.data.initialParty,itemIds:["item.food","item.potion","item.ward"],seed:19}))).ok).toBe(true);
  expect(await f.runtime.application.dispatch(await f.request(buy))).toMatchObject({ok:false,error:{code:"run-active"}});
  r=await f.read();if(r.snapshot.run?.kind!=="expedition")throw Error("departure");
  expect(r.snapshot.run.state.run.supplies.find(s=>s.instanceId===purchased.instanceId)).toEqual(purchased);
  const ref={kind:"expedition" as const,id:"paid"};
  expect((await f.runtime.application.dispatch(await f.request({type:"use-item",runRef:ref,instanceId:purchased.instanceId,target:{kind:"intent",id:r.snapshot.run.state.encounter!.enemies.find(e=>e.intent?.kind==="attack")!.id}}))).ok).toBe(true);
  r=await f.read();let steps=0;
  while(r.snapshot.run && steps++<1000){await setImmediate();const cmd=nextD5PlayCommand(catalog,r);const result=await (cmd.type==="resume-run"?f.runtime.application.resume:f.runtime.application.dispatch)(await f.request(cmd));if(!result.ok)throw Error(JSON.stringify(result));r=await f.read();}
  expect(r.snapshot.campaign.supplies.find(s=>s.instanceId===purchased.instanceId)).toMatchObject({charges:1,source:"supply.demo.shop"});
  const archive=await f.runtime.application.exportSave("loop");if(!archive.ok)throw Error("archive");
  expect((await f.runtime.application.importSave({saveId:"paid-copy",epoch:"paid-copy-epoch",clientRequestId:"copy",format:"application",archive:archive.archive})).ok).toBe(true);
  const copied=await f.read("paid-copy");
  expect(copied.snapshot.campaign.funds).toEqual(r.snapshot.campaign.funds);
  expect(copied.snapshot.campaign.supplies).toEqual(r.snapshot.campaign.supplies);
},120000);

it("survives purchase commit failures and concurrent requests without duplicating assets",async()=>{
  for(const fault of ["before","after"]){
    await setImmediate();
    const f=setup();let armed=true;
    const faulty={read:f.store.read.bind(f.store),receipt:f.store.receipt.bind(f.store),listSaveIds:f.store.listSaveIds.bind(f.store),commit:async(p:Parameters<typeof f.store.commit>[0])=>{
      if(armed && fault==="before"){armed=false;throw new GameStorageError("storage-aborted","before");}
      const result=await f.store.commit(p);if(armed && fault==="after"){armed=false;throw new GameStorageError("storage-unavailable","after");}return result;
    }};
    const request=await f.request(buy), app=createPlayerRuntime(faulty,environment).application;
    expect((await app.dispatch(request)).ok).toBe(false);
    expect(await app.dispatch(request)).toMatchObject({ok:true,replayed:fault==="after"});
    expect((await f.read()).snapshot.campaign.funds.party).toBe(records.firstClear.snapshot.campaign.funds.party-4);
  }
  const f=setup(),request=await f.request(buy),other=createPlayerRuntime(new MemoryGameStore(f.db),environment);
  const results=await Promise.all([f.runtime.application.dispatch(request),other.application.dispatch({...request,clientRequestId:"competing"})]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);
},60000);

it.each(["departure","pendingManor","intro","memory","memoryUndo","memoryComplete","returnPending","unlocked"])("copies %s and preserves undo; refuses tampered origin proofs",async(key)=>{
    let source=records[key];const f=setup(key==="memoryUndo"?records.memory:source);
    await setImmediate();
    if(key==="memoryUndo"){
      const ref=records.memory.snapshot.campaign.activeRunRef!;
      for(const command of [{type:"roll" as const},{type:"toggle-load" as const,actorId:"kael"}]) expect((await f.runtime.application.dispatch(await f.request({type:"battle-command",runRef:ref,command}))).ok).toBe(true);
      source=await f.read();
    }
    const saveId=`copy:${key}`,epoch=`epoch:${key}`;
    const request={saveId,epoch,clientRequestId:"copy",format:"application",archive:JSON.stringify({archiveVersion:4,record:source})};
    expect(await f.runtime.application.importSave(request),key).toMatchObject({ok:true,replayed:false});
    expect(await f.runtime.application.importSave(request)).toMatchObject({ok:true,replayed:true});
    const copied=await f.read(saveId);expect(copied.snapshot.run).toEqual(source.snapshot.run);
    expect(copied.snapshot.campaign.funds).toEqual(source.snapshot.campaign.funds);
    if(key==="memoryUndo"){
      const command={type:"undo",runRef:copied.snapshot.campaign.activeRunRef};
      expect(await f.runtime.application.dispatch({protocolVersion:4,saveId,expectedHead:copied.head,clientRequestId:"undo",command})).toMatchObject({ok:true});
    }
    const tampered=structuredClone(copied);tampered.originRef!.source.snapshot.campaign.funds.party++;
    expect((await f.runtime.application.importSave({...request,saveId:`bad:${key}`,epoch:`bad-epoch:${key}`,archive:JSON.stringify({archiveVersion:4,record:tampered})})).ok).toBe(false);
},60000);

it("creates a fresh cycle with only memory proof; fresh v3 upgrades retain their original save",async()=>{
  const f=setup(records.unlocked),source=await f.read();
  const request={sourceSaveId:source.head.saveId,expectedSourceHead:source.head,saveId:"cycle",epoch:"cycle-epoch",clientRequestId:"cycle",kind:"cycle" as const};
  expect((await f.runtime.application.continueSave(request)).ok).toBe(true);
  const cycle=await f.read("cycle");
  expect(cycle.snapshot.campaign).toMatchObject({funds:{party:0,public:0,crystals:0},progress:{appliedGrowthIds:[],equipment:[]},manor:{takeover:null},chapterClaim:null});
  expect(cycle.snapshot.campaign.inheritedChapter).toBeTruthy();
  expect((await f.runtime.application.dispatch({protocolVersion:4,saveId:"cycle",expectedHead:cycle.head,clientRequestId:"early",command:{type:"inherit-memory",chapterId:catalog.data.progression.chapter.id}})).ok).toBe(false);
  expect((await f.read()).head).toEqual(source.head);
  expect((await f.runtime.application.create({protocolVersion:3,saveId:"old",epoch:"old-epoch",clientRequestId:"old",profileId:catalog.data.journey!.defaultProfileId})).ok).toBe(true);
  const old=await f.runtime.application.open("old");if(!old.ok)throw Error("old");
  expect((await f.runtime.application.continueSave({sourceSaveId:"old",expectedSourceHead:old.record.head,saveId:"upgrade",epoch:"upgrade-epoch",clientRequestId:"upgrade",kind:"upgrade"})).ok).toBe(true);
  expect((await f.read("upgrade")).contentRef).toEqual(catalog.ref);
  expect((await f.runtime.application.open("old"))).toMatchObject({ok:true,record:{schemaVersion:3}});
},60000);
