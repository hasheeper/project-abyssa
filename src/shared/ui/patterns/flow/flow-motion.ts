import { uiTransition } from "../../motion/presets";

export type FlowPart = "surface" | "tint" | "content" | "action";
export type FlowOrigin = "center" | "rail";
export type ScenePart = "curtain" | "view" | "settle";

type Track = readonly [delay: number, duration: number];
// The backing appears before its ink comes into focus. UiModal owns presence;
// every exit finishes before the shared confirmation scrim's 420 ms deadline.
const entrance: Record<FlowPart, Track> = {
  surface: [280, 560], tint: [400, 420], content: [540, 460], action: [660, 320],
};
const departure: Record<FlowPart, Track> = {
  surface: [120, 280], tint: [60, 240], content: [0, 180], action: [0, 160],
};

export function flowTransition(part: FlowPart, present: boolean, reduced: boolean, from: FlowOrigin, index: 0 | 1 = 0) {
  if (reduced) return { ...uiTransition(80), delay: 0 };
  const [delay, duration] = (present ? entrance : departure)[part];
  const speed = present && from === "rail" ? .6 : 1;
  const stagger = part === "action" ? present ? index * 50 : (1 - index) * 30 : 0;
  return {
    ...uiTransition(duration * speed),
    delay: (delay + stagger) * speed / 1000,
  };
}

/** Entrance-only focus; remove the filter completely once the transition ends. */
export function flowFocus(part: "content" | "action", present: boolean, reduced: boolean, from: FlowOrigin, index: 0 | 1 = 0) {
  const track = flowTransition(part, present, reduced, from, index);
  return {
    initial: { opacity: 0, filter: reduced ? "none" : `blur(${part === "action" ? 5 : 8}px)` },
    animate: {
      opacity: present ? 1 : 0,
      // A distinct reduced target also interrupts an already running focus.
      filter: reduced || present ? "blur(0px)" : "none",
      ...(!reduced ? { transitionEnd: { filter: "none" } } : {}),
    },
    // A live preference change also clears an in-flight blur immediately.
    transition: { ...track, filter: reduced ? { duration: 0, delay: 0 } : track },
  };
}

const sceneEnter: Record<ScenePart, Track> = { curtain: [0, 520], view: [160, 760], settle: [160, 1000] };
const sceneExit: Record<ScenePart, Track> = { curtain: [180, 240], view: [90, 240], settle: [0, 240] };

export function flowSceneTransition(part: ScenePart, present: boolean, reduced: boolean, from: FlowOrigin, exitTo: "rail" | "reader") {
  if (reduced) return { ...uiTransition(80), delay: 0 };
  const [delay, duration] = present ? sceneEnter[part] : exitTo === "reader" ? [0, 420] : sceneExit[part];
  const speed = present && from === "rail" ? .6 : 1;
  return { ...uiTransition(duration * speed), delay: delay * speed / 1000 };
}
