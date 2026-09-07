import type { RuleCheckpoint, RuleResolution } from "../../domain/rule-state";
import { emit } from "../demo-events";
import { canonicalJson } from "../../../contracts/validation";
import { sha256 } from "../../../contracts/sha256";

export const memorySupplyId = (runId: string, definitionId: string) => `memory-supply:${sha256(canonicalJson([runId, definitionId])).slice(0, 32)}`;

export function memoryProtection(state: RuleCheckpoint, enemyId: string): number {
  const enc = state.encounter, memory = enc.memory;
  if (!memory || memory.bossId !== enemyId) return 0;
  const at = enc.formation.indexOf(enemyId); if (at < 0) return 0;
  return [enc.formation[at - 1], enc.formation[at + 1]].filter(id => enc.enemies.some(e => e.id === id && e.definitionId === memory.puppetId && e.hp > 0 && e.disposition !== "released")).length;
}
/** Shared by targeting, previews and each actual hit; protection is never consumed. */
export function predictEnemyDamage(state: RuleCheckpoint, id: string, raw: number) {
  const enemy = state.encounter.enemies.find(e => e.id === id);
  const protection = memoryProtection(state, id), absorbed = Math.min(raw, protection);
  return { raw, protection, absorbed, applied: !enemy || enemy.hp <= 0 || enemy.disposition === "released" || state.encounter.memory?.defeated ? 0 : Math.min(enemy.hp, Math.max(0, raw - protection)) };
}
/** Endurance victory retires survivors, without killing or paying for them. */
export function releaseMemoryDefenders(ctx: RuleResolution) {
  const enc = ctx.state.encounter, memory = enc.memory;
  if (!memory?.defeated || memory.released || !ctx.state.run.party.some(m => m.hp > 0)) return;
  memory.released = true;
  for (const e of enc.enemies) {
    if (e.hp <= 0 && e.id !== memory.bossId) continue;
    e.disposition = "released"; e.intent = null; e.boundRound = null; e.threaded = false;
    emit(ctx, "memory-defender-released", null, { targetId: e.id, reason: "defense-breached" });
  }
  enc.formation = [];
}
