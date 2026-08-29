import type {
  AtomicEffect,
  EffectResolution,
  EffectResolutionOptions
} from "../domain/effects";
import type {
  EffectDurationScope,
  ExpeditionState
} from "../domain/state";
import { resolveAtomicEffects } from "./resolver";

function durationMatches(
  durationScope: EffectDurationScope,
  boundary: EffectDurationScope
): boolean {
  if (durationScope === "next-round") return boundary === "round";
  return durationScope === boundary;
}

/** Advance status lifetimes at one explicit lifecycle boundary. */
export function advanceStatusDurations(
  state: ExpeditionState,
  boundary: EffectDurationScope,
  options: EffectResolutionOptions = {}
): EffectResolution {
  const effects: AtomicEffect[] = [];
  for (const [index, status] of state.statuses.entries()) {
    if (!status.duration || !durationMatches(status.duration.scope, boundary)) continue;
    const base = {
      id: `duration:${state.eventSequence}:${index}:${status.instanceId}`,
      source: { kind: "status" as const, instanceId: status.instanceId },
      causeId: null,
      batchId: `duration:${boundary}:${state.eventSequence}`,
      tags: ["duration"]
    };
    if (status.duration.remaining <= 1) {
      effects.push({
        ...base,
        type: "remove-status",
        instanceId: status.instanceId,
        reason: "expired"
      });
    } else {
      effects.push({
        ...base,
        type: "modify-status",
        instanceId: status.instanceId,
        durationDelta: -1
      });
    }
  }
  return resolveAtomicEffects(state, effects, options);
}
