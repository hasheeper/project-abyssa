import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, useMotionValue, usePresence } from "motion/react";
import { useUiMotion } from "../shared/ui/motion/UiMotionProvider";
import { ArchiveOverlayScope } from "./ArchiveFeedback";
import { SystemSceneFrame } from "./SystemSceneFrame";
import { SaveSlotsPanel } from "./SaveSlotsPanel";
import { slotSceneProgress, slotTiming } from "./save-slots-motion";
import type { ManualSaveAttempt } from "./manual-save";

type Props = {
  open: boolean;
  onClose: () => void;
  onExited: () => void;
  navigate: (href: string) => void;
} & ({ mode: "save"; attempt: ManualSaveAttempt; ready: boolean } | { mode: "load" });

/** The same slot choreography as the menu, hosted over the current Stage. */
export function SaveSlotsScene(props: Props) {
  return <AnimatePresence onExitComplete={props.onExited}>{props.open && <PresentedSlots key={props.mode} {...props} />}</AnimatePresence>;
}

function PresentedSlots(props: Props) {
  const [present, remove] = usePresence(), { reduced } = useUiMotion();
  const [hidden, setHidden] = useState(() => document.hidden);
  const [dataReady, setDataReady] = useState(false), [settled, setSettled] = useState(false);
  const root = useRef<HTMLDivElement>(null), clock = useMotionValue(0);
  const busy = useRef(false), paint = useRef(0);
  const skip = reduced || hidden;
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useLayoutEffect(() => {
    const start = paint.current;
    clock.set(0);
    const update = (value: number) => {
      paint.current = start + (Number(present) - start) * (skip ? 1 : slotSceneProgress(value, !present, "surface"));
      root.current?.style.setProperty("--system-scene-surface", String(paint.current));
      root.current?.style.setProperty("--system-scene-heading", String(paint.current));
    };
    update(0);
    return clock.on("change", update);
  }, [clock, present, skip]);
  useLayoutEffect(() => {
    const goal = present && !dataReady && !skip ? slotTiming.railHoldMs / slotTiming.enterMs : 1;
    let active = true;
    setSettled(false);
    const control = animate(clock, goal, { duration: skip ? 0 : (present ? slotTiming.enterMs : slotTiming.exitMs) * Math.max(0, goal - clock.get()) / 1000, ease: "linear" });
    void control.then(() => { if (active) { if (!present) remove?.(); else if (goal === 1) setSettled(true); } });
    return () => { active = false; control.stop(); };
  }, [clock, present, skip, dataReady, remove]);
  const close = () => { if (!busy.current) props.onClose(); };
  return <ArchiveOverlayScope><SystemSceneFrame root={root} className="save-slots-scene" title={props.mode === "save" ? "保存档案" : "读取档案"}
    present={present} interactive={settled} reduced={skip} onClose={close}>
    <SaveSlotsPanel {...(props.mode === "save" ? {mode: "save", attempt: props.attempt, ready: props.ready} : {mode: "load"})}
      fullScene returnLabel="返回游戏" onClose={close} navigate={props.navigate} onBusyChange={value => { busy.current = value; }}
      sceneMotion={{clock, exiting: !present, skip, onReady: setDataReady}} />
  </SystemSceneFrame></ArchiveOverlayScope>;
}
