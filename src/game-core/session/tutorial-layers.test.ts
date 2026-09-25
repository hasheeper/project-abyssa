import { beforeAll, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { FOUR_LAYER_TUTORIAL_CATALOG_DATA } from "../../content/gameplay/demo-v14/content";
import { G2Recorder } from "./testing/tide-guided-g2";
import { roomInstance } from "./demo-expedition";
import { tutorialGuideOperation } from "./tutorial-guide";

const catalog = validateD5Catalog(FOUR_LAYER_TUTORIAL_CATALOG_DATA);
let complete: G2Recorder;
beforeAll(() => {complete = new G2Recorder(catalog).until(s => s.tutorial!.stage === "claimable");}, 30_000);

it("advances through four real layers, banks each once and replays every boundary", () => {
  const openings = complete.states.filter(s => s.node === "battle" && s.encounter.phase === "roll" && s.encounter.round === 1);
  expect([...new Set(openings.map(s => s.run.layer))]).toEqual([1, 2, 3, 4]);
  for (const state of openings) {
    expect(state.run.room).toBe(0);
    expect(state.run.settledLayers).toHaveLength(state.run.layer - 1);
    expect(state.run.looseGold).toBe(0);
    expect(state.run.handBonus).toBe(0);
    expect(state.run.rng.combat.seed).toBe(state.run.layer === 1 ? 8267 : 11395852);
  }
  const event = complete.states.find(s => s.node === "event")!;
  expect([event.run.layer, event.run.room]).toEqual([2, 1]);
  expect(event.run.settledLayers).toEqual([1]);
  expect(complete.state.result).toMatchObject({deepestLayer: 4, totalGold: 41});
  expect(complete.state.result!.layerResults.map(r => [r.layer, r.looseGold, r.depthPercent, r.gold])).toEqual([
    [1, 2, 100, 4], [2, 2, 125, 5], [3, 4, 150, 20], [4, 5, 175, 12],
  ]);
  expect(complete.state.result!.returnedLoot).toMatchObject([{roomId: "g2-run:room:4:1", definitionId: "loot.tutorial.curio"}]);
  expect(complete.trace.flatMap(t => t.events).filter(e => e.type === "layer-banked")).toHaveLength(4);
  for (let i = 0; i < complete.states.length; i++) {
    const state = complete.engine.restore(JSON.parse(JSON.stringify(complete.states[i])));
    const replay = complete.engine.dispatch(state, complete.trace[i].operation);
    expect(replay.events).toEqual(complete.trace[i].events);
    expect(replay.state).toEqual(complete.states[i + 1] ?? complete.state);
  }
  const awaitingBank = complete.states.find(s => s.run.layer === 1 && s.node === "room-complete" && s.tutorial!.stage === "active")!;
  expect(tutorialGuideOperation(catalog, awaitingBank)).toBeNull();
  expect(() => complete.engine.dispatch(awaitingBank, {type: "advance", roomId: roomInstance(awaitingBank.run)})).toThrow();
}, 30_000);

it("restores the fourth-layer checkpoint and clears all layer earnings on chapter retry", () => {
  const r = new G2Recorder(catalog);
  r.state = structuredClone(complete.states.find(s => s.run.layer === 4 && s.encounter?.phase === "roll")!);
  const checkpoint = structuredClone(r.state.tutorial!.checkpoint.state.run);
  const lose = () => {
    for (let i = 0; i < 400 && r.state.tutorial!.stage !== "failed"; i++) {
      const e = r.state.encounter!;
      r.step(e.phase === "roll" ? {type: "battle", command: {type: "roll"}} : e.phase === "act" && e.formation.length ? {type: "battle", command: {type: "end-turn"}} : {type: "resume"});
    }
    expect(r.state.tutorial!.stage).toBe("failed");
    expect(r.trace.at(-1)!.events[0].payload).toMatchObject({roomId: "g2-run:room:4:1"});
  };
  lose();
  r.step({type: "tutorial-retry", scope: "encounter", attempt: 1});
  expect({...r.state.run, sequence: 0}).toEqual({...checkpoint, sequence: 0});
  expect(r.state.run.bankedGold).toBe(29);
  lose();
  r.step({type: "tutorial-retry", scope: "chapter", attempt: 2});
  expect(r.state.run).toMatchObject({layer: 1, room: 0, bankedGold: 0, looseGold: 0, layerResults: [], settledLayers: [], carriedLoot: []});
  r.until(s => s.tutorial!.stage === "claimable");
  expect(r.state.result).toEqual(complete.state.result);
}, 30_000);

it("rejects a checkpoint or guide proof from the wrong floor even when the room index matches", () => {
  const state = complete.states.find(s => s.run.layer === 4 && s.encounter?.phase === "roll")!;
  const wrongCheckpoint = structuredClone(state);
  wrongCheckpoint.tutorial!.checkpoint.state = structuredClone(wrongCheckpoint.tutorial!.entry);
  expect(() => complete.engine.restore(wrongCheckpoint)).toThrow(/checkpoint/);
  const wrongProof = structuredClone(state);
  const proof = wrongProof.tutorial!.guide!.proofs.find(p => p.stepId === "T2.R1.roll")!;
  proof.roomId = "g2-run:room:1:1";
  expect(() => complete.engine.restore(wrongProof)).toThrow(/proof/);
});
