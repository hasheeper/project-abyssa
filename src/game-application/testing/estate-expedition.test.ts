import { expect, it } from "vitest";
import { facilitiesFixture } from "./facilities-fixture";
import { ESTATE_CATALOG } from "../../game-runtime/estate-context";
import { playOrdinaryDrops, settleOrdinaryDrops } from "./ordinary-drops-fixture";

it("expedition return crosses Monday and completes construction in the same durable settlement", async () => {
  const f = await facilitiesFixture(27);
  await f.tick(24); await f.commit({type: "facility-build", roomId: "kitchen", fromLevel: 1, quotedCost: 200_000}); await f.tick(3);
  const before = f.read(), runId = "estate-return";
  await f.commit({type: "start-expedition", runId, routeId: "tide-reef.ordinary", partyIds: ESTATE_CATALOG.data.initialParty, itemIds: [], supplyQuantities: {}, seed: 19});
  const fixture = {...f, before, runId, catalog: ESTATE_CATALOG};
  await playOrdinaryDrops(fixture, "extract");
  expect(f.state().clock).toEqual({day: 7, phase: "night"});
  expect(f.state().facilities!.levels.kitchen).toBe(1);
  const settled = await settleOrdinaryDrops(fixture), final = f.read();
  expect(f.state().clock).toEqual({day: 8, phase: "dawn"});
  expect(f.state().facilities!.levels.kitchen).toBe(2);
  expect(f.state().facilities!.funding!.paidThroughWeek).toBe(1);
  expect(f.state().funds.public).toBe(300_000 + f.state().facilities!.funding!.lastAmount);
  expect(await f.runtime.application.dispatch(settled.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read()).toEqual(final);
}, 120_000);
