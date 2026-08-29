import {
  FRENZY_ACTIVE_STATUS_ID,
  FRENZY_WARNING_STATUS_ID
} from "../content/effect-definitions";
import type {
  EnemyState,
  ExpeditionState,
  StatusInstance
} from "../domain/state";

export const FRENZY_WARNING_DURATION = 3;

function enemyTargetKey(enemyId: string): string {
  return `enemy:${enemyId}`;
}

export function getEnemyFrenzyWarningStatus(
  state: ExpeditionState,
  enemyId: string
): StatusInstance | null {
  return state.statuses.find(
    (status) =>
      status.definitionId === FRENZY_WARNING_STATUS_ID &&
      status.targetKey === enemyTargetKey(enemyId)
  ) ?? null;
}

export function getEnemyFrenzyActiveStatus(
  state: ExpeditionState,
  enemyId: string
): StatusInstance | null {
  return state.statuses.find(
    (status) =>
      status.definitionId === FRENZY_ACTIVE_STATUS_ID &&
      status.targetKey === enemyTargetKey(enemyId)
  ) ?? null;
}

export function isEnemyFrenzied(
  state: ExpeditionState,
  enemy: EnemyState
): boolean {
  return Boolean(getEnemyFrenzyActiveStatus(state, enemy.id));
}

export function hasEnemyFrenzyWarning(
  state: ExpeditionState,
  enemy: EnemyState
): boolean {
  return Boolean(getEnemyFrenzyWarningStatus(state, enemy.id));
}
