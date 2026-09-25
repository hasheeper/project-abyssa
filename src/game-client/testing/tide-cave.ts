import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime, PLAYER_CATALOGS } from "../../game-runtime/player-runtime";
import { TIDE_CAVE_CATALOG } from "../../game-runtime/tide-cave-context";
import { tutorialNextOperation } from "../../game-core/session/testing/tutorial-driver";
import { g2Next } from "../../game-core/session/testing/tide-guided-g2";
import type { D5JourneyOperation } from "../../game-core/session/d5-journey-contracts";
import type { AnyGameRecord, AnyReceipt, D5GameRecord, D5Command } from "../../game-application";
import { GameSession } from "../session";

export function tideOperation(record: D5GameRecord) {
  const run = record.snapshot.run;
  const entry = PLAYER_CATALOGS.find(c => c.version === 4 && c.catalog.ref.digest === record.contentRef.digest);
  if (!entry || entry.version !== 4) throw Error("Missing tutorial catalog");
  return run?.kind === "expedition" ? entry.catalog.data.tutorial?.guide ? g2Next(entry.catalog, run.state) : tutorialNextOperation(entry.catalog, run.state, "tactical") : null;
}
/** Test-only adapter. Production UI never invokes the automatic test driver. */
export function tideCommand(op: D5JourneyOperation): Exclude<D5Command, {type:"resume-run"}> {
  const runRef = {kind:"expedition" as const,id:"tide-run"};
  switch (op.type) {
    case "resume": throw Error("GameSession must resume internally");
    case "battle": return op.command.type === "undo" ? {type:"undo",runRef} : {type:"battle-command",runRef,command:op.command};
    case "item": return {type:"use-item",runRef,instanceId:op.instanceId,target:op.target};
    case "advance": return {type:"advance-room",runRef,roomId:op.roomId};
    case "event": return {type:"choose-event",runRef,roomId:op.roomId,choiceId:op.choice,actorId:op.actorId};
    case "exit": return {type:"choose-exit",runRef,roomId:op.roomId,choice:op.choice};
    default: return {...op,runRef};
  }
}
/** All snapshots in tests originate from accepted application commands, including the authored opening. */
export async function tideClientFixture(contentVersion: 7 | 9 | 11 | 12 | 13 | 14 | "current" = 7) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let sequence = 0;
  const runtime = createPlayerRuntime(store, {newId: () => `tide-request-${++sequence}`, newSeed: () => 19, close() {}});
  // Unit regressions keep content7; browser closeout also exercises the player's current package.
  const created = await runtime.application.create({...runtime.defaultCreation, contentVersion: contentVersion === "current" ? runtime.defaultCreation.contentVersion : contentVersion, saveId: "tide-save", epoch: "epoch", clientRequestId: "create"});
  if (!created.ok) throw Error(created.error.message);
  const values = new Map<string, string>();
  const storage = {getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => {values.set(k, v);}, removeItem: (k: string) => {values.delete(k);}};
  const session = new GameSession(runtime, {saveId: "tide-save", epoch: "epoch", expeditionId: "tide-run"}, storage);
  await session.refresh();
  const send = async (command: Exclude<D5Command, {type: "resume-run"}>) => {
    const batch = await session.dispatch(command);
    if (!batch) throw Error(JSON.stringify(session.getSnapshot().error));
    return batch;
  };
  const archive = async () => {
    const result = await runtime.application.exportSave("tide-save");
    if (!result.ok) throw Error(result.error.message);
    return result.archive;
  };
  await send({type: "complete-prologue", shotId: "A1-01", choice: "skip"});
  let beforeDeparture = "";
  for (let step = 0; step <= TIDE_CAVE_CATALOG.data.opening!.lastStep; step++) {
    if (step === TIDE_CAVE_CATALOG.data.opening!.lastStep) beforeDeparture = await archive();
    await send({type: "advance-opening", step, choice: TIDE_CAVE_CATALOG.data.opening!.choiceSteps.includes(step) ? "A" : "continue"});
  }
  const afterMorning = await archive(), spec = TIDE_CAVE_CATALOG.data.tutorial!;
  const start = () => send({type: "start-expedition", runId: "tide-run", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
  return {runtime, currentContentVersion: runtime.defaultCreation.contentVersion, session, database, store, storage, send, archive, start, beforeDeparture, afterMorning};
}
