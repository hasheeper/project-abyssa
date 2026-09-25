import { beforeAll, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { shopFixture, playShopTutorial } from "./shop-foundation-fixture";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import { GameStorageError } from "../contracts";
import { lootQuote } from "../../game-core/session/d5-loot";
import { SHOP_FOUNDATION_CATALOG } from "../../game-runtime/shop-foundation-context";
import { g2RunRef } from "./tide-guided-g2-playthrough";

let checkpoints: Record<string, D5GameRecord>;
beforeAll(async () => { ({checkpoints} = await playShopTutorial()); }, 90_000);
const trade = (type: "appraise-loot" | "sell-loot", record = checkpoints.claimed): D5Command => ({
  type, shopId: "shop.mansion", instanceId: record.snapshot.campaign.loot![0].instanceId, quoteVersion: 1,
});

it("claims, appraises, sells, buys and carries a supply through real durable commands", async () => {
  const f = shopFixture(checkpoints.claimed), before = f.read().snapshot.campaign;
  expect(before.funds.party).toBe(51);
  expect(before.loot).toHaveLength(1);
  expect(checkpoints.claimable.snapshot.campaign.loot).toEqual([]);
  expect(checkpoints.claimable.snapshot.campaign.funds.party).toBe(0);
  const item = before.loot![0];
  const appraise = await f.commit(trade("appraise-loot"));
  expect(await f.runtime.application.dispatch(appraise.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read().snapshot.campaign.loot![0]).toMatchObject({instanceId: item.instanceId, resultId: "appraisal.ship-lamp-ring"});
  expect(f.read().snapshot.campaign.funds.party).toBe(49);
  checkpoints.appraised = f.read();
  expect((await f.send(trade("appraise-loot"))).result.ok).toBe(false);
  const sold = await f.commit(trade("sell-loot"));
  expect(await f.runtime.application.dispatch(sold.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read().snapshot.campaign.loot).toEqual([]);
  expect(f.read().snapshot.campaign.funds.party).toBe(57);
  expect(f.read().snapshot.campaign.lootTrades?.map(t => t.kind)).toEqual(["appraise", "sell"]);
  checkpoints.sold = f.read();
  expect((await f.send(trade("sell-loot"))).result.ok).toBe(false);
  await f.commit({type: "purchase-supply", shopId: "shop.mansion", definitionId: "item.holy-water", quantity: 1, quoteVersion: 1});
  expect(f.read().snapshot.campaign.funds.party).toBe(54);
  checkpoints.purchased = f.read();
  await f.commit({type: "start-expedition", runId: "shop-next-trip", routeId: "old-manor.first-clear", partyIds: before.availableCharacterIds, itemIds: ["item.food", "item.potion", "item.holy-water"], seed: 19});
  const run = f.read().snapshot.run;
  expect(run?.kind === "expedition" && run.state.run.supplies.find(s => s.definitionId === "item.holy-water")).toMatchObject({charges: 1, source: "supply.demo.shop"});
  checkpoints.departed = f.read();
  mkdirSync("dist/reports/shop-foundation", {recursive: true});
  writeFileSync("dist/reports/shop-foundation/checkpoints.json", JSON.stringify(checkpoints));
}, 45_000);

it("rejects premature, unknown, stale and forged trades and duplicate claims", async () => {
  const f = shopFixture(checkpoints.claimed);
  expect((await f.send(trade("sell-loot"))).result.ok).toBe(false);
  for (const command of [
    {...trade("appraise-loot"), instanceId: "foreign"},
    {...trade("appraise-loot"), quoteVersion: 2},
    {...trade("appraise-loot"), gold: 0},
    {...trade("appraise-loot"), resultId: "forged"},
  ]) expect((await f.send(command as D5Command)).result.ok).toBe(false);
  expect(f.read()).toEqual(checkpoints.claimed);
  const pending = shopFixture(checkpoints.claimable);
  expect((await pending.send(trade("appraise-loot"))).result.ok).toBe(false);
  const run = pending.read().snapshot.run;
  if (run?.kind !== "expedition") throw Error("Expected tutorial");
  const claim: D5Command = {type: "settle-expedition", runRef: g2RunRef, terminalRef: run.state.result!.id};
  const paid = await pending.commit(claim);
  expect(await pending.runtime.application.dispatch(paid.input)).toMatchObject({ok: true, replayed: true});
  expect((await pending.send(claim)).result.ok).toBe(false);
  expect(pending.read().snapshot.campaign.loot).toHaveLength(1);
}, 45_000);

it.each(["before", "after"])("recovers %s-commit failures without duplicate appraisal or sale", async fault => {
  const f = shopFixture(checkpoints.claimed);
  for (const type of ["appraise-loot", "sell-loot"] as const) {
    const original = f.store.commit.bind(f.store); let armed = true;
    f.store.commit = async plan => {
      if (armed && fault === "before") { armed = false; throw new GameStorageError("storage-aborted", "before commit"); }
      const result = await original(plan);
      if (armed) { armed = false; throw new GameStorageError("storage-unavailable", "response lost"); }
      return result;
    };
    const sent = await f.send(trade(type));
    expect(sent.result.ok).toBe(false);
    f.store.commit = original;
    expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: fault === "after"});
  }
  expect(f.read().snapshot.campaign.funds.party).toBe(57);
  expect(f.read().snapshot.campaign.lootTrades).toHaveLength(2);
}, 45_000);

it("serializes competing trades and preserves results across archive restore and copy", async () => {
  const f = shopFixture(checkpoints.claimed);
  const request = {protocolVersion: 4, saveId: f.saveId, expectedHead: f.read().head, clientRequestId: "one", command: trade("appraise-loot")};
  const results = await Promise.all([f.runtime.application.dispatch(request), f.runtime.application.dispatch({...request, clientRequestId: "two"})]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  const archive = await f.runtime.application.exportSave(f.saveId);
  if (!archive.ok) throw Error(JSON.stringify(archive));
  const restored = shopFixture();
  expect(await restored.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect((await restored.runtime.application.open(f.saveId))).toMatchObject({ok: true, record: {snapshot: f.read().snapshot}});
  expect(await restored.runtime.application.importSave({saveId: "shop-copy", epoch: "copy", clientRequestId: "copy", format: "application", archive: archive.archive})).toMatchObject({ok: true});
  const copy = await restored.runtime.application.open("shop-copy");
  expect(copy).toMatchObject({ok: true, record: {snapshot: {campaign: {loot: f.read().snapshot.campaign.loot, funds: f.read().snapshot.campaign.funds}}}});
}, 45_000);

it.each(["before", "after"])("recovers a %s-commit claim with gold and loot together", async fault => {
  const f = shopFixture(checkpoints.claimable), run = f.read().snapshot.run;
  if (run?.kind !== "expedition") throw Error("Expected tutorial");
  const original = f.store.commit.bind(f.store);
  f.store.commit = async plan => {
    if (fault === "before") throw new GameStorageError("storage-aborted", "before claim");
    await original(plan);
    throw new GameStorageError("storage-unavailable", "claim response lost");
  };
  const sent = await f.send({type: "settle-expedition", runRef: g2RunRef, terminalRef: run.state.result!.id});
  expect(sent.result.ok).toBe(false);
  expect(f.read().snapshot.campaign.funds.party).toBe(fault === "before" ? 0 : 51);
  expect(f.read().snapshot.campaign.loot).toHaveLength(fault === "before" ? 0 : 1);
  f.store.commit = original;
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: fault === "after"});
  expect(f.read().snapshot.campaign.funds.party).toBe(51);
  expect(f.read().snapshot.campaign.loot).toHaveLength(1);
}, 30_000);

it("checks insufficient funds and active stories in quotes, and blocks an active expedition", async () => {
  const campaign = checkpoints.claimed.snapshot.campaign;
  const input = {type: "loot-appraised" as const, shopId: "shop.mansion", instanceId: campaign.loot![0].instanceId, quoteVersion: 1};
  expect(() => lootQuote(SHOP_FOUNDATION_CATALOG, {...campaign, funds: {...campaign.funds, party: 1}}, input)).toThrow(expect.objectContaining({code: "insufficient-funds"}));
  expect(() => lootQuote(SHOP_FOUNDATION_CATALOG, {...campaign, activeStoryId: "story-in-progress"}, input)).toThrow(expect.objectContaining({code: "run-active"}));
  const active = shopFixture(checkpoints.claimed);
  await active.commit({type: "start-expedition", runId: "next", routeId: "old-manor.first-clear", partyIds: active.read().snapshot.campaign.availableCharacterIds, itemIds: ["item.food", "item.potion"], seed: 19});
  expect((await active.send(trade("appraise-loot"))).result).toMatchObject({ok: false, error: {code: "run-active"}});
}, 45_000);
