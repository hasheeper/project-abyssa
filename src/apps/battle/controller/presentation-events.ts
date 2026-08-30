import type { BattleEvent } from "../domain/events";
import type { CharacterId, EnemyTurnEvent } from "../domain/state";

export type PlayerAttackCue = {
  actorId: CharacterId;
  targetId: string;
  damage: number;
  lethal: boolean;
};

export type PlayerSupportCue =
  | {
      kind: "guard";
      actorId: CharacterId;
      targetId: CharacterId;
      amount: number;
    }
  | {
      kind: "heal";
      actorId: CharacterId;
      targetId: CharacterId;
      amount: number;
    };

export type PresentationEventBatch<TEvent extends BattleEvent = BattleEvent> = {
  batchId: string | null;
  events: TEvent[];
};

/**
 * Preserve domain sequence between batches while allowing every event carrying the
 * same batch id (for example, AOE hits) to be presented together. Unbatched events
 * remain independent presentation steps.
 */
export function groupPresentationEventsByBatch<TEvent extends BattleEvent>(
  events: readonly TEvent[]
): PresentationEventBatch<TEvent>[] {
  const groups: PresentationEventBatch<TEvent>[] = [];
  const batchIndexes = new Map<string, number>();

  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.batchId === null) {
      groups.push({ batchId: null, events: [event] });
      continue;
    }

    const existingIndex = batchIndexes.get(event.batchId);
    if (existingIndex === undefined) {
      batchIndexes.set(event.batchId, groups.length);
      groups.push({ batchId: event.batchId, events: [event] });
    } else {
      groups[existingIndex]!.events.push(event);
    }
  }

  return groups;
}

export function getPlayerAttackCue(
  events: readonly BattleEvent[]
): PlayerAttackCue | null {
  const damage = events.find(
    (event): event is Extract<BattleEvent, { type: "damage-applied" }> =>
      event.type === "damage-applied" &&
      event.payload.target.kind === "enemy" &&
      event.source.kind === "die"
  );
  if (!damage || damage.source.kind !== "die" || damage.payload.target.kind !== "enemy") {
    return null;
  }
  return {
    actorId: damage.source.ownerId,
    targetId: damage.payload.target.id,
    damage: damage.payload.raw,
    lethal: damage.payload.lethal
  };
}

export function getPlayerSupportCue(
  events: readonly BattleEvent[]
): PlayerSupportCue | null {
  const guard = events.find(
    (event): event is Extract<BattleEvent, { type: "guard-applied" }> =>
      event.type === "guard-applied"
  );
  if (guard) {
    return {
      kind: "guard",
      actorId: guard.payload.actorId,
      targetId: guard.payload.protectedId,
      amount: guard.payload.amount
    };
  }
  const healing = events.find(
    (event): event is Extract<BattleEvent, { type: "healing-applied" }> =>
      event.type === "healing-applied"
  );
  return healing
    ? {
        kind: "heal",
        actorId: healing.payload.actorId,
        targetId: healing.payload.targetId,
        amount: healing.payload.applied
      }
    : null;
}

export function getEnemyTurnCue(
  events: readonly BattleEvent[]
): EnemyTurnEvent | null {
  const resolved = events.find(
    (event): event is Extract<BattleEvent, { type: "enemy-intent-resolved" }> =>
      event.type === "enemy-intent-resolved"
  );
  return resolved?.payload ?? null;
}
