import { shopFixture } from "./shop-foundation-fixture";
import { SHOP_WAVE_CATALOG } from "../../game-runtime/shop-wave-context";
import type { D5GameRecord } from "../versions/d5-contracts";

export async function shopWaveFixture(record?: D5GameRecord) {
  const f = shopFixture(record);
  if (!record) {
    const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 23, profileId: "profile.demo.first-run", saveId: f.saveId, epoch: "wave", clientRequestId: "create-wave"});
    if (!created.ok) throw Error(JSON.stringify(created));
    await f.commit({type: "select-game-start", startAt: "hub"});
  }
  async function day(target: number, phase: "dawn" | "night" = "dawn") {
    while (f.read().snapshot.campaign.clock.day < target || f.read().snapshot.campaign.clock.phase !== phase) await f.commit({type: "advance-phase"});
  }
  const quote = (suffix: string) => ({type: "purchase-product" as const, shopId: "shop.mansion", productId: `product.equipment.${suffix}`, day: f.read().snapshot.campaign.clock.day, quoteVersion: 1, scheduleVersion: 1, quantity: 1});
  return {...f, day, quote, catalog: SHOP_WAVE_CATALOG};
}
