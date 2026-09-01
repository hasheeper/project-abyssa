import type { IdleId } from "../../shared/ui/patterns/motions";

export type StudioSeat = "left" | "right";
/** 默认 knee，与 RpScene 的默认取景保持一致。 */
export type StudioCrop = "full" | "upper" | "knee";
export type StudioExportTab = "ts" | "css" | "emote" | "json";

export const STUDIO_CROP_LABELS: Record<StudioCrop, string> = {
  knee: "中距离",
  upper: "近距离",
  full: "全身"
};

export interface StudioSeatState {
  characterId: string;
  expression: string;
  /** 是否处于说话中；决定立绘高度与明暗。 */
  active: boolean;
  /** 持续状态；多个状态共用 actor-idle 的 transform，因此互斥。 */
  idle: IdleId;
  /** 当前席位上的漫符。 */
  emote: string | null;
}
