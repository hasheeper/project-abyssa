import type { BattleContext } from "../../contracts";
import type {
  ActionError,
  ActionResult,
  CharacterId,
  EndTurnResult,
  ExpeditionState,
  HandEvaluation,
  Rng,
  RngStreamName
} from "../domain/state";
import { getStateFace } from "./dice";
import { dispatchBattleCommand } from "./dispatcher";
import { createExpeditionState } from "./expedition";
import { applyFrenzyRecoilTransition } from "./turns";
import { settleEnemyTurnTransition } from "./settlement";
import {
  advanceRngStream,
  createBattleRngState,
  getTrackedRngSnapshot,
  mulberry32
} from "../persistence/rng";
import {
  getRoundOutcome,
  isEnemyDefeated
} from "../selectors/battle-selectors";

function asActionResult(
  input: ExpeditionState,
  transition: ReturnType<typeof dispatchBattleCommand>
): ActionResult {
  return {
    state: preserveCompatibilityEventCursor(input, transition.state),
    error: transition.error as ActionError | null
  };
}

function preserveCompatibilityEventCursor(
  input: ExpeditionState,
  output: ExpeditionState
): ExpeditionState {
  if (output === input) return input;
  output.eventSequence = input.eventSequence;
  return output;
}

function runWithTrackedExternalRng<T extends { state: ExpeditionState }>(
  input: ExpeditionState,
  rng: Rng,
  streamName: RngStreamName,
  operation: (counted: Rng) => T
): T {
  let draws = 0;
  const counted: Rng = () => {
    draws += 1;
    return rng();
  };
  const result = operation(counted);
  if (result.state !== input) {
    const tracked = getTrackedRngSnapshot(rng);
    result.state.rng[streamName] =
      tracked ?? advanceRngStream(input.rng[streamName], draws);
  }
  return result;
}

function actorError(state: ExpeditionState, actorId: CharacterId): ActionError | null {
  if (state.mode.type !== "player-turn") return "not-act-phase";
  const member = state.party.find((candidate) => candidate.id === actorId);
  if (!member || member.downed) return "invalid-target";
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  if (!die || die.faceIndex === null) return "invalid-target";
  if (die.sealed) return "die-sealed";
  if (die.spent) return "die-spent";
  if (!die.loaded) return "die-not-loaded";
  return null;
}

export function createExpedition(context: BattleContext, rng: Rng, location = "混沌领域"): ExpeditionState {
  let draws = 0;
  const counted: Rng = () => {
    draws += 1;
    return rng();
  };
  const state = createExpeditionState(context, counted, location);
  const tracked = getTrackedRngSnapshot(rng);
  if (tracked) {
    state.rng = createBattleRngState(tracked.seed);
    state.rng.combat = tracked;
  } else {
    state.rng.combat = advanceRngStream(state.rng.combat, draws);
  }
  return state;
}

export function createExpeditionFromSeed(context: BattleContext,
  seed: number,
  location = "混沌领域"
): ExpeditionState {
  return createExpedition(context, mulberry32(seed), location);
}

export function rollDice(context: BattleContext, state: ExpeditionState, rng: Rng): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "roll-dice" }, { rng }).state
  );
}

export function rerollDice(context: BattleContext, state: ExpeditionState, rng: Rng): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "reroll-dice" }, { rng }).state
  );
}

export function toggleLoad(context: BattleContext, state: ExpeditionState, dieIndex: number): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "toggle-load", dieIndex }).state
  );
}

export function attackEnemy(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): ActionResult {
  return asActionResult(
    state,
    dispatchBattleCommand(context, state, { type: "attack-enemy", actorId, enemyId })
  );
}

export function blockIntent(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): ActionResult {
  return asActionResult(
    state,
    dispatchBattleCommand(context, state, { type: "block-intent", actorId, enemyId })
  );
}

export function healMember(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  targetId: CharacterId
): ActionResult {
  return asActionResult(
    state,
    dispatchBattleCommand(context, state, { type: "heal-member", actorId, targetId })
  );
}

export function stealFrom(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string,
  rng: Rng
): ActionResult {
  return asActionResult(
    state,
    dispatchBattleCommand(context, state, { type: "steal-from", actorId, enemyId }, { rng })
  );
}

export function actOnEnemy(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string,
  rng: Rng
): ActionResult {
  const precheck = actorError(state, actorId);
  if (precheck) return { state, error: precheck };
  const die = state.dice.find((candidate) => candidate.ownerId === actorId)!;
  const face = getStateFace(context, state, die)!;

  if (face.verb === "attack" || face.verb === "wild") {
    return attackEnemy(context, state, actorId, enemyId);
  }
  if (face.verb === "coin") return stealFrom(context, state, actorId, enemyId, rng);
  if (face.verb === "guard") return blockIntent(context, state, actorId, enemyId);
  return { state, error: "wrong-face" };
}

export function actOnMember(context: BattleContext,
  state: ExpeditionState,
  actorId: CharacterId,
  targetId: CharacterId
): ActionResult {
  const precheck = actorError(state, actorId);
  if (precheck) return { state, error: precheck };
  const die = state.dice.find((candidate) => candidate.ownerId === actorId)!;
  const face = getStateFace(context, state, die)!;

  if (face.verb === "heal") return healMember(context, state, actorId, targetId);
  if (face.verb === "guard" || face.verb === "wild") {
    const threat = state.enemies
      .filter(
        (enemy) =>
          !isEnemyDefeated(enemy) &&
          enemy.intent?.type === "attack" &&
          enemy.intent.targetId === targetId
      )
      .sort((left, right) => {
        const leftRemain =
          (left.intent as { value: number }).value - left.blocked;
        const rightRemain =
          (right.intent as { value: number }).value - right.blocked;
        return rightRemain - leftRemain;
      })[0];
    if (!threat) return { state, error: "no-attack-intent" };
    return blockIntent(context, state, actorId, threat.id);
  }
  return { state, error: "wrong-face" };
}

export function undo(context: BattleContext, state: ExpeditionState): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "undo" }).state
  );
}

export function endTurn(context: BattleContext, state: ExpeditionState, rng: Rng): EndTurnResult {
  const transition = dispatchBattleCommand(context, state, { type: "end-turn" }, { rng });
  if (transition.error) return { state, outcome: "continue", hand: null };
  preserveCompatibilityEventCursor(state, transition.state);
  const handEvent = transition.events.find((event) => event.type === "hand-evaluated");
  const hand =
    handEvent?.type === "hand-evaluated" && handEvent.payload.hand.adjustedBonus > 0
      ? handEvent.payload.hand
      : null;
  return {
    state: transition.state,
    outcome: getRoundOutcome(transition.state) ?? "continue",
    hand
  };
}

export function finishEnemyTurn(context: BattleContext,
  state: ExpeditionState,
  rng: Rng,
  hand: HandEvaluation | null
): EndTurnResult {
  const recoil = applyFrenzyRecoilTransition(context, state);
  if (recoil.error) return { state, outcome: "continue", hand: null };
  const result = runWithTrackedExternalRng(recoil.state, rng, "loot", (counted) =>
    {
      const settled = settleEnemyTurnTransition(context, recoil.state, counted, hand);
      return {
        state: settled.error ? recoil.state : settled.state,
        outcome: settled.error
          ? "continue" as const
          : getRoundOutcome(settled.state) ?? "continue",
        hand: settled.error ? null : hand
      };
    }
  );
  if (result.state === recoil.state) return { state, outcome: "continue", hand: null };
  result.state.eventSequence = state.eventSequence;
  return result;
}

export function nextRound(context: BattleContext, state: ExpeditionState, rng: Rng): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "next-round" }, { rng }).state
  );
}

export function goDeeper(context: BattleContext, state: ExpeditionState, rng: Rng): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "go-deeper" }, { rng }).state
  );
}

export function leaveExpedition(context: BattleContext, state: ExpeditionState, rng: Rng): ExpeditionState {
  return preserveCompatibilityEventCursor(
    state,
    dispatchBattleCommand(context, state, { type: "leave-expedition" }, { rng }).state
  );
}
