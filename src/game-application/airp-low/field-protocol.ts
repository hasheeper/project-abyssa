import type { LowExpressions } from "./contracts";

/** Explicit IDs for the formatter, derived from the frozen scene directory only. */
export function lowFieldCatalog(expressions: LowExpressions) {
  return {
    narrator: {speaker: "narrator", emotion: "neutral"},
    commonEmotionIds: Object.keys(expressions.common),
    actors: expressions.actors.map(a => ({speaker: a.id, specialEmotionIds: a.specials})),
    player: {speaker: expressions.player.id, specialEmotionIds: []},
  };
}

/** Presentation metadata cannot invalidate otherwise playable Chinese. No prose inference. */
export function normalizeLowEmotion(raw: unknown, common: LowExpressions["common"], specials: readonly string[], narrator: boolean) {
  if (narrator || typeof raw !== "string") return "neutral";
  const label = raw.trim(), id = label.toLowerCase();
  if (Object.hasOwn(common, label) || specials.includes(label)) return label;
  if (Object.hasOwn(common, id) || specials.includes(id)) return id;
  const matches = Object.entries(common).filter(([, name]) => name === label);
  return matches.length === 1 ? matches[0][0] : "neutral";
}
