import type { DemoCatalog } from "./demo";
import type { LootContent } from "./loot";
import * as v from "./validation";

export type StartRewardContent = {
  id: string;
  gold: number;
  supplies: {definitionId: string; charges: number}[];
  lootDefinitionIds: string[];
};

type RewardCatalog = Pick<DemoCatalog, "journey"> & {
  economy?: {unit?: "copper-lira"; freeItemIds: string[]; prices: Record<string, number>};
  facilities?: unknown;
  loot?: LootContent;
};
export function validateStartReward(raw: unknown, catalog: RewardCatalog): StartRewardContent {
  const reward = v.record(raw, "tutorialSkipReward", ["id", "gold", "supplies", "lootDefinitionIds"]);
  v.id(reward.id, "tutorialSkipReward.id");
  v.number(reward.gold, "tutorialSkipReward.gold", 0, catalog.economy?.unit === "copper-lira" ? 100_000 : 1000);
  const supplies = new Set<string>();
  for (const rawSupply of v.list(reward.supplies, "tutorialSkipReward.supplies", 16)) {
    const supply = v.record(rawSupply, "tutorialSkipReward.supply", ["definitionId", "charges"]);
    const definition = v.reference(catalog.journey!.items, supply.definitionId, "tutorialSkipReward.definitionId");
    if (supplies.has(definition.id)) v.invalid("tutorialSkipReward.supplies", "Duplicate supply");
    supplies.add(definition.id);
    v.number(supply.charges, "tutorialSkipReward.charges", 1, definition.capacity);
    if (!(catalog.facilities && definition.id === "item.food") && !catalog.economy?.freeItemIds.includes(definition.id) && !catalog.economy?.prices[definition.id])
      v.invalid("tutorialSkipReward.supplies", "Supply has no economy source");
  }
  for (const id of v.ids(reward.lootDefinitionIds, "tutorialSkipReward.lootDefinitionIds", 32))
    v.reference(catalog.loot!.definitions, id, "tutorialSkipReward.lootDefinitionIds");
  return raw as StartRewardContent;
}
