import { expect, it } from "vitest";
import type { SettlementActorState } from "../../game-core/contracts";
import type { D5Fact } from "../versions/d5-contracts";
import { currentSettlementActors } from "./actor-context";

// Projection-only fixture, not a valid saved game or gameplay evidence.
const located = (revision: number, locationActorIds: string[]) => ({ kind: "airp-game", source: { revision }, payload: { settlement: { locationActorIds } } }) as D5Fact;
const returned = (revision: number, ids: string[]) => ({ kind: "progression", source: { revision }, payload: { type: "expedition-settled", finalRun: { run: { party: ids.map(id => ({ id })) } } } }) as D5Fact;
const actors: SettlementActorState[] = ["elora", "norma"].map(actorId => ({ actorId, locationId: "plaza", activity: { id: "resting", untilPhase: 4, endConditionId: null }, conditions: [{ id: "tired", untilPhase: 5, endConditionId: null }] }));

it("return supersedes only participants' earlier positions, not a later unrelated settlement or absent actors", () => {
  const projected = currentSettlementActors(actors, 4, [located(1, ["elora", "norma"]), returned(2, ["elora"]), located(3, [])]);
  expect(projected.map(a => a.locationId)).toEqual([null, "plaza"]);
  expect(projected.every(a => a.activity === null && a.conditions.length === 1)).toBe(true);
  expect(actors[0].locationId).toBe("plaza"); expect(actors[0].activity).not.toBeNull();
});
it("an explicit post-return location assessment can reaffirm the same room; expired conditions disappear", () => {
  const projected = currentSettlementActors(actors, 5, [located(1, ["elora"]), returned(2, ["elora"]), located(3, ["elora"])]);
  expect(projected[0]).toMatchObject({ locationId: "plaza", activity: null, conditions: [] });
});
