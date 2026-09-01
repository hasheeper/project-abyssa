import { MAX_HP } from "../../content/balance";
import type {
  AtomicEffect,
  EffectResolutionError,
  EffectResolutionOptions
} from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import { isEnemyDefeated } from "../../selectors/battle-selectors";
import { applyNumericModifiers } from "../modifiers";
import type { ResolverEmitter } from "./emitter";
import {
  defeatEnemy,
  downPartyMember,
  emitModifierEvents
} from "./state-helpers";

type CombatEffect = Extract<
  AtomicEffect,
  { type: "damage" | "report-damage" | "heal" | "guard" | "revive" | "modify-stat" }
>;

export function applyCombatEffect(
  state: ExpeditionState,
  effect: CombatEffect,
  emitter: ResolverEmitter,
  options: EffectResolutionOptions
): EffectResolutionError | null {
  switch (effect.type) {
    case "damage": {
      const modified = applyNumericModifiers(
        effect.amount,
        "before-damage",
        effect.target,
        effect.tags,
        options.modifiers ?? []
      );
      if (!emitModifierEvents(emitter, effect, modified.applications)) {
        return "event-budget-exceeded";
      }
      const amount = Math.max(0, Math.round(modified.value));
      if (modified.target.kind === "party-member") {
        const member = state.party.find((candidate) => candidate.id === modified.target.id);
        if (!member || member.downed) return "invalid-effect-target";
        const hpBefore = member.hp;
        member.hp = Math.max(0, member.hp - amount);
        if (
          !emitter.emit(
            "damage-applied",
            {
              target: modified.target,
              raw: effect.rawAmount ?? effect.amount,
              modified: amount,
              applied: hpBefore - member.hp,
              hpBefore,
              hpAfter: member.hp,
              lethal: member.hp <= 0
            },
            effect.source,
            effect.causeId,
            effect.batchId
          )
        ) {
          return "event-budget-exceeded";
        }
        downPartyMember(state, member.id, emitter, effect);
      } else {
        const enemy = state.enemies.find((candidate) => candidate.id === modified.target.id);
        if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
        const hpBefore = enemy.hp;
        enemy.hp = Math.max(0, enemy.hp - amount);
        if (
          !emitter.emit(
            "damage-applied",
            {
              target: modified.target,
              raw: effect.rawAmount ?? effect.amount,
              modified: amount,
              applied: hpBefore - enemy.hp,
              hpBefore,
              hpAfter: enemy.hp,
              lethal: enemy.hp <= 0
            },
            effect.source,
            effect.causeId,
            effect.batchId
          )
        ) {
          return "event-budget-exceeded";
        }
        defeatEnemy(state, enemy.id, emitter, effect, effect.defeat);
      }
      break;
    }

    case "report-damage":
      emitter.emit(
        "damage-applied",
        effect.payload,
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "heal": {
      const member = state.party.find((candidate) => candidate.id === effect.target.id);
      if (!member || member.downed) return "invalid-effect-target";
      const modified = applyNumericModifiers(
        effect.amount,
        "before-heal",
        effect.target,
        effect.tags,
        options.modifiers ?? []
      );
      if (!emitModifierEvents(emitter, effect, modified.applications)) {
        return "event-budget-exceeded";
      }
      const amount = Math.max(0, Math.round(modified.value));
      const hpBefore = member.hp;
      member.hp = Math.min(MAX_HP, member.hp + amount);
      if (
        !emitter.emit(
          "healing-applied",
          {
            actorId:
              effect.source.kind === "character"
                ? effect.source.id
                : effect.source.kind === "die"
                  ? effect.source.ownerId
                  : member.id,
            targetId: member.id,
            requested: effect.amount,
            applied: member.hp - hpBefore,
            hpBefore,
            hpAfter: member.hp,
            cost: Math.max(0, effect.cost ?? 0)
          },
          effect.source,
          effect.causeId,
          effect.batchId
        )
      ) {
        return "event-budget-exceeded";
      }
      break;
    }

    case "guard": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      const member = state.party.find((candidate) => candidate.id === effect.protectedId);
      if (
        !enemy ||
        isEnemyDefeated(enemy) ||
        enemy.intent?.type !== "attack" ||
        !member
      ) {
        return "invalid-effect-target";
      }
      const amount = Math.max(0, effect.amount);
      const blockedBefore = enemy.blocked;
      const shieldBefore = member.shield;
      enemy.blocked += amount;
      member.shield += amount;
      emitter.emit(
        "guard-applied",
        {
          actorId: effect.actorId,
          protectedId: effect.protectedId,
          enemyId: effect.enemyId,
          amount,
          blockedBefore,
          blockedAfter: enemy.blocked,
          shieldBefore,
          shieldAfter: member.shield
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "revive": {
      const member = state.party.find((candidate) => candidate.id === effect.target.id);
      if (!member || !member.downed) return "invalid-effect-target";
      member.hp = Math.max(1, Math.min(MAX_HP, Math.round(effect.hp)));
      member.downed = false;
      emitter.emit(
        "unit-revived",
        { targetId: member.id, hp: member.hp },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-stat": {
      let before: number;
      let after: number;
      if (effect.target.kind === "party-member") {
        const member = state.party.find((candidate) => candidate.id === effect.target.id);
        if (!member || (effect.stat !== "hp" && effect.stat !== "shield")) {
          return "invalid-effect-target";
        }
        if (effect.stat === "hp") {
          before = member.hp;
          member.hp = Math.max(
            0,
            Math.min(
              MAX_HP,
              effect.operation === "set" ? effect.value : member.hp + effect.value
            )
          );
          after = member.hp;
          downPartyMember(state, member.id, emitter, effect);
        } else {
          before = member.shield;
          member.shield = Math.max(
            0,
            effect.operation === "set" ? effect.value : member.shield + effect.value
          );
          after = member.shield;
        }
      } else {
        const enemy = state.enemies.find((candidate) => candidate.id === effect.target.id);
        if (!enemy || effect.stat === "shield") return "invalid-effect-target";
        const key = effect.stat === "max-hp" ? "maxHp" : effect.stat;
        before = enemy[key];
        enemy[key] = Math.max(
          0,
          effect.operation === "set" ? effect.value : enemy[key] + effect.value
        );
        if (key === "maxHp") enemy.hp = Math.min(enemy.hp, enemy.maxHp);
        after = enemy[key];
        if (key === "hp") defeatEnemy(state, enemy.id, emitter, effect);
      }
      emitter.emit(
        "stat-modified",
        { target: effect.target, stat: effect.stat, before, after },
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
