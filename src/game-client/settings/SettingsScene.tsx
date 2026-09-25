import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, useMotionValue, usePresence } from "motion/react";
import { SystemSceneFrame } from "../SystemSceneFrame";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { SettingsPanel } from "./SettingsPanel";
import { settingsSceneVisibility, settingsTiming } from "./settings-motion";

type Props = { open: boolean; onClose: () => void; onPresentChange?: (present: boolean) => void; onExited?: () => void; onBackdropTextureChange?: (enabled: boolean) => void; initialTab?: "performance" | "display" | "ai" | "about" };
export function SettingsScene(props: Props) {
  return <AnimatePresence onExitComplete={props.onExited}>{props.open && <PresentedSettings key="settings" {...props} />}</AnimatePresence>;
}

function PresentedSettings({ onClose, onPresentChange, onBackdropTextureChange, initialTab }: Props) {
  const [present, remove] = usePresence(), { reduced } = useUiMotion();
  const [hidden, setHidden] = useState(() => document.hidden), [settled, setSettled] = useState(false);
  const root = useRef<HTMLDivElement>(null), clock = useMotionValue(0);
  const skip = reduced || hidden;
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useLayoutEffect(() => {
    const update = (reveal: number) => {
      const value = skip ? Number(present) : reveal;
      root.current?.style.setProperty("--system-scene-surface", String(settingsSceneVisibility(value, "surface")));
      root.current?.style.setProperty("--system-scene-heading", String(settingsSceneVisibility(value, "heading")));
    };
    update(clock.get());
    return clock.on("change", update);
  }, [clock, present, skip]);
  useLayoutEffect(() => {
    let active = true;
    setSettled(false);
    const goal = Number(present);
    const control = animate(clock, goal, { duration: skip ? 0 : Math.abs(goal - clock.get()) * (present ? settingsTiming.enterMs : settingsTiming.exitMs) / 1000, ease: "linear" });
    void control.then(() => { if (active) { if (present) setSettled(true); else remove?.(); } });
    return () => { active = false; control.stop(); };
  }, [clock, present, skip, remove]);
  return <SystemSceneFrame root={root} className="settings-scene" title="系统设置" present={present} interactive={settled} reduced={skip}
    onClose={onClose} onPresentChange={onPresentChange}>
    <SettingsPanel fullScene initialTab={initialTab} onBack={onClose} onBackdropTextureChange={onBackdropTextureChange} sceneMotion={{ clock, exiting: !present, skip }} />
  </SystemSceneFrame>;
}
