import { memo, useEffect, useRef } from "react";
import { createEnemyMistRenderer } from "./enemy-mist-renderer";

const FRAME_INTERVAL = 1000 / 24;

/** The parent battle policy owns visibility/reduced-motion subscriptions. */
export const EnemyMist = memo(function EnemyMist({ foregroundBusy = false, paused }: { foregroundBusy?: boolean; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foregroundBusyRef = useRef(foregroundBusy);
  // Entrance holds the already painted fog; resuming must not compile another
  // shader or jump its clock while the foreground board/dice are settling.
  const pausedRef = useRef(paused);
  const playbackRef = useRef<(() => void) | null>(null);
  useEffect(() => { foregroundBusyRef.current = foregroundBusy; }, [foregroundBusy]);
  useEffect(() => { pausedRef.current = paused; playbackRef.current?.(); }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof WebGLRenderingContext === "undefined") return;
    let renderer: ReturnType<typeof createEnemyMistRenderer> = null;
    let frame = 0;
    let previous = 0;
    let elapsed = 11_000;
    let deferredDraws = 0;
    let needsResize = false;

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
    const syncPlayback = () => {
      stop();
      if (!renderer || document.hidden) return;
      if (needsResize) {
        needsResize=false;
        renderer.resize();
        renderer.draw(elapsed/1000);
      }
      if (!pausedRef.current) frame = requestAnimationFrame(draw);
    };
    const refresh = () => {
      stop();
      if (!renderer) return;
      if (document.hidden) {needsResize=true;return;}
      needsResize=false;
      renderer.resize();
      renderer.draw(elapsed / 1000);
      syncPlayback();
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

    // Pause/resume only touches the clock. Do not force a layout measurement and
    // synchronous WebGL redraw at the exact frame the scene releases its layers.
    playbackRef.current = syncPlayback;
    initialize();
    const observer = new ResizeObserver(refresh);
    observer.observe(canvas);
    window.addEventListener("resize", refresh);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", initialize);
    return () => {
      playbackRef.current = null;
      stop();
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", initialize);
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="abyssa-expedition-enemies__mist" aria-hidden="true" />;
});
