import type { D5Catalog } from "../../../game-core/contracts";
import { SHOP_INTRODUCTION_CATALOG_DATA } from "../demo-v16/content";

/** B economy: every persisted amount is one copper lira (G). Earlier releases stay frozen. */
const data = structuredClone(SHOP_INTRODUCTION_CATALOG_DATA);
data.contentVersion = 17;
data.economy = {...data.economy!, unit: "copper-lira", quoteVersion: 2,
  prices: {"item.ward": 400, "item.holy-water": 300, "item.maintenance-kit": 600, "item.lucky-charm": 800, "item.divination-slip": 300}};
for (const enemy of Object.values(data.enemies)) enemy.bounty *= 100;
// The four-layer guided reference earns 3,600 G, then receives the 800 G return reward.
// Preserve the ordinary per-layer rounding and the player's actual hand bonuses.
for (const [id, bounty] of Object.entries({"tide-slime": 80, lookout: 80, crossbowman: 90, hauler: 190, "reef-hook-chief": 280}))
  data.enemies[`enemy.intro.${id}`].bounty = bounty;
data.manor!.firstClearReward.gold = 2_000;
for (const event of Object.values(data.journey!.events)) {event.cost *= 100; event.reward *= 100;}
data.tutorial!.reward.gold = 800;
const routeId = "intro.tide-cave.first", roomId = "room.tide-cave.4";
const definitions: NonNullable<D5Catalog["loot"]>["definitions"] = {
  "loot.tutorial.cross-coins": {id: "loot.tutorial.cross-coins", resultId: "known.cross-coins", initiallyKnown: true,
    quantity: 12, appraisalFee: 0, salePrice: 1_800},
  "loot.tutorial.barrier-nail": {id: "loot.tutorial.barrier-nail", resultId: "appraisal.barrier-nail",
    appraisalFee: 300, salePrice: 500, scrapPrice: 2,
    freeAppraisalGrantIds: ["grant.tide-cave.barrier-nail", "reward.tide-cave.skip"]},
  "loot.tutorial.candle-token": {id: "loot.tutorial.candle-token", resultId: "known.candle-token", initiallyKnown: true,
    appraisalFee: 0, salePrice: 2, bundleWith: "loot.tutorial.cross-coins"},
  "loot.tutorial.black-bread": {id: "loot.tutorial.black-bread", resultId: "known.black-bread", initiallyKnown: true,
    appraisalFee: 0, salePrice: 0, sellable: false},
};
data.loot = {quoteVersion: 2, definitions, grants: Object.keys(definitions).map(definitionId => ({
  id: `grant.tide-cave.${definitionId.split(".").at(-1)}`, definitionId, routeId, roomId,
}))};
data.tutorialSkipReward = {...data.tutorialSkipReward!, gold: 4_400, lootDefinitionIds: Object.keys(definitions)};
export const COPPER_ECONOMY_CATALOG_DATA: D5Catalog = data;
