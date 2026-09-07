import { LEGACY_CONTEXT } from "../../../legacy-context";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../../../game-core/battle/persistence/rng";
import { actScenario } from "../testing/scenario";
import { createExpeditionState as unbound_createExpeditionState } from "../../../../game-core/battle/rules/expedition";
import { isDieDowned } from "../../../../game-core/battle/selectors/battle-selectors";
import {
  performInitialRoll as unbound_performInitialRoll,
  performReroll as unbound_performReroll,
  performToggleLoad as unbound_performToggleLoad
} from "../../../../game-core/battle/rules/dice-actions";
const createExpeditionState = unbound_createExpeditionState.bind(null, LEGACY_CONTEXT);
const performInitialRoll = unbound_performInitialRoll.bind(null, LEGACY_CONTEXT);
const performReroll = unbound_performReroll.bind(null, LEGACY_CONTEXT);
const performToggleLoad = unbound_performToggleLoad.bind(null, LEGACY_CONTEXT);


describe("native dice actions", () => {
  it("rolls only eligible opening dice without mutating input", () => {
    const state = createExpeditionState(mulberry32(651));
    state.party[1]!.hp = 0;
    state.party[1]!.downed = true;
    state.dice[2]!.sealed = true;
    const original = structuredClone(state);

    const native = performInitialRoll(state, mulberry32(653));

    expect(native.error).toBeNull();
    expect(state).toEqual(original);
    expect(native.state.mode.type).toBe("player-turn");
    expect(native.state.lastTossed).toEqual(["kael", "kororo", "norma"]);
    expect(native.events.find((event) => event.type === "dice-rolled")?.payload.results)
      .toHaveLength(3);
  });

  it("exhausts rerolls, auto-loads and clears the undo stack", () => {
    const state = actScenario(655)
      .patch((draft) => {
        draft.rerollsRemaining = 1;
        draft.dice[0]!.loaded = true;
        draft.dice[1]!.sealed = true;
        draft.undoStack = [
          {
            action: "discarded-by-reroll",
            state: (({ undoStack: _undoStack, ...checkpoint }) => checkpoint)(
              structuredClone(draft)
            )
          }
        ];
      })
      .build();
    const original = structuredClone(state);
    const native = performReroll(state, mulberry32(657));

    expect(native.error).toBeNull();
    expect(state).toEqual(original);
    expect(native.state.rerollsRemaining).toBe(0);
    expect(native.state.undoStack).toEqual([]);
    expect(
      native.state.dice
        .filter((die) => !die.sealed && !isDieDowned(native.state, die) && !die.spent)
        .every((die) => die.loaded)
    ).toBe(true);
  });

  it("toggles loading and captures one complete undo checkpoint", () => {
    const state = actScenario(659).build();
    const original = structuredClone(state);
    const native = performToggleLoad(state, 0);

    expect(native.error).toBeNull();
    expect(state).toEqual(original);
    expect(native.state.dice[0]!.loaded).toBe(!state.dice[0]!.loaded);
    expect(native.events.find((event) => event.type === "die-load-changed")?.payload)
      .toMatchObject({ dieIndex: 0, loaded: true });
    expect(native.state.undoStack).toHaveLength(state.undoStack.length + 1);
  });
});
