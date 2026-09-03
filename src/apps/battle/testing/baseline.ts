import {
  MAX_HP,
  actOnEnemy,
  actOnMember,
  canActWith,
  canToggleLoad,
  createExpedition,
  endTurn,
  getBattlePhase,
  getExpeditionStatus,
  getRoundOutcome,
  getStateFace,
  goDeeper,
  mulberry32,
  nextRound,
  rerollDice,
  rollDice,
  isEnemyDefeated,
  toggleLoad,
  type CharacterId,
  type ExpeditionState,
  type Rng
} from "../engine";
import { assertExpeditionInvariants } from "../domain/invariants";
import {
  getEnemyFrenzyWarningStatus,
  isEnemyFrenzied
} from "../rules/frenzy-status";

type BaselineTraceStep = {
  index: number;
  command: string;
  fingerprint: string;
  summary: string;
};

export type BaselineRun = {
  seed: number;
  state: ExpeditionState;
  trace: BaselineTraceStep[];
};

/** Stable, dependency-free FNV-1a fingerprint for readable golden traces. */
function fingerprintBattleSummary(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Compact semantic state; deliberately excludes undo snapshots and full log history. */
function summarizeExpeditionState(state: ExpeditionState): string {
  const phase = getBattlePhase(state);
  const status = getExpeditionStatus(state);
  return JSON.stringify({
    location: state.location,
    layer: state.layer,
    deepestLayer: state.deepestLayer,
    round: state.round,
    phase,
    status,
    outcome: getRoundOutcome(state),
    rerolls: state.rerollsRemaining,
    gold: state.gold,
    bagGold: state.bagGold,
    handMultiplier: state.handMultiplier,
    stalledRounds: state.stalledRounds,
    lastEnemyHp: state.lastEnemyHp,
    party: state.party.map((member) => [
      member.id,
      member.hp,
      member.shield,
      member.downed,
      member.rustLevel,
      member.sealedNext
    ]),
    dice: state.dice.map((die) => {
      const member = state.party.find((candidate) => candidate.id === die.ownerId)!;
      return [
        die.ownerId,
        die.faceIndex,
        die.sealed,
        die.loaded,
        die.spent,
        member.downed,
        member.rustLevel
      ];
    }),
    enemies: state.enemies.map((enemy) => [
      enemy.id,
      enemy.kind,
      enemy.hp,
      enemy.maxHp,
      enemy.attack,
      isEnemyDefeated(enemy),
      enemy.chargeReady,
      enemy.countdown,
      enemy.intent,
      enemy.blocked,
      isEnemyFrenzied(state, enemy),
      (() => {
        const warning = getEnemyFrenzyWarningStatus(state, enemy.id);
        return warning?.duration
          ? state.round + warning.duration.remaining
          : null;
      })()
    ]),
    settlement: state.lastLayerSettlement,
    result: state.result,
    logLength: state.log.length,
    lastLog: state.log.at(-1) ?? null,
    factsLength: state.facts.length,
    lastFact: state.facts.at(-1) ?? null
  });
}

function lowestWoundedMember(state: ExpeditionState): CharacterId | null {
  return (
    [...state.party]
      .filter((member) => !member.downed && member.hp < MAX_HP)
      .sort((left, right) => left.hp - right.hp)[0]?.id ?? null
  );
}

function firstAliveEnemyId(state: ExpeditionState): string | null {
  return state.enemies.find((enemy) => !isEnemyDefeated(enemy))?.id ?? null;
}

function firstAttackIntentEnemyId(state: ExpeditionState): string | null {
  return (
    state.enemies.find(
      (enemy) => !isEnemyDefeated(enemy) && enemy.intent?.type === "attack"
    )?.id ?? null
  );
}

function takeDeterministicPlayerActions(
  initial: ExpeditionState,
  rng: Rng,
  commit: (command: string, state: ExpeditionState) => void
): ExpeditionState {
  let state = initial;

  for (const originalDie of initial.dice) {
    const ownerId = originalDie.ownerId;
    const dieIndex = state.dice.findIndex((die) => die.ownerId === ownerId);
    if (dieIndex < 0) continue;

    if (canToggleLoad(state, dieIndex) && !state.dice[dieIndex]!.loaded) {
      const loaded = toggleLoad(state, dieIndex);
      if (loaded !== state) {
        state = loaded;
        commit(`load:${ownerId}`, state);
      }
    }

    if (!canActWith(state, ownerId)) continue;
    const die = state.dice[dieIndex]!;
    const face = getStateFace(state, die);
    if (!face) continue;

    if (face.verb === "heal") {
      const targetId = lowestWoundedMember(state);
      if (!targetId) continue;
      const result = actOnMember(state, ownerId, targetId);
      if (!result.error) {
        state = result.state;
        commit(`act:${ownerId}:heal:${targetId}`, state);
      }
      continue;
    }

    if (face.verb === "guard") {
      const targetId = firstAttackIntentEnemyId(state);
      if (!targetId) continue;
      const result = actOnEnemy(state, ownerId, targetId, rng);
      if (!result.error) {
        state = result.state;
        commit(`act:${ownerId}:guard:${targetId}`, state);
      }
      continue;
    }

    if (face.verb === "attack" || face.verb === "wild" || face.verb === "coin") {
      const targetId = firstAliveEnemyId(state);
      if (!targetId) continue;
      const result = actOnEnemy(state, ownerId, targetId, rng);
      if (!result.error) {
        state = result.state;
        commit(`act:${ownerId}:${face.verb}:${targetId}`, state);
      }
    }
  }

  return state;
}

/**
 * Deterministic reference player used only to freeze current behavior.
 * It loads every usable die, heals the lowest HP member, blocks the first attack,
 * and otherwise targets the first living enemy before always going deeper.
 */
export function runDeterministicExpedition(seed: number, maxSteps = 500): BaselineRun {
  const rng = mulberry32(seed);
  let state = createExpedition(rng);
  const trace: BaselineTraceStep[] = [];

  const commit = (command: string, next: ExpeditionState) => {
    assertExpeditionInvariants(next);
    const summary = summarizeExpeditionState(next);
    trace.push({
      index: trace.length,
      command,
      fingerprint: fingerprintBattleSummary(summary),
      summary
    });
    if (trace.length > maxSteps) {
      throw new Error(`Baseline run ${seed} exceeded ${maxSteps} steps`);
    }
  };

  commit("create", state);

  while (getExpeditionStatus(state) !== "finished") {
    if (getExpeditionStatus(state) === "greed") {
      state = goDeeper(state, rng);
      commit("go-deeper", state);
      continue;
    }

    if (getBattlePhase(state) === "roll") {
      state = rollDice(state, rng);
      commit("roll", state);
      continue;
    }

    const phase = getBattlePhase(state);
    if (phase !== "act") {
      throw new Error(`Baseline player encountered unresolved ${phase} phase`);
    }

    state = takeDeterministicPlayerActions(state, rng, commit);
    const ended = endTurn(state, rng);
    state = ended.state;
    commit(`end-turn:${ended.outcome}`, state);

    if (ended.outcome === "continue") {
      state = nextRound(state, rng);
      commit("next-round", state);
    }
  }

  return { seed, state, trace };
}

/** A bounded reroll sequence used by the micro benchmark. */
export function runDeterministicRound(seed: number): ExpeditionState {
  const rng = mulberry32(seed);
  let state = rollDice(createExpedition(rng), rng);
  state = rerollDice(state, rng);
  state = rerollDice(state, rng);
  return endTurn(state, rng).state;
}
