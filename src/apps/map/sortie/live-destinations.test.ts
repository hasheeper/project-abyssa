// @vitest-environment node
import { expect, it } from "vitest";
import { reefFixture } from "../../../game-application/testing/tide-reef-fixture";
import { shopFixture } from "../../../game-application/testing/shop-foundation-fixture";
import { COPPER_ECONOMY_CATALOG } from "../../../game-runtime/copper-economy-context";
import { departureDestination, departureNodes } from "./live-destinations";

it("opens cave only in eligible new content; legacy saves and active runs stay gated", async () => {
  const f = await reefFixture();
  const query = f.runtime.queries.journey;
  expect(departureNodes(query(f.before))).toEqual(["tower", "cave"]);
  expect(departureDestination(query(f.before), "cave")).toMatchObject({routeId: "tide-reef.ordinary", layerCount: 3, exitLayers: [2], skin: "timber"});
  expect(departureNodes(query(f.read()))).toEqual([]);
  const old = shopFixture();
  const created = await old.runtime.application.create({protocolVersion: 4, contentVersion: 17, profileId: COPPER_ECONOMY_CATALOG.data.journey!.defaultProfileId, saveId: old.saveId, epoch: "old", clientRequestId: "create"});
  expect(created.ok).toBe(true);
  expect(departureNodes(query(old.read()))).toEqual([]);
  await old.commit({type: "select-game-start", startAt: "hub"});
  expect(departureNodes(query(old.read()))).toEqual(["tower"]);
});
