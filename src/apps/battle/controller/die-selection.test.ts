import { expect, it } from "vitest";
import { selectionAfterDieToggle } from "./die-selection";

it("selects the newly fixed die and clears only the actor whose die was unfixed", () => {
  expect(selectionAfterDieToggle(null, "kael", true)).toBe("kael");
  expect(selectionAfterDieToggle("kael", "eustice", true)).toBe("eustice");
  expect(selectionAfterDieToggle("eustice", "eustice", false)).toBeNull();
  expect(selectionAfterDieToggle("eustice", "kael", false)).toBe("eustice");
  expect(selectionAfterDieToggle(null, "kael", false)).toBeNull();
});
