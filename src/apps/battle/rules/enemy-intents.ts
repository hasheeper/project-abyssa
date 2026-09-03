import { DOWNED_RETURN_HP } from "../content/balance";
import { CHARACTERS } from "../content/characters";
import { makeEnemy } from "../content/enemies";
import type { BattleError, BattleTransition } from "../domain/commands";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type {
  EnemyIntent,
  EnemyState,
  EnemyTurnEvent,
  EnemyTurnStep,
  ExpeditionState
} from "../domain/state";
import { getRustableFaceCapacity } from "./dice";
import { resolveAtomicEffects } from "./resolver";
import { isEnemyDefeated } from "../selectors/battle-selectors";

type EnemyIntentTransition = BattleTransition & {
  enemyEvent: EnemyTurnEvent | null;
};

function fail(
  state: ExpeditionState,
  error: BattleError = "command-not-available"
): EnemyIntentTransition {
  return { state, events: [], error, enemyEvent: null };
}

function effectBase(
  state: ExpeditionState,
  enemy: EnemyState,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `enemy-intent:${state.eventSequence}:${enemy.id}`;
  return {
    id: `${batchId}:${suffix}`,
    source: { kind: "enemy", id: enemy.id },
    causeId: batchId,
    batchId,
    tags
  };
}

function makeEnemyTurnEvent(
  enemy: EnemyState,
  intent: EnemyIntent,
  details: Pick<
    EnemyTurnEvent,
    "result" | "damage" | "hpBefore" | "hpAfter" | "lethal"
  >
): EnemyTurnEvent {
  return {
    enemyId: enemy.id,
    enemyName: enemy.name,
    intentType: intent.type,
    intent: structuredClone(intent),
    title: intent.title,
    ...("targetId" in intent ? { targetId: intent.targetId } : {}),
    ...details
  };
}

function eventEffect(
  state: ExpeditionState,
  enemy: EnemyState,
  event: EnemyTurnEvent
): AtomicEffect {
  return {
    ...effectBase(state, enemy, "resolved"),
    type: "complete-enemy-intent",
    event
  };
}

function logEffect(
  state: ExpeditionState,
  enemy: EnemyState,
  suffix: string,
  tone: Extract<AtomicEffect, { type: "append-log" }>["tone"],
  text: string
): AtomicEffect {
  return {
    ...effectBase(state, enemy, suffix),
    type: "append-log",
    tone,
    text
  };
}

function factEffect(
  state: ExpeditionState,
  enemy: EnemyState,
  suffix: string,
  text: string
): AtomicEffect {
  return {
    ...effectBase(state, enemy, suffix),
    type: "append-fact",
    text
  };
}

function cancelIntentEffect(
  state: ExpeditionState,
  enemy: EnemyState
): AtomicEffect {
  return {
    ...effectBase(state, enemy, "cancel-intent"),
    type: "modify-intent",
    enemyId: enemy.id,
    operation: "cancel"
  };
}

function enemyPatchEffect(
  state: ExpeditionState,
  enemy: EnemyState,
  suffix: string,
  patch: Extract<AtomicEffect, { type: "modify-enemy" }>["patch"],
  defeat?: Extract<AtomicEffect, { type: "modify-enemy" }>["defeat"]
): AtomicEffect {
  return {
    ...effectBase(state, enemy, suffix),
    type: "modify-enemy",
    enemyId: enemy.id,
    patch,
    ...(defeat ? { defeat } : {})
  };
}

function resolveAttack(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: Extract<EnemyIntent, { type: "attack" }>
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  const target = state.party.find((member) => member.id === intent.targetId);
  const hpBefore = target?.hp ?? null;
  if (!target || target.downed) {
    const event = makeEnemyTurnEvent(enemy, intent, {
      result: "miss",
      damage: 0,
      hpBefore,
      hpAfter: target?.hp ?? null,
      lethal: false
    });
    const effects: AtomicEffect[] = [
      eventEffect(state, enemy, event),
      {
        ...effectBase(state, enemy, "miss-damage", ["enemy-attack"]),
        type: "report-damage",
        payload: {
          target: { kind: "party-member", id: intent.targetId },
          raw: intent.value,
          modified: 0,
          applied: 0,
          hpBefore: hpBefore ?? 0,
          hpAfter: target?.hp ?? 0,
          lethal: false
        }
      },
      logEffect(
        state,
        enemy,
        "miss-log",
        "system",
        `${enemy.name}的攻击因原目标已经倒下而落空。`
      )
    ];
    if (enemy.kind === "charger") {
      effects.push(enemyPatchEffect(state, enemy, "discharge", { chargeReady: false }));
    }
    effects.push(cancelIntentEffect(state, enemy));
    return { event, effects };
  }

  const damage = Math.max(0, intent.value - enemy.blocked);
  const hpAfter = Math.max(0, target.hp - damage);
  const lethal = damage > 0 && hpAfter <= 0;
  const event = makeEnemyTurnEvent(enemy, intent, {
    result: damage <= 0 ? "blocked" : "hit",
    damage,
    hpBefore,
    hpAfter,
    lethal
  });
  const effects: AtomicEffect[] = [eventEffect(state, enemy, event)];

  effects.push({
    ...effectBase(state, enemy, "damage", ["enemy-attack"]),
    type: "damage",
    target: { kind: "party-member", id: target.id },
    amount: damage,
    rawAmount: intent.value
  });
  effects.push(
    damage <= 0
      ? logEffect(
          state,
          enemy,
          "blocked-log",
          "good",
          `${enemy.name}对${CHARACTERS[target.id].name}的攻击被完全挡下。`
        )
      : logEffect(
          state,
          enemy,
          "damage-log",
          "bad",
          `${CHARACTERS[target.id].name}受到 ${damage} 点伤害。`
        )
  );

  if (lethal) {
    const rustAdded = target.rustLevel < getRustableFaceCapacity(target.id);
    effects.push(
      logEffect(
        state,
        enemy,
        "downed-log",
        "bad",
        `${CHARACTERS[target.id].name}力竭倒下，${
          rustAdded ? "命数新增 1 个锈面" : "命数已完全锈蚀"
        }；本层余下战斗无法行动，进入下一层时将以 ${DOWNED_RETURN_HP} 点生命归队。`
      ),
      factEffect(
        state,
        enemy,
        "downed-fact",
        `${CHARACTERS[target.id].name}被${enemy.name}击倒，命数因伤势进一步锈蚀。`
      )
    );
  }
  if (enemy.kind === "charger") {
    effects.push(enemyPatchEffect(state, enemy, "discharge", { chargeReady: false }));
  }
  effects.push(cancelIntentEffect(state, enemy));
  return { event, effects };
}

function resolveCharge(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: Extract<EnemyIntent, { type: "charge" }>
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  const event = makeEnemyTurnEvent(enemy, intent, {
    result: "effect",
    damage: 0,
    hpBefore: null,
    hpAfter: null,
    lethal: false
  });
  return {
    event,
    effects: [
      eventEffect(state, enemy, event),
      enemyPatchEffect(state, enemy, "charge-ready", { chargeReady: true }),
      logEffect(
        state,
        enemy,
        "charge-log",
        "bad",
        `${enemy.name}完成蓄力，下一回合将发动重击。`
      ),
      cancelIntentEffect(state, enemy)
    ]
  };
}

function resolveSeal(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: Extract<EnemyIntent, { type: "seal" }>
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  const target = state.party.find((member) => member.id === intent.targetId);
  const applied = Boolean(target && !target.downed);
  const event = makeEnemyTurnEvent(enemy, intent, {
    result: applied ? "effect" : "miss",
    damage: 0,
    hpBefore: target?.hp ?? null,
    hpAfter: target?.hp ?? null,
    lethal: false
  });
  const effects: AtomicEffect[] = [eventEffect(state, enemy, event)];
  if (target && !target.downed) {
    effects.push(
      {
        ...effectBase(state, enemy, "seal", ["seal"]),
        type: "modify-party-member",
        targetId: target.id,
        patch: { sealedNext: true }
      },
      logEffect(
        state,
        enemy,
        "seal-log",
        "bad",
        `${enemy.name}封锁了${CHARACTERS[target.id].name}的下一回合骰子。`
      )
    );
  }
  effects.push(cancelIntentEffect(state, enemy));
  return { event, effects };
}

function resolveCountdown(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: Extract<EnemyIntent, { type: "countdown" }>
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  const nextCountdown = enemy.countdown - 1;
  const event = makeEnemyTurnEvent(enemy, intent, {
    result: "effect",
    damage: 0,
    hpBefore: null,
    hpAfter: null,
    lethal: false
  });
  const effects: AtomicEffect[] = [
    eventEffect(state, enemy, event),
    enemyPatchEffect(state, enemy, "countdown", { countdown: nextCountdown }),
    cancelIntentEffect(state, enemy)
  ];
  if (nextCountdown <= 0) {
    const loss = Math.max(10, Math.round(state.gold * 0.2));
    effects.push(
      enemyPatchEffect(
        state,
        enemy,
        "explode",
        {},
        { reason: "enemy-effect", reward: 0 }
      ),
      {
        ...effectBase(state, enemy, "explosion-loss", ["countdown"]),
        type: "modify-resource",
        resource: "gold",
        operation: "add",
        value: -loss,
        reason: "enemy-effect"
      },
      logEffect(
        state,
        enemy,
        "explosion-log",
        "bad",
        `${enemy.name}引爆，囊袋损失 ${loss}G。`
      ),
      factEffect(
        state,
        enemy,
        "explosion-fact",
        "没有及时摧毁的术式陷阱炸飞了一部分战利品。"
      )
    );
  } else {
    effects.push(
      logEffect(
        state,
        enemy,
        "countdown-log",
        "bad",
        `${enemy.name}倒计时减少至 ${nextCountdown}。`
      )
    );
  }
  return { event, effects };
}

function resolveSummon(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: Extract<EnemyIntent, { type: "summon" }>
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  const event = makeEnemyTurnEvent(enemy, intent, {
    result: "effect",
    damage: 0,
    hpBefore: null,
    hpAfter: null,
    lethal: false
  });
  const effects: AtomicEffect[] = [eventEffect(state, enemy, event)];
  if (state.enemies.filter((candidate) => !isEnemyDefeated(candidate)).length < 5) {
    const enemySequence = state.enemySequence + 1;
    const spawned = makeEnemy(
      () => enemySequence,
      "brute",
      "新生畸变物",
      "amalgam",
      2,
      { attack: 1 }
    );
    effects.push(
      {
        ...effectBase(state, enemy, "summon", ["summon"]),
        type: "spawn-unit",
        unit: spawned,
        enemySequence
      },
      logEffect(
        state,
        enemy,
        "summon-log",
        "bad",
        `${enemy.name}召唤了一只 2 血新生畸变物。`
      )
    );
  }
  effects.push(cancelIntentEffect(state, enemy));
  return { event, effects };
}

function buildIntentEffects(
  state: ExpeditionState,
  enemy: EnemyState,
  intent: EnemyIntent
): { event: EnemyTurnEvent; effects: AtomicEffect[] } {
  switch (intent.type) {
    case "attack":
      return resolveAttack(state, enemy, intent);
    case "charge":
      return resolveCharge(state, enemy, intent);
    case "seal":
      return resolveSeal(state, enemy, intent);
    case "countdown":
      return resolveCountdown(state, enemy, intent);
    case "summon":
      return resolveSummon(state, enemy, intent);
  }
  const exhaustive: never = intent;
  return exhaustive;
}

/** Resolve exactly one already-published enemy intent through the effect pipeline. */
export function resolveEnemyIntentTransition(
  state: ExpeditionState,
  enemyId: string
): EnemyIntentTransition {
  if (state.mode.type !== "enemy-turn") return fail(state);
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || isEnemyDefeated(enemy) || !enemy.intent) return fail(state);

  const { event, effects } = buildIntentEffects(state, enemy, enemy.intent);
  const resolved = resolveAtomicEffects(state, effects);
  if (resolved.error) return fail(state);
  return {
    state: resolved.state,
    events: resolved.events,
    error: null,
    enemyEvent: event
  };
}

/** Public facade wrapper for callers that still consume one enemy event at a time. */
export function resolveEnemyTurnStep(
  state: ExpeditionState,
  enemyId: string
): EnemyTurnStep {
  const transition = resolveEnemyIntentTransition(state, enemyId);
  if (transition.error || !transition.enemyEvent) return { state, event: null };
  transition.state.eventSequence = state.eventSequence;
  return { state: transition.state, event: transition.enemyEvent };
}

export function getQueuedEnemyId(state: ExpeditionState): string | null {
  if (
    state.mode.type !== "enemy-turn" ||
    state.mode.cursor >= state.mode.enemyOrder.length
  ) {
    return null;
  }
  return state.mode.enemyOrder[state.mode.cursor] ?? null;
}
