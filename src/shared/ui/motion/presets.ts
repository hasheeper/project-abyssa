import tokens from "./tokens.json";

// The only conversion from design milliseconds to Motion seconds.
const ease: [number, number, number, number] = [tokens.ease[0], tokens.ease[1], tokens.ease[2], tokens.ease[3]];
export const motionTokens = tokens;
export const uiTransition = (milliseconds: number) => ({ duration: milliseconds / 1000, ease, type: "tween" as const });
export function surfaceTransition(reduced: boolean, exiting = false) {
  return uiTransition(reduced ? tokens.surface.reducedMs : exiting ? tokens.surface.exitMs : tokens.surface.enterMs);
}

/** Opt-in manor boards; the default surface preset remains unchanged. */
export const manorWindowMotion = tokens.manorWindow;
export function manorWindowTransition(reduced: boolean, exiting: boolean) {
  return {duration: (reduced ? tokens.surface.reducedMs : exiting ? manorWindowMotion.exitMs : manorWindowMotion.enterMs) / 1000,
    ease: [...manorWindowMotion.ease] as [number, number, number, number], type: "tween" as const};
}
