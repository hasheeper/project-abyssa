import type { AnyGameRecord } from "./demo-contracts";
import type { AirpPoolInstance, AirpPoolState } from "../../game-core/contracts";
import { emptyAirpPool } from "../../game-core/session";

/** Only validated, safe-boundary ancestors reach this adapter. Historical source
 * identities are retained, never promoted into new run/objective evidence. */
export function inheritAirpPool(source: AnyGameRecord): AirpPoolState {
  const state = emptyAirpPool();
  if (source.schemaVersion !== 4 || !source.narrative) return state;
  const old = source.narrative;
  if (old.version === 2) {
    const copy = structuredClone(old); copy.reading = null; copy.lastBoundaryId = null;
    return copy;
  }
  const i = old.instance;
  if (!i || i.status !== "resolved" && i.status !== "closed") return state;
  const terminal: AirpPoolInstance = {
    id: i.id, definition: i.definition, createdPhase: i.createdPhase, offerUntilPhase: i.offerUntilPhase, actorIds: [...i.actorIds],
    status: i.status, variant: "initial", exposedPhase: i.exposedPhase,
    accepted: i.status === "resolved" ? { head: i.acceptedHead, factId: i.acceptedFactId, phase: i.acceptedPhase, stance: i.stance } : null,
    binding: null, carryFactId: null, proof: i.status === "resolved" ? i.proof : null,
    completionFactIds: i.status === "resolved" ? [...i.proof.sourceFactIds] : [], returnSceneId: i.status === "resolved" ? i.returnSceneId : null, targetSceneId: null,
    closedPhase: i.status === "closed" ? i.closedPhase : null, reason: i.status === "closed" ? i.reason : null,
    resolvedPhase: i.status === "resolved" ? i.resolvedPhase : null, receiptId: i.status === "resolved" ? i.receiptId : null, aftermathRead: false,
  };
  state.instances = [structuredClone(terminal)]; state.scenes = structuredClone(old.scenes);
  state.memories = structuredClone(old.memories); state.cooldowns = structuredClone(old.cooldowns);
  if (i.status === "closed" && i.reason === "reserved") state.reserve.push({ definition: i.definition, sourceInstanceId: i.id, eligiblePhase: (Math.floor(i.closedPhase / 4) + 1) * 4 });
  return state;
}
