import type { BattleEvent, ExpeditionState, EnemyTurnEvent } from "../view";
export function enemyPresentationGroups(events: readonly BattleEvent[]) {
  const groups: { cue: EnemyTurnEvent | null; events: BattleEvent[] }[] = [];
  let current = { cue: null as EnemyTurnEvent | null, events: [] as BattleEvent[] };
  for (const event of events) {
    if (event.type === "enemy-intent-resolved") {
      if (current.events.length) groups.push(current);
      current = { cue: event.payload, events: [] };
    }
    current.events.push(event);
  }
  if (current.events.length) groups.push(current);
  return groups;
}
/** Absolute observed values only; this projection never calculates damage or resolves rules. */
export function applyVisibleEvents(input: ExpeditionState, events: readonly BattleEvent[]): ExpeditionState {
  const state = structuredClone(input);
  for (const event of events) {
    const p = event.payload;
    if (event.type === "damage-applied") {
      const target = event.payload.target;
      const unit = target.kind === "enemy" ? state.enemies.find(e => e.id === target.id) : target.kind === "party-member" ? state.party.find(m => m.id === target.id) : undefined;
      if (unit) unit.hp = event.payload.hpAfter;
    } else if (event.type === "healing-applied") {
      const unit = state.party.find(m => m.id === event.payload.targetId); if (unit) unit.hp = event.payload.hpAfter;
    } else if (event.type === "unit-downed") {
      const unit = state.party.find(m => m.id === event.payload.targetId); if (unit) unit.downed = true;
    } else if (event.type === "guard-applied") {
      const enemy = state.enemies.find(e => e.id === event.payload.enemyId); if (enemy) enemy.blocked = event.payload.blockedAfter;
      const unit = state.party.find(m => m.id === event.payload.protectedId); if (unit) unit.shield = event.payload.shieldAfter;
    } else if (event.type === "resource-changed") {
      if (event.payload.resource === "gold") state.gold = event.payload.after;
      if (event.payload.resource === "bag-gold") state.bagGold = event.payload.after;
      if (event.payload.resource === "hand-multiplier") state.handMultiplier = event.payload.after;
    }
    void p;
  }
  return state;
}
