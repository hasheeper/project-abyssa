import type { BattleContext } from "../../contracts";

import type {
  EnemyState,
  ExpeditionState,
  StatusInstance
} from "../domain/state";

export const FRENZY_WARNING_DURATION = 3;

function enemyTargetKey(enemyId: string): string {
  return `enemy:${enemyId}`;
}

export function getEnemyFrenzyWarningStatus(context: BattleContext,
  state: ExpeditionState,
  enemyId: string
): StatusInstance | null {
  return state.statuses.find(
    (status) =>
      status.definitionId === context.catalog.frenzyWarningId &&
      status.targetKey === enemyTargetKey(enemyId)
  ) ?? null;
}

export function getEnemyFrenzyActiveStatus(context: BattleContext,
  state: ExpeditionState,
  enemyId: string
): StatusInstance | null {
  return state.statuses.find(
    (status) =>
      status.definitionId === context.catalog.frenzyActiveId &&
      status.targetKey === enemyTargetKey(enemyId)
  ) ?? null;
}

export function isEnemyFrenzied(context: BattleContext,
  state: ExpeditionState,
  enemy: EnemyState
): boolean {
  return Boolean(getEnemyFrenzyActiveStatus(context, state, enemy.id));
}

export function hasEnemyFrenzyWarning(context: BattleContext,
  state: ExpeditionState,
  enemy: EnemyState
): boolean {
  return Boolean(getEnemyFrenzyWarningStatus(context, state, enemy.id));
}
