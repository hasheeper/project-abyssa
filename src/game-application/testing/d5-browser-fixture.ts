import { setImmediate } from "node:timers/promises";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { d5Catalog } from "../../game-core/session/testing/d5-fixtures";
import { createD5Application } from "../versions/d5-service";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import { nextD5PlayCommand } from "./d5-playthrough";

/** Fresh browser fixtures played through public commands, never patched HP, RNG or proofs. */
export async function playedMemoryFixtures() {
  const db = new MemoryGameDatabase<D5GameRecord,D5Receipt>(), app = createD5Application(d5Catalog,new MemoryGameStore(db));
  const created = await app.create({protocolVersion:4,saveId:"d5-d",epoch:"epoch",clientRequestId:"create",profileId:d5Catalog.data.journey!.defaultProfileId});
  if (!created.ok) throw Error(JSON.stringify(created));
  const read = async () => {const r = await app.open("d5-d"); if (!r.ok) throw Error(JSON.stringify(r)); return r.record;};
  let id = 0;
  const send = async (command: D5Command) => {
    await setImmediate();
    const request = {protocolVersion:4,saveId:"d5-d",expectedHead:(await read()).head,clientRequestId:`request:${++id}`,command};
    const result = await (command.type === "resume-run" ? app.resumeRun : app.dispatch)(request);
    if (!result.ok) throw Error(JSON.stringify(result));
    return read();
  };
  const snapshots: Record<string,D5GameRecord> = {};
  let record = await send({type:"start-expedition",runId:"manor-full",routeId:"old-manor.first-clear",partyIds:d5Catalog.data.initialParty,itemIds:d5Catalog.data.journey!.defaultItems,seed:19});
  let steps = 0;
  while (record.snapshot.run && steps++ < 1000) record = await send(nextD5PlayCommand(d5Catalog,record));
  if (record.snapshot.campaign.settlements.at(-1)?.outcome !== "cleared") throw Error("Fixture policy did not clear the manor");
  snapshots.firstClear = await send({type:"acknowledge-story",terminalId:record.snapshot.campaign.manor.story!.terminalId,step:0,choice:"skip"});
  record = await send({type:"begin-memory",chapterId:d5Catalog.data.progression.chapter.id});
  const memory = record.snapshot.campaign.memory!, ref = {kind:"memory" as const,id:memory.id,attempt:1};
  snapshots.intro = record;
  record = await send({type:"read-memory",runRef:ref,node:"present-intro",step:0});
  for (const node of ["history-opening","teaching","battle"] as const) record = await send({type:"advance-memory",runRef:ref,node,choice:"skip"});
  snapshots.memory = record;
  steps = 0;
  while (record.snapshot.campaign.memory?.node === "battle" && steps++ < 300) record = await send(nextD5PlayCommand(d5Catalog,record,true));
  if (record.snapshot.campaign.memory?.node !== "failed") throw Error("Passive fixture did not fail");
  snapshots.failed = record;
  await send({type:"retry-memory",runRef:ref});
  record = await send({type:"advance-memory",runRef:{...ref,attempt:2},node:"battle",choice:"skip"});
  steps = 0;
  while (record.snapshot.campaign.memory?.node === "battle" && steps++ < 400) {
    snapshots.preTerminal = record;
    record = await send(nextD5PlayCommand(d5Catalog,record));
  }
  if (record.snapshot.campaign.memory?.node !== "history-complete") throw Error("Fixture policy did not win the memory");
  snapshots.complete = record;
  record = await send({type:"advance-memory",runRef:{...ref,attempt:2},node:"return-pending",choice:"skip"});
  record = await send({type:"begin-story",eventId:"story.marietta.return",basisId:record.snapshot.campaign.chapterCompletion!.id});
  const story = record.snapshot.campaign.stories[0];
  snapshots.returnPending = await send({type:"advance-story",sessionId:story.id,step:0,choice:"skip"});
  return snapshots;
}
