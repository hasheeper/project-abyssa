import type {
  CharacterId,
  ExpeditionState,
  IncomingDamage,
  IntentThreat
} from "../domain/state";
import { getStateFace } from "../rules/dice";
import { isDieDowned, isEnemyDefeated } from "./battle-selectors";

export function canToggleLoad(state: ExpeditionState, dieIndex: number): boolean {
  if (state.mode.type !== "player-turn") return false;
  const die = state.dice[dieIndex];
  if (
    !die ||
    die.sealed ||
    isDieDowned(state, die) ||
    die.spent ||
    die.faceIndex === null
  ) {
    return false;
  }
  return true;
}

export function canActWith(state: ExpeditionState, memberId: CharacterId): boolean {
  if (state.mode.type !== "player-turn") return false;
  const member = state.party.find((item) => item.id === memberId);
  if (!member || member.downed) return false;
  const die = state.dice.find((item) => item.ownerId === memberId);
  if (!die) return false;
  const face = getStateFace(state, die);
  return (
    die.loaded &&
    !die.spent &&
    !die.sealed &&
    !isDieDowned(state, die) &&
    die.faceIndex !== null &&
    face !== null &&
    face.verb !== "blank"
  );
}

export function getBlocked(state: ExpeditionState, enemyId: string): number {
  return state.enemies.find((enemy) => enemy.id === enemyId)?.blocked ?? 0;
}

export function getIncomingDamageFor(
  state: ExpeditionState,
  memberId: CharacterId
): IncomingDamage {
  let raw = 0;
  let final = 0;

  for (const enemy of state.enemies) {
    if (
      isEnemyDefeated(enemy) ||
      enemy.intent?.type !== "attack" ||
      enemy.intent.targetId !== memberId
    ) {
      continue;
    }
    raw += enemy.intent.value;
    final += Math.max(0, enemy.intent.value - enemy.blocked);
  }

  return { raw, final };
}

export function getIntentThreat(
  state: ExpeditionState,
  enemyId: string
): IntentThreat | null {
  const enemy = state.enemies.find((item) => item.id === enemyId);
  const intent = enemy?.intent;
  if (!enemy || isEnemyDefeated(enemy) || intent?.type !== "attack") return null;

  const damage = Math.max(0, intent.value - enemy.blocked);
  if (damage <= 0) return "blocked";

  const target = state.party.find((item) => item.id === intent.targetId);
  if (!target || target.downed) return "normal";

  const incoming = getIncomingDamageFor(state, target.id);
  return incoming.final >= target.hp ? "lethal" : "normal";
}
