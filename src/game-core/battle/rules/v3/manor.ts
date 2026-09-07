import type { RuleCatalog as DemoCatalog, RuleContext as ValidatedDemoCatalog, RuleBattleState as DemoBattleState, RuleCheckpoint as DemoCheckpoint } from "../../domain/rule-state";
import * as v from "../../../contracts/validation";
import type { DemoEnemy, DemoEvent } from "../../domain/demo-state";
import { emit } from "../demo-events";

type Resolution = { state: DemoBattleState; events: DemoEvent[] };
export const activeManorEnemy = (enemy: DemoEnemy) => enemy.hp > 0 && enemy.disposition !== "released";
export const manorGuestCount = (state: DemoCheckpoint) => state.encounter.enemies.filter(e => activeManorEnemy(e) && e.origin?.seat).length;
/** The only evaluator for both visible and applied linked attack power. */
export function demoIntentPower(state: DemoCheckpoint, enemy: DemoEnemy): number {
  const intent = enemy.intent;
  if (!intent) return 0;
  return intent.formula ? Math.max(0, intent.value + manorGuestCount(state) - intent.formula.reduction) : intent.value;
}
export function emitManorSeatChange(ctx: Resolution, reason: "defeated" | "summoned" | "released", targetId: string, before: number) {
  const after = manorGuestCount(ctx.state);
  if (before === after) return;
  emit(ctx, "banquet-seats-changed", null, { encounterId: ctx.state.encounter.id, reason, targetId, before, after, toastPower: 2 + after });
}
/** Called at an effect-batch boundary, never between a cleave's locked targets. */
export function releaseManorGuests(catalog: DemoCatalog, ctx: Resolution) {
  const spec = catalog.manor, enc = ctx.state.encounter;
  if (!spec || !enc.manor || enc.manor.released || !ctx.state.run.party.some(m => m.hp > 0)) return;
  const boss = enc.enemies.find(e => e.definitionId === spec.boss.definitionId);
  if (!boss || boss.hp > 0) return;
  const before = manorGuestCount(ctx.state);
  enc.manor.released = true;
  for (const e of enc.enemies) {
    if (e !== boss && e.hp <= 0) continue;
    e.disposition = "released"; e.intent = null; e.boundRound = null; e.threaded = false;
    const bounty = e === boss ? catalog.enemies[e.definitionId].bounty : 0;
    ctx.state.run.looseGold += bounty;
    emit(ctx, "enemy-released", null, { targetId: e.id, bounty, reason: "core-released" });
  }
  enc.formation = [];
  emitManorSeatChange(ctx, "released", boss.id, before);
}
export function summonManorGuest(catalog: DemoCatalog, ctx: Resolution, boss: DemoEnemy) {
  const spec = catalog.manor!, enc = ctx.state.encounter, lifecycle = enc.manor!;
  const before = manorGuestCount(ctx.state);
  if (before >= spec.boss.maxGuests || lifecycle.summoned >= spec.boss.summonBudget) return;
  const serial = ++lifecycle.summoned;
  const guest: DemoEnemy = {
    id: `${enc.id}:enemy:summon:${serial}`, definitionId: spec.boss.guestId,
    hp: catalog.enemies[spec.boss.guestId].hp, chargeReady: false, threaded: false,
    escaped: false, boundRound: null, intent: null, disposition: "active",
    origin: { kind: "summoned", serial, bornRound: enc.round, summonerId: boss.id, seat: true },
  };
  enc.enemies.push(guest); enc.formation.push(guest.id);
  emit(ctx, "enemy-summoned", boss.id, { targetId: guest.id, definitionId: guest.definitionId, bornRound: enc.round, serial });
  emitManorSeatChange(ctx, "summoned", guest.id, before);
}

export function validateManorEncounter(catalog: ValidatedDemoCatalog, checkpoint: DemoCheckpoint) {
  const {encounter: enc, run} = checkpoint, spec = catalog.data.manor!;
  const lifecycle = v.record(enc.manor, "encounter.manor", ["summoned", "released"]);
  const summoned = v.number(lifecycle.summoned, "summoned", 0, spec.boss.summonBudget);
  v.boolean(lifecycle.released, "released");
  const initial = catalog.data.encounters[enc.definitionId].enemyIds;
  if (enc.enemies.length !== initial.length + summoned) v.invalid("enemies", "Summon ledger differs");
  const boss = enc.enemies.find(e => e.definitionId === spec.boss.definitionId);
  if ((!boss && (summoned || lifecycle.released)) || manorGuestCount(checkpoint) > spec.boss.maxGuests) v.invalid("manor", "Invalid seats or release");
  enc.enemies.forEach((e, index) => {
    const origin = v.record(e.origin, "enemy.origin", ["kind", "serial", "bornRound", "summonerId", "seat"]);
    const isInitial = index < initial.length, serial = isInitial ? index + 1 : index - initial.length + 1;
    if (origin.kind !== (isInitial ? "initial" : "summoned") || origin.serial !== serial || e.id !== `${enc.id}:enemy:${isInitial ? serial : `summon:${serial}`}` || e.definitionId !== (isInitial ? initial[index] : spec.boss.guestId)) v.invalid("enemy.origin", "Enemy has no legitimate spawn");
    if (origin.summonerId !== (isInitial ? null : boss?.id) || origin.seat !== (!!boss && e.definitionId === spec.boss.guestId)) v.invalid("enemy.origin", "Wrong summoner or seat");
    v.number(origin.bornRound, "bornRound", isInitial ? 0 : 1, isInitial ? 0 : enc.round);
    v.choice(e.disposition, ["active", "defeated", "released"], "disposition");
    if ((e.disposition === "active") !== (e.hp > 0 && !lifecycle.released) || (e.disposition === "defeated" && e.hp !== 0) || (e.disposition === "released" && !lifecycle.released)) v.invalid("disposition", "Retirement differs from encounter");
    if (e.disposition !== "active" && (e.intent || e.threaded || e.boundRound !== null)) v.invalid("enemy", "Retired enemy retains effects");
    if (e.origin!.bornRound === enc.round && (e.intent || enc.enemyOrder.includes(e.id))) v.invalid("summon", "New guest cannot act this round");
    if (e.intent) {
      if (e.intent.id !== `${e.id}:intent:${enc.round}`) v.invalid("intent.id", "Wrong intent identity");
      if (e.intent.formula) {
        const formula = v.record(e.intent.formula, "formula", ["kind", "reduction"]);
        const sovereign = run.party.some(m => m.config.faction === "sovereign");
        if (e !== boss || e.intent.kind !== "attack" || formula.kind !== "banquet-seats" || e.intent.value !== 2 || formula.reduction !== (enc.round === 1 && sovereign ? 1 : 0)) v.invalid("formula", "Invalid linked intent");
      } else if (e === boss && e.intent.kind === "attack") v.invalid("formula", "Heiress attack needs live seats");
      if (e.intent.kind === "summon" && (e !== boss || e.intent.targetId !== null)) v.invalid("summon", "Invalid summon intent");
    }
  });
  if (lifecycle.released && (!boss || boss.hp !== 0 || boss.disposition !== "released" || enc.formation.length || !run.party.some(m => m.hp > 0))) v.invalid("release", "No successful release cause");
  if (boss?.hp === 0 && run.party.some(m => m.hp > 0) && !lifecycle.released) v.invalid("release", "Unfinished boss release batch");
  if (enc.outcome === "victory" && boss && !lifecycle.released) v.invalid("victory", "Boss was not released");
}
