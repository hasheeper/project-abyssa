import { bench, describe } from "vitest";
import { runDeterministicRound } from "./testing/baseline";
import { createExpeditionFromSeed, dispatchBattleCommand } from "./engine";

const benchmarkOptions = { iterations: 10, warmupIterations: 2 } as const;

function runCommandRound(seed: number) {
  let state = createExpeditionFromSeed(seed);
  state = dispatchBattleCommand(state, { type: "roll-dice" }).state;
  state = dispatchBattleCommand(state, { type: "reroll-dice" }).state;
  state = dispatchBattleCommand(state, { type: "reroll-dice" }).state;
  return dispatchBattleCommand(state, { type: "end-turn" }).state;
}

describe("Battle engine performance regression", () => {
  bench("1,000 deterministic round simulations", () => {
    for (let seed = 1; seed <= 1_000; seed += 1) {
      runDeterministicRound(seed);
    }
  }, benchmarkOptions);

  bench("1,000 command-dispatch round simulations", () => {
    for (let seed = 1; seed <= 1_000; seed += 1) {
      runCommandRound(seed);
    }
  }, benchmarkOptions);
});
