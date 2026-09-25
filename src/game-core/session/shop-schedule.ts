import { supplyStorageCapacity, supplyStorageRoom } from "./facilities";
import type { ShopContent, ShopState, ShopProduct, ProductPurchase } from "../contracts/shop";
import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5Projection } from "./d5-types";
import { sha256 } from "../contracts/sha256";
import * as v from "../contracts/validation";

const order = (ids: string[], key: (string | number)[]) => ids.map(id => ({id, key: sha256(v.canonicalJson([...key, id]))}))
  .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(row => row.id);
export const productRemaining = (shop: ShopState, product: ShopProduct) => product.purchaseLimit === null ? null : Math.max(0, product.purchaseLimit - (shop.purchases[product.id] ?? 0));
export function initializeShop(content: ShopContent, startFactId: string): ShopState {
  const shop: ShopState = {seed: sha256(v.canonicalJson(["shop.mansion", content.version, startFactId])), day: 0, cycle: 0, bag: [], admitted: [], offers: [], purchases: {}};
  advanceShopToDay(content, shop, 1); return shop;
}

/** Mutates only a reducer-owned projection. Queries and purchases never draw. */
export function advanceShopToDay(content: ShopContent, shop: ShopState, targetDay: number) {
  if (!Number.isSafeInteger(targetDay) || targetDay < shop.day) v.invalid("shop.day", "Clock cannot rewind inside a projection");
  while (shop.day < targetDay) {
    shop.day++;
    const eligible = Object.values(content.products).filter(p => p.mode === "rotation" && p.availableFromDay <= shop.day && productRemaining(shop, p) !== 0).map(p => p.id);
    const slots = [...content.rotationSlots].reverse().find(s => s.fromDay <= shop.day)?.count ?? 0;
    shop.bag = shop.bag.filter(id => eligible.includes(id));
    const added = eligible.filter(id => !shop.admitted.includes(id));
    shop.admitted.push(...added);
    if (shop.bag.length) shop.bag.push(...order(added, [shop.seed, content.version, "admit", shop.day]));
    const previousLast = shop.offers.at(-1)?.productId, selected: string[] = [];
    while (selected.length < Math.min(slots, eligible.length)) {
      if (!shop.bag.length) {
        const shuffled = order(eligible, [shop.seed, content.version, "cycle", ++shop.cycle]);
        shop.bag = [...shuffled.filter(id => id !== previousLast), ...shuffled.filter(id => id === previousLast)];
      }
      const index = shop.bag.findIndex(id => !selected.includes(id));
      if (index < 0) v.invalid("shop.bag", "No distinct candidate remains");
      selected.push(shop.bag.splice(index, 1)[0]);
    }
    shop.offers = selected.map(productId => ({productId, remaining: 1}));
  }
}

export function offeredProducts(content: ShopContent, shop: ShopState) {
  const fixed = Object.values(content.products).filter(p => p.mode === "fixed" && p.availableFromDay <= shop.day && productRemaining(shop, p) !== 0);
  return [...fixed, ...shop.offers.map(o => content.products[o.productId])];
}

export function productQuote(catalog: ValidatedD5Catalog, campaign: D5Projection, input: ProductPurchase) {
  const content = catalog.data.shop, shop = campaign.shop;
  if (!content || !shop) v.invalid("shop", "Select a game start before shopping", "content-unavailable");
  if (campaign.activeRunRef || campaign.activeStoryId) v.invalid("shop", "Finish the active run or story", "run-active");
  if (input.shopId !== catalog.data.economy!.shopId || input.day !== shop.day || input.day !== campaign.clock.day || input.quoteVersion !== content.quoteVersion || input.scheduleVersion !== content.version) v.invalid("quote", "Shop day or quote changed", "quote-expired");
  const product = v.reference(content.products, input.productId, "productId");
  if (!offeredProducts(content, shop).some(p => p.id === product.id)) v.invalid("productId", "Product is not offered", "item-unavailable");
  const remaining = product.mode === "rotation" ? shop.offers.find(o => o.productId === product.id)?.remaining ?? 0 : productRemaining(shop, product);
  if (remaining === 0 || productRemaining(shop, product) === 0) v.invalid("productId", "Sold out", "shop-sold-out");
  const capacity = product.delivery === "supply" ? supplyStorageCapacity(catalog, campaign, product.definitionId) : 1;
  const quantity = v.number(input.quantity, "quantity", 1, capacity);
  if (remaining !== null && quantity > remaining) v.invalid("quantity", "Insufficient shop stock", "shop-sold-out");
  const stored = product.delivery === "supply" ? campaign.supplies.find(s => s.definitionId === product.definitionId) : undefined;
  if (product.delivery === "supply" && (catalog.data.facilities ? supplyStorageRoom(catalog, campaign, product.definitionId) < quantity : stored && stored.charges + quantity > capacity)) v.invalid("quantity", "Supply capacity exceeded", "inventory-full");
  const total = product.price * quantity;
  if (campaign.funds.party < total) v.invalid("funds.party", "Insufficient party funds", "insufficient-funds");
  return {product, total, stored, quantity};
}

export function commitProductStock(shop: ShopState, product: ShopProduct, quantity: number) {
  // Unlimited supplies need no accumulating counter; their real capacity is checked above.
  if (product.purchaseLimit !== null) shop.purchases[product.id] = (shop.purchases[product.id] ?? 0) + quantity;
  const offer = shop.offers.find(o => o.productId === product.id);
  if (offer) offer.remaining -= quantity;
}
