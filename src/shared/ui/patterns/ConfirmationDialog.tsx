import { useId, type RefObject, type ReactNode } from "react";
import { motion } from "motion/react";
import { cx } from "../../lib/cx";
import { UiModal } from "../motion/UiModal";
import { useUiMotion } from "../motion/UiMotionProvider";
import { confirmationTransition } from "../motion/confirmation-motion";
import { DiamondWatermark } from "../primitives/DiamondWatermark";
import { RpgShapeButton } from "../primitives/RpgShapeButton";
import "../styles/components-foundation.css";
import "../styles/components-controls.css";
import "../styles/motion-controls.css";
import "../styles/items.css";
import "../styles/scene-feedback.css";
import "../styles/confirmation-dialog.css";

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  /** Brief consequence of confirming; plain text, not raw API diagnostics. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Host-owned request state. Set synchronously when accepting confirmation. */
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onPresentChange?: (present: boolean) => void;
  className?: string;
  /** Persistent operation error, shown inside the existing content layer. */
  children?: ReactNode;
}

/** A deliberate choice, not a timed notice. Keep mounted and control `open`.
 * UiModal retains focus/input ownership through the full exit, inside Stage. */
export function ConfirmationDialog({ open, title, description, confirmLabel = "确认", cancelLabel = "取消",
  tone = "default", busy = false, busyLabel = "处理中…", onConfirm, onCancel,
  returnFocusRef, onPresentChange, className, children }: ConfirmationDialogProps) {
  const descriptionId = useId();
  const { reduced } = useUiMotion();
  const cancel = () => { if (!busy) onCancel(); };
  return <UiModal open={open} title={title} describedBy={descriptionId} onClose={cancel}
    motionPreset="confirmation"
    className="confirmation-dialog" panelClassName={cx("confirmation-dialog__panel", className)}
    dismissOnBackdrop={false} dismissOnEscape={!busy} returnFocusRef={returnFocusRef} onPresentChange={onPresentChange}>
    {present => <><div className="scene-feedback__surface confirmation-dialog__surface" data-tone={tone} aria-busy={busy}>
      <motion.div className="scene-feedback__surface confirmation-dialog__backing" aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("surface", present, reduced)}>
        <DiamondWatermark className="scene-feedback__texture" size={36} outerFill="currentColor" innerFill="currentColor" outerOpacity={0.025} innerOpacity={0.015} />
      </motion.div>
      <motion.div className="confirmation-dialog__crest" aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("surface", present, reduced)}><i /></motion.div>
      <motion.div className="confirmation-dialog__content" initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("content", present, reduced)}>
        <h2 className="confirmation-dialog__title">{title}</h2>
        <p className="confirmation-dialog__description" id={descriptionId}>{description}</p>
        {children}
      </motion.div>
      <div className="confirmation-dialog__actions">
        {/* Safe first focus; no autoFocus or form-wide Enter-to-confirm. aria-disabled
            keeps the focused control in the trap while the host is submitting. */}
        <motion.div className="confirmation-dialog__action" data-action="cancel" initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("action", present, reduced, 0)}>
        <RpgShapeButton className="scene-feedback__action confirmation-dialog__cancel" shape="chamfer" label={cancelLabel}
          watermark={{ outerOpacity: 0.2, innerOpacity: 0.08 }} aria-disabled={busy} onClick={cancel}>
          <span>{cancelLabel}</span>
        </RpgShapeButton>
        </motion.div>
        <motion.div className="confirmation-dialog__action" data-action="confirm" initial={{ opacity: 0 }} animate={{ opacity: present ? 1 : 0 }} transition={confirmationTransition("action", present, reduced, 1)}>
        <RpgShapeButton className="scene-feedback__action confirmation-dialog__confirm" shape="chamfer" label={busy ? busyLabel : confirmLabel}
          watermark={{ outerOpacity: 0.2, innerOpacity: 0.08 }} aria-disabled={busy} onClick={() => { if (!busy) onConfirm(); }}>
          <span>{busy ? busyLabel : confirmLabel}</span>
        </RpgShapeButton>
        </motion.div>
      </div>
    </div>
    <span className="scene-feedback__announcement" role="status" aria-atomic="true">{busy && present ? busyLabel : ""}</span></>}
  </UiModal>;
}
