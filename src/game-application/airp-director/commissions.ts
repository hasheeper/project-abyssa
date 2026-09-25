import type { DirectorEvent } from "./contracts";

/** Only a single-path patrol is fully determined by accepting the offer. */
export function singlePathPatrol(e: DirectorEvent) {
  const action = e.card.actions[e.actionIndex];
  return e.card.actions.length === 1 && e.actionIndex === 0 && action?.kind === "patrol" && action.choices.length === 1;
}

/** Reading role and executable registration are independent after the explicit upgrade. */
export function registeredPatrol(e: DirectorEvent) {
  return e.actionPhase !== null && e.card.actions[e.actionIndex]?.kind === "patrol" &&
    (e.status === "waiting-action" && e.role === "action" || e.status === "accepted" && e.role === "acceptance" && singlePathPatrol(e));
}
