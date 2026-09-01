import type {
  AtomicEffect,
  EffectResolution,
  EffectResolutionError,
  EffectResolutionOptions
} from "../domain/effects";
import type { ExpeditionState } from "../domain/state";
import { cloneBattleState } from "../persistence/clone";
import { mergeEffectResolutionOptions } from "./effect-runtime";
import { collectEventReactions } from "./reactions";
import { applyAtomicEffect } from "./resolver/apply-effect";
import { createResolverEmitter } from "./resolver/emitter";

export { targetRefKey } from "./resolver/targets";

export const DEFAULT_EFFECT_EVENT_BUDGET = 256;
export const DEFAULT_EFFECT_DEPTH_LIMIT = 8;

interface QueuedEffect {
  effect: AtomicEffect;
  depth: number;
}

/** Resolve a deterministic batch of serializable atomic effects and reactions. */
export function resolveAtomicEffects(
  input: ExpeditionState,
  effects: readonly AtomicEffect[],
  options: EffectResolutionOptions = {}
): EffectResolution {
  if (
    effects.length === 0 &&
    input.pendingEffects.length === 0 &&
    input.pendingReactions.length === 0
  ) {
    return { state: input, events: [], error: null };
  }

  const state = cloneBattleState(input);
  const effectiveOptions = mergeEffectResolutionOptions(input, options);
  const maxEvents = Math.max(
    1,
    effectiveOptions.maxEvents ?? DEFAULT_EFFECT_EVENT_BUDGET
  );
  const maxDepth = Math.max(
    0,
    effectiveOptions.maxDepth ?? DEFAULT_EFFECT_DEPTH_LIMIT
  );
  const emitter = createResolverEmitter(state, maxEvents);
  const queue: QueuedEffect[] = effects.map((effect) => ({ effect, depth: 0 }));
  const reacted = new Set<string>();
  let eventCursor = 0;
  let error: EffectResolutionError | null = null;

  /* Resolution is synchronous and atomic; no partially rewritten queue is observable. */
  state.pendingEffects = [];
  state.pendingReactions = [];

  while (queue.length > 0 && !error) {
    const current = queue.shift()!;
    if (current.depth > maxDepth) {
      emitter.failBudget("depth", maxDepth, current.effect.source);
      error = "trigger-depth-exceeded";
      break;
    }

    error = applyAtomicEffect(state, current.effect, emitter, effectiveOptions);
    if (error) break;

    while (eventCursor < emitter.events.length && !error) {
      const event = emitter.events[eventCursor++]!;
      if (event.type === "resolution-budget-exceeded") {
        error = "event-budget-exceeded";
        break;
      }
      const reactions = collectEventReactions(
        state,
        event,
        effectiveOptions.reactions ?? [],
        effectiveOptions.reactionRegistry ?? {},
        reacted
      );
      if (reactions.error) {
        error = reactions.error;
        emitter.emit(
          "resolution-failed",
          { error, effectId: current.effect.id },
          current.effect.source,
          event.id,
          current.effect.batchId
        );
        break;
      }
      if (reactions.effects.length === 0) continue;
      const nextDepth = current.depth + 1;
      if (nextDepth > maxDepth) {
        emitter.failBudget("depth", maxDepth, current.effect.source);
        error = "trigger-depth-exceeded";
        break;
      }
      const queued = reactions.effects.map((effect) => ({ effect, depth: nextDepth }));
      queue.push(...queued);
    }
  }

  if (error && !emitter.events.some((event) => event.type.includes("resolution-"))) {
    emitter.emit(
      "resolution-failed",
      { error, effectId: queue[0]?.effect.id ?? null },
      { kind: "system", id: "resolver" },
      null,
      null
    );
  }
  state.pendingEffects = [];
  state.pendingReactions = [];
  state.eventSequence = input.eventSequence + emitter.events.length;
  return { state, events: emitter.events, error };
}

/** Commit one player command and its complete reaction chain as one undo checkpoint. */
export function resolveEffectsCommand(
  input: ExpeditionState,
  actionLabel: string,
  effects: readonly AtomicEffect[],
  options: EffectResolutionOptions = {}
): EffectResolution {
  const resolution = resolveAtomicEffects(input, effects, options);
  if (resolution.error) return resolution;
  const cloned = cloneBattleState(input);
  const { undoStack: _undoStack, ...checkpointState } = cloned;
  resolution.state.undoStack = [
    ...input.undoStack,
    { action: actionLabel, state: checkpointState }
  ];
  return resolution;
}
