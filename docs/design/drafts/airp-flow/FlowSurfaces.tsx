/**
 * Design handoff adapter, authored by the coordinating agent.
 * Kept outside src: no production route imports this file.
 * Reuses existing modal artwork, timing, buttons and notice rendering.
 */
import { useId, type ReactNode, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";
import { UiModal } from "../../../../src/shared/ui/motion/UiModal";
import { useUiMotion } from "../../../../src/shared/ui/motion/UiMotionProvider";
import { UiContentTransition } from "../../../../src/shared/ui/motion/UiContentTransition";
import { confirmationTransition } from "../../../../src/shared/ui/motion/confirmation-motion";
import { DiamondWatermark } from "../../../../src/shared/ui/primitives/DiamondWatermark";
import { RpgShapeButton } from "../../../../src/shared/ui/primitives/RpgShapeButton";
import { SceneFeedback, type SceneFeedbackEntry } from "../../../../src/shared/ui/patterns/SceneFeedback";
import { feedbackTransition } from "../../../../src/shared/ui/patterns/feedback/feedback-motion";
import { motionTokens } from "../../../../src/shared/ui/motion/presets";
import { flowTone, type FlowAction, type FlowSurfaceActions, type FlowTaskView } from "./contracts";
import "../../../../src/shared/ui/styles/components-foundation.css";
import "../../../../src/shared/ui/styles/components-controls.css";
import "../../../../src/shared/ui/styles/motion-controls.css";
import "../../../../src/shared/ui/styles/items.css";
import "../../../../src/shared/ui/styles/scene-feedback.css";
import "../../../../src/shared/ui/styles/confirmation-dialog.css";
import "./flow-surfaces.css";

type DialogProps = FlowSurfaceActions & {
  open: boolean;
  from?: "center" | "rail";
  exitTo?: "rail" | "reader";
  /** Host retains this view throughout exit; do not conditionally unmount the dialog. */
  task: FlowTaskView;
  /** Required scene information, e.g. commission items; plain sections, no nested panels. */
  children?: ReactNode;
  details?: ReactNode;
  onPresentChange?: (present: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function FlowDialog({ open, from = "center", exitTo = "rail", task, children, details, onMinimize, onAction, onPresentChange, returnFocusRef }: DialogProps) {
  const { reduced } = useUiMotion();
  const statusId = useId();
  const utilities = task.utilities ?? [];
  const overflowUtilities = utilities.slice(2);
  const enterFrom = reduced || from === "center" ? { x: 0, y: 0, scale: 1 } : { x: 16, y: -10, scale: .985 };
  const exitAt = reduced ? { x: 0, y: 0, scale: 1 } : exitTo === "rail" ? { x: 24, y: -16, scale: .985 } : { x: 0, y: 6, scale: 1 };
  const minimize = () => { if (!task.presentationLocked) onMinimize(task.key); };
  const actions: readonly FlowAction[] = [
    task.secondary ?? { id: "minimize", label: "收起", effect: "presentation", enabled: !task.presentationLocked },
    ...(task.primary ? [task.primary] : []),
  ];
  const run = (action: FlowAction) => {
    if (!action.enabled || task.presentationLocked) return;
    if (action.id === "minimize") minimize();
    else onAction(task.key, action);
  };
  const utility = (action: FlowAction, present: boolean) => <button type="button" key={action.id}
    disabled={!present || !action.enabled || task.presentationLocked} onClick={() => run(action)}
    title={!action.enabled ? action.disabledReason : undefined}>{action.label}</button>;
  return <UiModal open={open} title={task.title} describedBy={statusId} onClose={minimize}
    motionPreset="confirmation" className="confirmation-dialog flow-dialog"
    panelClassName="confirmation-dialog__panel flow-dialog__panel"
    dismissOnBackdrop={false} dismissOnEscape={!task.presentationLocked}
    returnFocusRef={returnFocusRef} onPresentChange={onPresentChange}>
    {present => <motion.div className="scene-feedback__surface confirmation-dialog__surface flow-surface" data-tone={flowTone(task.phase)}
      data-phase={task.phase} data-ui-motion={reduced ? "reduced" : "full"}
      initial={enterFrom} animate={present ? { x: 0, y: 0, scale: 1 } : exitAt}
      transition={confirmationTransition("surface", present, reduced)}>
      <motion.div className="scene-feedback__surface confirmation-dialog__backing" aria-hidden="true"
        initial={{opacity: 0}} animate={{opacity: present ? 1 : 0}} transition={confirmationTransition("surface", present, reduced)}>
        <DiamondWatermark className="scene-feedback__texture" size={36} outerFill="currentColor" innerFill="currentColor"
          outerOpacity={0.025} innerOpacity={0.015}/>
      </motion.div>
      <motion.div className="confirmation-dialog__crest" aria-hidden="true"
        initial={{opacity: 0}} animate={{opacity: present ? 1 : 0}} transition={confirmationTransition("surface", present, reduced)}><i/></motion.div>
      <motion.button type="button" className="flow-collapse" aria-label="收起，任务继续保留"
        aria-disabled={!present || task.presentationLocked} onClick={() => { if (present) minimize(); }}
        initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("content", present, reduced)}><i/></motion.button>
      <motion.div initial={{opacity: 0}} animate={{opacity: present ? 1 : 0}} transition={confirmationTransition("content", present, reduced)}>
        <p className="flow-location">{task.location}</p>
        <h2 className="confirmation-dialog__title">{task.title}</h2>
        {task.stages && <ol className="flow-stages" aria-label="当前流程">
          {task.stages.map(stage => <li key={stage.id} data-state={stage.state}
            aria-current={stage.state === "current" ? "step" : undefined}>{stage.label}</li>)}
        </ol>}
        <UiContentTransition className="flow-state-copy" contentKey={task.key + ":" + task.phase + ":" + task.status}>
          <div className="flow-status">
            <p id={statusId} role="status" aria-atomic="true">{present ? task.status : ""}</p>
            {task.elapsed && <time className="flow-elapsed" aria-label="已用时间">{task.elapsed}</time>}
          </div>
          {task.detail && <p className="flow-detail">{task.detail}</p>}
          <span className="flow-track" aria-hidden="true"/>
        </UiContentTransition>
        {children && <div className="flow-context">{children}</div>}
      </motion.div>
      <div className="confirmation-dialog__actions">
        {actions.map((action, index) => <motion.div className="confirmation-dialog__action" data-kind={action === task.primary ? "primary" : "secondary"} key={action.id}
          initial={{opacity: 0}} animate={{opacity: present ? 1 : 0}}
          transition={confirmationTransition("action", present, reduced, index === 0 ? 0 : 1)}>
          <RpgShapeButton shape="chamfer" label={action.label}
            className={"scene-feedback__action " + (index === 0 ? "confirmation-dialog__cancel" : "confirmation-dialog__confirm")}
            aria-disabled={!present || !action.enabled || task.presentationLocked}
            title={!action.enabled ? action.disabledReason : undefined}
            watermark={{outerOpacity: 0.2, innerOpacity: 0.08}}
            onClick={() => { if (present) run(action); }}>
            <span>{action.label}</span>
          </RpgShapeButton>
        </motion.div>)}
      </div>
      {(utilities.length || details) ? <motion.div className="flow-utilities"
        initial={{opacity: 0}} animate={{opacity: present ? 1 : 0}} transition={confirmationTransition("content", present, reduced)}>
        {utilities.slice(0, 2).map(action => utility(action, present))}
        {(details || overflowUtilities.length > 0) && <details className="flow-diagnostics"><summary>{overflowUtilities.length ? "更多" : "详情"}</summary>
          <div><div className="flow-extra-actions">{overflowUtilities.map(action => utility(action, present))}</div>{details}</div>
        </details>}
      </motion.div> : null}
      {!!task.footerActions?.length && <motion.footer className="flow-footer"
        initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("content", present, reduced)}>
        {task.footerActions.map(action => utility(action, present))}
      </motion.footer>}
    </motion.div>}
  </UiModal>;
}

function TaskNotice({ task, onOpen, suspended }: { task: FlowTaskView; onOpen: (key: string) => void; suspended: boolean }) {
  const { reduced } = useUiMotion();
  const present = useIsPresent();
  const reachable = task.entry?.enabled ?? true;
  return <motion.li layout={reduced ? false : "position"} className="flow-task" data-tone={flowTone(task.phase)}
    data-phase={task.phase} data-ui-motion={reduced ? "reduced" : "full"} inert={!present || suspended}
    initial={{opacity: 0, x: reduced ? 0 : motionTokens.feedback.distancePx}}
    animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: reduced ? 0 : motionTokens.feedback.exitDistancePx}}
    transition={feedbackTransition(false, present, reduced)}>
    <div className="scene-feedback__surface flow-task__surface">
      <button type="button" className="flow-task__open" disabled={suspended || !present}
        aria-disabled={!reachable} aria-label={task.title + "，" + task.status + "，" + (task.entry?.label ?? "查看进度")}
        onClick={() => { if (reachable) onOpen(task.key); }}>
        <i className="flow-task__mark" aria-hidden="true"/>
        <div className="flow-task__copy"><strong>{task.title}</strong><UiContentTransition contentKey={task.phase + ":" + task.status}><span>{task.status}</span></UiContentTransition>
          {task.elapsed && <time className="flow-elapsed" aria-label="已用时间">{task.elapsed}</time>}
        </div>
        <span className="flow-task__entry">{task.entry?.label ?? "查看 ›"}</span>
        <span className="flow-track" aria-hidden="true"/>
      </button>
    </div>
  </motion.li>;
}

/** Mount once inside the active Stage. Arrays and their stable IDs come from the task/feedback host. */
export function FlowSideRail({ tasks, feedback, onOpen, onDismissFeedback, onShowAll, announcement, suspended = false }: {
  /** Already excludes the task whose center panel is visible or exiting. */
  tasks: readonly FlowTaskView[];
  /** Up to 3 rewards or terminal notices. Host retains queued events separately. */
  feedback: readonly Extract<SceneFeedbackEntry, { kind: "reward" | "notice" }>[];
  onOpen: (key: string) => void;
  onDismissFeedback: (id: string) => void;
  onShowAll: () => void;
  /** Host emits only real transitions after mount, not every timer tick or save restore. */
  announcement: string;
  suspended?: boolean;
}) {
  const { reduced } = useUiMotion();
  const layoutId = useId();
  const visible = tasks.slice(0, 3);
  return <LayoutGroup id={layoutId}><aside className="flow-side-rail" aria-label="任务与获得提示" inert={suspended}
    data-suspended={suspended} data-has-tasks={tasks.length > 0}>
    <span className="scene-feedback__announcement" role="status" aria-atomic="true">{suspended ? "" : announcement}</span>
    <ol className="flow-task-list" aria-label="后台任务">
      <AnimatePresence>{visible.map(task => <TaskNotice task={task} key={task.key} onOpen={onOpen} suspended={suspended}/>)}</AnimatePresence>
    </ol>
    {tasks.length > visible.length && <motion.button layout={reduced ? false : "position"} type="button" className="flow-task-overflow" onClick={onShowAll}>
      其余 {tasks.length - visible.length} 项进度
    </motion.button>}
    <motion.div className="flow-reward-slot" layout={reduced ? false : "position"}
      transition={{ layout: feedbackTransition(false, true, reduced) }}>
      <SceneFeedback entries={feedback} onDismiss={onDismissFeedback} paused={suspended} edge="right" className="flow-rewards"/>
    </motion.div>
  </aside></LayoutGroup>;
}

/** The overflow entry has an actual destination, using the same centered surface. */
export function FlowInbox({ open, identity, tasks, onClose, onSelect, onPresentChange, returnFocusRef }: {
  open: boolean;
  /** Presentation-only key scoped to the current save/epoch, not a runnable task. */
  identity: string;
  tasks: readonly FlowTaskView[];
  onClose: () => void;
  /** Host closes this inbox fully, then opens the selected task. */
  onSelect: (key: string) => void;
  onPresentChange?: (present: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const view: FlowTaskView = { key: identity, title: "当前进度", location: "行程", phase: "waiting",
    status: tasks.length ? `${tasks.length} 项进度` : "暂无待处理事项" };
  return <FlowDialog open={open} task={view} onMinimize={onClose} onAction={() => {}}
    onPresentChange={onPresentChange} returnFocusRef={returnFocusRef}>
    {tasks.length > 0 && <ul className="flow-inbox">
      {tasks.map(task => <li key={task.key} data-tone={flowTone(task.phase)}>
        <button type="button" aria-disabled={task.entry?.enabled === false} onClick={() => { if (task.entry?.enabled !== false) onSelect(task.key); }}>
          <span><strong>{task.title}</strong><small>{task.location} · {task.status}</small></span><em>{task.entry?.label ?? "查看"}</em>
        </button>
      </li>)}
    </ul>}
  </FlowDialog>;
}
