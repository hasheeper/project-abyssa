import { motionTokens, uiTransition } from "./presets";

const timing = motionTokens.confirmation;
export type ConfirmationPart = "scrim" | "surface" | "content" | "action";

/** Separate opacity tracks. The scrim finishes last on exit, so UiModal's
 * existing presence owner also covers every child without another exit timer. */
export function confirmationTransition(part: ConfirmationPart, present: boolean, reduced: boolean, index: 0 | 1 = 0) {
  if (reduced) return { ...uiTransition(timing.reducedMs), delay: 0 };
  const duration = present ? timing[`${part}EnterMs`] : timing[`${part}ExitMs`];
  const delay = present
    ? part === "scrim" ? 0 : part === "action" ? timing.actionEnterDelayMs + index * timing.actionStaggerMs : timing[`${part}EnterDelayMs`]
    : part === "action" ? (1 - index) * timing.actionExitStaggerMs : timing[`${part}ExitDelayMs`];
  return { ...uiTransition(duration), delay: delay / 1000 };
}
