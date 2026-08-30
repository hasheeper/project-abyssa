import { LAYER_MULTIPLIERS, MAX_HP } from "../content/balance";
import { CHARACTERS } from "../content/characters";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type { BattleEvent } from "../domain/events";
import type {
  ActionError,
  CharacterId,
  ExpeditionState,
  FaceDef,
  Rng,
  Verb
} from "../domain/state";
import type { TargetRef } from "../domain/targets";
import { isEnemyDefeated } from "../selectors/battle-selectors";
import { getStateFace } from "./dice";
import { buildActionEffectContribution } from "./action-effects";
import { resolveEffectsCommand } from "./resolver";

export type NativeActionTransition = {
  state: ExpeditionState;
  events: BattleEvent[];
  error: ActionError | null;
};

function fail(state: ExpeditionState, error: ActionError): NativeActionTransition {
  return { state, events: [], error };
}

function checkActor(
  state: ExpeditionState,
  actorId: CharacterId
): { dieIndex: number; face: FaceDef } | ActionError {
  if (state.mode.type !== "player-turn") return "not-act-phase";
  const member = state.party.find((candidate) => candidate.id === actorId);
  if (!member || member.downed) return "invalid-target";
  const dieIndex = state.dice.findIndex((candidate) => candidate.ownerId === actorId);
  const die = state.dice[dieIndex];
  if (!die || die.faceIndex === null) return "invalid-target";
  if (die.sealed) return "die-sealed";
  if (die.spent) return "die-spent";
  if (!die.loaded) return "die-not-loaded";
  const face = getStateFace(state, die);
  return face ? { dieIndex, face } : "invalid-target";
}

function actionBase(
  state: ExpeditionState,
  actorId: CharacterId,
  face: FaceDef,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `action:${state.eventSequence}:${actorId}:${face.verb}`;
  return {
    id: `${batchId}:${suffix}`,
    source: {
      kind: "die",
      ownerId: actorId,
      faceIndex: state.dice.find((die) => die.ownerId === actorId)?.faceIndex ?? null
    },
    causeId: batchId,
    batchId,
    tags
  };
}

function actionMarker(
  state: ExpeditionState,
  actorId: CharacterId,
  face: FaceDef,
  target: TargetRef,
  type: "declare-action" | "complete-action"
): AtomicEffect {
  return {
    ...actionBase(state, actorId, face, type),
    type,
    actorId,
    verb: face.verb,
    target
  };
}

function resolveAction(
  state: ExpeditionState,
  label: string,
  effects: AtomicEffect[]
): NativeActionTransition {
  const resolved = resolveEffectsCommand(state, label, effects);
  return resolved.error
    ? fail(state, "invalid-target")
    : { state: resolved.state, events: resolved.events, error: null };
}

export function performAttack(
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): NativeActionTransition {
  const actor = checkActor(state, actorId);
  if (typeof actor === "string") return fail(state, actor);
  if (actor.face.verb !== "attack" && actor.face.verb !== "wild") {
    return fail(state, "wrong-face");
  }
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || isEnemyDefeated(enemy)) return fail(state, "invalid-target");

  const target = { kind: "enemy" as const, id: enemyId };
  const lethal = actor.face.power >= enemy.hp;
  const bounty = lethal
    ? Math.round(enemy.maxHp * 10 * LAYER_MULTIPLIERS[state.layer - 1]!)
    : 0;
  const effects: AtomicEffect[] = [
    actionMarker(state, actorId, actor.face, target, "declare-action"),
    {
      ...actionBase(state, actorId, actor.face, "damage", ["attack"]),
      type: "damage",
      target,
      amount: actor.face.power,
      defeat: { reason: "damage", reward: bounty }
    },
    {
      ...actionBase(state, actorId, actor.face, "spend"),
      type: "modify-die",
      ownerId: actorId,
      patch: { spent: true }
    },
    {
      ...actionBase(state, actorId, actor.face, "damage-log"),
      type: "append-log",
      tone: "good",
      text: `${CHARACTERS[actorId].name}对${enemy.name}造成 ${actor.face.power} 点伤害。`
    }
  ];
  if (lethal) {
    effects.push(
      {
        ...actionBase(state, actorId, actor.face, "bounty"),
        type: "modify-resource",
        resource: "gold",
        operation: "add",
        value: bounty,
        reason: "bounty"
      },
      {
        ...actionBase(state, actorId, actor.face, "defeat-log"),
        type: "append-log",
        tone: "gold",
        text: `${enemy.name}被肃清，行动取消，获得 ${bounty}G。`
      }
    );
  }
  effects.push(actionMarker(state, actorId, actor.face, target, "complete-action"));

  return resolveAction(
    state,
    `${CHARACTERS[actorId].name}攻击${enemy.name}`,
    effects
  );
}

export function performBlock(
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): NativeActionTransition {
  const actor = checkActor(state, actorId);
  if (typeof actor === "string") return fail(state, actor);
  if (actor.face.verb !== "guard" && actor.face.verb !== "wild") {
    return fail(state, "wrong-face");
  }
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || isEnemyDefeated(enemy) || enemy.intent?.type !== "attack") {
    return fail(state, "no-attack-intent");
  }

  const protectedId = enemy.intent.targetId;
  const target = { kind: "enemy" as const, id: enemyId };
  const effects: AtomicEffect[] = [
    actionMarker(state, actorId, actor.face, target, "declare-action"),
    {
      ...actionBase(state, actorId, actor.face, "guard", ["guard"]),
      type: "guard",
      actorId,
      protectedId,
      enemyId,
      amount: actor.face.power
    },
    {
      ...actionBase(state, actorId, actor.face, "spend"),
      type: "modify-die",
      ownerId: actorId,
      patch: { spent: true }
    },
    {
      ...actionBase(state, actorId, actor.face, "log"),
      type: "append-log",
      tone: "good",
      text: `${CHARACTERS[actorId].name}为${CHARACTERS[protectedId].name}架起 ${actor.face.power} 层盾牌。`
    },
    actionMarker(state, actorId, actor.face, target, "complete-action")
  ];
  return resolveAction(
    state,
    `${CHARACTERS[actorId].name}格挡${enemy.name}`,
    effects
  );
}

export function performHeal(
  state: ExpeditionState,
  actorId: CharacterId,
  targetId: CharacterId
): NativeActionTransition {
  const actor = checkActor(state, actorId);
  if (typeof actor === "string") return fail(state, actor);
  if (actor.face.verb !== "heal") return fail(state, "wrong-face");
  const member = state.party.find((candidate) => candidate.id === targetId);
  if (!member || member.downed) return fail(state, "invalid-target");
  if (member.hp >= MAX_HP) return fail(state, "target-full-hp");

  const target = { kind: "party-member" as const, id: targetId };
  const actualHealing = Math.min(MAX_HP - member.hp, actor.face.power);
  const contribution = buildActionEffectContribution(
    state,
    "heal",
    actorId,
    actor.face.effectDefinitionIds ?? [],
    (suffix, tags) => actionBase(state, actorId, actor.face, suffix, tags)
  );
  const actualCost = contribution.resourceCosts.gold ?? 0;
  const effects: AtomicEffect[] = [
    actionMarker(state, actorId, actor.face, target, "declare-action"),
    {
      ...actionBase(state, actorId, actor.face, "heal", ["heal"]),
      type: "heal",
      target,
      amount: actor.face.power,
      cost: actualCost
    },
    {
      ...actionBase(state, actorId, actor.face, "spend"),
      type: "modify-die",
      ownerId: actorId,
      patch: { spent: true }
    },
    {
      ...actionBase(state, actorId, actor.face, "log"),
      type: "append-log",
      tone: "good",
      text: `${CHARACTERS[actorId].name}为${CHARACTERS[targetId].name}恢复 ${actualHealing} 点生命。`
    }
  ];
  effects.push(...contribution.effects);
  effects.push(actionMarker(state, actorId, actor.face, target, "complete-action"));
  return resolveAction(
    state,
    `${CHARACTERS[actorId].name}治疗${CHARACTERS[targetId].name}`,
    effects
  );
}

export function performSteal(
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string,
  rng: Rng
): NativeActionTransition {
  const actor = checkActor(state, actorId);
  if (typeof actor === "string") return fail(state, actor);
  if (actor.face.verb !== "coin") return fail(state, "wrong-face");
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || isEnemyDefeated(enemy)) return fail(state, "invalid-target");

  const target = { kind: "enemy" as const, id: enemyId };
  const gain = 5 * actor.face.power;
  const foundTrinket = rng() < 0.35;
  const effects: AtomicEffect[] = [
    actionMarker(state, actorId, actor.face, target, "declare-action"),
    {
      ...actionBase(state, actorId, actor.face, "gold", ["steal"]),
      type: "modify-resource",
      resource: "gold",
      operation: "add",
      value: gain,
      reason: "steal"
    },
    {
      ...actionBase(state, actorId, actor.face, "spend"),
      type: "modify-die",
      ownerId: actorId,
      patch: { spent: true }
    },
    {
      ...actionBase(state, actorId, actor.face, "log"),
      type: "append-log",
      tone: "gold",
      text: `${CHARACTERS[actorId].name}对${enemy.name}顺手牵羊，囊袋 +${gain}G。`
    }
  ];
  if (foundTrinket) {
    effects.push({
      ...actionBase(state, actorId, actor.face, "fact"),
      type: "append-fact",
      text: "诺玛在正式账目外藏起了一件来路不明的小东西。"
    });
  }
  effects.push(actionMarker(state, actorId, actor.face, target, "complete-action"));
  return resolveAction(
    state,
    `${CHARACTERS[actorId].name}偷取${enemy.name}`,
    effects
  );
}

export function getActionVerb(state: ExpeditionState, actorId: CharacterId): Verb | null {
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  return die ? (getStateFace(state, die)?.verb ?? null) : null;
}
