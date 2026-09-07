import type { RuleCatalog as DemoCatalog, RuleBattleState, RuleResolution } from "../../domain/rule-state";
import { invalid } from "../../../contracts/validation";
import { emit } from "../demo-events";
export { emit } from "../demo-events";
import { activeManorEnemy, manorGuestCount, emitManorSeatChange } from "../v3/manor";
import type {
  DemoActionChoice,
  DemoBattleState,
  DemoEnemy,
  DemoEvent,
  DemoMember,
} from "../../domain/demo-state";
import { drawRngValue } from "../../persistence/rng";
import { resolveDemoParty } from "./configuration";
import { demoFace } from "./hand";
import { predictEnemyDamage } from "../v4/memory";

export type DemoResolution = { state: DemoBattleState; events: DemoEvent[] };
export function randomInt(
  state: RuleBattleState,
  min: number,
  max: number,
): number {
  if (min === max) return min;
  const draw = drawRngValue(state.run.rng.combat);
  state.run.rng.combat = draw.stream;
  return min + Math.floor(draw.value * (max - min + 1));
}
export function livingEnemies(state: RuleBattleState): DemoEnemy[] {
  return state.encounter.formation.map((id) =>
    state.encounter.enemies.find((e) => e.id === id)!,
  );
}
export function resonance(catalog: DemoCatalog, state: RuleBattleState) {
  return resolveDemoParty(
    catalog,
    state.run.progress,
    state.run.party.map((m) => m.id),
  ).resonance;
}
export function damageEnemy(
  catalog: DemoCatalog,
  ctx: RuleResolution,
  id: string,
  amount: number,
  actorId: string,
) {
  const e = ctx.state.encounter.enemies.find((e) => e.id === id);
  if (!e || !activeManorEnemy(e) || ctx.state.encounter.memory?.defeated) return;
  const seatsBefore = manorGuestCount(ctx.state);
  const before = e.hp;
  const predicted = predictEnemyDamage(ctx.state, id, amount);
  e.hp = Math.max(0, e.hp - (catalog.rulesVersion === 4 ? predicted.applied : amount));
  emit(ctx, "damage-applied", actorId, {
    targetKind: "enemy",
    targetId: id,
    applied: before - e.hp,
    hpAfter: e.hp,
    ...(catalog.rulesVersion === 4 ? { raw: amount, absorbed: predicted.absorbed } : {}),
  });
  if (e.hp !== 0) return;
  e.intent = null;
  e.threaded = false;
  e.boundRound = null;
  ctx.state.encounter.formation = ctx.state.encounter.formation.filter(
    (key) => key !== id,
  );
  if (e.disposition) e.disposition = "defeated";
  if (ctx.state.encounter.memory?.bossId === id) {
    ctx.state.encounter.memory.defeated = true;
    emit(ctx, "memory-endurance-depleted", actorId, { targetId: id });
    return;
  }
  if (catalog.manor?.boss.definitionId === e.definitionId) return;
  const bounty = e.origin?.kind === "summoned" ? 0 : catalog.enemies[e.definitionId].bounty;
  ctx.state.run.looseGold += bounty;
  emit(ctx, "enemy-defeated", actorId, { targetId: id, bounty });
  if (e.origin?.seat) emitManorSeatChange(ctx, "defeated", id, seatsBefore);
}
export function damageMember(
  catalog: DemoCatalog,
  ctx: RuleResolution,
  id: string,
  amount: number,
  sourceId: string,
) {
  const m = ctx.state.run.party.find((m) => m.id === id);
  if (!m || m.hp <= 0) return;
  const before = m.hp;
  m.hp = Math.max(0, m.hp - amount);
  emit(ctx, "damage-applied", sourceId, {
    targetKind: "party-member",
    targetId: id,
    applied: before - m.hp,
    hpAfter: m.hp,
  });
  if (m.hp > 0) return;
  m.pendingSeal = false;
  const face = m.config.faces
    .filter((f) => f.quality !== "rust" && !m.temporaryRust.includes(f.id))
    .sort(
      (a, b) =>
        Number(a.quality === "gild") - Number(b.quality === "gild") ||
        a.slot - b.slot,
    )[0];
  if (face) m.temporaryRust.push(face.id);
  const die = ctx.state.encounter.dice.find((d) => d.ownerId === id)!;
  die.loaded = false;
  if (resonance(catalog, ctx.state).rainy) {
    m.rainyReturn = true;
    for (const ally of ctx.state.run.party.filter((p) => p.hp > 0))
      if (!ctx.state.encounter.guardBonusIds.includes(ally.id))
        ctx.state.encounter.guardBonusIds.push(ally.id);
  }
  emit(ctx, "unit-downed", id, { faceId: face?.id ?? null });
}
export function healMember(
  ctx: RuleResolution,
  member: DemoMember,
  power: number,
  actorId: string,
) {
  if (member.hp <= 0) return;
  const before = member.hp;
  member.hp = Math.min(member.config.maxHp, member.hp + power);
  emit(ctx, "healing-applied", actorId, {
    targetId: member.id,
    applied: member.hp - before,
    hpAfter: member.hp,
  });
}
export function finishEncounter(ctx: RuleResolution) {
  const { state } = ctx;
  const outcome = state.run.party.every((m) => m.hp === 0)
    ? "wipe"
    : !state.encounter.formation.length
      ? "victory"
      : null;
  if (!outcome || state.encounter.phase === "complete") return;
  state.encounter.phase = "complete";
  state.encounter.outcome = outcome;
  state.encounter.enemies.forEach((e) => {
    e.boundRound = null;
    e.threaded = false;
    e.escaped = false;
  });
  state.encounter.guardBonusIds = [];
  if (!state.run.completedEncounterIds.includes(state.encounter.id))
    state.run.completedEncounterIds.push(state.encounter.id);
  emit(ctx, "encounter-completed", null, {
    outcome,
    encounterId: state.encounter.id,
  });
}

export type DemoActionOption = {
  choice: DemoActionChoice;
  targetId: string | null;
  amount: number;
  secondaryTargetId: string | null;
};
export function demoActionOptions(
  catalog: DemoCatalog,
  state: RuleBattleState,
  actorId: string,
): { reason: string | null; options: DemoActionOption[] } {
  const die = state.encounter.dice.find((d) => d.ownerId === actorId),
    m = state.run.party.find((m) => m.id === actorId);
  const fail = (reason: string) => ({ reason, options: [] });
  if (state.encounter.phase !== "act" || !state.encounter.formation.length || state.encounter.memory?.defeated)
    return fail("not-player-action-window");
  if (!die || !m || m.hp <= 0) return fail("actor-unavailable");
  if (die.sealed) return fail("die-sealed");
  if (die.spent) return fail("die-spent");
  if (!die.loaded) return fail("die-not-loaded");
  const face = demoFace(state, die);
  if (!face) return fail("unrolled-die");
  const kind = catalog.actions[face.actionId].kind;
  const options: DemoActionOption[] = [];
  const add = (
    choice: DemoActionChoice,
    targetId: string | null,
    amount: number,
    secondaryTargetId: string | null = null,
  ) => options.push({ choice, targetId, amount, secondaryTargetId });
  const enemies = livingEnemies(state);
  if (
    ["attack", "wild", "cleave-left", "cleave-right", "thread-strike"].includes(
      kind,
    )
  ) {
    enemies.forEach((e, i) =>
      add(
        "attack",
        e.id,
        face.power + (kind === "thread-strike" && e.threaded ? 2 : 0),
        kind === "cleave-left"
          ? (enemies[i - 1]?.id ?? null)
          : kind === "cleave-right"
            ? (enemies[i + 1]?.id ?? null)
            : null,
      ),
    );
  }
  if (["guard", "wild", "protect"].includes(kind)) {
    for (const e of enemies)
      if (e.intent?.kind === "attack")
        add(
          "guard",
          e.id,
          face.power +
            (kind === "protect" && e.intent.targetId !== actorId ? 1 : 0) +
            (state.encounter.guardBonusIds.includes(actorId) ? 1 : 0),
        );
  }
  if (["heal", "wild", "expensive-heal"].includes(kind)) {
    for (const ally of state.run.party)
      if (ally.hp > 0 && ally.hp < ally.config.maxHp)
        add("heal", ally.id, Math.min(face.power, ally.config.maxHp - ally.hp));
  }
  if (kind === "bind") {
    for (const e of enemies) {
      const injured = e.hp * 2 < catalog.enemies[e.definitionId].hp;
      const ceiling = Math.min(
        6,
        injured ? m.config.maxHp * 2 : Math.ceil(m.config.maxHp * 1.5),
      );
      if (e.hp <= ceiling) add("bind", e.id, 0);
    }
  }
  if (kind === "guard-all" && enemies.some((e) => e.intent?.kind === "attack"))
    add("guard-all", null, face.power);
  return {
    reason: options.length
      ? null
      : kind === "blank"
        ? "blank-face"
        : "no-legal-target",
    options,
  };
}
export function performDemoAction(
  catalog: DemoCatalog,
  ctx: RuleResolution,
  actorId: string,
  choice: DemoActionChoice,
  targetId: string | null,
) {
  const { state } = ctx,
    offered = demoActionOptions(catalog, state, actorId);
  const option = offered.options.find(
    (o) => o.choice === choice && o.targetId === targetId,
  );
  if (!option)
    invalid(
      "action",
      offered.reason ?? "Invalid target or action choice",
      offered.reason ?? "invalid-target",
    );
  const die = state.encounter.dice.find((d) => d.ownerId === actorId)!,
    face = demoFace(state, die)!,
    kind = catalog.actions[face.actionId].kind;
  if (choice === "attack") {
    const e = state.encounter.enemies.find((e) => e.id === targetId)!;
    if (kind === "thread-strike" && e.threaded) {
      e.threaded = false;
      emit(ctx, "thread-consumed", actorId, { targetId: e.id });
    }
    damageEnemy(catalog, ctx, e.id, option.amount, actorId);
    if (option.secondaryTargetId)
      damageEnemy(catalog, ctx, option.secondaryTargetId, 1, actorId);
  } else if (choice === "heal") {
    healMember(
      ctx,
      state.run.party.find((m) => m.id === targetId)!,
      face.power,
      actorId,
    );
    if (kind === "expensive-heal") {
      const cost = Math.min(state.run.looseGold, 10);
      state.run.looseGold -= cost;
      emit(ctx, "healing-cost", actorId, { cost });
    }
  } else if (choice === "bind") {
    const e = state.encounter.enemies.find((e) => e.id === targetId)!;
    const stunned = !e.escaped;
    if (stunned) {
      e.boundRound = state.encounter.round;
      e.escaped = true;
    }
    e.threaded = true;
    emit(ctx, "thread-bound", actorId, { targetId: e.id, stunned });
  } else {
    for (const e of livingEnemies(state))
      if (
        e.intent?.kind === "attack" &&
        (choice === "guard-all" || e.id === targetId)
      ) {
        e.intent.blocked += option.amount;
        emit(ctx, "guard-applied", actorId, {
          enemyId: e.id,
          targetId: e.intent.targetId,
          amount: option.amount,
        });
      }
  }
  die.spent = true;
  emit(ctx, "action-resolved", actorId, {
    actionId: face.actionId,
    choice,
    targetId,
  });
}
