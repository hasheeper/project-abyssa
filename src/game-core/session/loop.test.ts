import { describe, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts";
import { LOOP_CATALOG_DATA } from "../../content/gameplay/demo-v3/content";
import { createD5MemoryEngine } from "../battle";
import { initialD5Projection } from "./d5-progress";
import { departureSupplies, supplyQuote } from "./d5-economy";

const catalog = validateD5Catalog(LOOP_CATALOG_DATA);
describe("manor loop content", () => {
  it("uses the clock beast, with a real charge and attack cycle in memory", () => {
    const engine = createD5MemoryEngine(catalog);
    let state = engine.create({runId:"clock-test",seed:5});
    expect(state.encounter.enemies.map(e=>e.definitionId)).toEqual(["enemy.memory.clockwork-beast"]);
    expect(state.encounter.enemies[0].intent?.kind).toBe("charge");
    state = engine.dispatch(state,{type:"roll"}).state;
    state = engine.dispatch(state,{type:"end-turn"}).state;
    while(state.encounter.cursor < state.encounter.enemyOrder.length) state=engine.dispatch(state,{type:"resolve-next-enemy"}).state;
    state=engine.dispatch(state,{type:"next-round"}).state;
    expect(state.encounter.enemies[0].intent).toMatchObject({kind:"attack",value:3});
    expect(engine.select(state).enemies[0].protection).toBe(0);
  });
  it("keeps basic departure free while bought charges are reserved without refilling", () => {
    const campaign=initialD5Projection(catalog);
    expect(departureSupplies(catalog,campaign,"empty",["item.food","item.potion"]).map(s=>s.charges)).toEqual([4,2]);
    expect(()=>departureSupplies(catalog,campaign,"empty",["item.ward"])).toThrow();
    campaign.funds.party=20;
    expect(supplyQuote(catalog,campaign,{shopId:"shop.mansion",definitionId:"item.ward",quantity:2,quoteVersion:1}).total).toBe(8);
    campaign.supplies=[{instanceId:"bought-ward",definitionId:"item.ward",source:"supply.demo.shop",charges:1}];
    expect(departureSupplies(catalog,campaign,"next",["item.ward"])[0]).toEqual(campaign.supplies[0]);
    expect(()=>supplyQuote(catalog,campaign,{shopId:"shop.mansion",definitionId:"item.ward",quantity:2,quoteVersion:1})).toThrow();
  });
});
