import { memo, useEffect, useRef } from "react";
import { createEnemyMistRenderer } from "./enemy-mist-renderer";

const FRAME_INTERVAL = 1000 / 24;

export const EnemyMist = memo(function EnemyMist({ foregroundBusy = false }: { foregroundBusy?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foregroundBusyRef = useRef(foregroundBusy);
  useEffect(() => { foregroundBusyRef.current = foregroundBusy; }, [foregroundBusy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof WebGLRenderingContext === "undefined") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: ReturnType<typeof createEnemyMistRenderer> = null;
    let frame = 0;
    let previous = 0;
    let elapsed = 11_000;
    let deferredDraws = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      deferredDraws = 0;
    };
    const draw = (now: number) => {
      if (!renderer) return;
      if (!previous) previous = now;
      const delta = now - previous;
      if (delta >= FRAME_INTERVAL) {
        elapsed += Math.min(delta - (delta % FRAME_INTERVAL), 100);
        previous = now - (delta % FRAME_INTERVAL);
        // Keep the same motion clock and full-resolution shader. While the 3D
        // dice or encounter camera move, draw this slow background once per
        // three ticks (8fps).
        if (!foregroundBusyRef.current || ++deferredDraws >= 3) {
          deferredDraws = 0;
          renderer.draw(elapsed / 1000);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    const refresh = () => {
      stop();
      if (!renderer || document.hidden) return;
      renderer.resize();
      renderer.draw(elapsed / 1000);
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const initialize = () => {
      renderer = createEnemyMistRenderer(canvas);
      canvas.dataset.mistReady = String(Boolean(renderer));
      refresh();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      stop();
      renderer = null;
      canvas.dataset.mistReady = "false";
    };

    initialize();
    const observer = new ResizeObserver(refresh);
    observer.observe(canvas);
    window.addEventListener("resize", refresh);
    document.addEventListener("visibilitychange", refresh);
    motion.addEventListener("change", refresh);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", initialize);
    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
      motion.removeEventListener("change", refresh);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", initialize);
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="abyssa-expedition-enemies__mist" aria-hidden="true" />;
});
