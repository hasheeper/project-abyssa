import { useEffect, useRef } from "react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

/** Camera coordinates live outside React so moving the pointer cannot rerender saves or CGs. */
export function useTitleParallax(blocked: boolean) {
  const { reduced } = useUiMotion();
  const ref = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element || !window.matchMedia) return;
    // Registered non-inheriting coordinates invalidate only the five camera
    // layers, not every SVG path, Logo letter, CG and menu descendant each frame.
    const layers = [element, ...element.querySelectorAll<HTMLElement>(".title-cg-layer, .title-backdrop, .title-emblem, .title-commands")];
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let target = { x: 0, y: 0 };
    let frame = 0;
    let previousTime = 0;
    let returning = true;
    const enabled = () => !blocked && !reduced && fine.matches && !document.hidden;

    function paint() {
      const x = position.current.x.toFixed(4), y = position.current.y.toFixed(4);
      for (const layer of layers) {
        layer.style.setProperty("--title-look-x", x);
        layer.style.setProperty("--title-look-y", y);
      }
    }
    function tick(time: number) {
      frame = 0;
      const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      const blend = 1 - Math.exp(-elapsed / (returning ? 170 : 125));
      position.current.x += (target.x - position.current.x) * blend;
      position.current.y += (target.y - position.current.y) * blend;
      const settled = Math.abs(target.x - position.current.x) + Math.abs(target.y - position.current.y) < 0.001;
      if (settled) position.current = { ...target };
      paint();
      if (settled) element!.removeAttribute("data-looking");
      else frame = window.requestAnimationFrame(tick);
    }
    function wake() {
      if (frame) return;
      previousTime = 0;
      element!.setAttribute("data-looking", "");
      frame = window.requestAnimationFrame(tick);
    }
    function reset(immediate = false) {
      target = { x: 0, y: 0 };
      returning = true;
      if (immediate) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        position.current = { ...target };
        paint();
        element!.removeAttribute("data-looking");
      } else if (position.current.x || position.current.y) wake();
    }
    function move(event: PointerEvent) {
      if (!enabled() || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      // The stationary host rect already includes Stage's scale and letterboxing.
      const bounds = element!.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      target = {
        x: clamp((event.clientX - bounds.left) / bounds.width * 2 - 1),
        y: clamp((event.clientY - bounds.top) / bounds.height * 2 - 1)
      };
      returning = false;
      wake();
    }
    const leave = () => reset();
    const visibility = () => reset(document.hidden);
    const preference = () => reset(reduced || !fine.matches);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    fine.addEventListener("change", preference);
    reset(reduced || !fine.matches || document.hidden);
    return () => {
      window.cancelAnimationFrame(frame);
      element.removeAttribute("data-looking");
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
      fine.removeEventListener("change", preference);
    };
  }, [blocked, reduced]);

  return ref;
}
