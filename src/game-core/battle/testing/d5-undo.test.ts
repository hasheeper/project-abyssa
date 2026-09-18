import { expect, it } from "vitest";
import { GUIDED_TIDE_CATALOG_DATA } from "../../../content/gameplay/demo-v11/content";
import { validateD5Catalog } from "../../contracts/d5-validation";
import { createD5BattleEngine } from "../d5-engine";
import type { D5BattleState } from "../../session/d5-types";

const catalog = validateD5Catalog(GUIDED_TIDE_CATALOG_DATA);
const engine = createD5BattleEngine(catalog);
function rolled() {
  const spec = catalog.data.tutorial!;
  return engine.dispatch(engine.create({runId: "handbook-undo", routeId: spec.routeId, partyIds: spec.partyIds,
    progress: {appliedGrowthIds: [], equipment: []}, seed: spec.firstBattleSeed}), {type: "roll"}).state;
}
const fix = (state: D5BattleState, actorId = "kael") => engine.dispatch(state, {type: "toggle-load", actorId}).state;
const hit = (state: D5BattleState, actorId: string, targetId: string) => engine.dispatch(fix(state, actorId), {type: "act", actorId, choice: "attack", targetId}).state;

it("restores health, intent, dice and bounty when undoing a kill that leaves another enemy alive", () => {
  const initial = rolled(), targetId = initial.encounter.formation[0];
  const firstHit = hit(initial, "kael", targetId), before = fix(firstHit, "eustice");
  const after = engine.dispatch(before, {type: "act", actorId: "eustice", choice: "attack", targetId}).state;
  expect(after.encounter.enemies.find(e => e.id === targetId)).toMatchObject({hp: 0, intent: null});
  expect(engine.select(after).canUndo).toBe(true);
  const undone = engine.dispatch(after, {type: "undo"}).state;
  expect(undone.encounter).toEqual(before.encounter);
  expect(undone.run).toEqual({...before.run, sequence: undone.run.sequence});
});

it("clears history on reroll but permits undoing new operations back to the new roll", () => {
  const initial = rolled();
  expect(initial.undo).toEqual([]);
  const afterHit = hit(initial, "kael", initial.encounter.formation[0]);
  expect(afterHit.undo.length).toBeGreaterThan(0);
  const rerolled = engine.dispatch(afterHit, {type: "reroll"}).state;
  expect(rerolled.undo).toEqual([]);
  expect(() => engine.dispatch(rerolled, {type: "undo"})).toThrow();
  const undone = engine.dispatch(fix(rerolled, "eustice"), {type: "undo"}).state;
  expect(undone.encounter).toEqual(rerolled.encounter);
  expect(undone.run.rng).toEqual(rerolled.run.rng);
  expect(undone.undo).toEqual([]);
});

it("ends the undo window immediately on END TURN", () => {
  const before = fix(rolled());
  expect(engine.select(before).canUndo).toBe(true);
  const ended = engine.dispatch(before, {type: "end-turn"});
  expect(ended.state.undo).toEqual([]);
  expect(ended.events.some(event => event.type === "hand-settled")).toBe(true);
  expect(engine.select(ended.state).canUndo).toBe(false);
  expect(() => engine.dispatch(ended.state, {type: "undo"})).toThrow();
});

it("rejects reroll with every die fixed, without discarding the existing undo history", () => {
  let state = rolled();
  for (const die of state.encounter.dice) state = fix(state, die.ownerId);
  const before = structuredClone(state);
  expect(() => engine.dispatch(state, {type: "reroll"})).toThrow();
  expect(state).toEqual(before);
  expect(engine.select(state).canUndo).toBe(true);
});

it("cannot undo the final kill even before automatic round cleanup", () => {
  let state = rolled();
  const [first, last] = state.encounter.formation;
  state = hit(state, "kael", first);
  state = hit(state, "eustice", first);
  state = engine.dispatch(state, {type: "end-turn"}).state;
  while (state.encounter.phase === "enemy") {
    state = engine.dispatch(state, {type: state.encounter.cursor < state.encounter.enemyOrder.length ? "resolve-next-enemy" : "next-round"}).state;
  }
  state = engine.dispatch(state, {type: "roll"}).state;
  state = hit(state, "eustice", last);
  expect(state.encounter.formation).toEqual([]);
  expect(state.encounter.phase).toBe("act");
  expect(engine.select(state).canUndo).toBe(false);
  expect(() => engine.dispatch(state, {type: "undo"})).toThrow();
  expect(engine.dispatch(state, {type: "end-turn"}).state.encounter.outcome).toBe("victory");
});
