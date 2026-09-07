import { invalid } from "../../../contracts/validation";
import type { RuleCheckpoint, RuleResolution } from "../../domain/rule-state";
import { emit } from "../demo-events";
import { demoIntentPower } from "../v3/manor";

export type FormationPlan = { before: string[]; after: string[]; swaps: number; scoreBefore: [number, number]; scoreAfter: [number, number] };
const compare = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
/** At most two adjacent swaps; no factorial permutation search or instance-ID tie break. */
export function planFormation(before: readonly string[], budget: 1 | 2, score: (ids: string[]) => [number, number]): FormationPlan {
  if (![1, 2].includes(budget) || before.length > 20 || new Set(before).size !== before.length) invalid("formation", "Invalid bounded permutation input");
  const initial = before.map((_, i) => i), candidates = [{ order: initial, swaps: 0 }], seen = new Set([initial.join(",")]);
  for (let at = 0; at < candidates.length; at++) {
    const c = candidates[at]; if (c.swaps === budget) continue;
    for (let i = 0; i + 1 < before.length; i++) {
      const order = [...c.order]; [order[i], order[i + 1]] = [order[i + 1], order[i]];
      const key = order.join(","); if (!seen.has(key)) { seen.add(key); candidates.push({ order, swaps: c.swaps + 1 }); }
    }
  }
  const scored = candidates.map(c => ({ ...c, score: score(c.order.map(i => before[i])), moved: c.order.filter((n, i) => n !== i).length }));
  scored.sort((a, b) => compare(b.score, a.score) || a.swaps - b.swaps || a.moved - b.moved || compare(a.order, b.order));
  const firstScore = score([...before]), best = scored[0];
  const improve = compare(best.score, firstScore) > 0;
  return { before: [...before], after: improve ? best.order.map(i => before[i]) : [...before], swaps: improve ? best.swaps : 0, scoreBefore: firstScore, scoreAfter: improve ? best.score : firstScore };
}
export function planCleaveFormation(state: RuleCheckpoint, budget: 1 | 2) {
  const units = new Map(state.encounter.enemies.map(e => [e.id, e]));
  const threat = (id: string) => { const e = units.get(id)!; return e.intent?.kind === "attack" && e.boundRound !== state.encounter.round ? demoIntentPower(state, e) : 0; };
  return planFormation(state.encounter.formation, budget, ids => {
    let k = 0, t = 0;
    for (let i = 0; i + 1 < ids.length; i++) for (const [a, b] of [[ids[i], ids[i + 1]], [ids[i + 1], ids[i]]]) {
      if (units.get(a)!.hp <= 2 && units.get(b)!.hp <= 1) { k++; t += threat(a) + threat(b); }
    }
    return [k, t];
  });
}
export function planBossFormation(state: RuleCheckpoint, budget: 1 | 2) {
  const memory = state.encounter.memory!;
  return planFormation(state.encounter.formation, budget, ids => {
    const at = ids.indexOf(memory.bossId);
    const neighbors = at < 0 ? [] : [ids[at - 1], ids[at + 1]];
    return [neighbors.filter(id => state.encounter.enemies.some(e => e.id === id && e.definitionId === memory.puppetId && e.hp > 0 && e.disposition !== "released")).length, 0];
  });
}
export function applyFormation(ctx: RuleResolution, plan: FormationPlan, source: string, reason: "covenant" | "memory-intent", budget: 1 | 2) {
  const enc = ctx.state.encounter, before = enc.formation;
  const alive = enc.enemies.filter(e => e.hp > 0 && e.disposition !== "released").map(e => e.id).sort();
  if (enc.phase !== "enemy" || before.join("\0") !== plan.before.join("\0") || [...plan.after].sort().join("\0") !== alive.join("\0") || new Set(plan.after).size !== alive.length) invalid("formation", "Stale or invalid live permutation");
  const indices = plan.after.map(id => before.indexOf(id));
  const swaps = indices.reduce((n, at, i) => n + indices.slice(i + 1).filter(x => x < at).length, 0);
  if (swaps > budget || swaps !== plan.swaps) invalid("formation", "Adjacent swap budget exceeded");
  if (reason === "covenant" ? source !== "marietta" || !enc.hand?.covenantOwnerIds.includes(source) : source !== enc.memory?.bossId) invalid("formation.source", "Unbound reorder source");
  if (!swaps) {
    emit(ctx, "formation-unchanged", source, { source, reason: before.length < 2 ? "no-targets" : "no-improvement", round: enc.round });
    return;
  }
  enc.formation = [...plan.after];
  emit(ctx, "formation-reordered", source, { before: [...before], after: [...plan.after], source, reason, round: enc.round, swaps });
}
export function matchesMariettaCovenant(values: readonly number[]): boolean {
  if (values.length !== 5) return false;
  const counts = new Map<number, number>();
  for (const n of values) counts.set(n, (counts.get(n) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  return groups[0] === 5 || groups[0] === 4 || groups[0] === 3 && groups[1] === 2;
}
