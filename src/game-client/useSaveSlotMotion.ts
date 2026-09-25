import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue } from "motion/react";
import { bindSaveSlotMotion, slotTiming, type SaveSlotSceneMotion, type SlotPagePhase } from "./save-slots-motion";

export function useSaveSlotMotion(root: RefObject<HTMLElement | null>, requestedPage: number, dataReady: boolean, scene?: SaveSlotSceneMotion, contentKey?: string) {
  const [page, setPage] = useState(requestedPage), [phase, setPhase] = useState<SlotPagePhase>("ready");
  const pageClock = useMotionValue(1), stationaryScene = useMotionValue(1);
  const sceneClock = scene?.clock ?? stationaryScene;
  const skip = !scene || scene.skip, exiting = scene?.exiting ?? false;
  const mounted = useRef(false), priorDirection = useRef(exiting);
  const starts = useRef(new WeakMap<HTMLElement, { start: number; startY: number }>());
  const sceneProgress = useRef(0);
  const paint = useRef<ReturnType<typeof bindSaveSlotMotion> | null>(null);
  const live = useRef({ phase, skip, exiting }); live.current = { phase, skip, exiting };
  const readyListener = scene?.onReady;
  const modeOpacity = scene?.modeOpacity;
  useEffect(() => { if (dataReady) readyListener?.(true); }, [readyListener, dataReady]);
  useLayoutEffect(() => {
    if (!modeOpacity) return;
    const update = (value: number) => {
      root.current?.style.setProperty("--slot-mode-opacity", String(value));
      paint.current?.(sceneProgress.current, pageClock.get(), live.current.phase, live.current.skip, value);
    };
    update(modeOpacity.get());
    return modeOpacity.on("change", update);
  }, [root, modeOpacity, pageClock]);

  useLayoutEffect(() => {
    if (skip) { pageClock.set(1); setPage(requestedPage); setPhase("ready"); return; }
    // Leave the currently visible page in place while its parent is retiring.
    if (exiting) { setPhase("ready"); return; }
    if (page === requestedPage && phase === "ready") return;
    let active = true;
    const leaving = page !== requestedPage;
    setPhase(leaving ? "leaving" : "entering"); pageClock.set(0);
    const control = animate(pageClock, 1, { duration: (leaving ? slotTiming.pageExitMs : slotTiming.pageEnterMs) / 1000, ease: "linear" });
    void control.then(() => {
      if (!active) return;
      if (leaving) { setPage(requestedPage); setPhase("entering"); }
      else setPhase("ready");
    });
    return () => { active = false; control.stop(); };
    // phase is driven by this effect; including it would restart each stage.
  }, [requestedPage, page, skip, exiting, pageClock]);

  useLayoutEffect(() => {
    if (!root.current) return;
    const directionChanged = priorDirection.current !== exiting;
    if (directionChanged) starts.current = new WeakMap();
    paint.current = bindSaveSlotMotion(root.current, exiting, !mounted.current, starts.current);
    if (directionChanged || !mounted.current) sceneProgress.current = 0;
    priorDirection.current = exiting; mounted.current = true;
    const update = () => paint.current?.(sceneProgress.current, pageClock.get(), live.current.phase, live.current.skip, modeOpacity?.get() ?? 1);
    // Child layout effects run before the parent resets the directional clock.
    update();
    const unScene = sceneClock.on("change", value => { sceneProgress.current = value; update(); }), unPage = pageClock.on("change", update);
    return () => { unScene(); unPage(); };
  }, [root, sceneClock, pageClock, exiting, page, dataReady, modeOpacity, contentKey]);
  useLayoutEffect(() => { paint.current?.(sceneProgress.current, pageClock.get(), phase, skip, modeOpacity?.get() ?? 1); }, [phase, skip, pageClock, modeOpacity]);
  return { page, changing: !exiting && (page !== requestedPage || phase !== "ready"), phase, skip };
}
