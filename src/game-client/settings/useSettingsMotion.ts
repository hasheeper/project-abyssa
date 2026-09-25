import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue } from "motion/react";
import type { SystemSceneMotion } from "../system-panel-motion";
import { bindSettingsMotion, settingsSceneVisibility, settingsTabVisibility, settingsTiming } from "./settings-motion";

export function useSettingsMotion<T extends string>(root: RefObject<HTMLElement | null>, requested: T, scene?: SystemSceneMotion) {
  const [displayed, setDisplayed] = useState(requested);
  const [phase, setPhase] = useState<"ready" | "entering" | "leaving">("ready");
  const [previewActive, setPreviewActive] = useState(!scene);
  const latest = useRef(requested); latest.current = requested;
  const tabClock = useMotionValue(1), stationary = useMotionValue(1);
  const sceneClock = scene?.clock ?? stationary;
  const skip = !scene || scene.skip, sceneExiting = scene?.exiting ?? false;
  const leavingTab = displayed !== requested;
  const previewLive = useRef(previewActive);

  useLayoutEffect(() => {
    previewLive.current = !scene;
    setPreviewActive(!scene);
    // A new category gets a new preview; leaving a visible category must not
    // blank its text before the component itself has faded away.
  }, [displayed]);

  useLayoutEffect(() => {
    if (skip) { tabClock.set(1); setDisplayed(latest.current); setPhase("ready"); return; }
    if (sceneExiting) return; // Freeze the current category while the scene leaves.
    if (!leavingTab && tabClock.get() === 1) { setPhase("ready"); return; }
    let active = true;
    const goal = leavingTab ? 0 : 1;
    setPhase(leavingTab ? "leaving" : "entering");
    const control = animate(tabClock, goal, { duration: Math.abs(goal - tabClock.get()) * (leavingTab ? settingsTiming.tabExitMs : settingsTiming.tabEnterMs) / 1000, ease: "linear" });
    void control.then(() => {
      if (!active) return;
      if (leavingTab) setDisplayed(latest.current);
      else setPhase("ready");
    });
    return () => { active = false; control.stop(); };
  }, [leavingTab, displayed, skip, sceneExiting, tabClock]);

  useLayoutEffect(() => {
    if (!root.current) return;
    const paint = bindSettingsMotion(root.current);
    const update = () => {
      paint(sceneClock.get(), tabClock.get(), skip);
      const ready = skip || (!sceneExiting && settingsSceneVisibility(sceneClock.get(), "body", 4) === 1 && settingsTabVisibility(tabClock.get(), "body", 4) === 1);
      if (ready && !previewLive.current) { previewLive.current = true; setPreviewActive(true); }
    };
    update();
    const unScene = sceneClock.on("change", update), unTab = tabClock.on("change", update);
    return () => { unScene(); unTab(); };
  }, [root, sceneClock, tabClock, displayed, skip, sceneExiting]);
  return { displayed, phase, changing: !skip && (leavingTab || phase !== "ready"), previewActive };
}
