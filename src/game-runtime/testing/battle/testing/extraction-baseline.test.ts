import { describe, expect, it } from "vitest";
import frozen from "../../../../game-core/battle/testing/fixtures/s1-extraction.json";
import { captureExtractionBaseline } from "./extraction-baseline";
import { createExpeditionFromSeed, createExpeditionStateFromInput, dispatchBattleCommand, mulberry32, rollDice } from "../../../legacy-battle";

describe("S1 pre-migration compatibility contract", () => {
  it("preserves all state fields, ordered transitions, exports and historical saves", () => {
    expect(JSON.parse(JSON.stringify(captureExtractionBaseline()))).toEqual(frozen);
  });

  it("keeps the legacy event cursor distinct from dispatch", () => {
    const state = createExpeditionFromSeed(19);
    expect(rollDice(state, mulberry32(19)).eventSequence).toBe(0);
    expect(dispatchBattleCommand(state, { type: "roll-dice" }).state.eventSequence).toBe(2);
  });

  it("records the raw constructor RNG limitation without silently changing it", () => {
    const raw = createExpeditionStateFromInput(mulberry32(19), {});
    const seeded = createExpeditionFromSeed(19);
    expect(raw.rng.combat).toMatchObject({ seed: 0, cursor: 0 });
    expect(seeded.rng.combat).toMatchObject({ seed: 19, cursor: 2 });
    expect(dispatchBattleCommand(raw, { type: "roll-dice" }).state.dice.map(die => die.faceIndex)).toEqual([1, 0, 1, 0, 2]);
    expect(dispatchBattleCommand(seeded, { type: "roll-dice" }).state.dice.map(die => die.faceIndex)).toEqual([2, 4, 5, 1, 3]);
  });
});
