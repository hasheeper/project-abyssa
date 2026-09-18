import { expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { TIDE_CAVE_CATALOG_DATA } from "../../content/gameplay/demo-v7/content";
import { createD5ExpeditionEngine } from "./d5-expedition";
import { initialD5Projection } from "./d5-progress";
import { tutorialNextOperation } from "./testing/tutorial-driver";
import type { D5ExpeditionState } from "./d5-types";
import type { D5JourneyOperation } from "./d5-expedition";
import { demoItemTargets } from "./demo-items-events";

export const catalog = validateD5Catalog(TIDE_CAVE_CATALOG_DATA);
const engine = createD5ExpeditionEngine(catalog);
function fixture(seed = 19) {
  const campaign = initialD5Projection(catalog);
  campaign.prologue!.status = "skipped"; campaign.opening!.status = "viewed";
  const spec = catalog.data.tutorial!;
  return engine.create(campaign, {runId: "tutorial-run", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed});
}

it("runs the teaching seed through real intent generation, and retracts lesson evidence with UNDO", () => {
  let state = fixture();
  expect(() => engine.dispatch(state, {type: "battle", command: {type: "roll"}})).toThrow();
  state = engine.dispatch(state, {type: "tutorial-read", storyId: "S3-1", step: 0, choice: "continue"}).state;
  expect(state.run.rng.combat.cursor).toBe(2);
  state = engine.dispatch(state, {type: "battle", command: {type: "roll"}}).state;
  expect(state.encounter!.dice.map(d => d.faceIndex! + 1)).toEqual([2, 2, 1, 1, 3]);
  expect(state.run.rng.combat.cursor).toBe(7);
  state = engine.dispatch(state, {type: "battle", command: {type: "toggle-load", actorId: "kael"}}).state;
  expect(state.tutorial!.lessons.map(e => e.kind)).toContain("fix");
  state = engine.dispatch(state, {type: "battle", command: {type: "undo"}}).state;
  expect(state.tutorial!.lessons.map(e => e.kind)).toEqual(["roll"]);
  const before = structuredClone(state.run);
  state = engine.dispatch(state, {type: "tutorial-hints", enabled: false}).state;
  expect(state.run.rng).toEqual(before.rng);
  expect(state.run.party).toEqual(before.party);
  expect(state.tutorial!.lessons.map(e => e.kind)).toEqual(["roll"]);
});

it("requires a real wipe, restores the whole encounter checkpoint and rejects stale retries", () => {
  let state = fixture();
  const entry = structuredClone(state.tutorial!.entry);
  expect(() => engine.dispatch(state, {type: "tutorial-retry", scope: "encounter", attempt: 1})).toThrow();
  for (let i = 0; i < 180 && state.tutorial!.stage !== "failed"; i++) {
    const next = state.tutorial!.story ? tutorialNextOperation(catalog, state, "basic")!
      : state.encounter!.phase === "roll" ? {type: "battle" as const, command: {type: "roll" as const}}
      : state.encounter!.phase === "act" ? {type: "battle" as const, command: {type: "end-turn" as const}} : {type: "resume" as const};
    state = engine.dispatch(state, next).state;
  }
  expect(state.tutorial!.stage).toBe("failed");
  expect(state.node).toBe("battle"); expect(state.result).toBeNull();
  const sequence = state.run.sequence;
  state = engine.dispatch(state, {type: "tutorial-retry", scope: "encounter", attempt: 1}).state;
  expect(state.tutorial!.attempt).toBe(2);
  expect(state.run.sequence).toBeGreaterThan(sequence);
  expect({...state.run, sequence: entry.run.sequence}).toEqual(entry.run);
  expect(state.encounter).toEqual(entry.encounter);
  expect(state.tutorial!.lessons).toEqual([]);
  expect(() => engine.dispatch(state, {type: "tutorial-retry", scope: "encounter", attempt: 1})).toThrow();
});

it("completes all four real encounters, switches to the ordinary RNG, then requires the return beats", () => {
  let state = fixture();
  const seen = new Set<number>();
  for (let i = 0; i < 600; i++) {
    seen.add(state.run.room);
    const operation = tutorialNextOperation(catalog, state, "tactical");
    if (!operation) break;
    state = engine.dispatch(state, operation).state;
    if (state.run.room > 0) expect(state.run.rng.combat.seed).toBe(19);
  }
  expect([...seen]).toEqual([0, 1, 2, 3]);
  expect(state.node).toBe("finished");
  expect(state.result?.completion?.encounterIds).toHaveLength(4);
  expect(state.result?.completion?.roomIds).toHaveLength(4);
  expect(state.result?.deepestLayer).toBe(1);
  expect(state.tutorial!.stage).toBe("claimable");
  expect(state.tutorial!.readStoryIds).toEqual(["S3-1", "S3-2", "S3-3", "S3-4", "S3-5", "S4-1", "S4-2"]);
  expect(state.tutorial!.choices).toEqual([{storyId: "S3-4", step: 0, choice: "A"}]);
  expect(engine.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
});

function loseEncounter(input: D5ExpeditionState) {
  let state = input;
  for (let i = 0; i < 180 && state.tutorial!.stage !== "failed"; i++) {
    const operation: D5JourneyOperation = state.encounter!.phase === "roll"
      ? {type: "battle", command: {type: "roll"}}
      : state.encounter!.phase === "act" ? {type: "battle", command: {type: "end-turn"}} : {type: "resume"};
    state = engine.dispatch(state, operation).state;
  }
  expect(state.tutorial!.stage).toBe("failed");
  return state;
}

it("retries the boss from its spent-supply checkpoint, and can restart the chapter without losing story choices", () => {
  let state = fixture();
  state = engine.dispatch(state, {type: "tutorial-read", storyId: "S3-1", step: 0, choice: "continue"}).state;
  state = engine.dispatch(state, {type: "battle", command: {type: "roll"}}).state;
  state = engine.dispatch(state, {type: "battle", command: {type: "end-turn"}}).state;
  while (state.encounter!.phase !== "roll") state = engine.dispatch(state, {type: "resume"}).state;
  const food = state.run.supplies.find(s => s.definitionId === "item.food")!;
  const target = demoItemTargets(catalog, state, food.instanceId)[0];
  expect(target).toBeDefined();
  state = engine.dispatch(state, {type: "item", instanceId: food.instanceId, target}).state;
  for (let i = 0; i < 500 && state.run.room < 3; i++) {
    const operation = tutorialNextOperation(catalog, state, "tactical");
    if (!operation) throw Error("Could not reach the boss");
    state = engine.dispatch(state, operation).state;
  }
  expect(state.run.room).toBe(3);
  const checkpoint = structuredClone(state.tutorial!.checkpoint);
  const entry = structuredClone(state.tutorial!.entry);
  expect(checkpoint.state.run.supplies).not.toEqual(entry.run.supplies);
  expect(checkpoint.state.run.rng.combat.seed).toBe(19);
  expect(state.tutorial!.choices).toHaveLength(1);
  state = engine.dispatch(state, {type: "tutorial-hints", enabled: false}).state;
  state = loseEncounter(state);
  const failedSequence = state.run.sequence;
  state = engine.dispatch(engine.restore(JSON.parse(JSON.stringify(state))), {type: "tutorial-retry", scope: "encounter", attempt: 1}).state;
  expect({...state.run, sequence: checkpoint.state.run.sequence}).toEqual(checkpoint.state.run);
  expect(state.encounter).toEqual(checkpoint.state.encounter);
  expect(state.tutorial!.lessons).toEqual(checkpoint.lessons);
  expect(state.run.sequence).toBeGreaterThan(failedSequence);

  state = loseEncounter(state);
  const choices = structuredClone(state.tutorial!.choices), read = [...state.tutorial!.readStoryIds];
  const sequence = state.run.sequence;
  state = engine.dispatch(state, {type: "tutorial-retry", scope: "chapter", attempt: 2}).state;
  expect(state.tutorial).toMatchObject({attempt: 3, stage: "story", story: {id: "S3-1", step: 0}, hintsEnabled: false, choices, readStoryIds: read, lessons: [], undoLessons: []});
  expect({...state.run, sequence: entry.run.sequence}).toEqual(entry.run);
  expect(state.encounter).toEqual(entry.encounter);
  expect(state.run.sequence).toBeGreaterThan(sequence);
  // Replaying the chapter neither rerolls T1 nor replaces its already committed attitude.
  for (let i = 0; i < 500 && state.tutorial!.story?.id !== "S3-4"; i++) {
    const operation = tutorialNextOperation(catalog, state, "tactical");
    if (!operation) throw Error("Could not revisit the cargo decision");
    state = engine.dispatch(state, operation).state;
  }
  expect(state.tutorial!.story?.id).toBe("S3-4");
  expect(() => engine.dispatch(state, {type: "tutorial-read", storyId: "S3-4", step: 0, choice: "B"})).toThrow();
  state = engine.dispatch(state, {type: "tutorial-read", storyId: "S3-4", step: 0, choice: "continue"}).state;
  expect(state.tutorial!.choices).toEqual(choices);
}, 15_000);
