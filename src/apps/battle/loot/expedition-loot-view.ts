import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { DemoTerminal } from "../../../game-core/session/demo-expedition";
import type { LootDrop } from "../../../game-core/contracts/loot";
import { DEFAULT_ITEM_RARITY } from "../../../shared/ui/items/rarity";
import { shopLootPresentation } from "../../../content/presentation/shop-loot";
import { supplyArt } from "../../../content/presentation/supply-icons";
import { resolveItemIcon } from "../../../assets/icons/items/catalog";
import unknownItem from "../../../assets/icons/items/locked-chest.svg";
import { expeditionScenes } from "../../../content/presentation/expedition-art";
import { TIDE_ROUTE, tideBattleStage, tideStoryEdition } from "../../../content/presentation/tide-cave";
import { archiveIdentities } from "../../../content/characters/identities";
import { battleMemberName } from "../presentation/manor-battle-model";
import { ledgerPartyTag, ledgerSpeaker } from "./ledger-voices";
import type { LootItemView } from "./loot-item";
import type { LootLedgerView, LootPocket, LootSettlement } from "./loot-types";
import type { LedgerClockPhase, LedgerDepthNode, LedgerPartyMember, LedgerRow, LedgerSupplyGroup } from "./LootSettlementView";

/** No sample drops, RNG or wallet writes. Every quantity comes from a run/receipt. */
export function expeditionLootCatalog(view: Pick<DemoJourneyView, "lootContent" | "items"> & Partial<Pick<DemoJourneyView, "expedition" | "appraisalLoot">>, settled?: DemoTerminal | null): Record<string, LootItemView> {
  const catalog: Record<string, LootItemView> = {};
  for (const definition of Object.values(view.lootContent?.definitions ?? {})) {
    const art = shopLootPresentation[definition.id];
    catalog[definition.id] = {id: definition.id, icon: (!definition.initiallyKnown && art?.unknownIconUrl ? art.unknownIconUrl : art?.iconUrl) ?? unknownItem,
      name: art ? definition.initiallyKnown ? art.name : art.unknownName : "未识别物品",
      description: art ? definition.initiallyKnown ? art.description : art.appearance : "带回商店后可查看或鉴定。",
      ...(definition.initiallyKnown ? {kind: "common", rarity: art?.rarity ?? DEFAULT_ITEM_RARITY} : {kind: "appraisal", rarity: "unknown"}),
    };
  }
  for (const item of view.items) {
    const art = supplyArt[item.kind];
    catalog[item.id] = {id: item.id, name: item.name, description: art?.description ?? "出征战备道具。", icon: art?.icon ?? unknownItem, kind: "preparation", rarity: "bronze"};
  }
  for (const [instanceId, copy] of Object.entries(view.appraisalLoot ?? {})) {
    catalog[instanceId] = {id: instanceId, icon: resolveItemIcon(copy.unknownName).assetUrl, name: copy.unknownName, description: copy.appearance, kind: "appraisal", rarity: "unknown"};
  }
  for (const item of (settled?.commissionRewards ?? view.expedition?.run.commissionRewards)?.manifest ?? []) {
    catalog[item.definitionId] = {id: item.definitionId, name: item.label, description: `${item.description} 委托物品，安全带回后交付；无法出售，团灭会遗失。`, icon: unknownItem, kind: "quest", rarity: "bronze"};
  }
  return catalog;
}

export function expeditionLootView(view: DemoJourneyView, settled?: DemoTerminal | null) {
  const terminal = settled ?? (view.expedition?.node === "finished" ? view.expedition.result : null);
  const run = !terminal || view.expedition?.run.id === terminal.runId ? view.expedition?.run : undefined;
  const definitions = view.lootContent?.definitions ?? {};
  const pocket = (copper: number, drops: readonly LootDrop[]): LootPocket => {
    const counts = new Map<string, number>();
    for (const item of drops) {
      const key = view.appraisalLoot?.[item.instanceId] ? item.instanceId : item.definitionId;
      counts.set(key, (counts.get(key) ?? 0) + (definitions[item.definitionId]?.quantity ?? 1));
    }
    return {copper, items: [...counts].map(([itemId, quantity]) => ({itemId, quantity}))};
  };
  const bags = terminal?.lootLedger ?? (run ? view.lootBags : null) ?? {banked: terminal?.returnedLoot ?? [], unbanked: []};
  const quest = terminal?.commissionRewards ?? run?.commissionRewards;
  const questPocket = (items: {definitionId: string}[]): LootPocket => ({copper: 0, items: items.map(i => ({itemId: i.definitionId, quantity: 1}))});
  const ledger: LootLedgerView = {
    ...(quest?.items.length ? {questItems: questPocket(quest.items)} : {}),
    layer: terminal?.deepestLayer ?? run?.layer ?? 1,
    banked: pocket(terminal?.bankedGold ?? run?.bankedGold ?? 0, bags.banked),
    unbanked: pocket(terminal?.lostLooseGold ?? run?.looseGold ?? 0, bags.unbanked),
  };
  const returnedIds = new Set(terminal?.returnedLoot?.map(item => item.instanceId));
  const receipt: LootSettlement | null = terminal ? {
    id: terminal.id,
    ...(terminal.commissionRewards ? {questReturned: questPocket(terminal.commissionRewards.returned), questLost: questPocket(terminal.commissionRewards.items.filter(i => !terminal.commissionRewards!.returned.some(r => r.instanceId === i.instanceId)))} : {}),
    outcome: terminal.outcome === "wipe" ? "failed" : terminal.outcome === "extracted" ? "retreated" : "cleared",
    ...ledger, returned: pocket(terminal.totalGold, terminal.returnedLoot ?? []),
    lostUnbanked: ledger.unbanked,
    lostBanked: pocket(terminal.lostBankedGold, bags.banked.filter(item => !returnedIds.has(item.instanceId))),
  } : null;
  const supplies: LootPocket = {copper: 0, items: (terminal?.returnedSupplies ?? []).filter(item => item.charges > 0).map(item => ({itemId: item.definitionId, quantity: item.charges}))};
  return {ledger, receipt, supplies};
}

export function expeditionLocation(routeId: string | undefined) {
  return routeId?.startsWith("old-manor.") ? "克雷格旧庄园" : routeId === "intro.tide-cave.first" ? "退潮岩窟" : "远征";
}

const PHASES: readonly LedgerClockPhase[] = ["dawn", "day", "dusk", "night"];
/** Settling spends one mansion phase; the dial shows it before the claim commits. */
export function ledgerClock(phase: LedgerClockPhase) {
  return {from: phase, to: PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]};
}

/** The receipt's surroundings: depth, per-layer rows, returning party and supply sources. */
export function expeditionLedgerDetail(view: DemoJourneyView, settled?: DemoTerminal | null, playerName?: string) {
  const terminal = settled ?? (view.expedition?.node === "finished" ? view.expedition.result : null);
  if (!terminal) return null;
  const route = view.routes[terminal.routeId];
  const room = (layer: number) => expeditionScenes[route?.layerSceneIds[layer - 1] ?? ""]?.location
    // Tutorial routes are omitted from the ordinary route picker. Content 14
    // introduced one battle per layer; earlier editions bank all four together.
    ?? (terminal.routeId === TIDE_ROUTE
      ? tideBattleStage(view.contentRef.contentVersion >= 14 ? layer : 4, tideStoryEdition(view.contentRef.contentVersion)).location : route?.name);
  const failed = terminal.outcome === "wipe", deepest = terminal.deepestLayer;
  const depth: LedgerDepthNode[] = Array.from({length: Math.max(route?.layerCount ?? 0, deepest)}, (_, i) => ({
    kind: i + 1 < deepest ? "passed" : i + 1 > deepest ? "ahead" : failed ? "fell" : "exit", room: room(i + 1),
  }));
  const rows: LedgerRow[] = terminal.layerResults.map(r => ({layer: r.layer, room: room(r.layer), looseGold: r.looseGold,
    bonusPercent: r.handBonusPercent, multiplier: r.depthPercent * r.earthPercent / 10000, gold: r.gold}));
  if (!terminal.layerResults.some(r => r.layer === deepest) && (failed || terminal.lostLooseGold > 0))
    rows.push({layer: deepest, room: room(deepest), looseGold: terminal.lostLooseGold});
  // Hit points exist only until the claim folds the run into the campaign.
  const party: LedgerPartyMember[] = view.expedition?.run.id === terminal.runId ? view.party.map(m => ({
    id: m.id, name: battleMemberName(m, playerName), avatar: archiveIdentities.find(identity => identity.id === m.id)?.thumbnailUrl,
    hp: m.hp, maxHp: m.config.maxHp,
    tag: ledgerPartyTag({hp: m.hp, maxHp: m.config.maxHp, pulled: failed, scarred: m.temporaryRust.length > 0}),
  })) : [];
  const supplyGroups: LedgerSupplyGroup[] = [
    {label: "免费配给", supplies: terminal.returnedSupplies.filter(s => s.source === "supply.demo.allowance")},
    {label: "战术补给", supplies: terminal.returnedSupplies.filter(s => s.source !== "supply.demo.allowance")},
  ].filter(group => group.supplies.length).map(group => ({label: group.label,
    pocket: {copper: 0, items: group.supplies.map(s => ({itemId: s.definitionId, quantity: s.charges}))}}));
  const receiptOutcome = failed ? "failed" : terminal.outcome === "extracted" ? "retreated" : "cleared";
  return {depth, rows, party, supplyGroups, speaker: ledgerSpeaker(receiptOutcome, terminal.partyIds, playerName)};
}
