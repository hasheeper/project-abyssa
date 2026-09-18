export type TutorialSide = "top" | "bottom" | "left" | "right";

/** Copy and anchors are presentation only. The caller owns actual lesson evidence. */
export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  targets: readonly string[];
  /** Visible threat/opportunity context, separate from the current action target. */
  contextTargets?: readonly string[];
  protect?: readonly string[];
  sides?: readonly TutorialSide[];
  action?: {label: string; onSelect: () => void};
  /** Guided steps collapse locally; dismissal must not hide their required action. */
  collapseOnDismiss?: boolean;
  /** An external help entry can reopen the same step without changing game progress. */
  expandKey?: number;
  onDismiss: () => void;
};

export type TutorialRect = {x: number; y: number; width: number; height: number};
