import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../index";
import type { AirpPoolState } from "../../game-core/contracts";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { AIRP_POOL_CATALOG } from "../../game-runtime/airp-context";
import { firstAirpOffer } from "./airp-playthrough";
import { nextD5PlayCommand } from "./d5-playthrough";

export type PoolRecord = D5GameRecord & { narrative: AirpPoolState };
export function poolTestRuntime(source?: D5GameRecord) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  if (source) database.records.set(source.head.saveId, structuredClone(source));
  const store = new MemoryGameStore(database);
  let seq = Math.max(0, ...(source?.commits.map(c => Number(c.requestId.split(":").at(-1)) || 0) ?? []));
  const runtime = createPlayerRuntime(store, { newId: () => `pool-client:${++seq}`, newSeed: () => 19, close() {} });
  const read = async () => (await store.read("pool")) as PoolRecord;
  const send = async (command: D5Command) => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const r = await read();
    const result = await (command.type === "resume-run" ? runtime.application.resume : runtime.application.dispatch)({ protocolVersion: 4, saveId: "pool", expectedHead: r.head, clientRequestId: `pool-play:${++seq}`, command });
    if (!result.ok) throw Error(JSON.stringify({ command, result }));
    return read();
  };
  return { database, store, runtime, read, send };
}
export async function firstPoolOffer(source?: D5GameRecord) {
  const old = source ?? await (await firstAirpOffer()).read();
  const f = poolTestRuntime(old);
  const result = await f.runtime.application.continueSave({ sourceSaveId: old.head.saveId, expectedSourceHead: old.head, saveId: "pool", epoch: "pool-epoch", clientRequestId: "pool-upgrade", kind: "upgrade" });
  if (!result.ok) throw Error(JSON.stringify(result));
  return f;
}
export async function readPoolConversation(f: ReturnType<typeof poolTestRuntime>, option: "A" | "B" | "C" = "B") {
  for (let step = 0; step < 40; step++) {
    const r = await f.read(), n = r.narrative, reading = n.reading;
    if (!reading || reading.completed || reading.paused) return r;
    const scene = n.scenes.find(s => s.id === reading.sceneId)!, node = scene.body.nodes[reading.node], instanceId = scene.instanceId;
    await f.send(node.kind === "choice" ? { type: "airp-accept", instanceId, sceneId: scene.id, nodeId: node.id, optionId: option } : { type: "airp-read", instanceId, sceneId: scene.id, nodeId: node.id });
  }
  throw Error("Reading did not terminate");
}
export function poolPatrolCommand(r: PoolRecord, outcome: "extracted" | "cleared" | "wipe" = "extracted") {
  const command = nextD5PlayCommand(AIRP_POOL_CATALOG, r, outcome === "wipe");
  return command.type === "choose-exit" && outcome === "extracted" ? { ...command, choice: "leave" as const } : command;
}
export async function playPoolPatrol(f: ReturnType<typeof poolTestRuntime>, runId: string, outcome: "extracted" | "cleared" | "wipe" = "extracted", onStep?: (r: PoolRecord) => void) {
  let r = await f.send({ type: "start-expedition", runId, routeId: "old-manor.maintenance", partyIds: AIRP_POOL_CATALOG.data.initialParty, itemIds: AIRP_POOL_CATALOG.data.journey!.defaultItems, seed: 19 });
  for (let step = 0; r.snapshot.run && step < 700; step++) { onStep?.(r); r = await f.send(poolPatrolCommand(r, outcome)); }
  if (r.snapshot.run || r.snapshot.campaign.settlements.at(-1)?.outcome !== outcome) throw Error(`Unexpected ${runId} outcome`);
  return r;
}
