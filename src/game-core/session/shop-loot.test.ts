import { describe, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { SHOP_FOUNDATION_CATALOG_DATA } from "../../content/gameplay/demo-v13/content";
import { CHAPTER_ONE_CATALOG_DATA } from "../../content/gameplay/demo-v12/content";
import { G2Recorder } from "./testing/tide-guided-g2";
import { initialD5Projection } from "./d5-progress";
import { createD5ExpeditionEngine } from "./d5-expedition";

const catalog = validateD5Catalog(SHOP_FOUNDATION_CATALOG_DATA);

describe("fixed tutorial loot", () => {
  it("earns real first-battle gold and one proven boss item, with stable recovery", () => {
    const r = new G2Recorder(catalog);
    expect(r.state.run.carriedLoot).toEqual([]);
    r.until(s => s.node === "room-complete");
    expect(r.state.run.looseGold).toBe(2);
    expect(r.state.run.carriedLoot).toEqual([]);
    r.until(s => s.tutorial!.stage === "claimable");
    const loot = r.state.run.carriedLoot!;
    expect(loot).toHaveLength(1);
    expect(loot[0]).toMatchObject({definitionId: "loot.tutorial.curio", runId: "g2-run", roomId: "g2-run:room:1:5"});
    expect(r.state.result?.returnedLoot).toEqual(loot);
    expect(r.state.result?.totalGold).toBe(43);
    expect(r.trace.flatMap(t => t.events).filter(e => e.type === "loot-found")).toHaveLength(1);
    expect(r.engine.restore(JSON.parse(JSON.stringify(r.state)))).toEqual(r.state);
    expect(r.state.tutorial!.entry.run.carriedLoot).toEqual([]);
    expect(r.state.tutorial!.checkpoint.state.run.carriedLoot).toEqual([]);
    for (const mutate of [
      (s: typeof r.state) => { s.run.carriedLoot = []; },
      (s: typeof r.state) => { s.result!.returnedLoot![0].instanceId = "forged"; },
      (s: typeof r.state) => { s.tutorial!.checkpoint.state.run.carriedLoot = loot; },
    ]) {
      const forged = structuredClone(r.state); mutate(forged);
      expect(() => r.engine.restore(forged)).toThrow();
    }
  }, 30_000);

  it("does not inject new fields into old content or give loot to ordinary departures", () => {
    const old = validateD5Catalog(CHAPTER_ONE_CATALOG_DATA);
    expect(old.data.enemies["enemy.intro.tide-slime"].bounty).toBe(0);
    const oldRun = new G2Recorder(old);
    expect(oldRun.state.run).not.toHaveProperty("carriedLoot");
    const bad = structuredClone(oldRun.state); bad.run.carriedLoot = [];
    expect(() => oldRun.engine.restore(bad)).toThrow();
    const campaign = initialD5Projection(catalog);
    campaign.prologue!.status = "skipped"; campaign.opening!.status = "skipped";
    campaign.tutorial = {status: "exempt", reason: "player-skipped"};
    const run = createD5ExpeditionEngine(catalog).create(campaign, {runId: "ordinary", routeId: "old-manor.first-clear", partyIds: catalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19});
    expect(run.run.carriedLoot).toEqual([]);
    expect(campaign.loot).toEqual([]);
  });

  it("retries a real Boss defeat and restarts the chapter without duplicating gold or loot", () => {
    const r = new G2Recorder(catalog).until(s => s.run.room === 4 && s.encounter?.phase === "roll");
    const lose = () => {
      for (let i = 0; i < 400 && r.state.tutorial!.stage !== "failed"; i++) {
        const e = r.state.encounter!;
        r.step(e.phase === "roll" ? {type: "battle", command: {type: "roll"}} : e.phase === "act" && e.formation.length ? {type: "battle", command: {type: "end-turn"}} : {type: "resume"});
      }
      expect(r.state.tutorial!.stage).toBe("failed");
      expect(r.state.run.carriedLoot).toEqual([]);
      expect(r.state.result?.returnedLoot ?? []).toEqual([]);
    };
    lose();
    r.step({type: "tutorial-retry", scope: "encounter", attempt: 1});
    expect(r.state.run.carriedLoot).toEqual([]);
    lose();
    r.step({type: "tutorial-retry", scope: "chapter", attempt: 2});
    expect(r.state.run.carriedLoot).toEqual([]);
    expect(r.state.run.looseGold).toBe(0);
    r.until(s => s.tutorial!.stage === "claimable");
    expect(r.state.result!.totalGold).toBe(43);
    expect(r.state.result!.returnedLoot).toHaveLength(1);
    expect(r.trace.flatMap(t => t.events).filter(e => e.type === "loot-found")).toHaveLength(1);
  }, 30_000);
});
