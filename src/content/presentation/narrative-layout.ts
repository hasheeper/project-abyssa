/** Program-owned composition metadata. Original AVG nodes and saved cursors remain unchanged. */
export type { AvgFrame, AvgStageCue } from "../../shared/domain/avg/story";
export { deriveStageSlots } from "../../shared/domain/presentation/stage-slots";
export type NarrativeMarker = {
  eventDefinitionId?: string; actId: string; actTitle: string; sliceId: string;
  phaseLabel?: string; surface?: "adv" | "counter" | "text"; complete?: boolean;
  actDefinitionId?: string; sliceDefinitionId?: string;
};

const morningActs = [
  { through: 6, id: "breakfast", title: "餐桌上的早晨" },
  { through: 10, id: "news", title: "被打断的早餐" },
  { through: 13, id: "departure", title: "动身去雾滩" },
];
export function morningNarrative(section: number): NarrativeMarker {
  const act = morningActs.find(a => section <= a.through)!;
  return { eventDefinitionId: "opening.departure", actId: act.id, actTitle: act.title,
    sliceId: `morning.section.${section}`, surface: "adv" };
}

const tideActs: Record<string, { id: string; title: string }> = {
  "S3-1": { id: "approach", title: "沿退潮道前行" }, "S3-2": { id: "approach", title: "沿退潮道前行" },
  "S3-3": { id: "cargo", title: "岩窟里的货物" }, "S3-4": { id: "cargo", title: "岩窟里的货物" },
  "S3-5": { id: "return", title: "赶在涨潮前返回" },
  "S4-1": { id: "home", title: "物归原主" }, "S4-2": { id: "home", title: "物归原主" },
};
export function tideNarrative(storyId: string, attempt: string, nodeId: string): NarrativeMarker {
  const act = tideActs[storyId];
  if (!act) throw Error(`Missing tutorial narrative composition: ${storyId}`);
  return { eventDefinitionId: "opening.return", actId: `${attempt}:${act.id}`, actTitle: act.title,
    actDefinitionId: act.id, sliceDefinitionId: nodeId, sliceId: `${attempt}:${nodeId}`, surface: "adv" };
}
export const tideActStoryIds = (storyId: string) => Object.keys(tideActs).filter(id => tideActs[id].id === tideActs[storyId]?.id);

export function shopNarrative(phase: string, step = 0): NarrativeMarker {
  const base = { eventDefinitionId: "shop.first-visit", surface: "counter" as const };
  if (phase === "arrival") return { ...base, actId: "loot.opening", actTitle: "进店与开箱",
    sliceId: step < 7 ? "shop.greeting" : step < 19 ? "loot.bag" : step < 24 ? "loot.unpack" : "loot.inspect" };
  if (phase === "appraise" || phase === "valuation" && step < 17) return { ...base, actId: "loot.valuation", actTitle: "鉴别与估价", phaseLabel: "鉴别",
    sliceId: phase === "appraise" || step < 4 ? "nail.appraisal" : step < 12 ? "coins.valuation" : "token.valuation" };
  if (["valuation", "reply", "sell"].includes(phase) || phase === "purchase" && step === 0) return { ...base,
    actId: "nail.disposition", actTitle: "结界钉的去留", phaseLabel: "处置", sliceId: "nail.decision" };
  if (["purchase", "buy"].includes(phase) || phase === "departure" && step === 0) return { ...base,
    actId: "next.supplies", actTitle: "下次出行的补给", sliceId: "next.advice" };
  if (phase === "departure") return { ...base, actId: "shop.message", actTitle: "临走前的托话", sliceId: step < 5 ? "delivery.message" : "shop.farewell" };
  throw Error(`Missing shop narrative composition: ${phase}`);
}
