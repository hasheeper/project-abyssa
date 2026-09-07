import type { ValidatedDemoCatalog } from "../contracts/demo";
import * as v from "../contracts/validation";
import type { DemoTerminal } from "./demo-expedition";

export type ManorProgression = {
  takeover: { id: "progress.old-manor.takeover"; terminalId: string; runId: string; rewardId: string; gold: number } | null;
  story: { storyId: string; terminalId: string; step: number; status: "pending" | "viewed" | "skipped" } | null;
};
export const MANOR_STORY_LAST_STEP = 4;
export function validateManorProgression(catalog: ValidatedDemoCatalog, raw: unknown, settlements: DemoTerminal[]): ManorProgression {
  const m = v.record(raw, "campaign.manor", ["takeover", "story"]), spec = catalog.data.manor!;
  const clears = settlements.filter(s => s.routeId === spec.firstClearRouteId && s.outcome === "cleared");
  if (clears.length > 1 || (m.takeover !== null) !== (clears.length === 1)) v.invalid("takeover", "First-clear ledger differs");
  if (m.takeover === null) { if (m.story !== null) v.invalid("story", "No story before takeover"); }
  else {
    const t = v.record(m.takeover, "takeover", ["id", "terminalId", "runId", "rewardId", "gold"]);
    if (t.id !== "progress.old-manor.takeover" || t.terminalId !== clears[0].id || t.runId !== clears[0].runId || t.rewardId !== spec.firstClearReward.id || t.gold !== spec.firstClearReward.gold) v.invalid("takeover", "Unexplained grant");
    const story = v.record(m.story, "story", ["storyId", "terminalId", "step", "status"]);
    if (story.storyId !== spec.storyId || story.terminalId !== t.terminalId) v.invalid("story", "Story has no completion reference");
    v.number(story.step, "story.step", 0, MANOR_STORY_LAST_STEP);
    v.choice(story.status, ["pending", "viewed", "skipped"], "story.status");
    if (story.status !== "pending" && story.step !== MANOR_STORY_LAST_STEP) v.invalid("story", "Incomplete presentation cursor");
  }
  for (const s of settlements) if (s.routeId === spec.maintenanceRouteId && (!clears[0] || settlements.indexOf(s) < settlements.indexOf(clears[0]))) v.invalid("maintenance", "Maintenance predates takeover");
  return raw as ManorProgression;
}
export function applyManorTakeover(catalog: ValidatedDemoCatalog, progression: ManorProgression, result: DemoTerminal) {
  const spec = catalog.data.manor!;
  if (result.routeId !== spec.firstClearRouteId || result.outcome !== "cleared" || progression.takeover) return 0;
  progression.takeover = {id: "progress.old-manor.takeover", terminalId: result.id, runId: result.runId, rewardId: spec.firstClearReward.id, gold: spec.firstClearReward.gold};
  progression.story = {storyId: spec.storyId, terminalId: result.id, step: 0, status: "pending"};
  return spec.firstClearReward.gold;
}
