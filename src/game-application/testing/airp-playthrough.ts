import type { AnyGameRecord, AnyReceipt, D5GameRecord as BaseD5GameRecord, D5Command } from "../index";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { LOOP_CATALOG } from "../../game-runtime/loop-context";
import { AIRP_CATALOG } from "../../game-runtime/airp-context";
import { nextD5PlayCommand } from "./d5-playthrough";

export type FirstAirpRecord = BaseD5GameRecord & { narrative: import("../../game-core/contracts").AirpLiveState };
type D5GameRecord = FirstAirpRecord;

export function airpTestRuntime(source?: D5GameRecord) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  if (source) database.records.set(source.head.saveId, structuredClone(source));
  const store = new MemoryGameStore(database);
  let seq = Math.max(0, ...(source?.commits.map(c => Number(c.requestId.split(":").at(-1)) || 0) ?? []));
  const runtime = createPlayerRuntime(store, { newId: () => `airp-client:${++seq}`, newSeed: () => 19, close() {} });
  const read = async (id = "airp") => (await store.read(id)) as D5GameRecord;
  const send = async (command: D5Command, id = "airp") => {
    // Release the worker event loop between replay-heavy commands (Vitest RPC / browser fixtures).
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const r = await read(id);
    const result = await (command.type === "resume-run" ? runtime.application.resume : runtime.application.dispatch)({ protocolVersion: 4, saveId: id, expectedHead: r.head, clientRequestId: `airp-play:${++seq}`, command });
    if (!result.ok) throw Error(JSON.stringify({ command, result }));
    return read(id);
  };
  return { database, store, runtime, read, send };
}

/** Real first-clear commands, then a proven old-save upgrade. No edited HP or milestones. */
export async function firstAirpOffer() {
  const f = airpTestRuntime();
  const result = await f.runtime.application.create({ protocolVersion: 4, contentVersion: 3, profileId: LOOP_CATALOG.data.journey!.defaultProfileId, saveId: "before-airp", epoch: "origin", clientRequestId: "create" });
  if (!result.ok) throw Error(JSON.stringify(result));
  let r = await f.send({ type: "start-expedition", runId: "first-clear", routeId: "old-manor.first-clear", partyIds: LOOP_CATALOG.data.initialParty, itemIds: LOOP_CATALOG.data.journey!.defaultItems, seed: 19 }, "before-airp");
  for (let steps = 0; r.snapshot.run && steps < 1000; steps++) r = await f.send(nextD5PlayCommand(LOOP_CATALOG, r), "before-airp");
  if (r.snapshot.campaign.settlements.at(-1)?.outcome !== "cleared") throw Error("First clear failed");
  r = await f.send({ type: "acknowledge-story", terminalId: r.snapshot.campaign.manor.story!.terminalId, step: 0, choice: "skip" }, "before-airp");
  const upgrade = await f.runtime.application.continueSave({ sourceSaveId: r.head.saveId, expectedSourceHead: r.head, saveId: "airp", epoch: "airp-epoch", clientRequestId: "upgrade", kind: "upgrade", contentVersion: 8 });
  if (!upgrade.ok) throw Error(JSON.stringify(upgrade));
  return f;
}

export async function readAirpConversation(f: ReturnType<typeof airpTestRuntime>, option: "A" | "B" | "C" = "A") {
  for (let i = 0; i < 20; i++) {
    const r = await f.read(), n = r.narrative!, reading = n.reading;
    if (!reading || reading.completed || reading.paused) return r;
    const scene = n.scenes.find(s => s.id === reading.sceneId)!, node = scene.body.nodes[reading.node];
    await f.send(node.kind === "choice" ? { type: "airp-accept", instanceId: n.instance!.id, sceneId: scene.id, nodeId: node.id, optionId: option } : { type: "airp-read", instanceId: n.instance!.id, sceneId: scene.id, nodeId: node.id });
  }
  throw Error("Conversation did not finish");
}
export function airpPatrolCommand(r: D5GameRecord, outcome: "extracted" | "cleared" | "wipe" = "extracted") {
  const command = nextD5PlayCommand(AIRP_CATALOG, r, outcome === "wipe");
  return command.type === "choose-exit" && outcome === "extracted" ? { ...command, choice: "leave" as const } : command;
}
