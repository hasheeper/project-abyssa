import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, usePresence } from "motion/react";
import { cx } from "../../lib/cx";
import { manorWindowMotion, manorWindowTransition, motionTokens, surfaceTransition, uiTransition } from "./presets";
import { useUiMotion } from "./UiMotionProvider";
import { confirmationTransition } from "./confirmation-motion";
import { modalFocusables, useModalPresentation } from "../primitives/useModalPresentation";
import "./modal-tokens.css";
import "./modal-motion.css";

/** Internal behavior/presentation boundary. Callers retain their own artwork. */
export interface UiModalProps {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode | ((present: boolean) => ReactNode);
  /** Decorative scene between the surrounding scrim and the content panel.
   * Its exit stays within this modal's presence lifetime. */
  backdrop?: (present: boolean) => ReactNode;
  className?: string; panelClassName?: string; side?: "right";
  dismissOnBackdrop?: boolean; dismissOnEscape?: boolean;
  describedBy?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onPresentChange?: (present: boolean) => void;
  motionPreset?: "surface" | "manor" | "confirmation";
}
export function UiModal(props: UiModalProps) {
  return <AnimatePresence>{props.open && <PresentedModal key="surface" {...props}/>}</AnimatePresence>;
}
function PresentedModal({ onClose, title, children, backdrop, className, panelClassName, side,
  dismissOnBackdrop = true, dismissOnEscape = true, describedBy, returnFocusRef, onPresentChange, motionPreset = "surface" }: UiModalProps) {
  const [present, safeToRemove] = usePresence();
  const { reduced } = useUiMotion();
  const opacity = useMotionValue(0);
  const manor = motionPreset === "manor";
  const confirmation = motionPreset === "confirmation";
  const layered = manor || confirmation;
  const panelOpacity = useMotionValue(0);
  const offset = confirmation ? "0px 0px" : manor ? `0px -${manorWindowMotion.distancePx}px` : side === "right" ? `${motionTokens.surface.distancePx}px 0px` : `0px ${motionTokens.surface.distancePx}px`;
  const translate = useMotionValue(reduced ? "0px 0px" : offset);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalPresentation(panelRef, rootRef, present, returnFocusRef, onPresentChange);

  useLayoutEffect(() => {
    // Motion owns presence and interpolation. Preference changes interrupt the
    // active animations too, including an exit already in progress.
    let current = true;
    if (reduced) translate.jump("0px 0px");
    const transition = manor ? manorWindowTransition(reduced, !present) : surfaceTransition(reduced, !present);
    const fade = animate(opacity, present ? 1 : 0, confirmation ? confirmationTransition("scrim", present, reduced)
      : manor ? uiTransition(reduced ? motionTokens.surface.reducedMs : manorWindowMotion.scrimMs) : transition);
    const move = animate(translate, present || reduced ? "0px 0px" : manor ? `0px -${manorWindowMotion.exitDistancePx}px` : offset, transition);
    const ink = manor ? animate(panelOpacity, present ? 1 : 0, uiTransition(reduced ? motionTokens.surface.reducedMs : present ? manorWindowMotion.fadeMs : manorWindowMotion.exitMs)) : null;
    if (manor && panelRef.current) panelRef.current.style.willChange = "opacity, translate";
    Promise.all([fade, move, ink]).then(() => {
      if (!current) return;
      if (manor && panelRef.current) panelRef.current.style.willChange = "auto";
      if (!present) safeToRemove?.();
    });
    return () => { current = false; fade.stop(); move.stop(); ink?.stop(); };
  }, [present, reduced, offset, opacity, translate, panelOpacity, manor, confirmation, safeToRemove]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (!present) { event.preventDefault(); return; }
      if (event.key === "Escape" && dismissOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = modalFocusables(panel);
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      // 真正的环形陷阱:只在两端接管,中间交给浏览器原生顺序。
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      }
    },
    [dismissOnEscape, onClose, present]
  );


  return <motion.div ref={rootRef} className={cx("abyssa-modal", className)}
    data-open={present ? "true" : "false"} data-ui-modal-present="" data-ui-motion-preset={motionPreset}
    data-ui-motion={reduced ? "reduced" : "full"} style={{ opacity: layered ? undefined : opacity }}
    onMouseDown={event => { if (present && dismissOnBackdrop && event.target === event.currentTarget) onClose(); }}>
    {layered && <motion.div className="abyssa-modal__scrim" aria-hidden="true" style={{opacity}}/>}
    {backdrop?.(present)}
    <motion.div ref={panelRef} className={cx("abyssa-modal__panel", panelClassName)} role="dialog"
      aria-modal="true" aria-label={title} aria-describedby={describedBy} tabIndex={-1} onKeyDown={handleKeyDown} style={{ translate, opacity: manor ? panelOpacity : undefined }}>
      {typeof children === "function" ? children(present) : children}
    </motion.div>
  </motion.div>;
}
