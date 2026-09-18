import { expect, it } from "vitest";
import { AIRP_TEXT_EMOTIONS } from "../game-application/airp/contracts";
import { EMOTION_LABELS } from "../shared/domain/presentation/emotion";

it("the online application contract exactly matches the existing 14 presentation emotions", () => {
  expect([...AIRP_TEXT_EMOTIONS]).toEqual(Object.keys(EMOTION_LABELS));
});
