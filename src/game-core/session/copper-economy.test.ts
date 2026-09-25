import { beforeAll, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { COPPER_ECONOMY_CATALOG_DATA } from "../../content/gameplay/demo-v17/content";
import { SHOP_INTRODUCTION_CATALOG_DATA } from "../../content/gameplay/demo-v16/content";
import { G2Recorder } from "./testing/tide-guided-g2";
import { initialD5Projection } from "./d5-progress";
import { applyGameStart } from "./game-start";
import { supplyQuote } from "./d5-economy";
import { lootQuote } from "./d5-loot";

const catalog = validateD5Catalog(COPPER_ECONOMY_CATALOG_DATA);
let tutorial: G2Recorder;
beforeAll(() => {tutorial = new G2Recorder(catalog).until(s => s.tutorial!.stage === "claimable");}, 30_000);

it("uses copper amounts while preserving the frozen v16 catalog", () => {
  expect(validateD5Catalog(SHOP_INTRODUCTION_CATALOG_DATA).ref.digest).toBe("cd350922b71d8434b12b3d5677d32cf9acd711fd182726102b0a5d0d0ec988a3");
  expect(catalog.data.economy!.prices).toEqual({"item.ward": 400, "item.holy-water": 300, "item.maintenance-kit": 600, "item.lucky-charm": 800, "item.divination-slip": 300});
  expect(Object.entries(catalog.data.economy!.prices).reduce((sum, [id, price]) => sum + price * catalog.data.journey!.items[id].capacity, 0)).toBe(3400);
  expect(catalog.data.manor!.firstClearReward.gold).toBe(2000);
  expect(catalog.data.enemies["enemy.memory.clockwork-beast"].bounty).toBe(0);
});

it("banks four layers once and returns 4,400 G with all four proven item lots", () => {
  const result = tutorial.state.result!;
  expect(result.layerResults.map(r => r.gold)).toEqual([334, 421, 1782, 1063]);
  expect(result.totalGold + catalog.data.tutorial!.reward.gold).toBe(4400);
  expect(catalog.data.tutorialSkipReward!.gold).toBe(4400);
  expect(result.returnedLoot).toHaveLength(4);
  expect(result.returnedLoot!.every(item => item.roomId === "g2-run:room:4:1")).toBe(true);
  expect(tutorial.engine.restore(JSON.parse(JSON.stringify(tutorial.state)))).toEqual(tutorial.state);
  for (const state of tutorial.states.filter(s => s.node === "battle" && s.encounter.round === 1 && s.encounter.phase === "roll"))
    expect(tutorial.engine.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
});

it("keeps regular appraisal at 300, grants only the first item's free service and quotes scrap separately", () => {
  const campaign = initialD5Projection(catalog);
  applyGameStart(catalog, campaign, "hub", "claim.start");
  const nail = campaign.loot!.find(i => i.definitionId === "loot.tutorial.barrier-nail")!;
  const quote = {shopId: "shop.mansion", instanceId: nail.instanceId, quoteVersion: 2};
  expect(lootQuote(catalog, campaign, {...quote, type: "loot-appraised"}).gold).toBe(0);
  expect(lootQuote(catalog, campaign, {...quote, type: "loot-sold"}).gold).toBe(2);
  nail.grantId = "grant.later-expedition";
  expect(lootQuote(catalog, campaign, {...quote, type: "loot-appraised"}).gold).toBe(300);
  campaign.funds.party = 299;
  expect(() => lootQuote(catalog, campaign, {...quote, type: "loot-appraised"})).toThrow(/funds/);
  nail.resultId = "appraisal.barrier-nail";
  expect(lootQuote(catalog, campaign, {...quote, type: "loot-sold"}).gold).toBe(500);
  expect(() => lootQuote(catalog, campaign, {...quote, type: "loot-appraised"})).toThrow();
});

it("quotes twelve coins as one lot, includes its scrap once, rejects bread and cannot spend public money", () => {
  const campaign = initialD5Projection(catalog);
  applyGameStart(catalog, campaign, "hub", "claim.start");
  const coins = campaign.loot!.find(i => i.definitionId === "loot.tutorial.cross-coins")!;
  const quote = {shopId: "shop.mansion", instanceId: coins.instanceId, quoteVersion: 2, type: "loot-sold" as const};
  expect(lootQuote(catalog, campaign, quote)).toMatchObject({gold: 1802, bundled: [{gold: 2}]});
  const bread = campaign.loot!.find(i => i.definitionId === "loot.tutorial.black-bread")!;
  expect(() => lootQuote(catalog, campaign, {...quote, instanceId: bread.instanceId})).toThrow();
  expect(() => lootQuote(catalog, campaign, {...quote, quoteVersion: 1})).toThrow();
  campaign.funds.public = 600_000; campaign.funds.party = 0;
  expect(() => supplyQuote(catalog, campaign, {shopId: "shop.mansion", definitionId: "item.ward", quantity: 1, quoteVersion: 2})).toThrow(/funds/);
});
