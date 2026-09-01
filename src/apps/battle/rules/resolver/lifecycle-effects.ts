import type { AtomicEffect, EffectResolutionError } from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import { isEnemyDefeated } from "../../selectors/battle-selectors";
import type { ResolverEmitter } from "./emitter";
import { removeStatusesForTarget } from "./state-helpers";

type LifecycleEffect = Extract<
  AtomicEffect,
  {
    type:
      | "declare-action"
      | "complete-action"
      | "complete-enemy-intent"
      | "prepare-enemy-turn"
      | "append-log"
      | "append-fact"
      | "modify-enemy"
      | "modify-battle-metrics"
      | "set-round"
      | "start-player-round"
      | "record-layer-settlement"
      | "enter-greed"
      | "finish-expedition"
      | "finalize-round"
      | "start-layer"
      | "announce-layer-started"
      | "modify-intent"
      | "spawn-unit"
      | "despawn-unit"
      | "flee-unit";
  }
>;

export function applyLifecycleEffect(
  state: ExpeditionState,
  effect: LifecycleEffect,
  emitter: ResolverEmitter
): EffectResolutionError | null {
  switch (effect.type) {
    case "declare-action":
    case "complete-action":
      emitter.emit(
        effect.type === "declare-action" ? "action-declared" : "action-resolved",
        { actorId: effect.actorId, verb: effect.verb, target: effect.target },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "complete-enemy-intent": {
      if (state.mode.type !== "enemy-turn") return "invalid-effect-target";
      const resolvedIndex = state.mode.enemyOrder.indexOf(effect.event.enemyId);
      if (resolvedIndex >= 0) {
        state.mode.cursor = Math.max(state.mode.cursor, resolvedIndex + 1);
      }
      emitter.emit(
        "enemy-intent-resolved",
        effect.event,
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "prepare-enemy-turn": {
      if (state.mode.type !== "player-turn") return "invalid-effect-target";
      Object.assign(state, {
        mode: {
          type: "enemy-turn",
          enemyOrder: [...effect.enemyOrder],
          cursor: 0,
          closingHand: structuredClone(effect.closingHand),
          outcome: null
        },
        result: null
      });
      state.undoStack = [];
      const evaluated = emitter.emit(
        "hand-evaluated",
        {
          hand: effect.hand,
          multiplierBefore: effect.multiplierBefore,
          multiplierAfter: effect.multiplierAfter
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      emitter.emit(
        "enemy-turn-prepared",
        { enemyOrder: [...effect.enemyOrder] },
        effect.source,
        evaluated?.id ?? effect.causeId,
        effect.batchId
      );
      break;
    }

    case "append-log":
      state.log.push({
        round: state.round,
        layer: state.layer,
        tone: effect.tone,
        text: effect.text
      });
      break;

    case "append-fact":
      if (!state.facts.includes(effect.text)) state.facts.push(effect.text);
      break;

    case "modify-enemy": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy) return "invalid-effect-target";
      const wasDefeated = isEnemyDefeated(enemy);
      Object.assign(enemy, effect.patch);
      if (!wasDefeated && effect.defeat) {
        enemy.hp = 0;
        enemy.intent = null;
        removeStatusesForTarget(
          state,
          `enemy:${enemy.id}`,
          emitter,
          effect,
          "expired"
        );
        emitter.emit(
          "unit-defeated",
          {
            target: { kind: "enemy", id: enemy.id },
            reason: effect.defeat.reason,
            reward: effect.defeat.reward
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "modify-battle-metrics":
      Object.assign(state, effect.patch);
      break;

    case "set-round":
      state.round = Math.max(0, Math.trunc(effect.round));
      break;

    case "start-player-round":
      if (state.mode.type !== "enemy-turn") return "invalid-effect-target";
      Object.assign(state, {
        mode: { type: "awaiting-roll" },
        result: null
      });
      state.rerollsRemaining = Math.max(0, effect.rerollsRemaining);
      state.lastTossed = [];
      state.dice = structuredClone(effect.dice);
      state.undoStack = [];
      for (const member of state.party) {
        member.sealedNext = false;
        member.shield = 0;
      }
      for (const enemy of state.enemies) {
        enemy.blocked = 0;
        if (isEnemyDefeated(enemy)) enemy.intent = null;
      }
      emitter.emit(
        "round-started",
        { round: state.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "record-layer-settlement":
      state.lastLayerSettlement = structuredClone(effect.settlement);
      break;

    case "enter-greed":
      Object.assign(state, {
        mode: { type: "greed" },
        result: null
      });
      break;

    case "finish-expedition":
      Object.assign(state, {
        mode: { type: "finished" },
        result: structuredClone(effect.result)
      });
      state.undoStack = [];
      if (effect.announce) {
        emitter.emit(
          "expedition-finished",
          { result: effect.result },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;

    case "finalize-round":
      if (state.mode.type === "enemy-turn") state.mode.outcome = effect.outcome;
      if (effect.outcome === "layer-cleared") {
        emitter.emit(
          "layer-cleared",
          { layer: state.layer, settlement: structuredClone(effect.settlement) },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      emitter.emit(
        "round-resolved",
        { outcome: effect.outcome, round: state.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (state.mode.type === "finished" && state.result) {
        emitter.emit(
          "expedition-finished",
          { result: state.result },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;

    case "start-layer":
      Object.assign(state, {
        layer: effect.layer,
        deepestLayer: effect.deepestLayer,
        round: 0,
        layerStartEnemies: effect.enemies.length,
        lastTossed: [],
        stalledRounds: 0,
        lastEnemyHp: 0,
        lastLayerSettlement: null,
        enemies: structuredClone(effect.enemies),
        enemySequence: effect.enemySequence,
        mode: {
          type: "enemy-turn",
          enemyOrder: [],
          cursor: 0,
          closingHand: null,
          outcome: null
        },
        result: null
      });
      break;

    case "announce-layer-started":
      emitter.emit(
        "layer-started",
        { layer: effect.layer, round: effect.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "modify-intent": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      const operation = effect.operation;
      switch (operation) {
        case "replace":
          if (!effect.intent) return "invalid-effect-target";
          enemy.intent = structuredClone(effect.intent);
          break;
        case "cancel":
          enemy.intent = null;
          break;
        case "add-block":
          if (enemy.intent?.type !== "attack") return "invalid-effect-target";
          enemy.blocked += Math.max(0, effect.amount ?? 0);
          break;
        case "retarget":
          if (enemy.intent?.type !== "attack" && enemy.intent?.type !== "seal") {
            return "invalid-effect-target";
          }
          if (!effect.targetId) return "invalid-effect-target";
          enemy.intent.targetId = effect.targetId;
          break;
        default: {
          const exhaustive: never = operation;
          return exhaustive;
        }
      }
      emitter.emit(
        "intent-modified",
        { enemyId: enemy.id, operation: effect.operation },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "spawn-unit":
      if (state.enemies.some((enemy) => enemy.id === effect.unit.id)) {
        return "invalid-effect-target";
      }
      state.enemies.push(structuredClone(effect.unit));
      if (effect.enemySequence !== undefined) {
        state.enemySequence = Math.max(state.enemySequence, effect.enemySequence);
      }
      emitter.emit(
        "unit-spawned",
        { enemyId: effect.unit.id },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "despawn-unit": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      enemy.hp = 0;
      enemy.intent = null;
      removeStatusesForTarget(state, `enemy:${enemy.id}`, emitter, effect, "expired");
      emitter.emit(
        "unit-despawned",
        { enemyId: enemy.id, reason: effect.reason },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (state.enemies.every(isEnemyDefeated)) {
        emitter.emit(
          "layer-cleared",
          { layer: state.layer, settlement: null },
          { kind: "system", id: "lifecycle" },
          effect.id,
          effect.batchId
        );
      }
      break;
    }

    case "flee-unit": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      enemy.hp = 0;
      enemy.intent = null;
      removeStatusesForTarget(state, `enemy:${enemy.id}`, emitter, effect, "expired");
      emitter.emit(
        "unit-despawned",
        { enemyId: enemy.id, reason: "fled" },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
  return null;
}
