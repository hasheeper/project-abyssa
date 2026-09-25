import { motionTokens, uiTransition } from "../../motion/presets";
import type { SceneFeedbackProps } from "./types";

export function feedbackOffset(edge: NonNullable<SceneFeedbackProps["edge"]>, distance: number) {
  return edge === "left" ? `${-distance}px 0px` : edge === "right" ? `${distance}px 0px` : `0px ${-distance}px`;
}

export function feedbackTransition(result: boolean, present: boolean, reduced: boolean) {
  const timing = motionTokens.feedback;
  return uiTransition(reduced ? timing.reducedMs : !present ? timing.exitMs : result ? timing.resultEnterMs : timing.noticeEnterMs);
}
