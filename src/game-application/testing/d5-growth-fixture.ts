import { setImmediate } from "node:timers/promises";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { d5Catalog } from "../../game-core/session/testing/d5-fixtures";
import { createD5Application } from "../versions/d5-service";
import { d5EventEligibility } from "../../game-core/session";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import { playedMemoryFixtures } from "./d5-browser-fixture";
import { nextD5PlayCommand } from "./d5-playthrough";

/** Real first clear + memory provenance, followed by all ten growth grants and two equipped departures. */
export async function playedGrowthFixtures() {
  const memory = await playedMemoryFixtures();
  const db = new MemoryGameDatabase<D5GameRecord,D5Receipt>();db.records.set("d5-d",memory.returnPending);
  const app = createD5Application(d5Catalog,new MemoryGameStore(db));
  const read = async () => {const r=await app.open("d5-d");if(!r.ok)throw Error(JSON.stringify(r));return r.record;};
  let sequence=0;
  const send = async(command:D5Command) => {
    await setImmediate();
    const r = await (command.type==="resume-run" ? app.resumeRun : app.dispatch)({protocolVersion:4,saveId:"d5-d",expectedHead:(await read()).head,clientRequestId:`growth:${++sequence}`,command});
    if(!r.ok)throw Error(JSON.stringify({command,result:r}));return read();
  };
  const result:Record<string,D5GameRecord>={firstClear:memory.firstClear,memory:memory.memory};
  result.home=await send({type:"complete-story",sessionId:memory.returnPending.snapshot.campaign.activeStoryId!});
  async function grant(eventId:string) {
    const record=await read();
    const starts=new Map(record.facts.flatMap(f=>f.kind==="progression" && f.payload.type==="expedition-started" ? [[f.payload.runId,f.source.revision] as const] : []));
    const basis=[...record.snapshot.campaign.settlements].reverse().find(t=>{try {d5EventEligibility(d5Catalog,record.snapshot.campaign,starts,eventId,t.id,record.head.revision+1);return true;}catch{return false;}});
    if(!basis)throw Error(`Unreachable ${eventId}`);
    await send({type:"begin-story",eventId,basisId:basis.id});
    const story=(await read()).snapshot.campaign.stories.find(s=>s.eventId===eventId)!;
    await send({type:"advance-story",sessionId:story.id,step:story.step,choice:"skip"});
    result[`pending:${eventId}`]=await read();
    await send({type:"complete-story",sessionId:story.id});
    result[eventId]=await read();
  }
  await grant("event.demo.preparation-gift");
  for(const id of ["eustice","elora","kororo","norma"])await grant(`event.growth.${id}.lv2`);
  result.lv2=await read();
  const items=result.lv2.snapshot.campaign.inventory;
  const blade=items.find(i=>i.definitionId==="equipment.spare-blade")!.instanceId,pouch=items.find(i=>i.definitionId==="equipment.emergency-pouch")!.instanceId;
  await send({type:"equip-equipment",instanceId:blade,ownerId:"elora"});
  result.preTransfer=await read();
  await send({type:"transfer-equipment",instanceId:blade,fromOwnerId:"elora",toOwnerId:"kororo"});
  await send({type:"equip-equipment",instanceId:pouch,ownerId:"norma"});
  result.equipped=await read();
  async function journey(id:string,partyIds:string[]) {
    await send({type:"start-expedition",runId:id,routeId:"old-manor.maintenance",partyIds,itemIds:d5Catalog.data.journey!.defaultItems,seed:2});
    result[`${id}:departure`]=await read();
    let record=await read(),steps=0;
    while(record.snapshot.run && steps++<1000) {
      const command=nextD5PlayCommand(d5Catalog,record);
      record=await send(command.type==="choose-exit" ? {...command,choice:"leave"} : command);
    }
    if(record.snapshot.campaign.settlements.at(-1)?.outcome!=="extracted")throw Error(`Journey failed ${id}`);
    result[`${id}:return`]=record;
  }
  await journey("growth-first",["kael","eustice","elora","kororo","marietta"]);
  for(const id of ["eustice","elora","kororo"])await grant(`event.growth.${id}.lv3`);
  await grant("event.growth.marietta.lv2");
  await journey("growth-second",["kael","eustice","elora","norma","marietta"]);
  await grant("event.growth.norma.lv3");await grant("event.growth.marietta.lv3");
  result.complete=await read();
  await send({type:"unequip-equipment",instanceId:blade,ownerId:"kororo"});
  await send({type:"unequip-equipment",instanceId:pouch,ownerId:"norma"});
  result.unloaded=await read();
  return result;
}
