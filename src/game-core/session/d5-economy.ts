import type { ValidatedD5Catalog } from "../contracts/d5";
import type { DemoSupply } from "../battle/domain/demo-state";
import type { D5Projection } from "./d5-types";
import * as v from "../contracts/validation";
import { sha256 } from "../contracts/sha256";

/** One source of truth for the shop quote and committed purchase replay. Prices never come from UI. */
export function supplyQuote(catalog: ValidatedD5Catalog, campaign: D5Projection, input: {shopId: string; definitionId: string; quantity: number; quoteVersion: number}) {
  const economy = catalog.data.economy;
  if (!economy) v.invalid("shop", "This content version has no shop", "content-unavailable");
  if (campaign.activeRunRef || campaign.activeStoryId) v.invalid("shop", "Finish the active run or story", "run-active");
  if (input.shopId !== economy.shopId || input.quoteVersion !== economy.quoteVersion) v.invalid("quoteVersion", "Quote changed", "quote-expired");
  const price = economy.prices[input.definitionId];
  if (!price) v.invalid("definitionId", "Item is not sold", "item-unavailable");
  const definition = v.reference(catalog.data.journey!.items, input.definitionId, "definitionId");
  const quantity = v.number(input.quantity, "quantity", 1, definition.capacity);
  const stored = campaign.supplies.find(s => s.definitionId === input.definitionId);
  if ((stored?.charges ?? 0) + quantity > definition.capacity) v.invalid("quantity", "Supply capacity exceeded", "inventory-full");
  const total = price * quantity;
  if (campaign.funds.party < total) v.invalid("funds.party", "Not enough party gold", "insufficient-funds");
  return {total, stored};
}

/** Free allowance refills on departure; purchased charges retain their actual identity and balance. */
export function departureSupplies(catalog: ValidatedD5Catalog, campaign: D5Projection, runId: string, raw: unknown): DemoSupply[] {
  return v.ids(raw, "itemIds", 4).map(id => {
    const def = v.reference(catalog.data.journey!.items, id, "itemIds");
    const stored = campaign.supplies.find(s => s.definitionId === id);
    if (catalog.data.economy && !catalog.data.economy.freeItemIds.includes(id)) {
      if (!stored || stored.source !== "supply.demo.shop" || stored.charges < 1) v.invalid("itemIds", "Purchase this supply before departure", "item-unavailable");
      return structuredClone(stored);
    }
    return {instanceId: stored?.instanceId ?? `supply:${sha256(v.canonicalJson([runId, id])).slice(0, 32)}`, definitionId: id, source: "supply.demo.allowance", charges: def.capacity};
  });
}
