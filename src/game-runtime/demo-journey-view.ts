import { facilitiesView } from "./facilities-view";
import type { FacilitiesView } from "./facilities-view";
import { tutorialView } from "./tutorial-view";
import { lootPockets } from "../game-core/session/expedition-loot";
import { manorRepriseView } from "./manor-reprise-view";
import type { DemoGameRecord, D5GameRecord } from "../game-application";
import type { RuleContext, RuleRun } from "../game-core/battle/domain/rule-state";
import type { ValidatedD5Catalog } from "../game-core/contracts";
import type { DemoExpeditionState } from "../game-core/session";
import { d5EncounterView, d5VisibleEvents, withMemoryDialogue } from "./d5-views";
import { demoRoom, departureSupplyLimit, type ValidatedDemoCatalog } from "../game-core/contracts";
import { createDemoBattleEngine, createD5MemoryEngine, createD5BattleEngine, demoFace } from "../game-core/battle";
import { asDemoBattle, roomInstance, eventFaceMethod, demoItemTargets } from "../game-core/session";
import { layerGold } from "../game-core/battle/rules/v2/journey-validation";
import type { JourneyLogRecord } from "./manor-log";
import { manorLog, manorReturnFeedback } from "./manor-log";
import { manorGuestCount } from "../game-core/battle/rules/v3/manor";
import { demoActionOptions } from "../game-core/battle/rules/v2/combat";
import { journeyRoutes } from "./journey-routes";
import { ordinaryExpeditionAvailable } from "../game-core/session/ordinary-expeditions";
import { publicGameAppraisal } from "../game-application/airp-game/appraisals";
import type { PublicAppraisal } from "../game-core/contracts/expedition-appraisal";

/** Presentation projection from one committed record. No page decides rule legality. */
type ViewRecord = JourneyLogRecord & { head: DemoGameRecord["head"]; contentRef: RuleContext["ref"]; snapshot: { campaign: Pick<DemoGameRecord["snapshot"]["campaign"], "supplies" | "settlements" | "manor">; expedition: DemoExpeditionState<RuleRun> | null } };
function ruleJourneyView(catalog: RuleContext, record: ViewRecord, selected: ReturnType<ReturnType<typeof createDemoBattleEngine>["select"]> | null, demoPatrol = false) {
  const c = catalog.data, journey = c.journey;
  if (!journey) return null;
  const expedition = record.snapshot.expedition, run = expedition?.run;
  const room = run ? demoRoom(c, run.routeId, run.layer, run.room) : null;
  const battle = expedition ? asDemoBattle(expedition) : null;
  const takeover = record.snapshot.campaign.manor?.takeover ?? null;
  const defaultRouteId = c.manor ? takeover || demoPatrol ? c.manor.maintenanceRouteId : c.manor.firstClearRouteId : journey.defaultRouteId;
  const routeId = run?.routeId ?? defaultRouteId;
  const routes = journeyRoutes(c), route = routes[routeId];
  const maintenance = routeId === c.manor?.maintenanceRouteId;
  const shop = c.rulesVersion === 4 ? c.economy : undefined;
  const items = Object.values(journey.items).map(def => {
    const storedCharges = record.snapshot.campaign.supplies.find(i => i.definitionId === def.id)?.charges ?? 0;
    const free = !shop || shop.freeItemIds.includes(def.id);
    return {...def, storedCharges, storageCapacity: def.capacity, free, availableCharges: free ? def.capacity : storedCharges};
  });
  const supplies = run?.supplies.map(item => {
    const definition = journey.items[item.definitionId];
    const targets = battle?.encounter.memory ? (battle.encounter.phase !== "act" || battle.encounter.memory.defeated || battle.encounter.itemsUsed >= 2 || !item.charges ? [] : item.definitionId === "item.potion" ? battle.run.party.filter(m => m.hp > 0 && m.hp < m.config.maxHp).map(m => ({kind: "member" as const, id: m.id})) : battle.encounter.enemies.filter(e => e.hp > 0 && e.intent?.kind === "attack" && battle.run.party.some(m => m.id === e.intent?.targetId && m.hp > 0)).map(e => ({kind: "intent" as const, id: e.intent!.id!}))) : demoItemTargets(catalog, expedition!, item.instanceId);
    return {...item, definition, targets, unavailableReason: targets.length ? null : !item.charges ? "已用尽" : battle && battle.encounter.itemsUsed >= 2 ? "本回合已使用两件道具" : "当前没有可用目标"};
  }) ?? [];
  return {
    head: record.head, contentRef: record.contentRef, defaultRouteId, routes, facilities: null as FacilitiesView | null,
    destinations: Object.values(routes).map(r => ({...r, available: r.routeId === defaultRouteId})),
    settlementScenes: Object.fromEntries(record.snapshot.campaign.settlements.map(t => [t.runId, routes[t.routeId]?.layerSceneIds[t.deepestLayer - 1]])),
    lootContent: "loot" in c ? c.loot ?? null : null,
    lootBags: run ? lootPockets(run.carriedLoot ?? [], run.roomIds, run.settledLayers) : null,
    appraisalLoot: {} as Record<string, Pick<PublicAppraisal, "unknownName" | "appearance">>,
    tutorial: null as ReturnType<typeof tutorialView>,
    reprise: null as ReturnType<typeof manorRepriseView>,
    fullManor: !!c.manor && route?.ending === "manor", maintenance, takeover, story: record.snapshot.campaign.manor?.story ?? null,
    lastSettlement: record.snapshot.campaign.settlements.at(-1) ?? null,
    returnFeedback: manorReturnFeedback(c,record),
    banquet: battle && c.manor && battle.encounter.enemies.some(e => e.definitionId === c.manor!.boss.definitionId) ? {guests: manorGuestCount(battle), limit: c.manor.boss.maxGuests, reserve: c.manor.boss.summonBudget - battle.encounter.manor!.summoned, nextToast: 2 + manorGuestCount(battle)} : null,
    brief: route?.brief ?? {flavor: "", event: "", threats: []},
    leaderId: c.leaderId, initialParty: c.initialParty, defaultItems: journey.defaultItems, itemLimit: departureSupplyLimit(catalog.ref), items, supplies,
    expedition, room, roomId: run ? roomInstance(run) : null,
    event: room?.kind === "event" ? journey.events[room.eventId] : null,
    lastEvent: run?.eventResults.find(r => r.roomId === roomInstance(run)) ?? null,
    layerCount: c.routes[routeId].layers.length,
    capPercent: journey.handBonusCapPercent,
    depthFactors: journey.depthPercent.slice(0, c.routes[routeId].layers.length).map(p => p / 100),
    economy: run ? (() => {
      const bonus = Math.min(journey.handBonusCapPercent, Math.round(run.handBonus * 100));
      const depth = journey.depthPercent[run.layer - 1];
      const earth = run.party.filter(m => m.config.suits.includes("earth")).length >= 4 ? 110 : 100;
      return {handFactor: 1 + bonus / 100, layerFactor: depth / 100, earthFactor: earth / 100,
        projected: layerGold(run.looseGold, bonus, depth, earth),
        battleGold: "loot" in c && c.loot && room?.kind === "battle" ? (() => {
          const facts = record.facts.filter(f => f.runRef?.id === run.id && !record.retractedFactIds.includes(f.id));
          const start = facts.reduce((last, f, i) => ["encounter-started", "tutorial-retried"].includes(f.kind) ? i : last, 0);
          return facts.slice(start).reduce((gold, f) => gold + (["enemy-defeated", "enemy-released"].includes(f.kind) ? Number((f.payload as Record<string, unknown>).bounty ?? 0) : 0), 0);
        })() : undefined};
    })() : null,
    log: manorLog(c, record),
    nextLayer: run && run.revealed.includes(`layer:${run.layer + 1}`) ? c.routes[run.routeId].layers[run.layer].map(id => { const r = journey.rooms[id]; return {kind: r.kind, enemies: r.kind === "battle" ? c.encounters[r.encounterId].enemyIds.map(id => c.enemies[id].name ?? id) : []}; }) : null,
    eventRevealed: !!run && run.revealed.includes(roomInstance(run)),
    party: run?.party.map(m => {
      const die = battle?.encounter.dice.find(d => d.ownerId === m.id) ?? null;
      // Read-only fixation preview uses the same legality query as real actions.
      // Do not suggest fixing a heal with no injured ally, or bind with no legal target.
      const afterFixOptions = battle && die && !die.loaded
        ? demoActionOptions(c, {...battle, encounter: {...battle.encounter,
          dice: battle.encounter.dice.map(d => d === die ? {...d, loaded: true} : d),
        }}, m.id).options
        : [];
      return {...m, name: c.characters[m.id].name,
        faces: m.config.faces.map((f, faceIndex) => ({...demoFace({run}, {ownerId: m.id, faceIndex, loaded: false, spent: false, sealed: false})!, kind: c.actions[f.actionId].kind})),
        eventSuccessFaces: m.config.faces.filter(f => eventFaceMethod(c, f) !== "failed").length,
        die, afterFixOptions, actions: selected?.party.find(p => p.id === m.id)!.actions ?? {reason: "not-in-battle", options: []},
      };
    }) ?? [],
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
  const view = ruleJourneyView(catalog, { head: record.head, contentRef: record.contentRef, snapshot: { campaign: record.snapshot.campaign, expedition }, facts: withMemoryDialogue(record, d5VisibleEvents(record, record.snapshot.campaign.activeRunRef)), retractedFactIds: [] }, selected, !!(catalog.data.airpDirect || catalog.data.airpDirector) && !!record.snapshot.campaign.airpDemoStart);
  if (view) {
    const campaign = record.snapshot.campaign;
    const acquired = [...(expedition?.run.carriedLoot ?? []), ...campaign.settlements.flatMap(s => [...(s.returnedLoot ?? []), ...(s.lootLedger?.banked ?? []), ...(s.lootLedger?.unbanked ?? [])])];
    for (const item of acquired) {
      const copy = publicGameAppraisal(record, item);
      if (copy) view.appraisalLoot[item.instanceId] = {unknownName: copy.unknownName, appearance: copy.appearance};
    }
    view.facilities = facilitiesView(catalog, record);
    if (view.facilities) {
      view.itemLimit = view.facilities.itemLimit;
      view.items = view.items.map(item => ({...item, free: false, availableCharges: Math.min(item.capacity, item.storedCharges), storageCapacity: view.facilities!.capacities[item.id]}));
    }
    for (const fact of record.facts) if (fact.kind === "progression" && fact.payload.type === "expedition-settled") {
      const run = fact.payload.finalRun.run;
      view.settlementScenes[run.id] = demoRoom(catalog.data, run.routeId, run.layer, run.room).sceneId;
    }
    view.destinations = view.destinations.map(d => ({...d, available: ordinaryExpeditionAvailable(catalog.data, campaign, d.routeId) && !campaign.activeRunRef && !campaign.activeStoryId}));
    view.reprise = manorRepriseView(catalog, record);
    view.tutorial = tutorialView(catalog, record);
    if (view.tutorial?.runRef) {
      view.fullManor = false;
      view.depthFactors = view.depthFactors.slice(0, view.layerCount);
      if (view.tutorial.stage !== "active") view.supplies = view.supplies.map(s => ({...s, targets: [], unavailableReason: "当前不能使用"}));
      if (catalog.data.tutorial?.guide && view.room?.id === "room.tide-cave.event.intro") view.eventRevealed = true;
    }
  }
  return view;
}
export type DemoJourneyView = NonNullable<ReturnType<typeof demoJourneyView>>;
