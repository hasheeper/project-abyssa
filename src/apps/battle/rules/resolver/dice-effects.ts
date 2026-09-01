import type { AtomicEffect, EffectResolutionError } from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import { getRustableFaceCapacity } from "../dice";
import type { ResolverEmitter } from "./emitter";

type DiceEffect = Extract<
  AtomicEffect,
  { type: "commit-dice-roll" | "modify-die" | "set-die-load" | "modify-party-member" }
>;

export function applyDiceEffect(
  state: ExpeditionState,
  effect: DiceEffect,
  emitter: ResolverEmitter
): EffectResolutionError | null {
  switch (effect.type) {
    case "commit-dice-roll": {
      if (
        (effect.roll === "initial" && state.mode.type !== "awaiting-roll") ||
        (effect.roll === "reroll" && state.mode.type !== "player-turn")
      ) {
        return "invalid-effect-target";
      }
      for (const result of effect.results) {
        const die = state.dice.find((candidate) => candidate.ownerId === result.ownerId);
        if (!die) return "invalid-effect-target";
        die.faceIndex = result.faceIndex;
        if (effect.roll === "initial") {
          die.loaded = false;
          die.spent = false;
        }
      }
      for (const ownerId of effect.autoLoadOwnerIds) {
        const die = state.dice.find((candidate) => candidate.ownerId === ownerId);
        if (!die) return "invalid-effect-target";
        die.loaded = true;
      }
      state.lastTossed = effect.results.map((result) => result.ownerId);
      state.rerollsRemaining = Math.max(0, effect.rerollsRemaining);
      state.undoStack = [];
      if (effect.roll === "initial") {
        Object.assign(state, {
          mode: { type: "player-turn" },
          result: null
        });
      }
      emitter.emit(
        "dice-rolled",
        {
          roll: effect.roll,
          results: structuredClone(effect.results),
          rerollsRemaining: state.rerollsRemaining
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-die": {
      const die = state.dice.find((candidate) => candidate.ownerId === effect.ownerId);
      if (!die) return "invalid-effect-target";
      const wasSpent = die.spent;
      const changed = Object.keys(effect.patch);
      Object.assign(die, effect.patch);
      emitter.emit(
        "die-modified",
        { ownerId: effect.ownerId, changed },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (!wasSpent && die.spent) {
        emitter.emit(
          "die-spent",
          { ownerId: effect.ownerId },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "set-die-load": {
      const die = state.dice[effect.dieIndex];
      if (!die || die.ownerId !== effect.ownerId) return "invalid-effect-target";
      die.loaded = effect.loaded;
      emitter.emit(
        "die-load-changed",
        {
          ownerId: die.ownerId,
          dieIndex: effect.dieIndex,
          loaded: die.loaded
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-party-member": {
      const member = state.party.find((candidate) => candidate.id === effect.targetId);
      if (!member) return "invalid-effect-target";
      Object.assign(member, effect.patch);
      if (effect.patch.rustLevel !== undefined) {
        member.rustLevel = Math.max(
          0,
          Math.min(getRustableFaceCapacity(member.id), Math.trunc(effect.patch.rustLevel))
        );
      }
      break;
    }

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
  return null;
}
