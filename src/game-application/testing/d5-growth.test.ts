import { beforeAll, expect, it } from "vitest";
import { setImmediate } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { playedGrowthFixtures } from "./d5-growth-fixture";
import type { D5Command, D5GameRecord, D5Receipt, D5Store } from "../versions/d5-contracts";
import { d5Catalog } from "../../game-core/session/testing/d5-fixtures";
import { resolveDemoCharacter } from "../../game-core/battle/rules/v2/configuration";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createD5Application } from "../versions/d5-service";
import { validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import { GameStorageError } from "../contracts";
import { projectCharacterHistory } from "../character-history";
let records:Record<string,D5GameRecord>;
beforeAll(async()=>{records=await playedGrowthFixtures();mkdirSync('dist/reports/demo-d5-e',{recursive:true});writeFileSync('dist/reports/demo-d5-e/played-checkpoints.json',JSON.stringify(records));},300000);
function fixture(record:D5GameRecord) {
 const db=new MemoryGameDatabase<D5GameRecord,D5Receipt>();db.records.set('d5-d',structuredClone(record));const store=new MemoryGameStore(db);
 return {store,app:createD5Application(d5Catalog,store),request:(command:D5Command,id='e-test')=>({protocolVersion:4,saveId:'d5-d',expectedHead:record.head,clientRequestId:id,command})};
}
it('obtains all ten growth events, the two original items and one Kael milestone through played journeys',()=>{
 const c=records.complete.snapshot.campaign;
 expect(c.growthGrants).toHaveLength(10);expect(c.progress.appliedGrowthIds).toHaveLength(10);
 for(const id of ['eustice','elora','kororo','norma','marietta'])expect(resolveDemoCharacter(d5Catalog.data,c.progress,id).level).toBe(3);
 const second=records['event.growth.elora.lv3'].snapshot.campaign.teamMilestone;
 expect(second).not.toBeNull();expect(c.teamMilestone).toEqual(second);
 expect(resolveDemoCharacter(d5Catalog.data,c.progress,'kael').faces[3].quality).toBe('gild');
 expect(c.inventory).toHaveLength(2);expect(records.unloaded.snapshot.campaign.inventory.map(i=>i.instanceId)).toEqual(c.inventory.map(i=>i.instanceId));
 expect(records.unloaded.snapshot.campaign.inventory.every(i=>i.location.kind==='inventory')).toBe(true);
 expect(projectCharacterHistory(records.complete,'kael').filter(e=>e.kind==='team-milestone')).toHaveLength(1);
 expect(projectCharacterHistory(records.complete,'marietta').filter(e=>e.kind==='growth-completed')).toHaveLength(2);
});
it('rewrites every native blank without changing fate, pips or quality; reserves and returns the same instances',()=>{
 const c=records.equipped.snapshot.campaign;
 for(const id of ['kororo','norma']) {
  const before=resolveDemoCharacter(d5Catalog.data,records.lv2.snapshot.campaign.progress,id),after=resolveDemoCharacter(d5Catalog.data,c.progress,id);
  expect(after.faces.filter((_,i)=>d5Catalog.data.actions[before.faces[i].actionId].kind==='blank').every(f=>d5Catalog.data.actions[f.actionId].kind===(id==='kororo'?'attack':'heal') && f.power===1)).toBe(true);
  expect(after.faces.map(({fate,pip,quality,suit})=>({fate,pip,quality,suit}))).toEqual(before.faces.map(({fate,pip,quality,suit})=>({fate,pip,quality,suit})));
 }
 const departure=records['growth-first:departure'],returned=records['growth-first:return'];
 expect(departure.snapshot.campaign.inventory.find(i=>i.definitionId==='equipment.spare-blade')?.location.kind).toBe('reserved');
 expect(departure.snapshot.campaign.inventory.find(i=>i.definitionId==='equipment.emergency-pouch')?.location.kind).toBe('equipped');
 expect(returned.snapshot.campaign.inventory).toEqual(c.inventory);
});
it('rejects stale qualification, duplicate grants, occupied targets, no-blank targets and frozen loadouts',async()=>{
 const cases:[D5GameRecord,D5Command][]=[
 [records.lv2,{type:'begin-story',eventId:'event.growth.eustice.lv3',basisId:records.lv2.snapshot.campaign.settlements[0].id}],
 [records.lv2,{type:'begin-story',eventId:'event.demo.preparation-gift',basisId:records.lv2.snapshot.campaign.settlements[0].id}],
 ...['kael','marietta','norma'].map(toOwnerId=>[records.equipped,{type:'transfer-equipment',instanceId:records.equipped.snapshot.campaign.inventory[0].instanceId,fromOwnerId:'kororo',toOwnerId}] as [D5GameRecord,D5Command]),
 [records['growth-first:departure'],{type:'unequip-equipment',instanceId:records.equipped.snapshot.campaign.inventory[0].instanceId,ownerId:'kororo'}],
 [records.memory,{type:'begin-story',eventId:'event.growth.elora.lv2',basisId:records.memory.snapshot.campaign.settlements[0].id}],
 ];
 for(const [record,command] of cases){await setImmediate();const f=fixture(record);expect((await f.app.dispatch(f.request(command))).ok).toBe(false);expect((await f.store.read('d5-d'))!.head).toEqual(record.head);}
},60000);
it('commits growth/gift/transfer atomically across faults, receipt replay and competing connections',async()=>{
 const examples:[D5GameRecord,D5Command][]=['event.growth.eustice.lv2','event.demo.preparation-gift','event.growth.elora.lv3'].map(id=>{
  const r=records[`pending:${id}`];return [r,{type:'complete-story',sessionId:r.snapshot.campaign.activeStoryId!}];
 });
 examples.push([records.preTransfer,{type:'transfer-equipment',instanceId:records.preTransfer.snapshot.campaign.inventory[0].instanceId,fromOwnerId:'elora',toOwnerId:'kororo'}]);
 for(const [record,command] of examples)for(const fault of ['before','after']){
  await setImmediate();
  const f=fixture(record);let armed=true;
  const faulty:D5Store={...f.store,read:id=>f.store.read(id),receipt:(...a)=>f.store.receipt(...a),listSaveIds:()=>f.store.listSaveIds(),commit:async proposal=>{
   if(armed && fault==='before'){armed=false;throw new GameStorageError('storage-aborted','before');}
   const r=await f.store.commit(proposal);if(armed && fault==='after'){armed=false;throw new GameStorageError('storage-unavailable','after');}return r;
  }};
  const request=f.request(command);expect((await createD5Application(d5Catalog,faulty).dispatch(request)).ok).toBe(false);
  expect((await f.store.read('d5-d'))!.head.revision).toBe(record.head.revision+(fault==='after'?1:0));
  expect(await f.app.dispatch(request)).toMatchObject({ok:true,replayed:fault==='after'});
  expect(await f.app.dispatch(request)).toMatchObject({ok:true,replayed:true});
  expect(await f.app.dispatch({...request,clientRequestId:'stale'})).toMatchObject({ok:false,error:{code:'conflict'}});
  const saved=(await f.store.read('d5-d'))!;expect(saved.head.revision).toBe(record.head.revision+1);
  expect(validateD5Record(saved,d5Catalog,D5_RUN_READERS)).toEqual(saved);
 }
},180000);
