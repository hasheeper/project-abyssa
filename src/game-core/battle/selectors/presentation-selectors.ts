import type { BattleContext } from "../../contracts";

import type { EnemyState, ExpeditionState, GreedSummary } from "../domain/state";
import { getRustFaceCount } from "../rules/dice";
import {
  getEnemyFrenzyWarningStatus,
  isEnemyFrenzied
} from "../rules/frenzy-status";
import { getBattlePhase, isEnemyDefeated } from "./battle-selectors";

/** UI frenzy countdown after accounting for an already-consumed enemy phase. */
export function getFrenzyWarningRounds(context: BattleContext,
  state: ExpeditionState,
  enemy: EnemyState
): number | null {
  if (isEnemyDefeated(enemy) || isEnemyFrenzied(context, state, enemy)) return null;
  const warning = getEnemyFrenzyWarningStatus(context, state, enemy.id);
  const consumedCurrentRound = getBattlePhase(state) === "enemy" ? 1 : 0;
  if (warning?.duration) {
    return Math.max(0, warning.duration.remaining - consumedCurrentRound);
  }
  return null;
}

export function getGreedSummary(context: BattleContext, state: ExpeditionState): GreedSummary {
  const nextLayer = state.layer + 1;
  return {
    bagTotal: state.bagGold,
    nextLayer,
    nextLayerMultiplier: context.catalog.balance.LAYER_MULTIPLIERS[nextLayer - 1] ?? context.catalog.balance.LAYER_MULTIPLIERS[4],
    downedCount: state.party.filter((member) => member.downed).length,
    rustedFaceCount: state.party.reduce(
      (count, member) => count + getRustFaceCount(context, member.id, member.rustLevel),
      0
    ),
    woundedCount: state.party.filter(
      (member) => !member.downed && member.hp < context.catalog.balance.MAX_HP
    ).length,
    crystalHint: nextLayer >= 3
  };
}
