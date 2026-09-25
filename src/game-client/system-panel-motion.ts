import { cubicBezier, type MotionValue } from "motion/react";
import "./system-panel-motion.css";

export type SystemSceneMotion = { clock: MotionValue<number>; exiting: boolean; skip: boolean };
export const panelEase = cubicBezier(.2, .7, .2, 1);
export const panelRamp = (ms: number, start: number, duration: number) => panelEase(Math.max(0, Math.min(1, (ms - start) / duration)));

/** Bind actual controls, never the nav/footer container. Each region reads
 * left-to-right; footer actions follow their own short stagger. */
export function systemControlItems(root: HTMLElement) {
  const top = Array.from(root.querySelectorAll<HTMLElement>(".abyssa-system-toolbar__label, .abyssa-system-tabs > button, .abyssa-system-toolbar__actions > button"));
  const footer = Array.from(root.querySelectorAll<HTMLElement>(".abyssa-system-panel__footer button"));
  return [...top.map((element, order) => ({ element, order })),
    ...footer.map((element, index) => ({ element, order: index + 1 })),
    ...Array.from(root.querySelectorAll<HTMLElement>(".save-slots__feedback"), element => ({ element, order: 0 }))];
}

export function prepareSystemItem(root: HTMLElement, element: HTMLElement) {
  root.setAttribute("data-system-item-motion", "");
  element.setAttribute("data-system-motion-item", "");
}
export function paintSystemItem(element: HTMLElement, opacity: number) {
  element.style.setProperty("--system-item-opacity", String(opacity));
}
