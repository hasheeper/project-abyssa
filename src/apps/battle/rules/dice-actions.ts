import { CHARACTERS } from "../content/characters";
import type { BattleTransition } from "../domain/commands";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type { CharacterId, ExpeditionState, Rng } from "../domain/state";
import { isDieDowned } from "../selectors/battle-selectors";
import { canToggleLoad } from "../selectors/targeting-selectors";
import { resolveAtomicEffects, resolveEffectsCommand } from "./resolver";

function base(
  state: ExpeditionState,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `dice:${state.eventSequence}:${state.layer}:${state.round}`;
  return {
    id: `${batchId}:${suffix}`,
    source: { kind: "system", id: "dice" },
    causeId: batchId,
    batchId,
    tags
  };
}

function rollFaceIndex(rng: Rng): number {
  return Math.floor(rng() * 6);
}

function failed(state: ExpeditionState): BattleTransition {
  return { state, events: [], error: "command-not-available" };
}

function finishResolution(
  state: ExpeditionState,
  resolved: ReturnType<typeof resolveAtomicEffects>
): BattleTransition {
  return resolved.error
    ? failed(state)
    : { state: resolved.state, events: resolved.events, error: null };
}

/** Resolve the automatic opening roll without adding an undo checkpoint. */
export function performInitialRoll(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  if (state.mode.type !== "awaiting-roll") return failed(state);
  const results = state.dice.flatMap((die) =>
    die.sealed || isDieDowned(state, die)
      ? []
      : [
          {
            ownerId: die.ownerId,
            faceIndex: rollFaceIndex(rng),
            sealed: die.sealed
          }
        ]
  );
  const effects: AtomicEffect[] = [
    {
      ...base(state, "initial-roll", ["roll"]),
      type: "commit-dice-roll",
      roll: "initial",
      results,
      rerollsRemaining: state.rerollsRemaining,
      autoLoadOwnerIds: []
    }
  ];
  return finishResolution(state, resolveAtomicEffects(state, effects));
}

/** Reroll every eligible unloaded die and auto-load the final result set. */
export function performReroll(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  if (state.mode.type !== "player-turn" || state.rerollsRemaining <= 0) {
    return failed(state);
  }
  const eligible = state.dice.filter(
    (die) => !die.sealed && !isDieDowned(state, die) && !die.loaded && !die.spent
  );
  if (eligible.length === 0) return failed(state);

  const rerollsRemaining = state.rerollsRemaining - 1;
  const results = eligible.map((die) => ({
    ownerId: die.ownerId,
    faceIndex: rollFaceIndex(rng),
    sealed: die.sealed
  }));
  const autoLoadOwnerIds: CharacterId[] =
    rerollsRemaining <= 0 ? eligible.map((die) => die.ownerId) : [];
  const effects: AtomicEffect[] = [
    {
      ...base(state, "reroll", ["reroll"]),
      type: "commit-dice-roll",
      roll: "reroll",
      results,
      rerollsRemaining,
      autoLoadOwnerIds
    },
    {
      ...base(state, "reroll-log"),
      type: "append-log",
      tone: "system",
      text: `重掷 ${eligible.length} 枚骰子。`
    }
  ];
  if (autoLoadOwnerIds.length > 0) {
    effects.push({
      ...base(state, "auto-load-log"),
      type: "append-log",
      tone: "system",
      text: `重掷次数耗尽，剩余 ${autoLoadOwnerIds.length} 枚骰子自动装载。`
    });
  }
  return finishResolution(state, resolveAtomicEffects(state, effects));
}

/** Toggle one die and capture the complete pre-action state for undo. */
export function performToggleLoad(
  state: ExpeditionState,
  dieIndex: number
): BattleTransition {
  if (!canToggleLoad(state, dieIndex)) return failed(state);
  const die = state.dice[dieIndex]!;
  const loaded = !die.loaded;
  const action = loaded
    ? `装载${CHARACTERS[die.ownerId].name}的骰子`
    : `卸载${CHARACTERS[die.ownerId].name}的骰子`;
  const effect: AtomicEffect = {
    ...base(state, `load:${die.ownerId}`),
    source: { kind: "die", ownerId: die.ownerId, faceIndex: die.faceIndex },
    type: "set-die-load",
    dieIndex,
    ownerId: die.ownerId,
    loaded
  };
  const resolved = resolveEffectsCommand(state, action, [effect]);
  return resolved.error
    ? failed(state)
    : { state: resolved.state, events: resolved.events, error: null };
}
