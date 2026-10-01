import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Stage } from "../shared/stage";
import "./game-system-menu.css";
const LayerDepth = createContext(0);

/** Share the system menu's Stage-level layer. Never inherit a window's
 * transform, scrolling, width, or descendant control styles. Keep active
 * through the hosted modal's exit animation, then release the hit area. */
export function SceneLayer({active, anchor, children, className}: {active: boolean; anchor?: Element | null; children: ReactNode; className?: string}) {
  const depth = useContext(LayerDepth);
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
    <LayerDepth.Provider value={depth + 1}><div className={`game-system-layer ${className ?? ""}`}
      style={{ ...(!host ? {position: "fixed" as const} : {}), ...(depth ? {zIndex: 1000 + depth} : {}) }}>
      {host ? children : <Stage>{children}</Stage>}
    </div></LayerDepth.Provider>, host ?? document.body,
  )}</>;
}
