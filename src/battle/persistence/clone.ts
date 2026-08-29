import type { ExpeditionState } from "../domain/state";

/**
 * Clone canonical Battle state through its persistence representation.
 *
 * Battle state is deliberately JSON-only. Keeping this helper state-specific makes
 * that precondition explicit and avoids the slower generic structured-clone path in
 * the synchronous effect resolver.
 */
export function cloneBattleState(state: ExpeditionState): ExpeditionState {
  return JSON.parse(JSON.stringify(state)) as ExpeditionState;
}
