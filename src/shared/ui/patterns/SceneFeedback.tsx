import { useMoney } from "../primitives/Money";
import { useContext, useId, useLayoutEffect, useState } from "react";
import { FeedbackDockContext } from "./feedback/FeedbackDockContext";
import { AnimatePresence, animate, motion, useMotionValue, usePresence } from "motion/react";
import { cx } from "../../lib/cx";
import { useUiMotion } from "../motion/UiMotionProvider";
import { motionTokens } from "../motion/presets";
import { feedbackOffset, feedbackTransition } from "./feedback/feedback-motion";
import { EventResult, FeedbackNotice, RewardNotice, feedbackAnnouncement } from "./feedback/FeedbackViews";
import { useFeedbackLifetime } from "./feedback/useFeedbackLifetime";
import type { SceneFeedbackEntry, SceneFeedbackProps } from "./feedback/types";

export { EventResult, FeedbackNotice, RewardNotice, InlineFeedback, FeedbackActionButton } from "./feedback/FeedbackViews";
export type { EventResultProps, FeedbackNoticeProps, RewardNoticeProps, FeedbackReward, FeedbackTone, FeedbackErrorDetails, InlineFeedbackProps, SceneFeedbackEntry, SceneFeedbackProps } from "./feedback/types";

const timings = motionTokens.feedback;

function PresentedFeedback({ entry, paused, edge, onDismiss, stacked }: {
  entry: SceneFeedbackEntry;
  paused: boolean;
  edge: NonNullable<SceneFeedbackProps["edge"]>;
  onDismiss: SceneFeedbackProps["onDismiss"];
  stacked: boolean;
}) {
  const money = useMoney();
  const [present, safeToRemove] = usePresence();
  const { reduced } = useUiMotion();
  const [ready, setReady] = useState(false);
  const result = entry.kind === "result";
  const [origin] = useState(edge);
  const opacity = useMotionValue(0);
  const translate = useMotionValue(reduced ? "0px 0px" : feedbackOffset(origin, timings.distancePx));
  useLayoutEffect(() => {
    let current = true;
    if (reduced) translate.jump("0px 0px");
    const transition = feedbackTransition(result, present, reduced);
    const fade = animate(opacity, present ? 1 : 0, transition);
    const move = animate(translate, present || reduced ? "0px 0px" : feedbackOffset(origin, timings.exitDistancePx), transition);
    Promise.all([fade, move]).then(() => {
      if (!current) return;
      if (present) setReady(true); else safeToRemove?.();
    });
    return () => { current = false; fade.stop(); move.stop(); };
  }, [present, reduced, result, origin, opacity, translate, safeToRemove]);
  const defaultDuration = result ? timings.resultDwellMs : timings.noticeDwellMs;
  const duration = entry.durationMs === null ? null
    : Number.isFinite(entry.durationMs) ? Math.max(0, entry.durationMs!) : defaultDuration;
  useFeedbackLifetime({ durationMs: duration, ready, paused: paused || !present, onElapsed: () => onDismiss(entry.id) });

  return <motion.div className="scene-feedback__presentation" data-kind={entry.kind} data-present={present}
    data-edge={origin} data-ui-motion={reduced ? "reduced" : "full"} style={{ opacity, translate }}
    layout={stacked && !reduced ? "position" : false} transition={{layout: feedbackTransition(false, true, reduced)}}>
    {/* This region is mounted empty before entry; exiting visuals are never re-announced. */}
    <span className="scene-feedback__announcement" role="status" aria-atomic="true">{ready && present && !paused ? feedbackAnnouncement(entry, money.scale) : ""}</span>
    <div aria-hidden="true">
      {entry.kind === "notice" ? <FeedbackNotice message={entry.message} tone={entry.tone} />
        : entry.kind === "reward" ? <RewardNotice reward={entry.reward} />
        : <EventResult title={entry.title} label={entry.label} description={entry.description} rewards={entry.rewards} />}
    </div>
  </motion.div>;
}

/** No portal, viewport anchor, focus/keyboard capture, scrim or business writes. */
export function SceneFeedback({ entry, entries, onDismiss, paused = false, edge = "top", className, style, dock = false }: SceneFeedbackProps) {
  const report = useContext(FeedbackDockContext), dockId = useId();
  const stacked = entries !== undefined;
  const visible = entries ?? (entry ? [entry] : []);
  useLayoutEffect(() => { if (dock && report) report(dockId, { entries: visible.filter(item=>item.kind!=="result"), paused, dismiss: onDismiss }); }, [dock, report, dockId, entry, entries, onDismiss, paused]);
  useLayoutEffect(() => () => { if (dock && report) report(dockId, null); }, [dock, report, dockId]);
  const local = dock && report ? visible.filter(item=>item.kind==="result") : visible;
  if (dock && report && !local.length) return null;
  return <div className={cx("scene-feedback", className)} data-stacked={stacked || undefined} style={style}>
    <AnimatePresence mode={stacked ? "sync" : "wait"}>
      {local.map(item => <PresentedFeedback key={item.id} entry={item} paused={paused} edge={edge} onDismiss={onDismiss} stacked={stacked} />)}
    </AnimatePresence>
  </div>;
}
