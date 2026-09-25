import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5Projection } from "./d5-types";
import * as v from "../contracts/validation";
import { lootAppraisalFee, lootSalePrice } from "../contracts/loot";

export function bundledLoot(catalog: ValidatedD5Catalog, campaign: D5Projection, item: NonNullable<D5Projection["loot"]>[number]) {
  return campaign.loot!.filter(other => other.claimId === item.claimId && catalog.data.loot!.definitions[other.definitionId].bundleWith === item.definitionId)
    .map(other => ({item: other, gold: lootSalePrice(catalog.data.loot!.definitions[other.definitionId], other)!}));
}

export function lootStackable(catalog: ValidatedD5Catalog, item: NonNullable<D5Projection["loot"]>[number]) {
  const d = catalog.data.loot!.definitions[item.definitionId];
  return catalog.ref.contentVersion >= 21 && !!item.resultId && (d.quantity ?? 1) === 1 && !d.bundleWith &&
    !Object.values(catalog.data.loot!.definitions).some(other => other.bundleWith === d.id) && d.sellable !== false;
}

/** Both live trades and saved evidence use this authoritative quote. */
export function lootQuote(catalog: ValidatedD5Catalog, campaign: D5Projection, input: {
  type: "loot-appraised" | "loot-sold"; shopId: string; instanceId: string; quoteVersion: number; quantity?: number;
}, scriptedVisit = false) {
  const content = catalog.data.loot;
  if (!content) v.invalid("loot", "This content has no loot trading", "content-unavailable");
  if (campaign.activeRunRef || campaign.activeStoryId) v.invalid("shop", "Finish the active run or story", "run-active");
  if (input.shopId !== catalog.data.economy?.shopId || input.quoteVersion !== content.quoteVersion) v.invalid("quoteVersion", "Quote changed", "quote-expired");
  if (!scriptedVisit && campaign.shopVisit?.status === "active" && campaign.shopVisit.phase !== "buy" &&
    Object.values(campaign.shopVisit.items).includes(input.instanceId)) v.invalid("shopVisit", "Finish the current counter interaction", "command-not-available");
  const item = campaign.loot?.find(i => i.instanceId === input.instanceId);
  if (!item) v.invalid("instanceId", "Item is not owned", "item-unavailable");
  const definition = v.reference(content.definitions, item.definitionId, "definitionId");
  const appraise = input.type === "loot-appraised";
  const quantity = v.number(input.quantity ?? 1, "loot.quantity", 1, 999);
  if (input.quantity !== undefined && (catalog.ref.contentVersion < 21 || appraise)) v.invalid("loot.quantity", "Quantity sale is unavailable for this command or content");
  if (quantity > 1 && !lootStackable(catalog, item)) v.invalid("loot.quantity", "This lot must be traded individually");
  const salePrice = lootSalePrice(definition, item);
  if (appraise ? item.resultId !== null || definition.initiallyKnown : salePrice === null) v.invalid("loot.state", appraise ? "Already identified" : "Item cannot be sold in its current state", "command-not-available");
  const bundled = appraise ? [] : bundledLoot(catalog, campaign, item);
  const soldItems = [item, ...campaign.loot!.filter(other => other.instanceId !== item.instanceId && other.definitionId === item.definitionId && other.resultId === item.resultId)].slice(0, quantity);
  if (soldItems.length !== quantity) v.invalid("loot.quantity", "Not enough owned items", "item-unavailable");
  const gold = appraise ? lootAppraisalFee(definition, item) : salePrice! * quantity + bundled.reduce((sum, entry) => sum + entry.gold, 0);
  if (appraise && campaign.funds.party < gold) v.invalid("funds.party", "Not enough party gold", "insufficient-funds");
  return {item, definition, gold, bundled, soldItems};
}
