import { demoIntentPower, releaseManorGuests } from "../v3/manor";
import type { DemoCovenant } from "../../../contracts/demo";
import type { RuleCatalog as DemoCatalog, RuleResolution } from "../../domain/rule-state";
import type { DemoEnemy } from "../../domain/demo-state";
import { matchesMariettaCovenant, planCleaveFormation, applyFormation } from "../v4/formation";
import { predictEnemyDamage } from "../v4/memory";
import {
  damageEnemy,
  emit,
  healMember,
  livingEnemies,
  randomInt,
} from "./combat";

export function resolveDemoCovenants(
  catalog: DemoCatalog,
  ctx: RuleResolution,
) {
  const { state } = ctx,
    hand = state.encounter.hand!;
  const priority: DemoCovenant["effect"][] = [
    "threat-damage",
    "execution-damage",
    "knives",
    "healing",
  ];
  const triggers = state.run.party
    .filter((m) => hand.covenantOwnerIds.includes(m.id) && m.config.covenantId && m.config.covenantId !== "covenant.marietta")
    .map((m) => ({ member: m, def: catalog.covenants[m.config.covenantId!] }))
    .filter(({ def }) => {
      switch (def.pattern) {
        case "flush":
          return hand.patterns.flush;
        case "triple":
          return hand.patterns.triple;
        case "straight":
          return hand.patterns.straight;
        case "two-pair-blank":
          return hand.patterns.twoPair && hand.hasBlank;
      }
    })
    .sort(
      (a, b) => priority.indexOf(a.def.effect) - priority.indexOf(b.def.effect),
    );
  const threat = (e: DemoEnemy) =>
    e.intent?.kind === "attack" && e.boundRound !== state.encounter.round
      ? demoIntentPower(state, e)
      : 0;
  for (const { member, def } of triggers) {
    emit(ctx, "covenant-triggered", member.id, {
      covenantId: def.id,
      stage: member.config.covenantStage,
    });
    const range = def.stages[member.config.covenantStage - 1];
    if (def.effect === "healing") {
      const living = state.run.party
        .filter((m) => m.hp > 0)
        .sort((a, b) => a.hp - b.hp);
      const cleanseTarget = living[0];
      const wounded = living.filter((m) => m.hp < m.config.maxHp);
      if (wounded.length)
        for (const ally of wounded.slice(
          0,
          randomInt(state, range.min, range.max),
        ))
          healMember(ctx, ally, 1, member.id);
      if (member.config.covenantStage === 2 && cleanseTarget) {
        const die = state.encounter.dice.find(
          (d) => d.ownerId === cleanseTarget.id,
        )!;
        if (die.sealed) {
          die.sealed = false;
          emit(ctx, "status-cleansed", member.id, {
            targetId: cleanseTarget.id,
            statusId: "status.sealed",
          });
        }
      }
      continue;
    }
    if (!state.encounter.formation.length || state.encounter.memory?.defeated) continue;
    if (def.effect === "threat-damage") {
      const enemies = livingEnemies(state),
        attacking = enemies.filter(
          (e) =>
            e.intent?.kind === "attack" &&
            e.boundRound !== state.encounter.round,
        );
      const target = attacking.length
        ? attacking.sort((a, b) => threat(b) - threat(a))[0]
        : enemies.sort((a, b) => a.hp - b.hp)[0];
      damageEnemy(
        catalog,
        ctx,
        target.id,
        randomInt(state, range.min, range.max),
        member.id,
      );
    } else if (def.effect === "execution-damage") {
      const hit = new Set<string>(),
        count = randomInt(state, range.min, range.max);
      for (let i = 0; i < count; i++) {
        if (state.encounter.memory?.defeated) break;
        const enemies = livingEnemies(state).filter((e) => !hit.has(e.id)),
          killable = enemies.filter((e) => catalog.rulesVersion === 4 ? predictEnemyDamage(state, e.id, 3).applied >= e.hp : e.hp <= 3);
        const target = killable.length
          ? killable.sort((a, b) => b.hp - a.hp || threat(b) - threat(a))[0]
          : enemies.sort((a, b) => a.hp - b.hp)[0];
        if (!target) break;
        hit.add(target.id);
        damageEnemy(catalog, ctx, target.id, 3, member.id);
      }
    } else {
      const count = randomInt(state, range.min, range.max);
      for (let i = 0; i < count; i++) {
        if (state.encounter.memory?.defeated) break;
        const enemies = livingEnemies(state);
        if (!enemies.length) break;
        damageEnemy(
          catalog,
          ctx,
          enemies[randomInt(state, 0, enemies.length - 1)].id,
          1,
          member.id,
        );
      }
    }
    releaseManorGuests(catalog, ctx);
  }
  const marietta = state.run.party.find(m => m.config.covenantId === "covenant.marietta" && hand.covenantOwnerIds.includes(m.id));
  if (catalog.rulesVersion === 4 && marietta && matchesMariettaCovenant(hand.dice.map(d => d.value))) {
    emit(ctx, "covenant-triggered", marietta.id, { covenantId: catalog.combat.mariettaCovenant.id, stage: marietta.config.covenantStage });
    const budget = catalog.combat.mariettaCovenant.budgets[marietta.config.covenantStage - 1];
    applyFormation(ctx, planCleaveFormation(state, budget), marietta.id, "covenant", budget);
  }
}
