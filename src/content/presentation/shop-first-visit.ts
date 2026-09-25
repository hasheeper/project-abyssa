import source from "./scenes/shop-first-visit.json";
import { parseAvgStory } from "../../shared/domain/avg/story";
import { avgFrameLine } from "../../shared/domain/avg/playback";
import { shopLootPresentation, type ShopLootPresentation } from "./shop-loot";
import type { ShopDialogueLine } from "./shop-dialogue";

export const SHOP_FIRST_VISIT = parseAvgStory(source);
const section = (id: string) => SHOP_FIRST_VISIT.nodes.filter(node => node.sectionId === id).flatMap(node => node.kind === "beat" ? node.frames.map(avgFrameLine) : []);
const branch = SHOP_FIRST_VISIT.nodes.find(node => node.kind === "branch")!;
if (branch.kind !== "branch") throw Error("Shop branch missing");
export const shopVisitLines = {
  arrival: section("arrival"), valuation: section("valuation"),
  "reply-A": branch.variants.A.map(avgFrameLine), "reply-B": branch.variants.B.map(avgFrameLine),
  purchase: section("purchase"), departure: section("departure"),
};
export const shopVisitDecision = SHOP_FIRST_VISIT.nodes.find(node => node.kind === "choice")!;
export function firstVisitLines(progress: {phase: string; choice: "A" | "B" | null}) {
  if (progress.phase === "reply") return progress.choice === "A" ? shopVisitLines["reply-A"] : shopVisitLines["reply-B"];
  if (progress.phase === "arrival" || progress.phase === "valuation" || progress.phase === "purchase" || progress.phase === "departure") return shopVisitLines[progress.phase];
  throw Error(`Shop transaction has no reading cursor: ${progress.phase}`);
}
export function firstVisitReading(progress: {phase: string; step: number; choice: "A" | "B" | null}) {
  const phases = ["arrival", "valuation", "reply", "purchase", "departure"];
  const previous = phases.slice(0, phases.indexOf(progress.phase)).flatMap(phase => firstVisitLines({...progress, phase}));
  return {lines: [...previous, ...firstVisitLines(progress)], cursor: previous.length + progress.step};
}
export const shopVisitAssetsLines = Object.values(shopVisitLines).flat();
export function visitSpeech(sectionId: keyof typeof shopVisitLines, index: number): ShopDialogueLine {
  const line = shopVisitLines[sectionId][index];
  return {text: line.text, emotion: ("emotion" in line ? line.emotion ?? "neutral" : "neutral") as ShopDialogueLine["emotion"]};
}

/** Authored first-visit instances keep their matching descriptions and appraisal
 * transcript after the player returns to the ordinary counter. */
export function presentShopLoot(item: {definitionId: string; shopVisitOffer?: 1; sampled?: true}): ShopLootPresentation {
  const original = shopLootPresentation[item.definitionId];
  if (!item.shopVisitOffer) return original;
  if (item.definitionId === "loot.tutorial.barrier-nail") return {...original, unknownName: "锈蚀黑钉",
    description: shopVisitLines.valuation[1].text, appearance: shopVisitLines.arrival[23].text,
    appraisal: [visitSpeech("valuation", 0), visitSpeech("valuation", 1), visitSpeech("valuation", 3)],
    teaser: visitSpeech("arrival", 29), sold: visitSpeech("reply-A", 1), kept: visitSpeech("reply-B", 1)};
  if (item.definitionId === "loot.tutorial.cross-coins") return {...original, quantity: item.sampled ? 11 : 12,
    appearance: shopVisitLines.arrival[23].text, description: item.sampled ? shopVisitLines.valuation[9].text : original.appearance,
    offer: item.sampled ? visitSpeech("valuation", 9) : visitSpeech("valuation", 6), sold: visitSpeech("reply-A", 1)};
  if (item.definitionId === "loot.tutorial.candle-token") return {...original, offer: visitSpeech("valuation", 13), sold: visitSpeech("reply-A", 1)};
  if (item.definitionId === "loot.tutorial.black-bread") return {...original, refusal: visitSpeech("arrival", 20)};
  return original;
}
