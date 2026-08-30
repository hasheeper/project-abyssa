import { STALL_GRACE_ROUNDS } from "../content/balance";
import type {
  DieState,
  EnemyState,
  ExpeditionState,
  ExpeditionStatus,
  Phase,
  RoundOutcome,
  StallVerdict
} from "../domain/state";
import { getStateFace } from "../rules/dice";

export function isEnemyDefeated(enemy: Pick<EnemyState, "hp">): boolean {
  return enemy.hp <= 0;
}

export function isDieDowned(state: ExpeditionState, die: DieState): boolean {
  return state.party.find((member) => member.id === die.ownerId)?.downed ?? true;
}

export function getBattlePhase(state: Pick<ExpeditionState, "mode">): Phase {
  if (state.mode.type === "awaiting-roll") return "roll";
  if (state.mode.type === "player-turn") return "act";
  return "enemy";
}

export function getExpeditionStatus(
  state: Pick<ExpeditionState, "mode">
): ExpeditionStatus {
  if (state.mode.type === "greed") return "greed";
  if (state.mode.type === "finished") return "finished";
  return "active";
}

export function getRoundOutcome(state: ExpeditionState): RoundOutcome | null {
  switch (state.mode.type) {
    case "awaiting-roll":
      return null;
    case "player-turn":
      return state.enemies.length > 0 && state.enemies.every(isEnemyDefeated)
        ? "layer-cleared"
        : null;
    case "enemy-turn":
      return state.mode.outcome;
    case "greed":
      return "layer-cleared";
    case "finished":
      return state.result?.wiped ? "wipe" : "layer-cleared";
  }
  const exhaustive: never = state.mode;
  return exhaustive;
}

export function canUndo(state: ExpeditionState): boolean {
  return state.mode.type === "player-turn" && state.undoStack.length > 0;
}

export function getUndoLabel(state: ExpeditionState): string | null {
  return state.undoStack[state.undoStack.length - 1]?.action ?? null;
}

export function hasPendingAction(state: ExpeditionState): boolean {
  return state.dice.some((die) => {
    if (
      !die.loaded ||
      die.spent ||
      die.sealed ||
      isDieDowned(state, die) ||
      die.faceIndex === null
    ) {
      return false;
    }
    const face = getStateFace(state, die);
    return face !== null && face.verb !== "blank";
  });
}

export function getReadyDamage(state: ExpeditionState): number {
  return state.dice.reduce((sum, die) => {
    if (
      die.sealed ||
      isDieDowned(state, die) ||
      die.spent ||
      !die.loaded ||
      die.faceIndex === null
    ) {
      return sum;
    }
    const face = getStateFace(state, die)!;
    if (face.verb !== "attack" && face.verb !== "wild") return sum;
    return sum + face.power;
  }, 0);
}

export function getPotentialDamage(state: ExpeditionState): number {
  return state.dice.reduce((sum, die) => {
    if (die.sealed || isDieDowned(state, die) || die.spent || die.faceIndex === null) {
      return sum;
    }
    const face = getStateFace(state, die)!;
    if (face.verb !== "attack" && face.verb !== "wild") return sum;
    return sum + face.power;
  }, 0);
}

export function getEnemyTotalHp(state: ExpeditionState): number {
  return state.enemies.reduce(
    (sum, enemy) => (isEnemyDefeated(enemy) ? sum : sum + enemy.hp),
    0
  );
}

export function getTotalThreat(state: ExpeditionState): number {
  return state.enemies.reduce((sum, enemy) => {
    if (isEnemyDefeated(enemy) || enemy.intent?.type !== "attack") return sum;
    return sum + Math.max(0, enemy.intent.value - enemy.blocked);
  }, 0);
}

export function getPartyTotalHp(state: ExpeditionState): number {
  return state.party.reduce(
    (sum, member) => (member.downed ? sum : sum + member.hp),
    0
  );
}

/** Pure stalled-combat assessment; it never mutates the supplied state. */
export function assessStalling(state: ExpeditionState): StallVerdict {
  const alive = state.enemies.filter((enemy) => !isEnemyDefeated(enemy));
  const aliveCount = alive.length;

  if (aliveCount === 0) {
    return {
      stalling: false,
      routed: false,
      weakened: false,
      harmless: false,
      couldFinish: false,
      grinding: false
    };
  }

  const startCount = state.layerStartEnemies || aliveCount;
  const routed = aliveCount <= Math.max(1, Math.floor(startCount / 3)) || aliveCount === 1;
  const totalHp = getEnemyTotalHp(state);
  const partyPotential = getPotentialDamage(state);
  const weakened = totalHp > 0 && totalHp <= Math.max(3, partyPotential);
  const partyHp = getPartyTotalHp(state);
  const threat = getTotalThreat(state);
  const harmless = partyHp > 0 && threat * 4 <= partyHp;
  const couldFinish = partyPotential >= totalHp && totalHp > 0;
  const grinding = state.stalledRounds >= STALL_GRACE_ROUNDS;

  return {
    stalling: routed && weakened && harmless && (couldFinish || grinding),
    routed,
    weakened,
    harmless,
    couldFinish,
    grinding
  };
}

export function hasUnloadedDice(state: ExpeditionState): boolean {
  return state.dice.some(
    (die) =>
      !die.loaded &&
      !die.spent &&
      !die.sealed &&
      !isDieDowned(state, die) &&
      die.faceIndex !== null
  );
}
