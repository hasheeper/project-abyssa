import { useLayoutEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { motionTokens, uiTransition } from "./presets";
import { useUiMotion } from "./UiMotionProvider";

export interface UiContentTransitionProps {
  contentKey: string | number | null;
  children: ReactNode;
  className?: string;
}

/** One live subtree: no duplicate IDs, exit queue, or animation-driven remounts. */
export function UiContentTransition({ contentKey, children, className }: UiContentTransitionProps) {
  const { reduced } = useUiMotion();
  const previous = useRef(contentKey);
  const opacity = useMotionValue(1);
  useLayoutEffect(() => {
    const changed = previous.current !== contentKey;
    previous.current = contentKey;
    if (reduced) { opacity.jump(1); return; }
    if (!changed) return;
    // A rapid replacement continues from the current opacity, never from zero.
    if (opacity.get() >= 0.999) opacity.set(motionTokens.content.fromOpacity);
    const animation = animate(opacity, 1, uiTransition(motionTokens.content.changeMs));
    return () => animation.stop();
  }, [contentKey, reduced, opacity]);
  return <motion.div className={className} data-ui-motion-preset="content" style={{ opacity }}>{children}</motion.div>;
}
