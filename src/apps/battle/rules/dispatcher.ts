import type {
  BattleCommand,
  BattleDispatchContext,
  BattleError,
  BattleTransition
} from "../domain/commands";
import type {
  BattleEvent,
  BattleEventPayloadMap,
  BattleEventType
} from "../domain/events";
import type {
  ExpeditionState,
  Rng,
  RngStreamName
} from "../domain/state";
import type { EffectSourceRef } from "../domain/targets";
import {
  advanceRngStream,
  createRngCursor,
  getTrackedRngSnapshot
} from "../persistence/rng";
import {
  performAttack,
  performBlock,
  performHeal,
  performSteal
} from "./actions";
import {
  performInitialRoll,
  performReroll,
  performToggleLoad
} from "./dice-actions";
import {
  getQueuedEnemyId,
  resolveEnemyIntentTransition
} from "./enemy-intents";
import {
  applyFrenzyRecoilTransition,
  beginNextRoundTransition,
  prepareEnemyTurnTransition
} from "./turns";
import {
  leaveExpeditionTransition,
  settleEnemyTurnTransition
} from "./settlement";
import { goDeeperTransition } from "./expedition";
import { performUndo } from "./undo";

export type {
  BattleCommand,
  BattleDispatchContext,
  BattleError,
  BattleTransition
} from "../domain/commands";
export type {
  BattleEvent,
  BattleEventEnvelope,
  BattleEventPayloadMap,
  BattleEventType
} from "../domain/events";
export type { BattleResource, EffectSourceRef, TargetRef } from "../domain/targets";

type EventEmitter = {
  events: BattleEvent[];
  commandId: string;
  startSequence: number;
  emit<TType extends BattleEventType>(
    type: TType,
    payload: BattleEventPayloadMap[TType],
    source: EffectSourceRef,
    causeId?: string | null,
    batchId?: string | null
  ): Extract<BattleEvent, { type: TType }>;
};

function createEventEmitter(state: ExpeditionState, command: BattleCommand): EventEmitter {
  const commandId = [
    "command",
    state.eventSequence,
    state.layer,
    state.round,
    state.log.length,
    state.undoStack.length,
    state.enemySequence,
    command.type
  ].join(":");
  const events: BattleEvent[] = [];

  return {
    events,
    commandId,
    startSequence: state.eventSequence,
    emit(type, payload, source, causeId = commandId, batchId = null) {
      const sequence = events.length;
      const event = {
        id: `event:${state.eventSequence + sequence}`,
        type,
        payload,
        source,
        causeId,
        batchId,
        sequence
      } as Extract<BattleEvent, { type: typeof type }>;
      events.push(event);
      return event;
    }
  };
}

function rejected(state: ExpeditionState, error: BattleError): BattleTransition {
  return { state, events: [], error };
}

function completed(state: ExpeditionState, emitter: EventEmitter): BattleTransition {
  state.eventSequence = emitter.startSequence + emitter.events.length;
  return { state, events: emitter.events, error: null };
}

function appendTransitionEvents(
  emitter: EventEmitter,
  transition: BattleTransition
) {
  for (const event of transition.events) {
    emitter.events.push({
      ...event,
      sequence: emitter.events.length
    } as BattleEvent);
  }
}

type CommandRng = {
  rng: Rng;
  commit: (state: ExpeditionState) => void;
};

function getRng(
  state: ExpeditionState,
  context: BattleDispatchContext,
  streamName: RngStreamName
): CommandRng {
  const external = context.rng;
  if (external) {
    let draws = 0;
    return {
      rng: () => {
        draws += 1;
        return external();
      },
      commit: (next) => {
        const tracked = getTrackedRngSnapshot(external);
        next.rng[streamName] =
          tracked ?? advanceRngStream(state.rng[streamName], draws);
      }
    };
  }

  const cursor = createRngCursor(state.rng[streamName]);
  return {
    rng: cursor.rng,
    commit: (next) => {
      next.rng[streamName] = cursor.snapshot();
    }
  };
}

function dispatchSteal(
  state: ExpeditionState,
  command: Extract<BattleCommand, { type: "steal-from" }>,
  context: BattleDispatchContext
): BattleTransition {
  const random = getRng(state, context, "flavor");
  const result = performSteal(state, command.actorId, command.enemyId, random.rng);
  if (result.error) return rejected(state, result.error);
  random.commit(result.state);
  return result;
}

function resolveQueuedEnemy(
  state: ExpeditionState,
  emitter: EventEmitter
): ExpeditionState | null {
  const enemyId = getQueuedEnemyId(state);
  if (!enemyId) return null;
  state.eventSequence = emitter.startSequence + emitter.events.length;
  const transition = resolveEnemyIntentTransition(state, enemyId);
  if (transition.error) return null;
  appendTransitionEvents(emitter, transition);
  return transition.state;
}

function dispatchEndTurn(
  state: ExpeditionState,
  command: Extract<BattleCommand, { type: "end-turn" }>,
  context: BattleDispatchContext
): BattleTransition {
  if (state.mode.type !== "player-turn") {
    return rejected(state, "command-not-available");
  }
  const random = getRng(state, context, "loot");

  const emitter = createEventEmitter(state, command);
  const prepared = prepareEnemyTurnTransition(state);
  if (prepared.error) return rejected(state, prepared.error);
  appendTransitionEvents(emitter, prepared);

  let next = prepared.state;
  while (
    next.mode.type === "enemy-turn" &&
    next.mode.cursor < next.mode.enemyOrder.length
  ) {
    const resolved = resolveQueuedEnemy(next, emitter);
    if (!resolved) break;
    next = resolved;
  }

  const closingHand =
    next.mode.type === "enemy-turn" ? next.mode.closingHand : prepared.hand;
  const recoil = applyFrenzyRecoilTransition(next);
  if (recoil.error) return rejected(state, recoil.error);
  appendTransitionEvents(emitter, recoil);
  const finished = settleEnemyTurnTransition(
    recoil.state,
    random.rng,
    closingHand
  );
  if (finished.error) return rejected(state, finished.error);
  appendTransitionEvents(emitter, finished);
  next = finished.state;
  random.commit(next);
  return completed(next, emitter);
}

/** Single authoritative command gateway for Battle state changes. */
export function dispatchBattleCommand(
  state: ExpeditionState,
  command: BattleCommand,
  context: BattleDispatchContext = {}
): BattleTransition {
  switch (command.type) {
    case "roll-dice": {
      const random = getRng(state, context, "combat");
      const transition = performInitialRoll(state, random.rng);
      if (transition.error) return transition;
      random.commit(transition.state);
      return transition;
    }

    case "reroll-dice": {
      const random = getRng(state, context, "combat");
      const transition = performReroll(state, random.rng);
      if (transition.error) return transition;
      random.commit(transition.state);
      return transition;
    }

    case "toggle-load": {
      return performToggleLoad(state, command.dieIndex);
    }

    case "attack-enemy":
      return performAttack(state, command.actorId, command.enemyId);
    case "block-intent":
      return performBlock(state, command.actorId, command.enemyId);
    case "heal-member":
      return performHeal(state, command.actorId, command.targetId);
    case "steal-from":
      return dispatchSteal(state, command, context);

    case "undo": {
      return performUndo(state);
    }

    case "end-turn":
      return dispatchEndTurn(state, command, context);

    case "begin-enemy-turn": {
      return prepareEnemyTurnTransition(state);
    }

    case "resolve-next-enemy": {
      const enemyId = getQueuedEnemyId(state);
      return enemyId
        ? resolveEnemyIntentTransition(state, enemyId)
        : rejected(state, "command-not-available");
    }

    case "finish-enemy-turn": {
      if (
        state.mode.type !== "enemy-turn" ||
        state.mode.cursor < state.mode.enemyOrder.length
      ) {
        return rejected(state, "command-not-available");
      }
      const random = getRng(state, context, "loot");
      const emitter = createEventEmitter(state, command);
      const recoil = applyFrenzyRecoilTransition(state);
      if (recoil.error) return rejected(state, recoil.error);
      appendTransitionEvents(emitter, recoil);
      const finished = settleEnemyTurnTransition(
        recoil.state,
        random.rng,
        state.mode.closingHand
      );
      if (finished.error) return rejected(state, finished.error);
      appendTransitionEvents(emitter, finished);
      random.commit(finished.state);
      return completed(finished.state, emitter);
    }

    case "next-round": {
      const random = getRng(state, context, "combat");
      const transition = beginNextRoundTransition(state, random.rng);
      if (transition.error) return transition;
      random.commit(transition.state);
      return transition;
    }

    case "go-deeper": {
      const random = getRng(state, context, "combat");
      const transition = goDeeperTransition(state, random.rng);
      if (transition.error) return transition;
      random.commit(transition.state);
      return transition;
    }

    case "leave-expedition": {
      const random = getRng(state, context, "loot");
      const transition = leaveExpeditionTransition(state, random.rng);
      if (transition.error) return transition;
      random.commit(transition.state);
      return transition;
    }
  }

  const exhaustive: never = command;
  return exhaustive;
}
