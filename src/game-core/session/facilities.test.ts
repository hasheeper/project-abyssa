import { expect, it } from "vitest";
import { FACILITIES_CATALOG_DATA } from "../../content/gameplay/demo-v25/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { initialD5Projection } from "./d5-progress";
import { applyFacilityCommand, initializeFacilities, facilitySupplyLimit, supplyStorageCapacity, supplyStorageRoom, storeFacilitySupply } from "./facilities";
import { quoteConstruction, startConstruction, completeConstruction } from "./facility-construction";
import { departureSupplies } from "./d5-economy";
import { nextCampaignClock, campaignPhaseIndex } from "./d5-clock";
import type { FacilityLevel } from "../contracts/facilities";
const catalog = validateD5Catalog(FACILITIES_CATALOG_DATA);
function fixture() {
  const c = initialD5Projection(catalog); c.tutorial = {status: "exempt", reason: "player-skipped"};
  c.prologue = undefined; c.opening = undefined; c.funds.party = 0;
  initializeFacilities(catalog, c, "fixture"); return c;
}
it("provides food at zero funds and isolates all three storage/carry levels", () => {
  const c = fixture();
  for (let n = 0; n < 4; n++) c.clock = nextCampaignClock(c.clock);
  applyFacilityCommand(catalog, c, {type: "facility-collect", roomId: "kitchen", batchId: c.facilities!.batches.kitchen!.id, quantity: 2}, "harvest");
  expect(c.funds.party).toBe(0); expect(c.supplies[0].charges).toBe(2);
  const ids = Object.keys(catalog.data.journey!.items);
  for (const id of ids) storeFacilitySupply(c, id, 1, "stock");
  for (const level of [1, 2, 3] as const) {
    c.facilities!.levels.storage = level;
    expect(facilitySupplyLimit(catalog, c)).toBe(level + 3);
    expect(supplyStorageCapacity(catalog, c, "item.food")).toBe([12, 16, 24][level - 1]);
    const selected = ids.slice(0, level + 3), amounts = Object.fromEntries(selected.map(id => [id, 1]));
    expect(departureSupplies(catalog, c, "run", selected, amounts)).toHaveLength(level + 3);
    expect(() => departureSupplies(catalog, c, "run", ids.slice(0, level + 4), Object.fromEntries(ids.slice(0, level + 4).map(id => [id, 1])))).toThrow();
  }
  expect(() => applyFacilityCommand(catalog, c, {type: "facility-enable", roomId: "workshop"}, "early")).toThrow();
});
it("locks construction price, timing, self exclusion and workshop occupancy", () => {
  const c = fixture(), state = c.facilities!, data = catalog.data.facilities!;
  for (const level of [0, 1, 2] as const) {
    state.levels.kitchen = level;
    expect(quoteConstruction(data, state, "kitchen", 200_000, 8)).toMatchObject({cost: [50_000, 200_000, 400_000][level], readyAt: 8 + [2, 4, 8][level]});
  }
  state.levels.kitchen = 1;
  for (const level of [1, 2, 3] as const) {state.levels.maid = level; expect(quoteConstruction(data, state, "kitchen", 200_001, 0).cost).toBe(Math.ceil(200_001 * (100 - level * 5) / 100));}
  state.levels.maid = 1;
  const quote = startConstruction(data, state, null, "kitchen", 200_000, 0);
  expect(quoteConstruction(data, state, "maid", 200_000, 0).cost).toBe(200_000);
  expect(() => startConstruction(data, state, quote, "storage", 200_000, 0)).toThrow();
  state.levels.maid = 3; expect(quote.cost).toBe(190_000);
  expect(() => completeConstruction(state, quote, 3)).toThrow();
  const upgraded = completeConstruction(state, quote, 4);
  expect(upgraded.batches).toEqual(state.batches);
  c.facilities = upgraded; c.clock = {day: 2, phase: "dawn"};
  applyFacilityCommand(catalog, c, {type: "facility-collect", roomId: "kitchen", batchId: upgraded.batches.kitchen!.id, quantity: 2}, "new-cycle");
  expect(c.facilities.batches.kitchen!.remaining).toBe(3);
  c.facilities.order = {id: "order", recipeId: "recipe.potion", quantity: 1, readyAt: 2};
  expect(() => quoteConstruction(data, c.facilities!, "workshop", 200_000, 4)).toThrow();
});
it("keeps materials and overflow separate from carry stock, validating space and funds", () => {
  const c = fixture(); c.clock = {day: 3, phase: "dawn"};
  applyFacilityCommand(catalog, c, {type: "facility-enable", roomId: "workshop"}, "enable");
  c.facilities!.materials["material.medicinal-herb"] = 2;
  expect(() => applyFacilityCommand(catalog, c, {type: "facility-craft", recipeId: "recipe.potion", quantity: 1}, "poor")).toThrow();
  expect(c.facilities!.materials["material.medicinal-herb"]).toBe(2);
  c.facilities!.overflow["item.food"] = 3;
  applyFacilityCommand(catalog, c, {type: "facility-store-return", definitionId: "item.food", quantity: 2}, "return");
  expect(c.facilities!.overflow["item.food"]).toBe(1); expect(c.supplies[0].charges).toBe(2);
  expect(() => departureSupplies(catalog, c, "run", ["material.medicinal-herb"], {"material.medicinal-herb": 1})).toThrow();
});

/** A declared demand sample, not simulated combat or public-fund affordability. */
function sample(level: FacilityLevel, trips: number, use: number) {
  const c = fixture(), f = c.facilities!, totals = {level, trips, use, foodMade: 0, foodMissing: 0, crafted: 0, bought: 0, spent: 0, foodFullPhase: null as number | null};
  c.funds.party = 100_000; storeFacilitySupply(c, "item.food", 3, "initial"); storeFacilitySupply(c, "item.potion", 2, "initial");
  f.levels.kitchen = f.levels.storage = level;
  for (let phase = 1; phase <= 56; phase++) {
    c.clock = nextCampaignClock(c.clock);
    for (const id of ["greenhouse", "workshop"] as const) if (!f.levels[id] && c.clock.day >= catalog.data.facilities!.rooms[id].availableDay) {
      applyFacilityCommand(catalog, c, {type: "facility-enable", roomId: id}, `enable:${id}`); f.levels[id] = level;
    }
    for (const id of ["kitchen", "greenhouse"] as const) {
      const b = f.batches[id]; if (!b || b.readyAt > phase) continue;
      const project = catalog.data.facilities!.projects[b.projectId];
      const room = project.kind === "supply" ? supplyStorageRoom(catalog, c, project.definitionId) : catalog.data.facilities!.storage.materials[level - 1] - (f.materials[project.definitionId] ?? 0);
      const quantity = Math.min(room, b.remaining);
      if (quantity) {applyFacilityCommand(catalog, c, {type: "facility-collect", roomId: id, batchId: b.id, quantity}, `collect:${phase}:${id}`); if (id === "kitchen") totals.foodMade += quantity;}
    }
    if (f.order && f.order.readyAt <= phase) {totals.crafted += f.order.quantity; applyFacilityCommand(catalog, c, {type: "facility-claim", orderId: f.order.id}, `claim:${phase}`);}
    if (f.levels.workshop && !f.order) {
      const quantity = Math.min(level, Math.floor((f.materials["material.medicinal-herb"] ?? 0) / 2), supplyStorageRoom(catalog, c, "item.potion"));
      if (quantity) {applyFacilityCommand(catalog, c, {type: "facility-craft", recipeId: "recipe.potion", quantity}, `craft:${phase}`); totals.spent += quantity * 100;}
    }
    const food = c.supplies.find(s => s.definitionId === "item.food")!;
    if (food.charges === supplyStorageCapacity(catalog, c, "item.food")) totals.foodFullPhase ??= phase;
    if (phase % 4 === 0) {
      const demand = trips * use;
      totals.foodMissing += Math.max(0, demand - food.charges); food.charges = Math.max(0, food.charges - demand);
      const potion = c.supplies.find(s => s.definitionId === "item.potion")!, buy = Math.max(0, demand - potion.charges);
      totals.bought += buy; totals.spent += buy * 260; c.funds.party -= buy * 260; potion.charges = Math.max(0, potion.charges - demand);
    }
    expect(food.charges).toBeLessThanOrEqual(supplyStorageCapacity(catalog, c, "item.food"));
  }
  expect(campaignPhaseIndex(c.clock)).toBe(56);
  return {...totals, food: c.supplies.find(s => s.definitionId === "item.food")!.charges, herbs: f.materials["material.medicinal-herb"] ?? 0};
}
it("samples 14 days of waiting, normal and high consumption at 0/1/2 trips per day", () => {
  const rows = ([1, 3] as const).flatMap(level => [0, 1, 2].flatMap(trips => (trips ? [1, 2] : [0]).map(use => sample(level, trips, use))));
  console.info("FACILITY_14_DAY_SAMPLE", JSON.stringify(rows));
  expect(rows.find(r => r.level === 1 && r.trips === 2 && r.use === 2)!.foodMissing).toBeGreaterThan(0);
  expect(rows.find(r => r.level === 3 && r.trips === 2 && r.use === 2)!.foodMissing).toBe(0);
  expect(rows.filter(r => r.trips === 0).every(r => r.foodFullPhase !== null && r.bought === 0)).toBe(true);
});

it.each([1, 2, 3] as const)("applies level %s craft batch and ingredient limits", level => {
  const c = fixture(); c.clock = {day: 3, phase: "dawn"}; c.funds.party = 1000;
  c.facilities!.levels.workshop = level; c.facilities!.materials["material.medicinal-herb"] = 6;
  expect(() => applyFacilityCommand(catalog, c, {type: "facility-craft", recipeId: "recipe.potion", quantity: level + 1}, "excess")).toThrow();
  applyFacilityCommand(catalog, c, {type: "facility-craft", recipeId: "recipe.potion", quantity: level}, "valid");
  expect(c.funds.party).toBe(1000 - 100 * level);
  expect(c.facilities!.materials["material.medicinal-herb"]).toBe(6 - 2 * level);
  c.clock = nextCampaignClock(c.clock);
  applyFacilityCommand(catalog, c, {type: "facility-claim", orderId: c.facilities!.order!.id}, "claim");
  expect(c.supplies[0].charges).toBe(level);
});
it("rejects missing initial production and empty or unknown recipes at the content boundary", () => {
  const missing = structuredClone(FACILITIES_CATALOG_DATA); delete missing.facilities!.projects["production.food"];
  expect(() => validateD5Catalog(missing)).toThrow();
  const empty = structuredClone(FACILITIES_CATALOG_DATA); empty.facilities!.recipes = {};
  expect(() => validateD5Catalog(empty)).toThrow();
  const unknown = structuredClone(FACILITIES_CATALOG_DATA); unknown.facilities!.recipes["recipe.potion"].materials = {unknown: 2};
  expect(() => validateD5Catalog(unknown)).toThrow();
});
