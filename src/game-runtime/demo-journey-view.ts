import type { DemoGameRecord, D5GameRecord } from "../game-application";
import type { RuleContext, RuleRun } from "../game-core/battle/domain/rule-state";
import type { ValidatedD5Catalog } from "../game-core/contracts";
import type { DemoExpeditionState } from "../game-core/session";
import { d5EncounterView, d5VisibleEvents, withMemoryDialogue } from "./d5-views";
import { demoRoom, type ValidatedDemoCatalog } from "../game-core/contracts";
import { createDemoBattleEngine, createD5MemoryEngine, createD5BattleEngine, demoFace } from "../game-core/battle";
import { asDemoBattle, roomInstance, eventFaceMethod, demoItemTargets } from "../game-core/session";
import { layerGold } from "../game-core/battle/rules/v2/journey-validation";
import type { JourneyLogRecord } from "./manor-log";
import { manorLog, manorReturnFeedback } from "./manor-log";
import { manorGuestCount } from "../game-core/battle/rules/v3/manor";

/** Presentation projection from one committed record. No page decides rule legality. */
type ViewRecord = JourneyLogRecord & { head: DemoGameRecord["head"]; contentRef: RuleContext["ref"]; snapshot: { campaign: Pick<DemoGameRecord["snapshot"]["campaign"], "supplies" | "settlements" | "manor">; expedition: DemoExpeditionState<RuleRun> | null } };
function ruleJourneyView(catalog: RuleContext, record: ViewRecord, selected: ReturnType<ReturnType<typeof createDemoBattleEngine>["select"]> | null) {
  const c = catalog.data, journey = c.journey;
  if (!journey) return null;
  const expedition = record.snapshot.expedition, run = expedition?.run;
  const room = run ? demoRoom(c, run.routeId, run.layer, run.room) : null;
  const battle = expedition ? asDemoBattle(expedition) : null;
  const takeover = record.snapshot.campaign.manor?.takeover ?? null;
  const defaultRouteId = c.manor ? takeover ? c.manor.maintenanceRouteId : c.manor.firstClearRouteId : journey.defaultRouteId;
  const routeId = run?.routeId ?? defaultRouteId;
  const maintenance = routeId === c.manor?.maintenanceRouteId;
  const shop = c.rulesVersion === 4 ? c.economy : undefined;
  const items = Object.values(journey.items).map(def => {
    const storedCharges = record.snapshot.campaign.supplies.find(i => i.definitionId === def.id)?.charges ?? 0;
    const free = !shop || shop.freeItemIds.includes(def.id);
    return {...def, storedCharges, free, availableCharges: free ? def.capacity : storedCharges};
  });
  const supplies = run?.supplies.map(item => {
    const definition = journey.items[item.definitionId];
    const targets = battle?.encounter.memory ? (battle.encounter.phase !== "act" || battle.encounter.memory.defeated || battle.encounter.itemsUsed >= 2 || !item.charges ? [] : item.definitionId === "item.potion" ? battle.run.party.filter(m => m.hp > 0 && m.hp < m.config.maxHp).map(m => ({kind: "member" as const, id: m.id})) : battle.encounter.enemies.filter(e => e.hp > 0 && e.intent?.kind === "attack" && battle.run.party.some(m => m.id === e.intent?.targetId && m.hp > 0)).map(e => ({kind: "intent" as const, id: e.intent!.id!}))) : demoItemTargets(catalog, expedition!, item.instanceId);
    return {...item, definition, targets, unavailableReason: targets.length ? null : !item.charges ? "已用尽" : battle && battle.encounter.itemsUsed >= 2 ? "本回合已使用两件道具" : "当前没有可用目标"};
  }) ?? [];
  return {
    head: record.head, contentRef: record.contentRef, defaultRouteId,
    fullManor: !!c.manor, maintenance, takeover, story: record.snapshot.campaign.manor?.story ?? null,
    lastSettlement: record.snapshot.campaign.settlements.at(-1) ?? null,
    returnFeedback: manorReturnFeedback(c,record),
    banquet: battle && c.manor && battle.encounter.enemies.some(e => e.definitionId === c.manor!.boss.definitionId) ? {guests: manorGuestCount(battle), limit: c.manor.boss.maxGuests, reserve: c.manor.boss.summonBudget - battle.encounter.manor!.summoned, nextToast: 2 + manorGuestCount(battle)} : null,
    brief: c.manor ? {flavor: maintenance ? "主位已经收起。清理失去中央权限的支线残余，让旧庄园重新安静。" : "从迎客门厅走到宴会厅，逐区拆开红线，结束等候三百年的家宴。", event: "全程五层，第三层可撤离或深入；后半段通向第五层终场。"} : {flavor: "白布覆盖宾客，红线维系规矩。带领伙伴穿过迎客门厅与服务走廊。", event: "三层庄园考核，各层独立入袋；通过落幕管家后带宝返回。"},
    leaderId: c.leaderId, initialParty: c.initialParty, defaultItems: journey.defaultItems, items, supplies,
    expedition, room, roomId: run ? roomInstance(run) : null,
    event: room?.kind === "event" ? journey.events[room.eventId] : null,
    lastEvent: run?.eventResults.find(r => r.roomId === roomInstance(run)) ?? null,
    layerCount: c.routes[routeId].layers.length,
    capPercent: journey.handBonusCapPercent,
    depthFactors: journey.depthPercent.map(p => p / 100),
    economy: run ? (() => {
      const bonus = Math.min(journey.handBonusCapPercent, Math.round(run.handBonus * 100));
      const depth = journey.depthPercent[run.layer - 1];
      const earth = run.party.filter(m => m.config.suits.includes("earth")).length >= 4 ? 110 : 100;
      return {handFactor: 1 + bonus / 100, layerFactor: depth / 100, earthFactor: earth / 100,
        projected: layerGold(run.looseGold, bonus, depth, earth)};
    })() : null,
    log: manorLog(c, record),
    nextLayer: run && run.revealed.includes(`layer:${run.layer + 1}`) ? c.routes[run.routeId].layers[run.layer].map(id => { const r = journey.rooms[id]; return {kind: r.kind, enemies: r.kind === "battle" ? c.encounters[r.encounterId].enemyIds.map(id => c.enemies[id].name ?? id) : []}; }) : null,
    eventRevealed: !!run && run.revealed.includes(roomInstance(run)),
    party: run?.party.map(m => ({...m, name: c.characters[m.id].name, faces: m.config.faces.map((f, faceIndex) => ({...demoFace({run}, {ownerId: m.id, faceIndex, loaded: false, spent: false, sealed: false})!, kind: c.actions[f.actionId].kind})), eventSuccessFaces: m.config.faces.filter(f => eventFaceMethod(c, f) !== "failed").length, die: battle?.encounter.dice.find(d => d.ownerId === m.id) ?? null, actions: selected?.party.find(p => p.id === m.id)!.actions ?? {reason: "not-in-battle", options: []}})) ?? [],
    battle: battle && selected ? {...selected, encounter: battle.encounter, enemies: selected.enemies.map(e => ({...e, definition: c.enemies[e.definitionId]})), eligibleOwnerIds: battle.encounter.dice.filter(d => !d.loaded && !d.spent && !d.sealed && run!.party.some(m => m.id === d.ownerId && m.hp > 0)).map(d => d.ownerId)} : null,
  };
}
export function demoJourneyView(catalog: ValidatedDemoCatalog, record: DemoGameRecord) {
  const battle = record.snapshot.expedition && asDemoBattle(record.snapshot.expedition);
  return ruleJourneyView(catalog, record, battle ? createDemoBattleEngine(catalog).select(battle) : null);
}
export function d5JourneyView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const expedition = d5EncounterView(record), run = record.snapshot.run;
  const selected = run?.kind === "memory" && run.battle ? createD5MemoryEngine(catalog).select(run.battle)
    : run?.kind === "expedition" && run.state.node === "battle" ? createD5BattleEngine(catalog).select(asDemoBattle(run.state)!) : null;
  // Presentation-only shape retains the actual content reference and run configuration.
  return ruleJourneyView(catalog, { head: record.head, contentRef: record.contentRef, snapshot: { campaign: record.snapshot.campaign, expedition }, facts: withMemoryDialogue(record, d5VisibleEvents(record, record.snapshot.campaign.activeRunRef)), retractedFactIds: [] }, selected);
}
export type DemoJourneyView = NonNullable<ReturnType<typeof demoJourneyView>>;
