import { useEffect, useRef, useState } from "react";
import { useUiMotion } from "../../ui/motion/UiMotionProvider";

export type ReadingLayout = "adv" | "nvl";

/** Shared two-part handoff. Layout/LOG changes never move a story cursor. */
export function useReadingPresentation(initialLayout: ReadingLayout = "adv") {
  const {reduced} = useUiMotion();
  const [layout, setLayout] = useState(initialLayout), [reading, setReading] = useState(false);
  const [morph, setMorph] = useState<"to-adv" | "to-nvl" | null>(null), [phase, setPhase] = useState<"out" | "in">("out");
  const [switched, setSwitched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), switching = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  function changePresentation(nextLayout: ReadingLayout, nextReading: boolean, onApply?: () => void) {
    if (switching.current) return;
    const wasLog = reading || layout === "nvl", willLog = nextReading || nextLayout === "nvl";
    const apply = () => { setLayout(nextLayout); setReading(nextReading); setSwitched(true); onApply?.(); };
    if (wasLog === willLog) { apply(); return; }
    switching.current = true;
    setMorph(willLog ? "to-nvl" : "to-adv"); setPhase("out");
    const half = reduced ? 0 : 280;
    timer.current = setTimeout(() => {
      apply(); setPhase("in");
      timer.current = setTimeout(() => { setMorph(null); switching.current = false; }, half);
    }, half);
  }
  return {layout, reading, morph, phase, switched, switching, changePresentation};
}
