export type ShopSupply = {
  id: string;
  name: string;
  iconUrl: string;
  description: string;
  price: number;
  owned: number;
  capacity: number;
};

/** Presentation only. The runtime still validates and commits every quote. */
export function supplyPurchase(item: ShopSupply, funds: number, requested: number) {
  const remaining = Math.max(0, item.capacity - item.owned);
  const quantity = Math.min(remaining, Math.max(1, Math.floor(requested)));
  const total = item.price * quantity;
  return { remaining, quantity, total, shortfall: Math.max(0, total - funds), after: item.owned + quantity };
}
