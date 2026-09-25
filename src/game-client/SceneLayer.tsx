import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Stage } from "../shared/stage";
import "./game-system-menu.css";

/** Share the system menu's Stage-level layer. Never inherit a window's
 * transform, scrolling, width, or descendant control styles. Keep active
 * through the hosted modal's exit animation, then release the hit area. */
export function SceneLayer({active, anchor, children, className}: {active: boolean; anchor?: Element | null; children: ReactNode; className?: string}) {
  const marker = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const [resolved, setResolved] = useState(false);
  useLayoutEffect(() => {
    if (!active) { setResolved(false); return; }
    const pageStage = [...document.querySelectorAll(".abyssa-stage__canvas")].find(canvas => !canvas.closest(".game-system-layer"));
    setHost((anchor ?? marker.current)?.closest(".abyssa-stage__canvas") ?? pageStage ?? null);
    setResolved(true);
  }, [active, anchor]);
  return <><span ref={marker} hidden/>{active && resolved && createPortal(
    <div className={`game-system-layer ${className ?? ""}`} style={host ? undefined : {position: "fixed"}}>
      {host ? children : <Stage>{children}</Stage>}
    </div>, host ?? document.body,
  )}</>;
}
