import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { loadImage } from "../../shared/loading/images";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

interface Props {
  contentKey: string;
  children: ReactNode;
  imageUrl?: string;
  className: string;
}

/** One live subtree, not an exit queue of duplicate interactive panels. */
export function CharacterContentSwap({ contentKey, children, imageUrl, className }: Props) {
  const { reduced } = useUiMotion();
  const root = useRef<HTMLDivElement>(null);
  const opacity = useMotionValue(1), y = useMotionValue(0);
  const [shown, setShown] = useState({ key: contentKey, children });
  const latest = useRef({ key: contentKey, children });
  const snapshot = useRef(shown);
  const changing = shown.key !== contentKey;

  // Data refreshes for the same identity render immediately and preserve state.
  // Keep the last committed tree only while its replacement is being prepared.
  useLayoutEffect(() => {
    latest.current = { key: contentKey, children };
    if (!changing) snapshot.current = latest.current;
  });

  useLayoutEffect(() => {
    let cancelled = false;
    let frame = 0;
    const controls: ReturnType<typeof animate>[] = [];
    const stop = () => {
      cancelAnimationFrame(frame);
      controls.forEach(control => control.stop());
    };
    const replace = () => {
      if (cancelled) return;
      const panel = root.current?.closest<HTMLElement>('[role="tabpanel"]');
      if (root.current?.contains(document.activeElement)) panel?.focus({ preventScroll: true });
      snapshot.current = latest.current;
      if (shown.key !== latest.current.key) setShown(latest.current);
    };
    const finish = () => {
      stop();
      replace();
      opacity.jump(1); y.jump(0);
    };
    if (reduced || document.hidden) {
      finish();
      return;
    }
    if (shown.key === contentKey) {
      // A -> B -> A can return before B was committed. Restore A, don't queue B.
      if (opacity.get() !== 1 || y.get() !== 0) {
        // Start after the new subtree commits. Starting in replace() spends
        // the animation clock mounting complex dice SVGs and can skip all
        // intermediate frames on a slower device.
        frame = requestAnimationFrame(() => {
          controls.push(animate(opacity, 1, { duration: .2, ease: [.2, .7, .2, 1] }));
          controls.push(animate(y, 0, { duration: .2, ease: [.2, .7, .2, 1] }));
        });
      }
    } else {
      const swap = async () => {
        // Keep the old portrait visible until its replacement has decoded.
        // A rejected image proceeds to the screen's existing error placeholder.
        if (imageUrl) await loadImage(imageUrl).catch(() => undefined);
        if (cancelled) return;
        const outgoing = animate(opacity, 0, { duration: .08, ease: "easeIn" });
        controls.push(outgoing);
        await outgoing;
        if (cancelled) return;
        y.set(10);
        replace();
      };
      void swap();
    }
    const hidden = () => {
      if (!document.hidden) return;
      finish();
      cancelled = true;
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [contentKey, shown.key, imageUrl, reduced, opacity, y]);

  return <motion.div ref={root} className={className}
    data-character-content={shown.key} aria-busy={changing || undefined}
    inert={changing || undefined} style={{ opacity, y }}>
    {changing ? snapshot.current.children : children}
  </motion.div>;
}
