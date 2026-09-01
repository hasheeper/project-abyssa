export interface MapSceneRuntimeOptions {
  element: HTMLElement;
  onFrame: () => void;
  onResize: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onDestroy: () => void;
}

export interface MapSceneRuntime {
  readonly destroyed: boolean;
  scheduleReplay: (callback: () => void, delay: number) => void;
  destroy: () => void;
}

/** Owns the browser lifecycle around a map scene, independently of Three.js. */
export function createMapSceneRuntime(options: MapSceneRuntimeOptions): MapSceneRuntime {
  let animationFrame = 0;
  let replayTimer: number | null = null;
  let destroyed = false;

  const animate = () => {
    if (destroyed) return;
    animationFrame = requestAnimationFrame(animate);
    options.onFrame();
  };

  options.element.addEventListener("pointerdown", options.onPointerDown);
  options.element.addEventListener("pointermove", options.onPointerMove);
  window.addEventListener("resize", options.onResize);
  animate();

  const runtime: MapSceneRuntime = {
    get destroyed() {
      return destroyed;
    },
    scheduleReplay(callback, delay) {
      if (destroyed) return;
      if (replayTimer !== null) window.clearTimeout(replayTimer);
      replayTimer = window.setTimeout(() => {
        replayTimer = null;
        if (!destroyed) callback();
      }, delay);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (replayTimer !== null) {
        window.clearTimeout(replayTimer);
        replayTimer = null;
      }
      cancelAnimationFrame(animationFrame);
      options.element.removeEventListener("pointerdown", options.onPointerDown);
      options.element.removeEventListener("pointermove", options.onPointerMove);
      window.removeEventListener("resize", options.onResize);
      options.onDestroy();
    }
  };

  return runtime;
}
