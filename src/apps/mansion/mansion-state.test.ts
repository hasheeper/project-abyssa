import { describe, expect, it } from "vitest";
import {
  MAX_DAMAGED,
  REPAIR_STEPS,
  advanceMansionPhase,
  collectMansionProduction,
  createMansionEstateState,
  previewMansionPhase,
  promoteMansionFacility,
  startMansionRepair
} from "./mansion-state";

describe("mansion estate state", () => {
  it("creates the playable day-one estate baseline", () => {
    const state = createMansionEstateState();

    expect(state.phase).toBe("day");
    expect(state.day).toBe(1);
    expect(state.funds).toEqual({ public: 12800, party: 1450 });
    expect([...state.damaged]).toEqual(["kitchen", "laundry"]);
    expect(state.readyProduction).toContain("kitchen");
  });

  it("previews a phase without settling a day or production", () => {
    const state = createMansionEstateState();
    const result = previewMansionPhase(state, "night");

    expect(result.state.phase).toBe("night");
    expect(result.state.day).toBe(1);
    expect(result.state.readyProduction).toBe(state.readyProduction);
  });

  it("advances through dawn before incrementing the day and caps damage", () => {
    let state = createMansionEstateState();
    state = advanceMansionPhase(state, [0.1, 0]).state;
    expect(state.phase).toBe("dusk");
    expect(state.damaged.size).toBe(MAX_DAMAGED);

    state = advanceMansionPhase(state, [0.1, 0, 0]).state;
    expect(state.phase).toBe("night");
    expect(state.day).toBe(1);
    expect(state.damaged.size).toBe(MAX_DAMAGED);

    state = advanceMansionPhase(state, [0.1, 0, 0]).state;
    expect(state.phase).toBe("dawn");
    expect(state.day).toBe(2);
  });

  it("collects production by item identity exactly once per phase", () => {
    const initial = createMansionEstateState();
    const first = collectMansionProduction(initial, "kitchen");
    const duplicate = collectMansionProduction(first.state, "kitchen");

    expect(first.state.inventory["hot-meal"]).toBe(2);
    expect(first.state.readyProduction).not.toContain("kitchen");
    expect(first.notice).toContain("热食 ×2份");
    expect(duplicate.state).toBe(first.state);
  });

  it("charges each repair step and promotes only after all steps complete", () => {
    let state = createMansionEstateState();

    for (let step = 1; step <= REPAIR_STEPS; step += 1) {
      const repair = startMansionRepair(state, "kitchen");
      expect(repair.state.funds.public).toBe(12800 - step * 900);
      expect(repair.state.upgrading.kitchen).toBe(1);
      state = advanceMansionPhase(repair.state, [1, 0, 0]).state;
      expect(state.repairProgress.kitchen).toBe(step);
    }

    const promoted = promoteMansionFacility(state, "kitchen");
    expect(promoted.state.levels.kitchen).toBe(3);
    expect(promoted.state.repairProgress.kitchen).toBe(0);
    expect(promoted.state.funds.public).toBe(8300);
    expect(promoted.notice).toContain("Lv.3");
  });

  it("leaves the estate unchanged when a repair fund is insufficient", () => {
    const state = createMansionEstateState();
    state.funds = { ...state.funds, public: 0 };
    const result = startMansionRepair(state, "kitchen");

    expect(result.state).toBe(state);
    expect(result.notice).toBe("维稳公款不足");
  });
});
