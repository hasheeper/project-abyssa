import { airpPhaseIndex } from "../../game-core/session";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import type { AirpReplayInput } from "../versions/airp-boundary";
import type { DirectorSource } from "./contracts";

/** Public opening history for the day planner and later scenes. The skip receipt
 * grants the same authored premise; it never asserts a player choice or a battle reward. */
export function tutorialMemories(catalog: ValidatedD5Catalog, input: AirpReplayInput): DirectorSource[] {
  if (input.after.openingFlowVersion !== 1 || catalog.ref.contentVersion !== 28 || !catalog.data.tutorial || !catalog.data.opening) return [];
  const sources: DirectorSource[] = [];
  const party = [...catalog.data.tutorial.partyIds];
  const add = (episode: "departure" | "return", fact: AirpReplayInput["facts"][number], skipped: boolean) => {
    if (sources.some(s => s.id === `opening:${episode}`)) return;
    const text = episode === "departure"
      ? "洋馆清晨，诺玛带来班车被劫的消息，艾比希斯送去修补的旧毛毯也在车上。勇者与四位同伴出发追回失物。"
      : "众人从退潮岩窟找回旧毛毯，并在午餐前回到洋馆，将毛毯交还给艾比希斯。";
    sources.push({id: `opening:${episode}`, phase: airpPhaseIndex(fact.worldTime.day, fact.worldTime.phase), evidenceIds: [fact.id],
      knownBy: [...new Set([...party, "abyssa", ...(episode === "return" ? ["marietta"] : [])])],
      text: skipped ? `${text}（玩家选择跳过教学，此为沿用的开局经历，不包含玩家分支选择或额外奖励。）` : text});
  };
  for (const fact of input.facts) {
    if (input.retracted.includes(fact.id) || fact.kind !== "progression") continue;
    const e = fact.payload;
    if (e.type === "opening-advanced" && e.step === catalog.data.opening.lastStep) add("departure", fact, false);
    if (e.type === "expedition-settled" && e.terminal.routeId === catalog.data.tutorial.routeId && e.terminal.outcome === "cleared") add("return", fact, false);
    if (e.type === "game-start-selected" && ["tutorial", "hub", "debug-shop", "airp-director"].includes(e.startAt)) {
      add("departure", fact, true);
      if (e.startAt !== "tutorial") add("return", fact, true);
    }
  }
  return sources;
}
