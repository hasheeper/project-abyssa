import { PARTY_ORDER } from "../content/characters";
import {
  FRENZY_ATTACK_BONUS,
  REROLLS_PER_ROUND
} from "../content/balance";
import type { BattleTransition } from "../domain/commands";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type { BattleEvent } from "../domain/events";
import type {
  CharacterId,
  EnemyKind,
  ExpeditionState,
  HandEvaluation,
  PreparedEnemyTurn,
  Rng
} from "../domain/state";
import {
  assessStalling,
  getEnemyTotalHp,
  isEnemyDefeated
} from "../selectors/battle-selectors";
import { evaluateHand } from "./hand";
import { resolveAtomicEffects } from "./resolver";
import {
  FRENZY_WARNING_DURATION,
  getEnemyFrenzyWarningStatus,
  hasEnemyFrenzyWarning,
  isEnemyFrenzied
} from "./frenzy-status";
import {
  FRENZY_ACTIVE_STATUS_ID,
  FRENZY_WARNING_STATUS_ID
} from "../content/effect-definitions";

const FRENZY_SELF_DAMAGE = 1;

function randomItem<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

export type PreparedEnemyTurnTransition = BattleTransition & {
  enemyOrder: string[];
  hand: HandEvaluation | null;
};

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function systemBase(
  state: ExpeditionState,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `prepare-enemy-turn:${state.eventSequence}:${state.layer}:${state.round}`;
  return {
    id: `${batchId}:${suffix}`,
    source: { kind: "system", id: "enemy-turn" },
    causeId: batchId,
    batchId,
    tags
  };
}

function enemyBase(
  state: ExpeditionState,
  enemyId: string,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `prepare-enemy-turn:${state.eventSequence}:${state.layer}:${state.round}`;
  return {
    id: `${batchId}:${enemyId}:${suffix}`,
    source: { kind: "enemy", id: enemyId },
    causeId: batchId,
    batchId,
    tags
  };
}

function systemLog(
  state: ExpeditionState,
  suffix: string,
  tone: Extract<AtomicEffect, { type: "append-log" }>["tone"],
  text: string
): AtomicEffect {
  return {
    ...systemBase(state, suffix),
    type: "append-log",
    tone,
    text
  };
}

function systemFact(
  state: ExpeditionState,
  suffix: string,
  text: string
): AtomicEffect {
  return {
    ...systemBase(state, suffix),
    type: "append-fact",
    text
  };
}

function enemyLog(
  state: ExpeditionState,
  enemyId: string,
  suffix: string,
  tone: Extract<AtomicEffect, { type: "append-log" }>["tone"],
  text: string
): AtomicEffect {
  return {
    ...enemyBase(state, enemyId, suffix),
    type: "append-log",
    tone,
    text
  };
}

function enemyFact(
  state: ExpeditionState,
  enemyId: string,
  suffix: string,
  text: string
): AtomicEffect {
  return {
    ...enemyBase(state, enemyId, suffix),
    type: "append-fact",
    text
  };
}

function getStallBehaviour(kind: EnemyKind): "frenzy" | "flee" {
  return kind === "summoner" || kind === "trap" || kind === "anomaly"
    ? "flee"
    : "frenzy";
}

function buildStallEffects(
  state: ExpeditionState
): { effects: AtomicEffect[]; fledIds: Set<string> } {
  const effects: AtomicEffect[] = [];
  const fledIds = new Set<string>();
  if (!assessStalling(state).stalling) return { effects, fledIds };

  let projectedGold = state.gold;
  for (const enemy of state.enemies) {
    if (isEnemyDefeated(enemy)) continue;

    if (getStallBehaviour(enemy.kind) === "flee") {
      const stolen = Math.round(projectedGold * 0.5);
      projectedGold = Math.max(0, projectedGold - stolen);
      fledIds.add(enemy.id);
      if (stolen > 0) {
        effects.push({
          ...enemyBase(state, enemy.id, "flee-loss", ["flee"]),
          type: "modify-resource",
          resource: "gold",
          operation: "add",
          value: -stolen,
          reason: "enemy-effect"
        });
      }
      effects.push(
        {
          ...enemyBase(state, enemy.id, "flee", ["flee"]),
          type: "flee-unit",
          enemyId: enemy.id
        },
        enemyLog(
          state,
          enemy.id,
          "flee-log",
          "bad",
          stolen > 0
            ? `${enemy.name}见势不妙逃走，顺走了 ${stolen}G 战利品。`
            : `${enemy.name}见势不妙逃走了。`
        ),
        enemyFact(
          state,
          enemy.id,
          "flee-fact",
          `${enemy.name}在残局中脱身，带走了一部分战利品。`
        )
      );
      continue;
    }

    if (
      !isEnemyFrenzied(state, enemy) &&
      !hasEnemyFrenzyWarning(state, enemy) &&
      enemy.attack > 0
    ) {
      effects.push(
        {
          ...enemyBase(state, enemy.id, "frenzy-warning-status", ["frenzy"]),
          type: "apply-status",
          target: { kind: "enemy", id: enemy.id },
          refresh: "replace",
          status: {
            instanceId: `frenzy-warning:${enemy.id}`,
            definitionId: FRENZY_WARNING_STATUS_ID,
            sourceId: enemy.id,
            stacks: 1,
            maxStacks: 1,
            duration: { scope: "round", remaining: FRENZY_WARNING_DURATION },
            tags: ["frenzy", "warning", "unremovable"],
            data: { enemyId: enemy.id }
          }
        },
        enemyLog(
          state,
          enemy.id,
          "frenzy-warning-log",
          "bad",
          `${enemy.name}显露狂暴预兆：两回合后爆发，当前公开意图伤害不变。`
        ),
        enemyFact(
          state,
          enemy.id,
          "frenzy-warning-fact",
          `${enemy.name}在被围困后显露狂暴预兆。`
        )
      );
    }
  }
  return { effects, fledIds };
}

/** Freeze the enemy queue and apply hand/stalling rules through atomic effects. */
export function prepareEnemyTurnTransition(
  state: ExpeditionState
): PreparedEnemyTurnTransition {
  if (state.mode.type !== "player-turn") {
    return {
      state,
      events: [],
      error: "command-not-available",
      enemyOrder: [],
      hand: null
    };
  }

  const hand = evaluateHand(state);
  const closingHand = hand.adjustedBonus > 0 ? hand : null;
  const multiplierAfter =
    hand.adjustedBonus > 0
      ? roundTwo(state.handMultiplier + hand.adjustedBonus)
      : state.handMultiplier;
  const enemyHpNow = getEnemyTotalHp(state);
  const stalledRounds =
    state.lastEnemyHp > 0 && enemyHpNow >= state.lastEnemyHp
      ? state.stalledRounds + 1
      : 0;
  const projected = { ...state, stalledRounds, lastEnemyHp: enemyHpNow };
  const stall = buildStallEffects(projected);
  const enemyOrder = state.enemies
    .filter(
      (enemy) =>
        !isEnemyDefeated(enemy) &&
        !stall.fledIds.has(enemy.id) &&
        enemy.intent !== null
    )
    .map((enemy) => enemy.id);

  const effects: AtomicEffect[] = [
    {
      ...systemBase(state, "prepare"),
      type: "prepare-enemy-turn",
      hand,
      multiplierBefore: state.handMultiplier,
      multiplierAfter,
      enemyOrder,
      closingHand
    }
  ];
  if (hand.adjustedBonus > 0) {
    effects.push(
      {
        ...systemBase(state, "hand-multiplier", ["hand"]),
        type: "modify-resource",
        resource: "hand-multiplier",
        operation: "set",
        value: multiplierAfter,
        reason: "effect"
      },
      systemLog(
        state,
        "hand-log",
        "purple",
        `点数构成【${hand.name}】，倍率 +${hand.adjustedBonus}` +
          (hand.qualityModifier !== 0
            ? `（品相修正 ${hand.qualityModifier > 0 ? "+" : ""}${hand.qualityModifier}）`
            : "") +
          `，当前累计 ×${(1 + multiplierAfter).toFixed(2)}。`
      )
    );
    if (hand.bonus >= 1.2) {
      effects.push(
        systemFact(
          state,
          "hand-fact",
          `远征中掷出罕见牌型【${hand.name}】，令战利品收益显著提高。`
        )
      );
    }
  }
  effects.push({
    ...systemBase(state, "stall-metrics"),
    type: "modify-battle-metrics",
    patch: { stalledRounds, lastEnemyHp: enemyHpNow }
  });
  effects.push(...stall.effects);

  const resolved = resolveAtomicEffects(state, effects);
  if (resolved.error) {
    return {
      state,
      events: [],
      error: "command-not-available",
      enemyOrder: [],
      hand: null
    };
  }
  return {
    state: resolved.state,
    events: resolved.events,
    error: null,
    enemyOrder,
    hand: closingHand
  };
}

/** Public facade wrapper for callers that consume the prepared queue directly. */
export function prepareEnemyTurn(state: ExpeditionState): PreparedEnemyTurn {
  const transition = prepareEnemyTurnTransition(state);
  if (transition.error) return { state, enemyOrder: [], hand: null };
  transition.state.eventSequence = state.eventSequence;
  return {
    state: transition.state,
    enemyOrder: transition.enemyOrder,
    hand: transition.hand
  };
}

/** Apply persistent frenzy recoil before the round outcome is settled. */
export function applyFrenzyRecoilTransition(
  state: ExpeditionState
): BattleTransition {
  if (state.mode.type !== "enemy-turn") {
    return { state, events: [], error: "command-not-available" };
  }
  const effects: AtomicEffect[] = [];
  for (const enemy of state.enemies) {
    if (isEnemyDefeated(enemy) || !isEnemyFrenzied(state, enemy)) continue;
    effects.push(
      {
        ...enemyBase(state, enemy.id, "frenzy-recoil", ["frenzy", "recoil"]),
        type: "damage",
        target: { kind: "enemy", id: enemy.id },
        amount: FRENZY_SELF_DAMAGE,
        defeat: {
          reason: "frenzy-recoil",
          reward: 0,
          deferLayerClear: true
        }
      },
      enemyLog(
        state,
        enemy.id,
        "frenzy-recoil-log",
        "bad",
        `${enemy.name}因狂暴自伤 ${FRENZY_SELF_DAMAGE} 点。`
      )
    );
    if (enemy.hp <= FRENZY_SELF_DAMAGE) {
      effects.push(
        enemyLog(
          state,
          enemy.id,
          "frenzy-collapse-log",
          "system",
          `${enemy.name}在狂暴中自我崩坏，未留下战利品。`
        ),
        enemyFact(
          state,
          enemy.id,
          "frenzy-collapse-fact",
          `${enemy.name}没被打死，是自己崩坏的。`
        )
      );
    }
  }

  const resolved = resolveAtomicEffects(state, effects);
  return resolved.error
    ? { state, events: [], error: "command-not-available" }
    : { state: resolved.state, events: resolved.events, error: null };
}

/** Increment the round and activate each previously scheduled frenzy exactly once. */
export function activateScheduledFrenzyForNextRoundTransition(
  state: ExpeditionState
): BattleTransition {
  if (state.mode.type !== "enemy-turn") {
    return { state, events: [], error: "command-not-available" };
  }
  const nextRound = state.round + 1;
  const effects: AtomicEffect[] = [
    {
      ...systemBase(state, "next-round"),
      type: "set-round",
      round: nextRound
    }
  ];
  for (const enemy of state.enemies) {
    const warning = getEnemyFrenzyWarningStatus(state, enemy.id);
    if (
      warning &&
      !isEnemyDefeated(enemy) &&
      warning.duration &&
      warning.duration.remaining > 1
    ) {
      effects.push({
        ...enemyBase(state, enemy.id, "frenzy-warning-tick", ["frenzy"]),
        type: "modify-status",
        instanceId: warning.instanceId,
        durationDelta: -1
      });
      continue;
    }
    if (
      isEnemyDefeated(enemy) ||
      isEnemyFrenzied(state, enemy) ||
      !warning
    ) {
      continue;
    }
    effects.push(
      ...(warning
        ? [{
            ...enemyBase(state, enemy.id, "frenzy-warning-remove", ["frenzy"]),
            type: "remove-status" as const,
            instanceId: warning.instanceId,
            reason: "effect" as const
          }]
        : []),
      {
        ...enemyBase(state, enemy.id, "frenzy-active-status", ["frenzy"]),
        type: "apply-status",
        target: { kind: "enemy", id: enemy.id },
        refresh: "replace",
        status: {
          instanceId: `frenzy-active:${enemy.id}`,
          definitionId: FRENZY_ACTIVE_STATUS_ID,
          sourceId: enemy.id,
          stacks: 1,
          maxStacks: 1,
          duration: null,
          tags: ["frenzy", "persistent", "unremovable"],
          data: { enemyId: enemy.id }
        }
      },
      {
        ...enemyBase(state, enemy.id, "frenzy-attack", ["frenzy"]),
        type: "modify-stat",
        target: { kind: "enemy", id: enemy.id },
        stat: "attack",
        operation: "add",
        value: FRENZY_ATTACK_BONUS
      },
      enemyLog(
        state,
        enemy.id,
        "frenzy-activate-log",
        "bad",
        `${enemy.name}进入狂暴，攻击大幅提升，但开始自我崩坏。`
      ),
      enemyFact(
        state,
        enemy.id,
        "frenzy-activate-fact",
        `${enemy.name}在两回合预警后陷入狂暴。`
      )
    );
  }

  const resolved = resolveAtomicEffects(state, effects);
  return resolved.error
    ? { state, events: [], error: "command-not-available" }
    : { state: resolved.state, events: resolved.events, error: null };
}

function buildEnemyIntentEffects(
  state: ExpeditionState,
  rng: Rng
): AtomicEffect[] {
  const targets = state.party.filter((member) => !member.downed);
  if (targets.length === 0) return [];
  const effects: AtomicEffect[] = [];

  for (const enemy of state.enemies) {
    if (isEnemyDefeated(enemy)) continue;
    let intent: NonNullable<typeof enemy.intent>;
    switch (enemy.kind) {
      case "brute": {
        const target = randomItem(targets, rng);
        intent = {
          type: "attack",
          targetId: target.id,
          value: enemy.attack,
          title: isEnemyFrenzied(state, enemy) ? "狂暴" : "攻击",
          description: `造成 ${enemy.attack} 点伤害`
        };
        break;
      }
      case "charger": {
        if (enemy.chargeReady) {
          const target = randomItem(targets, rng);
          intent = {
            type: "attack",
            targetId: target.id,
            value: enemy.attack,
            title: isEnemyFrenzied(state, enemy) ? "狂暴重击" : "蓄力重击",
            description: `造成 ${enemy.attack} 点伤害`
          };
        } else {
          intent = {
            type: "charge",
            title: "蓄积力量",
            description: `下回合发动 ${enemy.attack} 点重击`
          };
        }
        break;
      }
      case "anomaly": {
        const target = randomItem(targets, rng);
        intent = {
          type: "seal",
          targetId: target.id,
          title: "缠绕",
          description: "封锁其下一回合骰子"
        };
        break;
      }
      case "trap":
        intent = {
          type: "countdown",
          title: `倒计时 ${enemy.countdown}`,
          description:
            enemy.countdown <= 1
              ? "本回合结束时引爆"
              : "若不摧毁，倒计时继续减少"
        };
        break;
      case "summoner":
        intent = {
          type: "summon",
          title: "召唤",
          description: "回合结束时增加一只 2 血魔物"
        };
        break;
      default: {
        const exhaustive: never = enemy.kind;
        return exhaustive;
      }
    }
    effects.push({
      ...enemyBase(state, enemy.id, "publish-intent", ["intent"]),
      type: "modify-intent",
      enemyId: enemy.id,
      operation: "replace",
      intent
    });
  }
  return effects;
}

/** Reset round-scoped state and publish the next set of enemy intents. */
export function completeNextRoundAfterFrenzyTransition(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  if (state.mode.type !== "enemy-turn") {
    return { state, events: [], error: "command-not-available" };
  }
  const dice = PARTY_ORDER.map((ownerId) => {
    const member = state.party.find((candidate) => candidate.id === ownerId)!;
    return {
      ownerId,
      faceIndex: null,
      sealed: member.sealedNext,
      loaded: false,
      spent: false
    };
  });
  const effects: AtomicEffect[] = [
    {
      ...systemBase(state, "start-player-round"),
      type: "start-player-round",
      dice,
      rerollsRemaining: REROLLS_PER_ROUND
    },
    ...buildEnemyIntentEffects(state, rng)
  ];
  const resolved = resolveAtomicEffects(state, effects);
  return resolved.error
    ? { state, events: [], error: "command-not-available" }
    : { state: resolved.state, events: resolved.events, error: null };
}

function mergeTransitionEvents(
  first: readonly BattleEvent[],
  second: readonly BattleEvent[]
): BattleEvent[] {
  const events = first.map((event) => ({ ...event } as BattleEvent));
  for (const event of second) {
    events.push({ ...event, sequence: events.length } as BattleEvent);
  }
  return events;
}

/** Full next-round transition, including scheduled frenzy activation. */
export function beginNextRoundTransition(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  const activation = activateScheduledFrenzyForNextRoundTransition(state);
  if (activation.error) return activation;
  const started = completeNextRoundAfterFrenzyTransition(activation.state, rng);
  if (started.error) return { state, events: [], error: started.error };
  return {
    state: started.state,
    events: mergeTransitionEvents(activation.events, started.events),
    error: null
  };
}
