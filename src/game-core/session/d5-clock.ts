import type { D5Projection } from "./d5-types";

export const CAMPAIGN_PHASES = ["dawn", "day", "dusk", "night"] as const;
export function campaignPhaseIndex(clock: D5Projection["clock"]) {
  return (clock.day - 1) * 4 + CAMPAIGN_PHASES.indexOf(clock.phase);
}
export function nextCampaignClock(clock: D5Projection["clock"]): D5Projection["clock"] {
  const next = campaignPhaseIndex(clock) + 1;
  return { day: 1 + Math.floor(next / 4), phase: CAMPAIGN_PHASES[next % 4] };
}
/** Shared by durable replay and UI eligibility. Narrative locks are checked by
 * the narrative reducer, which owns that separate part of the record. */
export function mansionTimeBlock(c: D5Projection): string | null {
  if (c.prologue?.status === "playing" || c.opening?.status === "playing") return "请先完成当前剧情";
  if (c.tutorial?.status === "pending" || c.tutorial?.status === "active") return "请先完成初次远征";
  if (c.activeRunRef) return "请先结束当前远征或回忆";
  if (c.activeStoryId || c.manor.story?.status === "pending") return "请先完成或暂缓当前交谈";
  return null;
}
