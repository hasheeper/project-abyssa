import { createBattleEngine, type BattleState } from "../game-core/battle";
import { activeExecution } from "../game-core/session";
import { canonicalJson, sha256 } from "../game-core/contracts";
import { projectPlayerHistory, type GameRecord, type CommandRequest, type GameCommand } from "../game-application";
import { LEGACY_VALIDATED_CATALOG as catalog } from "./legacy-context";

export const gameContent = catalog.data;
export const gameContentRef = catalog.ref;
export function battleState(record: import("../game-application").AnyGameRecord): BattleState {
  if (record.schemaVersion !== 1) throw new Error("Legacy battle projection requires schema 1");
  return createBattleEngine(catalog, record.snapshot.expedition!.routeId).restore(activeExecution(record.snapshot));
}
export function continuation(record: GameRecord): CommandRequest | null {
  const expedition = record.snapshot.expedition;
  if (!expedition || expedition.lifecycle.type !== "in-encounter") return null;
  const state = battleState(record);
  let command: GameCommand | null = null;
  if (state.mode.type === "enemy-turn") {
    if (state.mode.outcome === null) command = { type: "resume-enemy-turn", expeditionId: expedition.id };
    else if (state.mode.outcome === "continue") command = { type: "battle-command", expeditionId: expedition.id, command: { type: "next-round" } };
  } else if (state.mode.type === "player-turn" && createBattleEngine(catalog, expedition.routeId).select(state).outcome === "layer-cleared") {
    command = { type: "battle-command", expeditionId: expedition.id, command: { type: "end-turn" } };
  }
  return command ? { protocolVersion: 1, saveId: record.head.saveId, expectedHead: record.head,
    clientRequestId: `resume:${sha256(canonicalJson([record.head, command]))}`, command } : null;
}
export const playerHistory = projectPlayerHistory;
export { parseCommandRequest } from "../game-application/parse";
export { sameHead } from "../game-application/transaction";
export type { GameRecord, HeadRef, GameCommand, CommandRequest, CommandReceipt, ApplicationResult, ReceiptError, SaveListEntry, GameFact } from "../game-application";
