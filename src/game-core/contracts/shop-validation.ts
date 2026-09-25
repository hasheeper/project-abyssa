import type { D5Catalog } from "./d5";
import type { ShopContent } from "./shop";
import * as v from "./validation";

export function validateShopContent(raw: unknown, catalog: D5Catalog): ShopContent {
  const shop = v.record(raw, "shop", ["version", "quoteVersion", "products", "rotationSlots"]);
  v.choice(shop.version, [1], "shop.version"); v.choice(shop.quoteVersion, [1], "shop.quoteVersion");
  const products = v.record(shop.products, "shop.products"), definitions = new Set<string>();
  v.list(Object.keys(products), "shop.products", 64);
  for (const [id, value] of Object.entries(products)) {
    const p = v.record(value, id, ["id", "name", "definitionId", "delivery", "price", "availableFromDay", "mode", "purchaseLimit"]);
    if (p.id !== id || !v.id(id, id).startsWith("product.")) v.invalid(id, "Invalid product identity");
    v.text(p.name, id, 40); const definitionId = v.id(p.definitionId, id);
    if (definitions.has(definitionId)) v.invalid(id, "A definition may have only one sales channel");
    definitions.add(definitionId);
    v.choice(p.delivery, ["equipment", "supply"], id); v.number(p.price, id, 1, 50_000);
    v.number(p.availableFromDay, id, 1, 366); v.choice(p.mode, ["fixed", "rotation"], id);
    if (p.delivery === "equipment") {
      v.reference(catalog.equipment, definitionId, id); v.choice(p.purchaseLimit, [1], id);
    } else {
      v.reference(catalog.journey!.items, definitionId, id);
      if (p.mode !== "fixed" || p.availableFromDay !== 1 || p.purchaseLimit !== null || p.price !== catalog.economy?.prices[definitionId]) v.invalid(id, "Baseline supplies retain their fixed price and availability");
    }
  }
  for (const id of Object.keys(catalog.economy!.prices)) if (!definitions.has(id)) v.invalid("shop.products", "A baseline supply is missing");
  for (const id of Object.keys(catalog.equipment)) if (!definitions.has(id)) v.invalid("shop.products", "Equipment has no sales definition");
  let previous = 0;
  for (const rawSlot of v.list(shop.rotationSlots, "shop.rotationSlots", 16)) {
    const slot = v.record(rawSlot, "shop.rotationSlots", ["fromDay", "count"]);
    const day = v.number(slot.fromDay, "fromDay", 1, 366);
    if (day <= previous) v.invalid("shop.rotationSlots", "Days must increase");
    previous = day; v.number(slot.count, "count", 0, 8);
  }
  return structuredClone(raw) as ShopContent;
}
