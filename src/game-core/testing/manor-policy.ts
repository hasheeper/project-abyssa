import type { ValidatedDemoCatalog } from "../contracts";
import { createDemoBattleEngine, type DemoBattleCommand, type DemoBattleState } from "../battle";
/** Deterministic, explainable test policy; never supplies dice results or rewrites HP. */
export function manorBattlePlan(c: ValidatedDemoCatalog, state: DemoBattleState, policy: "attack" | "survival"): DemoBattleCommand[] {
  const engine = createDemoBattleEngine(c), view = engine.select(state), e = state.encounter;
  if (e.phase === "roll") return [{type: "roll"}];
  if (e.phase !== "act" || !e.formation.length) return [];
  const available = e.dice.filter(d => !d.spent && !d.sealed && state.run.party.some(m => m.id === d.ownerId && m.hp > 0));
  const unloaded = available.filter(d => !d.loaded);
  if (unloaded.length) return unloaded.map(d => ({type: "toggle-load", actorId: d.ownerId}));
  const actions = view.party.flatMap(m => m.actions.options.map(o => {
    const enemy = view.enemies.find(e => e.id === o.targetId), member = view.party.find(p => p.id === o.targetId);
    const threat = member ? view.enemies.filter(e => e.intent?.targetId === member.id).reduce((n, e) => n + e.damage, 0) : 0;
    let score = 0;
    if (o.choice === "attack" && enemy) score = 50 + Math.min(o.amount, enemy.hp) * 3 + (o.amount >= enemy.hp ? 30 + enemy.damage * 5 : 0) + (o.secondaryTargetId ? 6 : 0);
    if (c.ref.rulesVersion === 3 && policy === "attack" && o.choice === "attack" && enemy?.definitionId === c.data.manor?.boss.definitionId) score += 90;
    if (o.choice === "heal" && member && o.amount > 0) score = policy === "survival" && threat >= member.hp ? 140 + o.amount : 20 + o.amount;
    if (o.choice === "guard" && enemy && enemy.damage > 0) score = policy === "survival" && view.party.some(p => p.id === enemy.intent?.targetId && p.hp <= enemy.damage) ? 120 : 10 + Math.min(o.amount, enemy.damage);
    if (o.choice === "guard-all" && view.enemies.some(e => e.damage > 0)) score = policy === "survival" ? 115 : 15;
    return {score, command: {type: "act" as const, actorId: m.id, choice: o.choice, targetId: o.targetId}};
  })).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
  if (actions.length) return [actions[0].command];
  if (e.rerolls > 0 && available.length) return [...available.filter(d => d.loaded).map(d => ({type: "toggle-load" as const, actorId: d.ownerId})), {type: "reroll"}];
  return [{type: "end-turn"}];
}
