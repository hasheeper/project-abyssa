import { beforeAll, expect, it } from "vitest";
import { playShopTutorial, shopFixture } from "./shop-foundation-fixture";
import { GameStorageError, type D5GameRecord } from "../index";

let checkpoints: Record<string, D5GameRecord>;
beforeAll(async () => {checkpoints = (await playShopTutorial("prologue")).checkpoints;}, 180_000);
const advance = (step: number, choice: "continue" | "skip" = "continue") => ({type: "advance-shop-introduction" as const, shopId: "shop.mansion", step, choice});

it("reaches the same first appraisal from a preserved content-16 save through the full authored opening", async () => {
  const f = shopFixture(checkpoints.claimed);
  expect(checkpoints.created.contentRef.contentVersion).toBe(16);
  expect(checkpoints.created.snapshot.campaign.prologue?.status).toBe("viewed");
  expect(checkpoints.created.snapshot.campaign.opening?.status).toBe("viewed");
  expect(checkpoints.created.snapshot.campaign.loot).toEqual([]);
  expect(checkpoints.created.snapshot.campaign.funds.party).toBe(0);
  const campaign = f.read().snapshot.campaign;
  expect(campaign.funds.party).toBe(49);
  expect(campaign.loot).toHaveLength(1);
  // The frozen version-15/16 reward still matches its guided route; modern defaults are separate.
  const skip = f.runtime.defaultCreation;
  expect(skip.contentVersion).toBe(23);
  const {STARTER_REWARD_CATALOG} = await import("../../game-runtime/starter-reward-context");
  const reward = STARTER_REWARD_CATALOG.data.tutorialSkipReward!;
  expect(reward.gold).toBe(campaign.funds.party);
  expect(reward.supplies).toEqual(campaign.supplies.map(({definitionId, charges}) => ({definitionId, charges})));
  expect(reward.lootDefinitionIds).toEqual(campaign.loot!.map(item => item.definitionId));
  expect(campaign.settlements.at(-1)).toMatchObject({deepestLayer: 4, totalGold: 41});
  expect(campaign.progress.appliedGrowthIds).toEqual([]);
  expect(campaign.loot![0].roomId).toBe("g2-run:room:4:1");
  expect(f.runtime.queries.shop(f.read())?.introduction).toMatchObject({step: 0, lastStep: 3});
  for (let step = 0; step <= 3; step++) await f.commit(advance(step));
  expect(f.runtime.queries.shop(f.read())?.introduction).toBeNull();
  const {shopIntroduction, ...afterIntro} = f.read().snapshot.campaign;
  const {shopIntroduction: _beforeIntro, ...beforeIntro} = campaign;
  expect(shopIntroduction).toEqual({step: 3, status: "viewed"});
  expect(afterIntro).toEqual(beforeIntro);
  await f.commit({type: "appraise-loot", shopId: "shop.mansion", instanceId: campaign.loot![0].instanceId, quoteVersion: 1});
  expect(f.read().snapshot.campaign.funds.party).toBe(47);
  expect(f.read().snapshot.campaign.loot![0].resultId).toBe("appraisal.ship-lamp-ring");
  await f.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: campaign.loot![0].instanceId, quoteVersion: 1});
  expect(f.read().snapshot.campaign.funds.party).toBe(55);
  await f.commit({type: "purchase-supply", shopId: "shop.mansion", definitionId: "item.holy-water", quantity: 1, quoteVersion: 1});
  expect(f.read().snapshot.campaign.funds.party).toBe(52);
}, 180_000);

it.each(["pending", "viewed", "skipped"] as const)("retains %s introduction progress across reload, exact restore and copy", async status => {
  const f = shopFixture(checkpoints.claimed);
  await f.commit(advance(0));
  if (status === "skipped") await f.commit(advance(1, "skip"));
  if (status === "viewed") for (let step = 1; step <= 3; step++) await f.commit(advance(step));
  const record = f.read();
  expect(record.snapshot.campaign.shopIntroduction).toEqual({step: status === "pending" ? 1 : 3, status});
  expect(await shopFixture(record).runtime.application.open(f.saveId)).toEqual({ok: true, record});
  const exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  const restored = shopFixture();
  expect(await restored.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect(restored.read()).toEqual(record);
  expect(await f.runtime.application.importSave({saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", archive: exported.archive})).toMatchObject({ok: true});
  const copied = await f.runtime.application.open("copy");
  if (!copied.ok || copied.record.schemaVersion !== 4) throw Error("copy");
  expect(copied.record.snapshot.campaign.shopIntroduction).toEqual(record.snapshot.campaign.shopIntroduction);
  expect(f.runtime.queries.shop(copied.record)?.introduction?.step ?? null).toBe(status === "pending" ? 1 : null);
  const before = f.read();
  expect((await f.send(advance(0))).result).toMatchObject({ok: false, error: {code: "command-not-available"}});
  expect(f.read()).toEqual(before);
}, 30_000);

it("requires the completed tutorial, matching shop and exact cursor, and rejects forged progress", async () => {
  for (const id of ["created", "firstGold", "claimable"]) {
    const f = shopFixture(checkpoints[id]), before = f.read();
    expect(f.runtime.queries.shop(before)?.introduction).toBeNull();
    expect((await f.send(advance(0))).result.ok).toBe(false);
    expect(f.read()).toEqual(before);
  }
  const f = shopFixture(checkpoints.claimed), before = f.read();
  expect((await f.send({...advance(0), shopId: "shop.other"})).result.ok).toBe(false);
  expect((await f.send(advance(2))).result.ok).toBe(false);
  expect(f.read()).toEqual(before);
  const forged = structuredClone(before);
  forged.snapshot.campaign.shopIntroduction = {step: 3, status: "viewed"};
  expect(await shopFixture(forged).runtime.application.open(f.saveId)).toMatchObject({ok: false});
}, 60_000);

it.each([15, 16])("exempts skipped tutorials and keeps content %s compatibility", async contentVersion => {
  const f = shopFixture();
  expect(await f.runtime.application.create({...f.runtime.defaultCreation, contentVersion, saveId: f.saveId, epoch: "skip", clientRequestId: "create"})).toMatchObject({ok: true});
  await f.commit({type: "select-game-start", startAt: "hub"});
  const before = f.read();
  expect(before.snapshot.campaign.shopIntroduction).toEqual(contentVersion === 16 ? {step: 0, status: "exempt"} : undefined);
  expect(f.runtime.queries.shop(before)?.introduction).toBeNull();
  expect((await f.send(advance(0))).result.ok).toBe(false);
  expect(f.read()).toEqual(before);
});

it.each(["before", "after"])("recovers an introduction write lost %s commit without double advancement", async when => {
  const f = shopFixture(checkpoints.claimed), commit = f.store.commit.bind(f.store);
  let armed = true;
  f.store.commit = async plan => {
    if (armed) {
      armed = false;
      if (when === "after") await commit(plan);
      throw new GameStorageError("storage-unavailable", "injected failure");
    }
    return commit(plan);
  };
  const sent = await f.send(advance(0));
  expect(sent.result.ok).toBe(false);
  expect(f.read().snapshot.campaign.shopIntroduction?.step).toBe(when === "before" ? 0 : 1);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
  expect(f.read().snapshot.campaign.shopIntroduction).toEqual({step: 1, status: "pending"});
  expect(f.read().head.revision).toBe(checkpoints.claimed.head.revision + 1);
}, 30_000);
