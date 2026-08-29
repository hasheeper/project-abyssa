import type { BattleTransition } from "../domain/commands";
import type { BattleEvent } from "../domain/events";
import type { ExpeditionState } from "../domain/state";
import { canUndo } from "../selectors/battle-selectors";

/** Restore the complete checkpoint, including RNG cursors, then expose one undo event. */
export function performUndo(state: ExpeditionState): BattleTransition {
  if (!canUndo(state)) {
    return { state, events: [], error: "command-not-available" };
  }

  const stack = structuredClone(state.undoStack);
  const snapshot = stack.pop()!;
  const restored = {
    ...structuredClone(snapshot.state),
    undoStack: stack
  } as ExpeditionState;
  const commandId = [
    "command",
    restored.eventSequence,
    restored.layer,
    restored.round,
    restored.log.length,
    restored.undoStack.length,
    restored.enemySequence,
    "undo"
  ].join(":");
  const event: BattleEvent = {
    id: `event:${restored.eventSequence}`,
    type: "undo-applied",
    payload: { action: snapshot.action },
    source: { kind: "system", id: "undo" },
    causeId: commandId,
    batchId: commandId,
    sequence: 0
  };
  restored.eventSequence += 1;
  return { state: restored, events: [event], error: null };
}
