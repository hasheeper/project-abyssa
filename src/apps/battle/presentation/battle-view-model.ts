import type { ExpeditionDieFace } from "../ExpeditionDie3D";
import {
  CHARACTERS,
  MAX_HP,
  PARTY_ORDER,
  getEffectiveFaceQuality,
  getStateFace,
  isEnemyDefeated
} from "../view";
import type {
  BattleCommand,
  CharacterId,
  EnemyIntent,
  ExpeditionState
} from "../view";

export const INTENT_VIEW_WIDTH = 1040;
/* 与角色区的边框、外层 padding 和卡列 padding 对齐：1 + 18 + 34。 */
const PARTY_GRID_INSET = 53;

/** Maps engine faces to their current rust-aware 3D presentation. */
export function buildDieFaces(
  ownerId: CharacterId,
  rustLevel: number
): ExpeditionDieFace[] {
  return CHARACTERS[ownerId].faces.map((face, faceIndex) => ({
    verb: face.verb,
    power: face.power,
    quality: getEffectiveFaceQuality(ownerId, faceIndex, rustLevel),
    wildPip: face.wildPip
  }));
}

export function enemyAnchorX(index: number, count: number): number {
  return ((index + 0.5) / Math.max(count, 1)) * INTENT_VIEW_WIDTH;
}

export function partyAnchorX(memberId: CharacterId, order: readonly CharacterId[] = PARTY_ORDER): number {
  const index = order.indexOf(memberId);
  if (index < 0) return INTENT_VIEW_WIDTH / 2;
  const columnWidth =
    (INTENT_VIEW_WIDTH - PARTY_GRID_INSET * 2) / order.length;
  return PARTY_GRID_INSET + (index + 0.5) * columnWidth;
}

export function getMemberTargetCommand(
  state: ExpeditionState,
  actorId: CharacterId,
  targetId: CharacterId
): BattleCommand | null {
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  const face = die ? getStateFace(state, die) : null;
  if (face?.verb === "heal") {
    const target = state.party.find(member => member.id === targetId);
    if (!target || target.downed || target.hp >= MAX_HP) return null;
    return { type: "heal-member", actorId, targetId };
  }
  if (face?.verb !== "guard" && face?.verb !== "wild") return null;
  const threat = state.enemies
    .filter(
      (enemy) =>
        !isEnemyDefeated(enemy) &&
        enemy.intent?.type === "attack" &&
        enemy.intent.targetId === targetId
    )
    .sort((left, right) => {
      const leftRemain =
        (left.intent as Extract<EnemyIntent, { type: "attack" }>).value - left.blocked;
      const rightRemain =
        (right.intent as Extract<EnemyIntent, { type: "attack" }>).value - right.blocked;
      return rightRemain - leftRemain;
    })[0];
  return threat ? { type: "block-intent", actorId, enemyId: threat.id } : null;
}

export function getEnemyTargetCommand(
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): BattleCommand | null {
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  const face = die ? getStateFace(state, die) : null;
  if (face?.verb === "attack" || face?.verb === "wild") {
    return { type: "attack-enemy", actorId, enemyId };
  }
  if (face?.verb === "coin") return { type: "steal-from", actorId, enemyId };
  if (face?.verb === "guard") return { type: "block-intent", actorId, enemyId };
  return null;
}
