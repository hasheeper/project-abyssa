import type { MemoryRange } from "./memory-range";
import type { MemoryEntry, MemoryJournalData } from "../../game-runtime/memory-journal-types";
export type { MemoryBlock, MemoryEntry, MemoryJournalData } from "../../game-runtime/memory-journal-types";
export const unopenedMemoryJournal: MemoryJournalData = { status: "unavailable" };
export type MemoryMode = "catalogue" | "reading";
export type MemoryOrder = "recent" | "oldest";
export const dayLabel = (day: number | null) => day === null ? "时间未记录" : `第 ${day} 天`;
export const memoryActorLabels = (actors: readonly string[]) => actors.length > 3 ? [`${actors.length}人`] : actors;

export function orderedMemories(entries: readonly MemoryEntry[], range: MemoryRange, order: MemoryOrder) {
  return entries.filter(entry => {
    const days = entry.recordedDays ?? [entry.day];
    return range.kind === "all" || (range.kind === "undated" ? days.some(day => day === null)
      : days.some(day => day !== null && day >= range.from && day <= range.to));
  })
    .sort((a, b) => {
      if (a.day === null || b.day === null) return a.day === b.day ? (order === "recent" ? b.sequence - a.sequence : a.sequence - b.sequence) : a.day === null ? 1 : -1;
      const chronological = a.day - b.day || a.sequence - b.sequence || a.id.localeCompare(b.id);
      return order === "recent" ? -chronological : chronological;
    });
}
