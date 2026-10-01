import { useLayoutEffect, type RefObject } from "react";
import { panelRamp, systemControlItems, type SystemSceneMotion } from "../system-panel-motion";
import { motionTokens } from "../../shared/ui/motion/presets";

const timing = motionTokens.memoryJournal;
export function useMemorySceneMotion(root: RefObject<HTMLElement | null>, scene: SystemSceneMotion | undefined, contentKey: string) {
  useLayoutEffect(() => {
    if (!root.current) return;
    const panel = root.current;
    const list = panel.querySelector<HTMLElement>(".memory-catalogue"), listRect = list?.getBoundingClientRect();
    const rows = Array.from(panel.querySelectorAll<HTMLElement>("[data-memory-id]"));
    const firstVisible = Math.max(0, rows.findIndex(row => row.getBoundingClientRect().bottom > (listRect?.top ?? 0)));
    const items = [
      ...rows.map((element, index) => ({ element, start: timing.rowStartMs + Math.min(5, Math.max(0, index - firstVisible)) * timing.rowStaggerMs, duration: timing.rowMs, distance: 16 })),
      ...Array.from(panel.querySelectorAll<HTMLElement>(".memory-page__heading, .memory-empty, .memory-reader__text"), element => ({ element, start: 120, duration: 440, distance: 12 })),
      ...systemControlItems(panel).map(({ element, order }) => ({ element, start: timing.chromeStartMs + order * 36, duration: 240, distance: 8 })),
      ...Array.from(panel.querySelectorAll<HTMLElement>(".memory-time"), element => ({ element, start: timing.chromeStartMs, duration: 320, distance: 0 })),
      ...Array.from(panel.querySelectorAll<HTMLElement>(".memory-footer__context"), element => ({ element, start: timing.chromeStartMs, duration: 240, distance: 8 })),
    ];
    const paint = () => {
      const ms = (!scene || scene.skip ? 1 : scene.clock.get()) * timing.enterMs;
      panel.style.setProperty("--memory-axis-reveal", String(panelRamp(ms, 0, timing.axisMs)));
      panel.style.setProperty("--memory-scene-reveal", String(panelRamp(ms, 40, timing.sceneMs)));
      for (const { element, start, duration, distance } of items) {
        const alpha = panelRamp(ms, start, duration);
        element.style.setProperty("--memory-scene-alpha", String(alpha));
        element.style.setProperty("--memory-scene-y", `${distance * (1 - alpha)}px`);
        element.setAttribute("data-memory-scene-item", "");
      }
    };
    paint(); const unsubscribe = scene?.clock.on("change", paint);
    return () => { unsubscribe?.(); items.forEach(({ element }) => { element.removeAttribute("data-memory-scene-item"); element.style.removeProperty("--memory-scene-alpha"); element.style.removeProperty("--memory-scene-y"); }); };
  }, [root, scene?.clock, scene?.skip, contentKey]);
}
