import { expect, it } from "vitest";
import { GameStorageError } from "../index";
import { shopFixture } from "./shop-foundation-fixture";
import type { ShopVisitPhase } from "../../game-core/contracts/shop-visit";

async function create(startAt: "hub" | "debug-shop" | "airp-director" = "hub") {
  const f = shopFixture();
  const result = await f.runtime.application.createNewGame({saveId: f.saveId, epoch: "visit-epoch", clientRequestId: "create", startAt});
  expect(result.ok).toBe(true);
  const view = () => f.runtime.queries.shop(f.read())!;
  const advance = (choice: "continue" | "A" | "B" = "continue") => {
    const progress = f.read().snapshot.campaign.shopVisit!;
    return f.commit({type: "advance-shop-visit", shopId: "shop.mansion", phase: progress.phase, step: progress.step, choice});
  };
  async function through(phase: ShopVisitPhase) {
    for (let count = 0; f.read().snapshot.campaign.shopVisit!.phase === phase && count < 40; count++) await advance();
  }
  const appraisal = () => f.commit({type: "appraise-shop-visit", shopId: "shop.mansion", quoteVersion: view().loot!.quoteVersion});
  return {...f, view, advance, through, appraisal};
}

it.each(["A", "B"] as const)("settles branch %s atomically with 11 coins, optional nail and exactly one token", async choice => {
  const f = await create();
  const original = f.read(), gold = original.snapshot.campaign.funds.party;
  expect(f.view().firstVisit).toEqual({progress: null, canBegin: true});
  await f.commit({type: "begin-shop-visit", shopId: "shop.mansion"});
  expect(f.read().snapshot.campaign.startReward).toEqual(original.snapshot.campaign.startReward);
  const ids = f.read().snapshot.campaign.shopVisit!.items;
  expect(f.view().loot!.items.find(item => item.instanceId === ids.coins)?.quantity).toBe(12);
  expect((await f.send({type: "sell-loot", shopId: "shop.mansion", instanceId: ids.coins, quoteVersion: f.view().loot!.quoteVersion})).result.ok).toBe(false);
  await f.through("arrival");
  expect(f.read().snapshot.campaign.shopVisit?.phase).toBe("appraise");
  expect((await f.send({type: "advance-shop-visit", shopId: "shop.mansion", phase: "appraise", step: 0, choice: "continue"})).result.ok).toBe(false);
  await f.appraisal();
  expect(f.read().snapshot.campaign.funds.party).toBe(gold);
  expect(f.view().loot!.items.find(item => item.instanceId === ids.nail)).toMatchObject({salePrice: 400, resultId: "appraisal.barrier-nail"});
  for (let step = 0; step < 7; step++) await f.advance();
  expect(f.view().loot!.items.find(item => item.instanceId === ids.coins)?.quantity).toBe(11);
  const snapshot = f.read();
  expect(await shopFixture(snapshot).runtime.application.open(f.saveId)).toEqual({ok: true, record: snapshot});
  for (let step = 7; step < 17; step++) await f.advance();
  await f.advance(choice); await f.through("reply");
  const command = {type: "sell-shop-visit" as const, shopId: "shop.mansion", quoteVersion: f.view().loot!.quoteVersion};
  const sale = await f.commit(command);
  expect(f.read().snapshot.campaign.funds.party - gold).toBe(choice === "A" ? 2202 : 1802);
  expect(f.view().loot!.items.some(item => item.instanceId === ids.nail)).toBe(choice === "B");
  expect(f.view().loot!.items.some(item => item.instanceId === ids.bread)).toBe(true);
  expect(f.read().snapshot.campaign.lootTrades!.filter(trade => trade.kind === "sell" && trade.item.instanceId === ids.token)).toHaveLength(1);
  const settled = f.read();
  expect((await f.runtime.application.dispatch(sale.input)).ok).toBe(true);
  expect(f.read()).toEqual(settled);
  expect((await f.send(command)).result.ok).toBe(false);
  await f.through("purchase");
  expect(f.read().snapshot.campaign.shopVisit?.phase).toBe("buy");
  await f.advance(); // Buying nothing is explicitly permitted.
  for (let step = 0; step < 8; step++) await f.advance();
  expect(f.read().snapshot.campaign.shopVisit?.status).toBe("completed");
  expect(f.view().firstVisit).toBeNull();
  expect(f.view().introduction).toBeNull();
  expect(f.read().snapshot.campaign.funds.party - gold).toBe(choice === "A" ? 2202 : 1802);
  const exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  const restored = shopFixture();
  expect((await restored.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).ok).toBe(true);
  expect(restored.read()).toEqual(f.read());
}, 60_000);

it.each(["before", "after"] as const)("recovers a coin-sampling save failure %s commit without sampling twice", async when => {
  const f = await create("debug-shop");
  await f.commit({type: "begin-shop-visit", shopId: "shop.mansion"});
  await f.through("arrival"); await f.appraisal();
  for (let step = 0; step < 6; step++) await f.advance();
  const commit = f.store.commit.bind(f.store); let armed = true;
  f.store.commit = async plan => {
    if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");}
    return commit(plan);
  };
  const sent = await f.send({type: "advance-shop-visit", shopId: "shop.mansion", phase: "valuation", step: 6, choice: "continue"});
  expect(sent.result.ok).toBe(false);
  expect((await f.runtime.application.dispatch(sent.input)).ok).toBe(true);
  expect(f.read().snapshot.campaign.shopVisit).toMatchObject({phase: "valuation", step: 7});
  expect(f.view().loot!.items.find(item => item.definitionId.endsWith("cross-coins"))?.quantity).toBe(11);
}, 60_000);

it("enables the complete scene for the AIRP shortcut without forging a tutorial victory", async () => {
  const f = await create("airp-director");
  expect(f.read().snapshot.campaign.tutorial?.status).toBe("exempt");
  await f.commit({type: "begin-shop-visit", shopId: "shop.mansion"});
  await f.advance();
  expect(f.read().snapshot.campaign.shopVisit).toMatchObject({phase: "arrival", step: 1});
  expect(f.read().snapshot.campaign.tutorial?.status).toBe("exempt");
  expect(f.read().snapshot.campaign.settlements).toEqual([]);
  expect((await f.runtime.application.open(f.saveId)).ok).toBe(true);
});

it("keeps previously sold lots and frozen old prices intact instead of granting missing story props", async () => {
  const f = await create();
  const nail = f.view().loot!.items.find(item => item.definitionId.endsWith("barrier-nail"))!;
  await f.commit({type: "appraise-loot", shopId: "shop.mansion", instanceId: nail.instanceId, quoteVersion: f.view().loot!.quoteVersion});
  expect(f.view().loot!.items.find(item => item.instanceId === nail.instanceId)?.salePrice).toBe(500);
  await f.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: nail.instanceId, quoteVersion: f.view().loot!.quoteVersion});
  const before = f.read();
  expect(f.view().firstVisit).toBeNull();
  expect((await f.send({type: "begin-shop-visit", shopId: "shop.mansion"})).result.ok).toBe(false);
  expect(f.read()).toEqual(before);
});
