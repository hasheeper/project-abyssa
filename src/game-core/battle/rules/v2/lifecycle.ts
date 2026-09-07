import { activeManorEnemy, demoIntentPower, summonManorGuest } from "../v3/manor";
import type { RuleCatalog as DemoCatalog, RuleResolution } from "../../domain/rule-state";
import { invalid } from "../../../contracts/validation";
import { planBossFormation, applyFormation } from "../v4/formation";
import {
  damageMember,
  emit,
  finishEncounter,
  randomInt,
  resonance,
} from "./combat";

export function beginDemoRound(catalog: DemoCatalog, ctx: RuleResolution) {
  const { state } = ctx,
    enc = state.encounter;
  enc.round++;
  enc.phase = "roll";
  enc.hand = null;
  enc.enemyOrder = [];
  enc.cursor = 0;
  enc.rerolls = 2;
  enc.itemsUsed = 0; enc.extraRerolls = 0;
  enc.dice = state.run.party.map((m) => ({
    ownerId: m.id,
    faceIndex: null,
    loaded: false,
    spent: false,
    sealed: m.hp > 0 && m.pendingSeal,
  }));
  state.run.party.forEach((m) => {
    m.pendingSeal = false;
  });
  const allies = state.run.party.filter((m) => m.hp > 0);
  const reduction =
    enc.round === 1 && resonance(catalog, state).sovereign ? 1 : 0;
  for (const enemy of enc.enemies) {
    enemy.boundRound = null;
    if (!activeManorEnemy(enemy)) {
      enemy.intent = null;
      continue;
    }
    const def = catalog.enemies[enemy.definitionId];
    const kind =
      enc.memory?.bossId === enemy.id && def.behavior === "idle" ? (enemy.chargeReady ? "attack" : "idle") : def.behavior === "charge"
        ? enemy.chargeReady
          ? "attack"
          : "charge"
        : def.behavior === "heiress" ? (enemy.chargeReady ? "summon" : "attack") : def.behavior === "butler" ? (enemy.chargeReady ? "attack" : "seal") : def.behavior;
    const repair = enc.formation.map(id => enc.enemies.find(e => e.id === id)!).filter(e => e.id !== enemy.id && e.hp > 0 && e.hp < catalog.enemies[e.definitionId].hp).sort((a, b) => (catalog.enemies[b.definitionId].hp - b.hp) - (catalog.enemies[a.definitionId].hp - a.hp))[0];
    const targetId =
      (kind === "attack" || kind === "seal") && allies.length
        ? allies[randomInt(state, 0, allies.length - 1)].id
        : kind === "repair" ? repair?.id ?? null : null;
    enemy.intent = {
      kind: kind === "repair" && !targetId ? "idle" : kind,
      targetId,
      value: kind === "attack" ? Math.max(0, def.attack - reduction) : kind === "repair" ? 1 : 0,
      blocked: 0,
      ...(catalog.rulesVersion >= 3 ? {id: `${enemy.id}:intent:${enc.round}`} : {}),
      ...(enc.memory?.bossId === enemy.id && kind === "idle" ? { operation: "memory-reorder" as const } : {}),
      ...(def.behavior === "heiress" && kind === "attack" ? {value: 2, formula: {kind: "banquet-seats" as const, reduction}} : {}),
    };
  }
  emit(ctx, "round-started", null, { round: enc.round });
}
export function resolveDemoEnemy(catalog: DemoCatalog, ctx: RuleResolution) {
  const { state } = ctx,
    enc = state.encounter;
  if (enc.phase !== "enemy" || enc.cursor >= enc.enemyOrder.length)
    invalid("phase", "No queued enemy", "command-not-available");
  const enemyId = enc.enemyOrder[enc.cursor++];
  const enemy = enc.enemies.find((e) => e.id === enemyId)!;
  const intent = enemy.intent;
  if (activeManorEnemy(enemy) && enemy.boundRound !== enc.round && intent) {
    if (intent.operation === "memory-reorder" && catalog.rulesVersion === 4) {
      const budget = catalog.combat.memory.reorderBudget;
      applyFormation(ctx, planBossFormation(state, budget), enemy.id, "memory-intent", budget);
      enemy.chargeReady = true;
    } else if (intent.kind === "attack") {
      if (intent.targetId)
        damageMember(
          catalog,
          ctx,
          intent.targetId,
          Math.max(0, demoIntentPower(state, enemy) - intent.blocked),
          enemy.id,
        );
      enemy.chargeReady = catalog.enemies[enemy.definitionId].behavior === "heiress";
    } else if (intent.kind === "summon") {
      summonManorGuest(catalog, ctx, enemy);
      enemy.chargeReady = false;
    } else if (intent.kind === "repair") {
      const target = enc.enemies.find(e => e.id === intent.targetId && e.hp > 0);
      if (target) {
        const before = target.hp;
        target.hp = Math.min(catalog.enemies[target.definitionId].hp, target.hp + intent.value);
        emit(ctx, "enemy-repaired", enemy.id, { targetId: target.id, applied: target.hp - before, hpAfter: target.hp });
      }
    } else if (intent.kind === "charge") enemy.chargeReady = true;
    else if (intent.kind === "seal") {
      if (catalog.enemies[enemy.definitionId].behavior === "butler") enemy.chargeReady = true;
      const member = state.run.party.find(
        (m) => m.id === intent.targetId && m.hp > 0,
      );
      if (member) {
        member.pendingSeal = true;
        emit(ctx, "seal-scheduled", enemy.id, { targetId: member.id });
      }
    }
  }
  emit(ctx, "enemy-intent-resolved", enemy.id, {
    skipped: enemy.hp <= 0 || enemy.boundRound === enc.round,
    cursor: enc.cursor,
  });
  finishEncounter(ctx);
  if (catalog.rulesVersion !== 4 && enc.cursor === enc.enemyOrder.length)
    enc.enemies.forEach((e) => {
      e.boundRound = null;
    });
}
