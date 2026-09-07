import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";

export type ManorEventRoll = {
  actorId: string;
  faceIndex: number;
  phase: "rolling" | "checking" | "outcome";
};

/** Locate the face already decided by core. Never roll or re-evaluate an event here. */
export function manorEventDie(view: DemoJourneyView) {
  const result = view.lastEvent;
  if (result?.choiceId !== "attempt" || !result.actorId || !result.faceId) return null;
  const actor = view.party.find(m => m.id === result.actorId);
  const faceIndex = actor?.faces.findIndex(f => f.id === result.faceId) ?? -1;
  return actor && faceIndex >= 0 ? {actorId: actor.id, faceIndex} : null;
}
