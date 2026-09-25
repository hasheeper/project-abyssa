import { expect, it } from "vitest";
import { facilitiesFixture } from "./facilities-fixture";
import { shopFixture, playShopTutorial } from "./shop-foundation-fixture";
import { formalAirpFixture } from "./airp-game-fixture";
import { weeklyPublicGrant } from "../../game-core/session/facilities";
import { ESTATE_CATALOG } from "../../game-runtime/estate-context";
import { GameStorageError } from "../index";

it.each([27, 28])("pays once at free play and every Monday morning, including reloads and retries (%s)", async version => {
  const f = await facilitiesFixture(version), initial = f.state().facilities!.funding!;
  expect(f.state().funds.public).toBe(500_000);
  expect(initial).toMatchObject({paidThroughWeek: 0, totalGranted: 500_000});
  await f.tick(27);
  expect(f.state().clock).toEqual({day: 7, phase: "night"});
  expect(f.state().funds.public).toBe(500_000);
  const monday = await f.commit({type: "advance-phase"});
  const amount = weeklyPublicGrant(initial.seed, 1, ESTATE_CATALOG.data.facilities!.construction!.funding.weekly);
  expect([450_000, 475_000, 500_000, 525_000, 550_000]).toContain(amount);
  expect(f.state().clock).toEqual({day: 8, phase: "dawn"});
  expect(f.state().funds.public).toBe(500_000 + amount);
  const paid = f.read();
  expect(await f.runtime.application.dispatch(monday.input)).toMatchObject({ok: true, replayed: true});
  expect(await f.runtime.application.open(f.saveId)).toMatchObject({ok: true, record: paid});
  expect(f.read()).toEqual(paid);
  await f.tick(27);
  expect(f.state().funds.public).toBe(500_000 + amount);
  await f.tick();
  expect(f.state().funds.public).toBe(500_000 + amount + weeklyPublicGrant(initial.seed, 2, ESTATE_CATALOG.data.facilities!.construction!.funding.weekly));
}, 30_000);

it("normal tutorial pays only upon completion; reopening cannot add another initial grant", async () => {
  const {f, checkpoints} = await playShopTutorial("tutorial", 27);
  expect(checkpoints.created.snapshot.campaign.funds.public).toBe(0);
  expect(checkpoints.claimable.snapshot.campaign.funds.public).toBe(0);
  expect(f.read().snapshot.campaign.funds.public).toBe(500_000);
  expect((await f.runtime.application.open(f.saveId)).ok).toBe(true);
  expect(f.read().snapshot.campaign.funds.public).toBe(500_000);
}, 30_000);

it("restoring or copying a pre-Monday save preserves the upcoming payment", async () => {
  const f = await facilitiesFixture(27);
  await f.tick(27);
  const saved = f.read(), exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  await f.tick(); const expected = f.state().funds.public;
  const target = shopFixture();
  expect(await target.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect(target.read().snapshot).toEqual(saved.snapshot);
  await target.commit({type: "advance-phase"});
  expect(target.read().snapshot.campaign.funds.public).toBe(expected);
  const imported = await target.runtime.application.importSave({archive: exported.archive, saveId: "copy", epoch: "copy", clientRequestId: "copy"});
  if (!imported.ok) throw Error(JSON.stringify(imported));
  const opened = await target.runtime.application.open("copy");
  if (!opened.ok) throw Error("open");
  expect(opened.record.snapshot.campaign.funds.public).toBe(500_000);
  expect(await target.runtime.application.dispatch({protocolVersion: 4, saveId: "copy", expectedHead: opened.record.head, clientRequestId: "copied-monday", command: {type: "advance-phase"}})).toMatchObject({ok: true});
  expect(target.db.records.get("copy")!.snapshot.campaign.funds.public).toBe(expected);
}, 30_000);

it.each(["before", "after"] as const)("recovers a %s-write Monday fault without duplicating or rerolling", async when => {
  const f = await facilitiesFixture(27); await f.tick(27);
  const expected = shopFixture(f.read()); await expected.commit({type: "advance-phase"});
  const commit = f.store.commit.bind(f.store); let armed = true;
  f.store.commit = async plan => { if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");} return commit(plan); };
  const sent = await f.send({type: "advance-phase"}); expect(sent.result.ok).toBe(false);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
  expect(f.read().snapshot).toEqual(expected.read().snapshot);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read().snapshot).toEqual(expected.read().snapshot);
}, 30_000);

it.each([25, 26])("keeps historical content %s free of grants and paid construction", async version => {
  const f = await facilitiesFixture(version); await f.tick(4);
  await f.commit({type: "facility-enable", roomId: "greenhouse"});
  expect(f.state().facilities!.levels.greenhouse).toBe(1);
  expect(f.state().facilities!.funding).toBeUndefined();
  expect(f.state().funds.public).toBe(0);
  expect((await f.send({type: "facility-build", roomId: "kitchen", fromLevel: 1, quotedCost: 200_000})).result.ok).toBe(false);
});

it("keeps formal AIRP preparation, guards and inventory live in content28", async () => {
  const f = await formalAirpFixture("tide-reef.ordinary", 28);
  expect(f.raw().snapshot.campaign.funds.public).toBe(500_000);
  const id = await f.prepare(), permit = await f.flow.gm.departurePermit(id);
  await f.send({type: "start-expedition", ...permit.departure});
  expect(f.raw().snapshot.campaign.facilities!.reservations).toEqual({"item.food": 1, "item.potion": 1});
  expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
}, 30_000);
