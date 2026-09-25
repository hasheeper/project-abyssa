import { describe, expect, it } from "vitest";
import { ORDINARY_DROPS_CATALOG_DATA } from "../../content/gameplay/demo-v21/content";
import { TIDE_REEF_CATALOG_DATA } from "../../content/gameplay/demo-v20/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { earnedLoot } from "../contracts/loot";
import { createBattleRngState } from "../battle/persistence/rng";
import { createD5ExpeditionEngine } from "./d5-expedition";
import { initialD5Projection } from "./d5-progress";
import { applyGameStart } from "./game-start";
import { hasOrdinaryLoot } from "./expedition-loot";
import { lootQuote } from "./d5-loot";

const catalog = validateD5Catalog(ORDINARY_DROPS_CATALOG_DATA), loot = catalog.data.loot!;
const reef = "tide-reef.ordinary", first = "old-manor.first-clear", maintenance = "old-manor.maintenance";
const roomIds = (route: string) => catalog.data.routes[route].layers.flatMap((row, l) => row.map((_, r) => `run:room:${l + 1}:${r + 1}`));
const drops = (route: string, seed: number, rooms = roomIds(route)) => earnedLoot(loot, catalog.data.routes, "run", route, rooms, createBattleRngState(seed).loot.seed);

describe("ordinary drop tables", () => {
  it("preserves old fixed content, tutorial grants and the three source budgets", () => {
    const old = validateD5Catalog(TIDE_REEF_CATALOG_DATA);
    expect(old.data.loot!.dropTables).toBeUndefined();
    expect(old.data.loot!.grants.filter(g => g.routeId === reef)).toHaveLength(5);
    expect(loot.grants).toEqual(old.data.loot!.grants.filter(g => g.routeId === old.data.tutorial!.routeId));
    expect(Object.values(loot.definitions).filter(d => !d.id.startsWith("loot.tutorial."))).toHaveLength(16);
    expect([reef, first, maintenance].map(route => loot.dropTables!.rooms.filter(r => r.routeId === route).reduce((n, r) => n + r.tableIds.length, 0))).toEqual([11, 12, 14]);
    for (const route of [reef, first, maintenance]) expect(hasOrdinaryLoot(catalog, route)).toBe(true);
    expect(hasOrdinaryLoot(catalog, catalog.data.tutorial!.routeId)).toBe(false);
  });
  it.each(["weights", "negative", "missing-item", "foreign-room", "duplicate-room", "tutorial", "fixed-and-random", "too-few-curios", "batch-item"])("rejects malformed %s content", kind => {
    const data = structuredClone(ORDINARY_DROPS_CATALOG_DATA), tables = data.loot!.dropTables!, mire = tables.tables["table.loot.mire"];
    if (kind === "weights") mire.entries[0].weight++;
    if (kind === "negative") mire.entries[0].weight = -1;
    if (kind === "missing-item") mire.entries[0].definitionId = "loot.missing";
    if (kind === "foreign-room") tables.rooms[0].roomId = "room.old-manor.first.foyer";
    if (kind === "duplicate-room") tables.rooms.push(structuredClone(tables.rooms[0]));
    if (kind === "tutorial") {tables.rooms[0].routeId = data.tutorial!.routeId; tables.rooms[0].roomId = "room.tide-cave.4";}
    if (kind === "fixed-and-random") data.loot!.grants.push({id: "bad", routeId: reef, roomId: tables.rooms[0].roomId, definitionId: "loot.salvage.shell"});
    if (kind === "too-few-curios") tables.tables["table.loot.reef-curios"].entries = [{definitionId: "loot.salvage.ship-lamp-ring", weight: 100}];
    if (kind === "batch-item") data.loot!.definitions["loot.salvage.shell"].quantity = 2;
    expect(() => validateD5Catalog(data)).toThrow();
  });
  it("uses addressed loot draws, preserves prefixes, and rejects forged run RNG", () => {
    const ids = roomIds(reef), full = drops(reef, 19), prefix = drops(reef, 19, ids.slice(0, 2));
    expect(drops(reef, 19)).toEqual(full);
    expect(full.filter(d => ids.slice(0, 2).includes(d.roomId))).toEqual(prefix);
    expect(new Set(full.map(d => d.instanceId)).size).toBe(full.length);
    const campaign = initialD5Projection(catalog); applyGameStart(catalog, campaign, "hub", "start");
    const engine = createD5ExpeditionEngine(catalog);
    const state = engine.create(campaign, {runId: "run", routeId: reef, seed: 19, partyIds: catalog.data.initialParty, itemIds: ["item.food", "item.potion"]});
    expect(state.run.rng.loot).toEqual(createBattleRngState(19).loot);
    const forged = structuredClone(state); forged.run.rng.loot.seed++;
    expect(() => engine.restore(forged)).toThrow(/loot.rng/);
    const changed = structuredClone(ORDINARY_DROPS_CATALOG_DATA);
    changed.loot!.dropTables!.tables["table.loot.mire"].entries = [{definitionId: "loot.salvage.shell", weight: 100}];
    const alternate = validateD5Catalog(changed), other = createD5ExpeditionEngine(alternate);
    const otherCampaign = initialD5Projection(alternate); applyGameStart(alternate, otherCampaign, "hub", "start");
    const start = other.create(otherCampaign, {runId: "run", routeId: reef, seed: 19, partyIds: alternate.data.initialParty, itemIds: ["item.food", "item.potion"]});
    const roll = {type: "battle" as const, command: {type: "roll" as const}};
    expect(other.dispatch(start, roll).state.run.rng.combat).toEqual(engine.dispatch(state, roll).state.run.rng.combat);
    expect(other.dispatch(start, roll).state.encounter?.dice).toEqual(engine.dispatch(state, roll).state.encounter?.dice);
  });
  it.each([[reef, 1304, 13], [first, 2734, 14], [maintenance, 2690, 16]] as const)("bounds rewards and samples the planned economy for %s", (route, target, max) => {
    let value = 0, curios = 0, count = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const found = drops(route, seed), unknown = found.filter(d => !loot.definitions[d.definitionId].initiallyKnown);
      expect(unknown.length).toBeGreaterThanOrEqual(1); expect(unknown.length).toBeLessThanOrEqual(2);
      expect(new Set(unknown.map(d => d.definitionId)).size).toBe(unknown.length);
      expect(found.length).toBeLessThanOrEqual(max);
      expect(found.every(d => !d.definitionId.startsWith("loot.tutorial."))).toBe(true);
      value += found.reduce((n, d) => n + loot.definitions[d.definitionId].salePrice - loot.definitions[d.definitionId].appraisalFee, 0);
      curios += unknown.length; count += found.length;
    }
    expect(Math.abs(value / 1000 - target)).toBeLessThan(100);
    expect(curios / 1000).toBeGreaterThan(1.15); expect(curios / 1000).toBeLessThan(1.25);
    expect(count / 1000).toBeGreaterThan(6);
  });
  it("quotes only owned, compatible units and retains tutorial lot semantics", () => {
    const campaign = initialD5Projection(catalog); applyGameStart(catalog, campaign, "hub", "start");
    const units = Array.from({length: 3}, (_, i) => ({instanceId: `item-${i}`, definitionId: "loot.salvage.shell", grantId: `test-${i}`, runId: "run", roomId: "room", claimId: "claim", resultId: "known.salvage.shell"}));
    campaign.loot!.push(...units);
    const request = {type: "loot-sold" as const, shopId: "shop.mansion", instanceId: "item-0", quoteVersion: 2, quantity: 2};
    expect(lootQuote(catalog, campaign, request)).toMatchObject({gold: 160, soldItems: units.slice(0, 2)});
    expect(() => lootQuote(catalog, campaign, {...request, quantity: 4})).toThrow();
    const coins = campaign.loot!.find(i => i.definitionId === "loot.tutorial.cross-coins")!;
    expect(() => lootQuote(catalog, campaign, {...request, instanceId: coins.instanceId})).toThrow(/individually/);
    const nail = campaign.loot!.find(i => i.definitionId === "loot.tutorial.barrier-nail")!;
    expect(() => lootQuote(catalog, campaign, {...request, instanceId: nail.instanceId})).toThrow();
    expect(() => lootQuote(catalog, campaign, {...request, type: "loot-appraised", instanceId: nail.instanceId})).toThrow();
  });
});
