import type {
  BattleEvent,
  BattleEventPayloadMap,
  BattleEventType
} from "../../domain/events";
import type { ExpeditionState } from "../../domain/state";
import type { EffectSourceRef } from "../../domain/targets";

export interface ResolverEmitter {
  events: BattleEvent[];
  emit<TType extends BattleEventType>(
    type: TType,
    payload: BattleEventPayloadMap[TType],
    source: EffectSourceRef,
    causeId: string | null,
    batchId: string | null
  ): Extract<BattleEvent, { type: TType }> | null;
  failBudget(kind: "events" | "depth", limit: number, source: EffectSourceRef): void;
}

export function createResolverEmitter(
  state: ExpeditionState,
  maxEvents: number
): ResolverEmitter {
  const events: BattleEvent[] = [];
  const startSequence = state.eventSequence;
  let budgetFailed = false;

  const forceBudgetEvent = (
    kind: "events" | "depth",
    limit: number,
    source: EffectSourceRef
  ) => {
    if (budgetFailed || events.length >= maxEvents) return;
    budgetFailed = true;
    const sequence = events.length;
    events.push({
      id: `event:${startSequence + sequence}`,
      type: "resolution-budget-exceeded",
      payload: { kind, limit },
      source,
      causeId: null,
      batchId: null,
      sequence
    });
  };

  return {
    events,
    emit(type, payload, source, causeId, batchId) {
      /* Reserve the final slot for an explicit budget error. */
      if (events.length >= Math.max(0, maxEvents - 1)) {
        forceBudgetEvent("events", maxEvents, source);
        return null;
      }
      const sequence = events.length;
      const event = {
        id: `event:${startSequence + sequence}`,
        type,
        payload,
        source,
        causeId,
        batchId,
        sequence
      } as Extract<BattleEvent, { type: typeof type }>;
      events.push(event);
      return event;
    },
    failBudget: forceBudgetEvent
  };
}
