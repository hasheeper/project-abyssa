// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createBattlePreviewSession } from "../../../game-client/battle-preview";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { expeditionLootCatalog, expeditionLootView } from "./expedition-loot-view";
import { expeditionRewardFeedback } from "./useExpeditionLootFeedback";
import type { LootDrop } from "../../../game-core/contracts/loot";
import { itemIconCatalog } from "../../../assets/icons/items/catalog";

let session: Awaited<ReturnType<typeof createBattlePreviewSession>>;
let view: DemoJourneyView;
beforeAll(async () => { session = await createBattlePreviewSession(); view = session.runtime.queries.journey(session.getSnapshot().record!)!; });
afterAll(() => session.dispose());
const drop = (id: string, definitionId: string, roomId: string): LootDrop => ({instanceId: id, definitionId, roomId, grantId: id, runId: "run"});

it("uses actual carried items and settled layers; departure supplies never become loot", () => {
  const run = structuredClone(view);
  run.expedition!.run.carriedLoot = [drop("coins", "loot.tutorial.cross-coins", "room-1"), drop("nail", "loot.tutorial.barrier-nail", "room-2")];
  run.expedition!.run.roomIds = [["room-1"], ["room-2"]];
  run.expedition!.run.settledLayers = [1];
  run.lootBags = {banked: run.expedition!.run.carriedLoot.slice(0, 1), unbanked: run.expedition!.run.carriedLoot.slice(1)};
  const shown = expeditionLootView(run);
  expect(shown.ledger.banked.items).toEqual([{itemId: "loot.tutorial.cross-coins", quantity: 12}]);
  expect(shown.ledger.unbanked.items).toEqual([{itemId: "loot.tutorial.barrier-nail", quantity: 1}]);
  expect(shown.receipt).toBeNull();
  expect(expeditionLootView(view).ledger.banked.items).toEqual([]);
  expect(expeditionLootView(view).ledger.unbanked.items).toEqual([]);
});

it("uses the selected terminal after the run is gone and preserves actual loss quantities", () => {
  const returned = drop("a", "loot.tutorial.candle-token", "r1"), lost = drop("b", "loot.tutorial.barrier-nail", "r1"), loose = drop("c", "loot.tutorial.black-bread", "r2");
  const result = expeditionLootView(view, {id: "end", runId: "different-run", routeId: "old-manor.first-clear", outcome: "wipe", deepestLayer: 2, partyIds: [],
    bankedGold: 301, lostLooseGold: 380, lostBankedGold: 151, totalGold: 150,
    layerResults: [], returnedLoot: [returned], returnedSupplies: [{instanceId: "supply", definitionId: "item.potion", source: "supply.demo.allowance", charges: 1}],
    lootLedger: {banked: [returned, lost], unbanked: [loose]}});
  expect(result.receipt).toMatchObject({outcome: "failed", returned: {copper: 150, items: [{itemId: returned.definitionId, quantity: 1}]}, lostBanked: {copper: 151, items: [{itemId: lost.definitionId, quantity: 1}]}, lostUnbanked: {copper: 380, items: [{itemId: loose.definitionId, quantity: 1}]}});
  expect(result.supplies.items).toEqual([{itemId: "item.potion", quantity: 1}]);
});

it("keeps unknown names/quality concealed and notifies only real rewards", () => {
  const catalog = expeditionLootCatalog(view);
  expect(catalog["loot.tutorial.barrier-nail"]).toMatchObject({name: "发黑的金属钉", kind: "appraisal", rarity: "unknown"});
  expect(catalog["item.potion"]).toMatchObject({kind: "preparation"});
  const found = {id: "found", type: "loot-found", actorId: null, payload: {definitionId: "loot.tutorial.cross-coins"}};
  expect(expeditionRewardFeedback(found, view)).toMatchObject({kind: "reward", reward: {name: "旧十字币", quantity: 12}});
  expect(expeditionRewardFeedback({...found, payload: {definitionId: "box"}}, view)).toBeNull();
  expect(expeditionRewardFeedback({...found, type: "enemy-defeated", payload: {bounty: 300}}, view)).toMatchObject({reward: {kind: "currency", quantity: 300}});
  expect(expeditionRewardFeedback({...found, type: "layer-banked"}, view)).toBeNull();
});

it("uses generated instance names in the reward notice and pockets without combining different curios", () => {
  const run = structuredClone(view), definitionId = "loot.tutorial.barrier-nail";
  run.appraisalLoot = {"curio:a": {unknownName: "蜡封的锁盒", appearance: "蜡封住了盒沿。"}, "curio:b": {unknownName: "生锈的钥匙", appearance: "钥匙上留着刻痕。"}};
  const drops = [drop("curio:a", definitionId, "r1"), drop("curio:b", definitionId, "r1")];
  run.lootBags = {banked: drops, unbanked: []};
  expect(expeditionLootView(run).ledger.banked.items).toEqual([{itemId: "curio:a", quantity: 1}, {itemId: "curio:b", quantity: 1}]);
  const boxIcon = itemIconCatalog.find(item => item.id === "locked-box")!.assetUrl;
  const keyIcon = itemIconCatalog.find(item => item.id === "key")!.assetUrl;
  expect(expeditionLootCatalog(run)["curio:a"]).toMatchObject({name: "蜡封的锁盒", icon: boxIcon, rarity: "unknown"});
  expect(expeditionRewardFeedback({id: "found:generated", type: "loot-found", actorId: null, payload: {...drops[1]}}, run)).toMatchObject({reward: {name: "生锈的钥匙", icon: keyIcon, rarity: "unknown", quantity: 1}});
  const terminal = {id: "generated:return", runId: "run", routeId: "tide-reef.ordinary", outcome: "extracted" as const, deepestLayer: 1, partyIds: [],
    bankedGold: 0, lostLooseGold: 0, lostBankedGold: 0, totalGold: 0, layerResults: [], returnedLoot: drops, returnedSupplies: []};
  expect(expeditionLootView(run, terminal).receipt?.returned.items).toEqual([{itemId: "curio:a", quantity: 1}, {itemId: "curio:b", quantity: 1}]);
  expect(expeditionLootCatalog(run, terminal)["curio:a"].icon).toBe(boxIcon);
});

it("shows actual quest acquisition, independent loss and the persisted return receipt", () => {
  const run = structuredClone(view);
  const item = {definitionId: "quest:case", eventId: "commission", stepId: "patrol", objectiveId: "medicine", label: "空药箱", description: "战斗后取回的药箱。", layer: 3, roomIndex: 0, roomDefinitionId: "room", awardWhen: "room-cleared" as const, instanceId: "quest:instance", runId: run.expedition!.run.id, roomId: "target"};
  const {instanceId: _instance, runId: _run, roomId: _room, ...placement} = item;
  run.expedition!.run.commissionRewards = {version: 1, manifest: [placement], items: [item]};
  const catalog = expeditionLootCatalog(run), projected = expeditionLootView(run);
  expect(catalog[item.definitionId]).toMatchObject({name: "空药箱", kind: "quest"});
  expect(projected.ledger.questItems?.items).toEqual([{itemId: item.definitionId, quantity: 1}]);
  expect(projected.ledger.banked.items.some(i => i.itemId === item.definitionId)).toBe(false);
  expect(expeditionRewardFeedback({id: "found:quest", type: "commission-item-found", actorId: null, payload: {...item}}, run)).toMatchObject({reward: {name: "空药箱", quantity: 1}});
  const terminal = {id: "end", runId: item.runId, routeId: "old-manor.maintenance", outcome: "wipe" as const, deepestLayer: 4, partyIds: [], bankedGold: 0, lostLooseGold: 0, lostBankedGold: 0, totalGold: 0, layerResults: [], returnedLoot: [], returnedSupplies: [], commissionRewards: {...run.expedition!.run.commissionRewards, completedRoomIds: [item.roomId], returned: []}};
  expect(expeditionLootView(run, terminal).receipt).toMatchObject({questReturned: {items: []}, questLost: {items: [{itemId: item.definitionId, quantity: 1}]}});
  const returned = {...terminal, outcome: "extracted" as const, commissionRewards: {...terminal.commissionRewards, returned: [item]}};
  expect(expeditionLootCatalog(view, returned)[item.definitionId].name).toBe("空药箱");
  expect(expeditionLootView(view, returned).receipt).toMatchObject({questReturned: {items: [{itemId: item.definitionId, quantity: 1}]}, questLost: {items: []}});
});
