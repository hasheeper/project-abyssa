import type {
  AtomicEffect,
  EffectResolutionError,
  ReactionBinding,
  ReactionRegistry
} from "../domain/effects";
import type { BattleEvent } from "../domain/events";
import type { ExpeditionState } from "../domain/state";

export function compareReactionBindings(
  left: Pick<ReactionBinding, "priority" | "sourceId" | "instanceId">,
  right: Pick<ReactionBinding, "priority" | "sourceId" | "instanceId">
): number {
  return (
    left.priority - right.priority ||
    left.sourceId.localeCompare(right.sourceId) ||
    left.instanceId.localeCompare(right.instanceId)
  );
}

export type CollectedReactions = {
  effects: AtomicEffect[];
  error: EffectResolutionError | null;
};

/** Collect each binding at most once for one event, in stable source order. */
export function collectEventReactions(
  state: ExpeditionState,
  event: BattleEvent,
  bindings: readonly ReactionBinding[],
  registry: ReactionRegistry,
  reacted: Set<string>
): CollectedReactions {
  const effects: AtomicEffect[] = [];
  const ordered = bindings
    .filter((binding) => binding.eventTypes.includes(event.type));
  ordered.sort(compareReactionBindings);

  for (const binding of ordered) {
    const reactionKey = `${event.id}:${binding.instanceId}`;
    if (reacted.has(reactionKey)) continue;
    reacted.add(reactionKey);

    const handler = registry[binding.definitionId];
    if (!handler) return { effects, error: "missing-reaction-handler" };
    for (const effect of handler({ state, event, binding })) {
      effects.push({
        ...effect,
        causeId: effect.causeId ?? event.id,
        batchId: effect.batchId ?? event.batchId
      });
    }
  }
  return { effects, error: null };
}
