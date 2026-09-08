import type { RuleContext, RuleCheckpoint } from "../../domain/rule-state";
import * as v from "../../../contracts/validation";
import { memorySupplyId } from "./memory";
import { createBattleRngState } from "../../persistence/rng";

/** Historical constraints augment the shared dice, identity, hand, RNG and status reader. */
export function validateMemoryEncounter(catalog: RuleContext, state: RuleCheckpoint) {
  if (catalog.data.rulesVersion !== 4) v.invalid("memory", "Version 4 required");
  const spec = catalog.data.progression.chapter, rules = catalog.data.combat.memory, { run, encounter: enc } = state;
  const memory = v.record(enc.memory, "memory", ["bossId", "puppetId", "defeated", "released"]);
  v.boolean(memory.defeated, "defeated"); v.boolean(memory.released, "released");
  const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
  const rng = createBattleRngState(run.rng.combat.seed);
  for (const key of ["loot", "flavor"] as const) if (run.rng[key].seed !== rng[key].seed || run.rng[key].cursor !== 0) v.invalid("memory.rng", "Foreign or consumed ordinary random stream");
  if (run.routeId !== rules.routeId || enc.definitionId !== spec.encounterId || !same(run.progress, spec.progress) || !same(run.party.map(m => m.id), spec.partyIds)) v.invalid("memory.template", "Fixed historical template differs");
  if (run.layer !== 1 || run.room !== 0 || run.encounterSequence !== 1 || enc.id !== `${run.id}:encounter:1` || !same(run.completedEncounterIds,enc.phase === "complete" ? [enc.id] : [])) v.invalid("memory.identity", "Historical encounter identity differs");
  if (run.looseGold || run.bankedGold || run.handBonus || run.layerResults.length || run.settledLayers.length || run.completedRoomIds.length || run.eventResults.length || run.revealed.length || Object.keys(run.foodUses).length || enc.extraRerolls) v.invalid("memory.economy", "History has ordinary journey resources");
  if (run.supplies.length !== 2) v.invalid("memory.supplies", "Two local supplies required");
  for (const expected of spec.supplies) {
    const local = run.supplies.find(s => s.definitionId === expected.definitionId);
    if (!local || local.source !== "memory.marietta.allowance" || local.instanceId !== memorySupplyId(run.id, expected.definitionId) || local.charges > expected.charges) v.invalid("memory.supplies", "Local allowance differs");
  }
  const initial = [spec.bossId, ...Array<string>(spec.puppetCount).fill(spec.puppetId)], boss = enc.enemies[0];
  if (!same(enc.enemies.map(e => e.definitionId), initial) || memory.bossId !== boss.id || memory.puppetId !== spec.puppetId || memory.defeated !== (boss.hp === 0)) v.invalid("memory.enemies", "Historical roster or endurance state differs");
  enc.enemies.forEach((e, i) => {
    if (e.id !== `${enc.id}:enemy:${i + 1}` || !same(e.origin, {kind: "initial", serial: i + 1, bornRound: 0, summonerId: null, seat: false})) v.invalid("memory.origin", "Unproved historical spawn");
    const disposition = e.hp === 0 && i !== 0 ? "defeated" : memory.released ? "released" : e.hp === 0 ? "defeated" : "active";
    if (e.disposition !== disposition || e.disposition !== "active" && (e.intent || e.threaded || e.boundRound !== null)) v.invalid("memory.disposition", "Historical retirement differs");
    if (e.intent) {
      if (e.intent.id !== `${e.id}:intent:${enc.round}` || e.intent.formula) v.invalid("memory.intent", "Foreign intent or ordinary formula");
      if (catalog.data.contentVersion >= 3) {
        if (e.intent.operation !== undefined || !["attack", "charge"].includes(e.intent.kind) || e.intent.value !== (e.intent.kind === "attack" ? rules.judgmentPower : 0) || e.intent.kind === "charge" && (e.intent.targetId !== null || e.intent.blocked !== 0)) v.invalid("memory.intent", "Clockwork intent differs");
        const executed = enc.enemyOrder.slice(0, enc.cursor).includes(e.id) && e.boundRound !== enc.round;
        if (enc.phase !== "complete" && e.chargeReady !== (executed ? e.intent.kind === "charge" : e.intent.kind === "attack")) v.invalid("memory.loop", "Clockwork charge cursor differs");
        return;
      }
      if (e.intent.operation !== undefined && (i !== 0 || e.intent.kind !== "idle" || e.intent.operation !== "memory-reorder")) v.invalid("memory.intent", "Invalid reorder intent");
      if (e.intent.kind === "idle" ? i !== 0 || e.intent.operation !== "memory-reorder" || e.intent.targetId !== null || e.intent.value !== 0 || e.intent.blocked !== 0 : e.intent.kind !== "attack" || e.intent.operation !== undefined || e.intent.value !== (i === 0 ? rules.judgmentPower : 1)) v.invalid("memory.intent", "Historical intent differs");
      // Intent remains visible after execution; the loop cursor then describes the next intent.
      const executed = enc.enemyOrder.slice(0, enc.cursor).includes(e.id) && e.boundRound !== enc.round;
      if (i === 0 && enc.phase !== "complete" && e.chargeReady !== (executed ? e.intent.operation === "memory-reorder" : e.intent.kind === "attack")) v.invalid("memory.loop", "Intent and alternating cursor differ");
    }
  });
  if (memory.released !== (memory.defeated && enc.phase === "complete" && enc.outcome === "victory") || memory.defeated && !["act","complete"].includes(enc.phase)) v.invalid("memory.ending", "Invalid endurance ending");
  if (enc.outcome === "victory" && !memory.defeated) v.invalid("memory.ending", "No defeated endurance");
}
