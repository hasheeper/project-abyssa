import { expect, it } from "vitest";
import { SHOP_WAVE_CATALOG_DATA } from "../../content/gameplay/demo-v23/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { advanceShopToDay, initializeShop, offeredProducts, commitProductStock } from "./shop-schedule";

const catalog = validateD5Catalog(SHOP_WAVE_CATALOG_DATA), content = catalog.data.shop!;
it("opens only the scheduled products and leaves same-day stock untouched", () => {
  const shop = initializeShop(content, "start:1");
  expect(offeredProducts(content, shop).map(p => p.delivery)).toEqual(Array(5).fill("supply"));
  for (const [day, fixed, rotating] of [[2, 7, 0], [3, 7, 1], [4, 9, 1], [5, 9, 1], [6, 10, 1], [7, 10, 2]]) {
    advanceShopToDay(content, shop, day);
    expect(offeredProducts(content, shop).filter(p => p.mode === "fixed")).toHaveLength(fixed);
    expect(shop.offers).toHaveLength(rotating);
  }
  const before = structuredClone(shop);
  advanceShopToDay(content, shop, 7); expect(shop).toEqual(before);
  const id = shop.offers[0].productId;
  commitProductStock(shop, content.products[id], 1);
  expect(shop.offers).toEqual([{productId: id, remaining: 0}, before.offers[1]]);
  expect(offeredProducts(content, shop).some(p => p.id === id)).toBe(true);
  advanceShopToDay(content, shop, 8); expect(shop.offers.some(o => o.productId === id)).toBe(false);
});

it("covers the rotating pool by D7 and within every four days, including partially bought pools", () => {
  for (let seed = 0; seed < 128; seed++) for (const strategy of ["none", "all", "one", "three"]) {
    const shop = initializeShop(content, `seed:${seed}`), seen = new Set<string>();
    const history: string[][] = [];
    for (let day = 1; day <= 28; day++) {
      advanceShopToDay(content, shop, day);
      const ids = shop.offers.map(o => o.productId); history.push(ids); ids.forEach(id => seen.add(id));
      expect(new Set(ids).size).toBe(ids.length);
      if (strategy === "none" && day === 7) expect(seen.size).toBe(4);
      if (strategy === "none" && day >= 10) expect(new Set(history.slice(-4).flat()).size).toBe(4);
      for (const id of ids) {
        const bought = Object.keys(shop.purchases).length;
        if (strategy === "all" || strategy === "one" && bought < 1 || strategy === "three" && bought < 3) commitProductStock(shop, content.products[id], 1);
      }
      const reloaded = JSON.parse(JSON.stringify(shop));
      advanceShopToDay(content, reloaded, day + 1);
      const cloned = structuredClone(shop); advanceShopToDay(content, cloned, day + 1);
      expect(reloaded).toEqual(cloned);
    }
    if (strategy === "all") expect(shop.offers).toEqual([]);
    if (strategy === "three") expect(shop.offers).toHaveLength(1);
  }
});
