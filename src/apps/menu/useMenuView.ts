import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue } from "motion/react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { motionTokens, uiTransition } from "../../shared/ui/motion/presets";
import { bindMenuHomeMotion, homeTitleReveal } from "./menu-home-motion";

export type MenuView = "home" | "save" | "load" | "settings";
const timing = motionTokens.menuSection;
const isArchive = (view: MenuView) => view === "save" || view === "load";

/** Home reverses its layered entrance; sections exchange only their local body.
 * A changed destination does not restart exit. Reversal retains the live clock. */
export function useMenuView(root: RefObject<HTMLDivElement | null>, waitForArchive = false) {
  const [target, request] = useState<MenuView>("home");
  const latestTarget = useRef(target); latestTarget.current = target;
  const [displayed, setDisplayed] = useState<MenuView>("home");
  const [phase, setPhase] = useState<"ready" | "leaving" | "entering">("ready");
  const [hidden, setHidden] = useState(() => document.hidden);
  const { reduced } = useUiMotion();
  const homeTime = useMotionValue(timing.homeMs);
  const archiveTime = useMotionValue(1);
  const modeOpacity = useMotionValue(1);
  const archiveDirection = useRef({ displayed: "home" as MenuView, exiting: false });
  const [archiveReady, setArchiveReady] = useState(!waitForArchive);
  const opacity = useMotionValue(1), titleOpacity = useMotionValue(1), titleX = useMotionValue(0);
  const exiting = target !== displayed;
  const archive = isArchive(displayed);
  const modeChanging = archive && exiting && isArchive(target);
  const sceneExiting = exiting && !modeChanging;
  const awaitingArchive = waitForArchive && archive && !sceneExiting && !archiveReady;
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useLayoutEffect(() => {
    if (displayed !== "home" || !root.current) return;
    const paint = bindMenuHomeMotion(root.current);
    const update = (time: number) => {
      paint(time);
      const title = homeTitleReveal(time);
      titleX.set((title - 1) * timing.withdrawPx); titleOpacity.set(title);
    };
    update(homeTime.get());
    return homeTime.on("change", update);
  }, [displayed, exiting, root, homeTime, titleX, titleOpacity]);
  useLayoutEffect(() => {
    if (hidden || reduced) {
      archiveDirection.current = { displayed: latestTarget.current, exiting: false };
      homeTime.set(timing.homeMs); archiveTime.set(1); modeOpacity.set(1); opacity.set(1); titleX.set(0); titleOpacity.set(1);
      setDisplayed(latestTarget.current); setPhase("ready");
      return;
    }
    const isHome = displayed === "home";
    if (modeChanging) {
      // SAVE/LOAD share a mounted archive. Contents cross-fade without
      // re-drawing rails; the title keeps the same slide used by other sections.
      if (archiveDirection.current.exiting) archiveTime.set(0);
      archiveDirection.current = { displayed, exiting: false };
      let active = true;
      setPhase("leaving");
      const controls = [animate(modeOpacity, 0, { duration: motionTokens.saveSlots.modeOutMs / 1000, ease: "linear" }),
        animate(titleOpacity, 0, uiTransition(timing.exitMs)),
        animate(titleX, -timing.withdrawPx, uiTransition(timing.exitMs))];
      void Promise.all(controls).then(() => {
        if (!active) return;
        archiveDirection.current = { displayed: latestTarget.current, exiting: false };
        setDisplayed(latestTarget.current);
      });
      return () => { active = false; controls.forEach(control => control.stop()); };
    }
    if (archive && (archiveDirection.current.displayed !== displayed || archiveDirection.current.exiting !== exiting)) {
      // Reset only after the new tree/direction has committed. Resetting in the
      // exit promise repaints the still-mounted outgoing archive at full opacity.
      archiveTime.set(0);
    }
    archiveDirection.current = { displayed, exiting };
    if (!awaitingArchive && !exiting && (isHome ? homeTime.get() === timing.homeMs : (archive ? archiveTime.get() === 1 && modeOpacity.get() === 1 : opacity.get() === 1) && titleX.get() === 0 && titleOpacity.get() === 1)) {
      setPhase("ready"); return;
    }
    let current = true;
    setPhase(exiting ? "leaving" : "entering");
    const returningMode = archive && !exiting && modeOpacity.get() < 1;
    const transition = uiTransition(exiting ? timing.exitMs : timing.enterMs);
    const archiveGoal = awaitingArchive ? motionTokens.saveSlots.railHoldMs / motionTokens.saveSlots.enterMs : 1;
    const controls = isHome
      ? [animate(homeTime, exiting ? 0 : timing.homeMs, {
          duration: Math.abs((exiting ? 0 : timing.homeMs) - homeTime.get()) / timing.homeMs
            * (exiting ? timing.homeExitMs : timing.homeMs) / 1000, ease: "linear",
        })]
      : [archive ? animate(archiveTime, archiveGoal, { duration: Math.abs(archiveGoal - archiveTime.get()) * (exiting ? motionTokens.saveSlots.exitMs : motionTokens.saveSlots.enterMs) / 1000, ease: "linear" })
          : animate(opacity, exiting ? 0 : 1, { duration: Math.abs((exiting ? 0 : 1) - opacity.get()) * (exiting ? motionTokens.settingsPanel.exitMs : motionTokens.settingsPanel.enterMs) / 1000, ease: "linear" }),
         animate(titleOpacity, exiting ? 0 : 1, transition),
         animate(titleX, exiting ? -timing.withdrawPx : 0, transition)];
    if (returningMode) controls.push(animate(modeOpacity, 1, { duration: motionTokens.saveSlots.modeInMs / 1000, ease: "linear" }));
    void Promise.all(controls).then(() => {
      if (!current) return;
      if (exiting) {
        // Prime the new tree before it mounts; no visible empty frame or flash.
        homeTime.set(0); modeOpacity.set(1); setArchiveReady(!waitForArchive); opacity.set(0); titleX.set(-timing.withdrawPx); titleOpacity.set(0);
        setDisplayed(latestTarget.current);
      } else if (!awaitingArchive) setPhase("ready");
    });
    return () => { current = false; controls.forEach(control => control.stop()); };
  }, [exiting, displayed, modeChanging, reduced, hidden, homeTime, opacity, titleOpacity, titleX, archiveTime, modeOpacity, archive, awaitingArchive, waitForArchive]);
  return { target, displayed, phase, opacity, titleOpacity, titleX, request, transitioning: phase !== "ready" || exiting,
    settingsMotion: { clock: opacity, exiting: displayed === "settings" && exiting, skip: reduced || hidden },
    archiveMotion: { clock: archiveTime, modeOpacity, exiting: archive && sceneExiting, skip: reduced || hidden, onReady: setArchiveReady } };
}
