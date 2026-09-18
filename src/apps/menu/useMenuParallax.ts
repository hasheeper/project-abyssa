import { useEffect, useRef, type RefObject } from "react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

/** One camera, six depths. Pointer input never goes through React state. */
export function useMenuParallax(ref: RefObject<HTMLDivElement | null>, blocked: boolean) {
  const { reduced } = useUiMotion();
  const position = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const root = ref.current;
    if (!root || !window.matchMedia) return;
    const layers = root.querySelectorAll<HTMLElement | SVGSVGElement>(
      ".menu-scenery, .menu-backdrop, .menu-app__host, .menu-topbar, .menu-sidebar, .menu-app__dial"
    );
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let target = { x: 0, y: 0 };
    let frame = 0;
    let previousTime = 0;
    let returning = true;
    let keyboard = false;
    let pressed = false;
    const enabled = () => !blocked && !reduced && fine.matches && !document.hidden;

    function paint() {
      for (const layer of layers) {
        layer.style.setProperty("--menu-look-x", position.current.x.toFixed(4));
        layer.style.setProperty("--menu-look-y", position.current.y.toFixed(4));
      }
    }
    function stop() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      root!.removeAttribute("data-menu-looking");
    }
    function tick(time: number) {
      frame = 0;
      const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      const blend = 1 - Math.exp(-elapsed / (returning ? 180 : 125));
      position.current.x += (target.x - position.current.x) * blend;
      position.current.y += (target.y - position.current.y) * blend;
      const settled = Math.abs(target.x - position.current.x) + Math.abs(target.y - position.current.y) < .001;
      if (settled) position.current = { ...target };
      paint();
      if (settled) root!.removeAttribute("data-menu-looking");
      else frame = window.requestAnimationFrame(tick);
    }
    function wake() {
      if (frame) return;
      previousTime = 0;
      root!.setAttribute("data-menu-looking", "");
      frame = window.requestAnimationFrame(tick);
    }
    function reset(immediate = false) {
      target = { x: 0, y: 0 };
      returning = true;
      pressed = false;
      if (immediate) {
        stop();
        position.current = { ...target };
        paint();
      } else if (position.current.x || position.current.y || frame) wake();
    }
    function move(event: PointerEvent) {
      if (!enabled() || pressed || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      // Ignore synthetic zero-distance moves after keyboard focus / layout changes.
      if (keyboard && !event.movementX && !event.movementY) return;
      keyboard = false;
      const bounds = root!.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      target = {
        x: clamp((event.clientX - bounds.left) / bounds.width * 2 - 1),
        y: clamp((event.clientY - bounds.top) / bounds.height * 2 - 1)
      };
      returning = false;
      wake();
    }
    // Freeze at the current position through pointerup: art and hit areas move
    // together, and a press must never chase a still-settling camera.
    const down = () => { pressed = true; target = { ...position.current }; stop(); };
    const up = () => { pressed = false; };
    const leave = () => reset();
    const visibility = () => reset(document.hidden);
    const preference = () => reset(reduced || !fine.matches);
    const key = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (!["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      keyboard = true;
      reset();
    };
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("keydown", key, true);
    document.addEventListener("visibilitychange", visibility);
    fine.addEventListener("change", preference);
    reset(reduced || !fine.matches || document.hidden);
    return () => {
      stop();
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("visibilitychange", visibility);
      fine.removeEventListener("change", preference);
    };
  }, [ref, blocked, reduced]);
}
