import type { CSSProperties } from "react";
import type { CurrencyKind } from "../../primitives/CurrencyAmount";
import type { ItemRarity } from "../../items/rarity";

export type FeedbackTone = "info" | "success" | "warning";

export interface FeedbackNoticeProps {
  message: string;
  tone?: FeedbackTone;
  className?: string;
  style?: CSSProperties;
}

export type FeedbackReward =
  | { id: string; kind: "item"; name: string; quantity: number; icon?: string; rarity?: ItemRarity | "unknown" }
  | { id: string; kind: "currency"; currency: CurrencyKind; quantity: number };

export interface RewardNoticeProps {
  reward: FeedbackReward;
  className?: string;
  style?: CSSProperties;
}

export interface EventResultProps {
  title: string;
  /** Optional event category, such as 委托完成 / 获得物品 / 新区域开放. */
  label?: string;
  description?: string;
  rewards?: readonly FeedbackReward[];
  className?: string;
  style?: CSSProperties;
}

export interface FeedbackErrorDetails {
  /** One error occurrence. A new id resets the disclosure to collapsed. */
  id: string;
  /** Plain text, never HTML. Prefer an upstream-sanitized response/error only. */
  raw: string;
  status?: number;
  code?: string;
  requestId?: string;
}

export interface InlineFeedbackProps {
  message: string;
  tone?: "error" | "warning" | "info";
  action?: { label: string; onClick: () => void; disabled?: boolean };
  details?: FeedbackErrorDetails;
  className?: string;
  style?: CSSProperties;
}

/** Stable id identifies one presentation, not an inventory item or a save slot. */
export type SceneFeedbackEntry = { id: string; durationMs?: number | null } & (
  | ({ kind: "notice" } & Omit<FeedbackNoticeProps, "className" | "style">)
  | ({ kind: "reward" } & Omit<RewardNoticeProps, "className" | "style">)
  | ({ kind: "result" } & Omit<EventResultProps, "className" | "style">)
);

export type SceneFeedbackProps = {
  /** Join the current scene's shared task/reward column when a host is present. */
  dock?: boolean;
  /** Clear/advance only the matching entry. This is not a business commit. */
  onDismiss: (id: string) => void;
  /** Suspend the readable lifetime when the host scene is covered. */
  paused?: boolean;
  /** Motion origin only; the host still owns the actual anchor/placement. */
  edge?: "top" | "left" | "right";
  className?: string;
  style?: CSSProperties;
} & (
  | { entry: SceneFeedbackEntry | null; entries?: never }
  /** Ordered top to bottom; each entry keeps its own lifetime. */
  | { entries: readonly SceneFeedbackEntry[]; entry?: never }
);
