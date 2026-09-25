import { describe, expect, it } from "vitest";
import { TIDE_REEF_CATALOG_DATA } from "../../content/gameplay/demo-v20/content";
import { COPPER_ECONOMY_CATALOG_DATA } from "../../content/gameplay/demo-v17/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { initialD5Projection } from "./d5-progress";
import { applyGameStart } from "./game-start";
import { createD5ExpeditionEngine } from "./d5-expedition";
import { ordinaryExpeditionAvailable } from "./ordinary-expeditions";

const catalog = validateD5Catalog(TIDE_REEF_CATALOG_DATA), routeId = "tide-reef.ordinary";
describe("ordinary reef content", () => {
  it("keeps all three ordinary routes in the shared reader and banks by real layers", () => {
    expect(Object.keys(catalog.shared.data.routes)).toHaveLength(3);
    expect(catalog.shared.data.routes[routeId].layers.map(r => r.length)).toEqual([2, 3, 1]);
    expect(catalog.data.routes[catalog.data.tutorial!.routeId].layers).toHaveLength(4);
    expect(catalog.data.routes[catalog.data.manor!.firstClearRouteId].layers).toHaveLength(5);
    expect(catalog.data.loot!.grants.filter(g => g.routeId === routeId)).toHaveLength(5);
    expect(catalog.data.loot!.definitions["loot.salvage.ship-lamp-ring"].freeAppraisalGrantIds).toBeUndefined();
  });
  it.each(["hub", "debug-shop"] as const)("creates and restores a normal run after %s without tutorial state", startAt => {
    const campaign = initialD5Projection(catalog);
    expect(ordinaryExpeditionAvailable(catalog.data, campaign, routeId)).toBe(false);
    applyGameStart(catalog, campaign, startAt, "test-start");
    const engine = createD5ExpeditionEngine(catalog);
    const state = engine.create(campaign, {runId: "reef", routeId, partyIds: catalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19});
    expect(state.tutorial).toBeUndefined();
    expect(state.run.carriedLoot).toEqual([]);
    expect(engine.restore(state)).toEqual(state);
    expect(campaign.funds.party).toBe(4400);
  });
  it("preserves old content and rejects an extra route in its frozen validator", () => {
    const old = validateD5Catalog(COPPER_ECONOMY_CATALOG_DATA);
    expect(old.data.expeditions).toBeUndefined();
    const changed = structuredClone(COPPER_ECONOMY_CATALOG_DATA);
    changed.routes[routeId] = catalog.data.routes[routeId];
    changed.journey!.rooms = {...changed.journey!.rooms, ...catalog.data.journey!.rooms};
    changed.encounters = catalog.data.encounters;
    changed.enemies = catalog.data.enemies;
    expect(() => validateD5Catalog(changed)).toThrow();
  });
  it.each(["duplicate-room", "no-exit", "missing-art-enemy", "unregistered-route", "story-enemy"])("rejects %s", kind => {
    const data = structuredClone(TIDE_REEF_CATALOG_DATA), route = data.routes[routeId];
    if (kind === "duplicate-room") route.layers[0][1] = route.layers[0][0];
    if (kind === "no-exit") route.layers[1].pop();
    if (kind === "missing-art-enemy") delete data.enemies["enemy.tide-reef.reef-crab"];
    if (kind === "unregistered-route") delete data.expeditions![routeId];
    if (kind === "story-enemy") data.encounters["encounter.tide-reef.boardwalk"].enemyIds = [data.manor!.boss.definitionId];
    expect(() => validateD5Catalog(data)).toThrow();
  });
});
