import type { GameFact, GameRecord } from "./contracts";

/** Player history is separate from the single-commit, actor-scoped AI projection. */
export function projectPlayerHistory(record: GameRecord, expeditionId: string): GameFact[] {
  const withdrawn = new Set(record.retractedFactIds);
  return record.facts.filter(f =>
    f.source.saveId === record.head.saveId && f.source.epoch === record.head.epoch &&
    f.source.revision <= record.head.revision && f.expeditionId === expeditionId &&
    f.origin !== "simulation" && !withdrawn.has(f.id) &&
    (f.visibility.type === "player" || (f.visibility.type === "party" && f.visibility.actorIds.length > 0))
  ).map(f => structuredClone(f));
}
