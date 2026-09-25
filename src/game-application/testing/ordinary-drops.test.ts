import { beforeAll, expect, it } from "vitest";
import { dropCatalog, startOrdinaryDrops, playOrdinaryDrops, settleOrdinaryDrops } from "./ordinary-drops-fixture";
import { readD5Archive, validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";
import { retainHalfLoot } from "../../game-core/session/expedition-loot";
import { d5VisibleEvents } from "../../game-runtime/d5-views";
import { shopFixture, playShopTutorial } from "./shop-foundation-fixture";
import { GameStorageError } from "../index";
import type { D5GameRecord } from "../versions/d5-contracts";

let manorCleared: D5GameRecord;
beforeAll(async () => {
  const f = await startOrdinaryDrops("old-manor.first-clear");
  const {terminal} = await playOrdinaryDrops(f, "clear");
  expect(terminal.outcome).toBe("cleared");
  await settleOrdinaryDrops(f); manorCleared = f.read();
}, 120_000);

it.each(["tide-reef.ordinary", "old-manor.first-clear", "old-manor.maintenance"])("obtains, banks, appraises and sells real rewards in %s", async route => {
  const f = await startOrdinaryDrops(route, route.endsWith("maintenance") ? manorCleared : undefined);
  let midway: D5GameRecord | undefined;
  const {record, terminal} = await playOrdinaryDrops(f, "clear", record => {
    const run = record.snapshot.run;
    if (run?.kind === "expedition" && run.state.run.carriedLoot?.length && run.state.run.settledLayers.length === 0) midway ??= record;
  });
  expect(terminal.outcome).toBe("cleared"); expect(midway).toBeDefined();
  const bags = terminal.lootLedger!;
  expect(bags.unbanked).toEqual([]); expect(terminal.returnedLoot).toEqual(bags.banked);
  const curios = bags.banked.filter(item => !dropCatalog.data.loot!.definitions[item.definitionId].initiallyKnown);
  expect(curios.length).toBeGreaterThanOrEqual(1); expect(curios.length).toBeLessThanOrEqual(2);
  expect(new Set(curios.map(i => i.definitionId)).size).toBe(curios.length);
  const facts = d5VisibleEvents(record, {kind: "expedition", id: f.runId}).filter(f => f.kind === "loot-found");
  expect(facts).toHaveLength(bags.banked.length);
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: midway}), dropCatalog, D5_RUN_READERS)).toEqual(midway);
  const forged = structuredClone(record);
  if (forged.snapshot.run?.kind === "expedition" && forged.snapshot.run.state.node === "finished") forged.snapshot.run.state.result.lootProof!.seed++;
  expect(() => validateD5Record(forged, dropCatalog, D5_RUN_READERS)).toThrow();
  const settled = await settleOrdinaryDrops(f), after = f.read();
  expect(await f.runtime.application.dispatch(settled.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read()).toEqual(after);
  expect(after.snapshot.campaign.loot!.length - f.before.snapshot.campaign.loot!.length).toBe(bags.banked.length);
  const startMoney = after.snapshot.campaign.funds.party;
  let net = 0;
  for (const item of curios) {
    const appraisal = await f.commit({type: "appraise-loot", shopId: "shop.mansion", instanceId: item.instanceId, quoteVersion: 2});
    expect(await f.runtime.application.dispatch(appraisal.input)).toMatchObject({ok: true, replayed: true});
    expect((await f.send({type: "appraise-loot", shopId: "shop.mansion", instanceId: item.instanceId, quoteVersion: 2})).result.ok).toBe(false);
    net -= 300;
  }
  // Sell the returned kinds as actual inventory stacks, including prior matching stock.
  for (const drop of bags.banked) {
    const owned = f.read().snapshot.campaign.loot!.find(i => i.instanceId === drop.instanceId);
    if (!owned) continue;
    const same = f.read().snapshot.campaign.loot!.filter(i => i.definitionId === owned.definitionId && i.resultId === owned.resultId);
    const quantity = same.length;
    const trade = await f.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: owned.instanceId, quoteVersion: 2, quantity});
    net += quantity * dropCatalog.data.loot!.definitions[owned.definitionId].salePrice;
    expect(await f.runtime.application.dispatch(trade.input)).toMatchObject({ok: true, replayed: true});
    expect((await f.send({type: "sell-loot", shopId: "shop.mansion", instanceId: owned.instanceId, quoteVersion: 2})).result.ok).toBe(false);
  }
  expect(f.read().snapshot.campaign.funds.party).toBe(startMoney + net);
  const exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("Export failed");
  expect(readD5Archive(exported.archive, dropCatalog, D5_RUN_READERS)).toEqual(f.read());
}, 120_000);

it.each(["extract", "wipe"] as const)("keeps the correct inventory after reef %s and restores its proof", async outcome => {
  const f = await startOrdinaryDrops("tide-reef.ordinary"), {record, terminal} = await playOrdinaryDrops(f, outcome);
  const bags = terminal.lootLedger!;
  expect(terminal.outcome).toBe(outcome === "wipe" ? "wipe" : "extracted");
  expect(terminal.returnedLoot).toEqual(outcome === "wipe" ? retainHalfLoot(bags.banked) : bags.banked);
  expect(terminal.returnedLoot!.some(d => bags.unbanked.some(u => u.instanceId === d.instanceId))).toBe(false);
  expect(terminal.returnedLoot!.some(d => d.roomId.endsWith(":3:1"))).toBe(false);
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record}), dropCatalog, D5_RUN_READERS)).toEqual(record);
  await settleOrdinaryDrops(f);
  expect(f.read().snapshot.campaign.loot!.length - f.before.snapshot.campaign.loot!.length).toBe(terminal.returnedLoot!.length);
}, 120_000);

it("sells a stack atomically across before-write and after-write faults", async () => {
  const original = manorCleared.snapshot.campaign;
  const item = original.loot!.find(item => item.resultId && item.definitionId.startsWith("loot.salvage.") && original.loot!.filter(other => other.definitionId === item.definitionId).length >= 2)!;
  expect(item).toBeDefined();
  const price = dropCatalog.data.loot!.definitions[item.definitionId].salePrice;
  for (const when of ["before", "after"] as const) {
    const f = shopFixture(manorCleared), commit = f.store.commit.bind(f.store); let armed = true;
    f.store.commit = async plan => {if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");} return commit(plan);};
    const sent = await f.send({type: "sell-loot", shopId: "shop.mansion", instanceId: item.instanceId, quoteVersion: 2, quantity: 2});
    expect(sent.result.ok).toBe(false);
    expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
    const after = f.read().snapshot.campaign;
    expect(after.loot).toHaveLength(original.loot!.length - 2);
    expect(after.funds.party).toBe(original.funds.party + price * 2);
    expect(after.lootTrades).toHaveLength(original.lootTrades!.length + 2);
  }
}, 120_000);

it("keeps the current four-layer tutorial fixed with its free first appraisal", async () => {
  const {f} = await playShopTutorial("tutorial", 21);
  expect(f.read().snapshot.campaign.funds.party).toBe(4400);
  expect(f.read().snapshot.campaign.loot).toHaveLength(4);
  expect(f.runtime.queries.shop(f.read())!.loot!.items.find(i => i.definitionId === "loot.tutorial.barrier-nail")!.appraisalFee).toBe(0);
}, 120_000);
