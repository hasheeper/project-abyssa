import { LAYER_MULTIPLIERS, MAX_HP } from "../content/balance";
import type { EnemyState, ExpeditionState, GreedSummary } from "../domain/state";
import { getRustFaceCount } from "../rules/dice";
import {
  getEnemyFrenzyWarningStatus,
  isEnemyFrenzied
} from "../rules/frenzy-status";
import { getBattlePhase, isEnemyDefeated } from "./battle-selectors";

/** UI frenzy countdown after accounting for an already-consumed enemy phase. */
export function getFrenzyWarningRounds(
  state: ExpeditionState,
  enemy: EnemyState
): number | null {
  if (isEnemyDefeated(enemy) || isEnemyFrenzied(state, enemy)) return null;
  const warning = getEnemyFrenzyWarningStatus(state, enemy.id);
  const consumedCurrentRound = getBattlePhase(state) === "enemy" ? 1 : 0;
  if (warning?.duration) {
    return Math.max(0, warning.duration.remaining - consumedCurrentRound);
  }
  return null;
}

export function getGreedSummary(state: ExpeditionState): GreedSummary {
  const nextLayer = state.layer + 1;
  return {
    bagTotal: state.bagGold,
    nextLayer,
    nextLayerMultiplier: LAYER_MULTIPLIERS[nextLayer - 1] ?? LAYER_MULTIPLIERS[4],
    downedCount: state.party.filter((member) => member.downed).length,
    rustedFaceCount: state.party.reduce(
      (count, member) => count + getRustFaceCount(member.id, member.rustLevel),
      0
    ),
    woundedCount: state.party.filter(
      (member) => !member.downed && member.hp < MAX_HP
    ).length,
    crystalHint: nextLayer >= 3
  };
}
