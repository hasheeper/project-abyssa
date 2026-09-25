import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, useMotionValue, usePresence } from "motion/react";
import { SaveArchivePanel } from "../../game-client/SaveArchive";
import { ArchiveOverlayScope } from "../../game-client/ArchiveFeedback";
import { slotSceneProgress, slotTiming } from "../../game-client/save-slots-motion";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { SystemSceneFrame } from "../../game-client/SystemSceneFrame";
import type { useTitleArchive } from "./useTitleArchive";
import "./title-archive.css";

type Props = { archive: ReturnType<typeof useTitleArchive>; onNewGame?: () => void; onPresentChange: (present: boolean) => void };
export function TitleArchive(props: Props) {
  const startAfterExit = useRef(false);
  return <AnimatePresence onExitComplete={() => {
    if (startAfterExit.current) { startAfterExit.current = false; props.onNewGame?.(); }
  }}>{props.archive.open && <ArchiveScene key="archive" {...props} onNewGame={props.onNewGame ? () => {
    startAfterExit.current = true; props.archive.setOpen(false);
  } : undefined} />}</AnimatePresence>;
}

/** Full Stage view, with modal input ownership but no window/scrim animation preset. */
function ArchiveScene({ archive, onNewGame, onPresentChange }: Props) {
  const [present, remove] = usePresence(), { reduced } = useUiMotion();
  const [hidden, setHidden] = useState(() => document.hidden);
  const [dataReady, setDataReady] = useState(archive.listState !== "loading");
  const [settled, setSettled] = useState(false);
  const clock = useMotionValue(0), root = useRef<HTMLDivElement>(null);
  const paint = useRef({ surface: 0, heading: 0 });
  const skip = reduced || hidden;
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useLayoutEffect(() => {
    const start = { ...paint.current }, exiting = !present;
    clock.set(0);
    const update = (value: number) => {
      const progress = skip ? 1 : slotSceneProgress(value, exiting, "surface");
      const goal = present ? 1 : 0;
      paint.current = { surface: start.surface + (goal - start.surface) * progress,
        heading: start.heading + (goal - start.heading) * progress };
      root.current?.style.setProperty("--system-scene-surface", String(paint.current.surface));
      root.current?.style.setProperty("--system-scene-heading", String(paint.current.heading));
    };
    update(0);
    return clock.on("change", update);
  }, [present, skip, clock]);
  useLayoutEffect(() => {
    // Hold on the already-open light rails while the directory is being read.
    const goal = present && !dataReady && !skip ? slotTiming.railHoldMs / slotTiming.enterMs : 1;
    let active = true;
    setSettled(false);
    const control = animate(clock, goal, { duration: skip ? 0 : (present ? slotTiming.enterMs : slotTiming.exitMs) * Math.max(0, goal - clock.get()) / 1000, ease: "linear" });
    void control.then(() => { if (active) { if (!present) remove?.(); else if (goal === 1) setSettled(true); } });
    return () => { active = false; control.stop(); };
  }, [present, skip, clock, remove, dataReady]);
  return <ArchiveOverlayScope><SystemSceneFrame root={root} className="title-archive" title="读取档案" present={present} interactive={settled} reduced={skip}
    onClose={() => { if (!archive.busy) archive.setOpen(false); }} onPresentChange={onPresentChange}>
    <SaveArchivePanel archive={archive} onNewGame={onNewGame} sceneMotion={{ clock, exiting: !present, skip, onReady: setDataReady }} />
  </SystemSceneFrame></ArchiveOverlayScope>;
}
