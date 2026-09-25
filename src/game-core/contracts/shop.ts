export type ShopProduct = {
  id: string; name: string; definitionId: string; delivery: "supply" | "equipment";
  price: number; availableFromDay: number; mode: "fixed" | "rotation"; purchaseLimit: number | null;
};
export type ShopContent = {
  version: 1; quoteVersion: 1; products: Record<string, ShopProduct>;
  rotationSlots: {fromDay: number; count: number}[];
};
export type ShopState = {
  seed: string; day: number; cycle: number; bag: string[]; admitted: string[];
  offers: {productId: string; remaining: number}[]; purchases: Record<string, number>;
};
export type ProductPurchase = {shopId: string; productId: string; quantity: number; day: number; quoteVersion: number; scheduleVersion: number};
