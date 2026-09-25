import { expect, it } from "vitest";
import { feedbackOffset, feedbackTransition } from "./feedback-motion";
import { motionTokens } from "../../motion/presets";

it("enters from the selected edge and retreats a shorter distance toward the same edge", () => {
  const { distancePx, exitDistancePx } = motionTokens.feedback;
  expect(feedbackOffset("top", distancePx)).toBe("0px -18px");
  expect(feedbackOffset("right", distancePx)).toBe("18px 0px");
  expect(feedbackOffset("left", distancePx)).toBe("-18px 0px");
  expect(feedbackOffset("right", exitDistancePx)).toBe("8px 0px");
  expect(exitDistancePx).toBeLessThan(distancePx);
});

it("is brisker than the center choreography, with more space for an event result", () => {
  expect(feedbackTransition(false, true, false).duration).toBe(.32);
  expect(feedbackTransition(true, true, false).duration).toBe(.42);
  expect(feedbackTransition(true, false, false).duration).toBe(.22);
  expect(feedbackTransition(true, false, true).duration).toBe(.08);
});
