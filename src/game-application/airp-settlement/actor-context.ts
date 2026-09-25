import type { SettlementActorState } from "../../game-core/contracts";
import { projectSettlementActorState } from "../../game-core/session";
import type { D5Fact } from "../versions/d5-contracts";

/** Read-only current view. Original narrative assessments and frozen frames remain unchanged. */
export function currentSettlementActors(actors: readonly SettlementActorState[], phase: number, effectiveFacts: readonly D5Fact[]) {
  const locations = new Map<string, number>(), returns = new Map<string, number>();
  for (const f of effectiveFacts) {
    if (f.kind === "airp-game" && f.payload.settlement) for (const id of f.payload.settlement.locationActorIds) locations.set(id, f.source.revision);
    if (f.kind === "progression" && f.payload.type === "expedition-settled") for (const member of f.payload.finalRun.run.party) returns.set(member.id, f.source.revision);
  }
  return actors.map(a => {
    const current = projectSettlementActorState(a, phase);
    // Actual return supersedes only this participant's earlier narrative location.
    // Null falls back to the current program schedule; it does not invent a return room.
    if ((returns.get(a.actorId) ?? -1) > (locations.get(a.actorId) ?? -1)) current.locationId = null;
    return current;
  });
}
