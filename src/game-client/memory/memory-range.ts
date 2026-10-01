export type MemoryRange = { kind: "all" } | { kind: "days"; from: number; to: number } | { kind: "undated" };
export type DayRange = { from: number; to: number };
export const allMemories: MemoryRange = { kind: "all" };
export const memoryRangeKey = (range: MemoryRange) => range.kind === "days" ? `${range.from}:${range.to}` : range.kind;
export const memoryRangeLabel = (range: MemoryRange) => range.kind === "all" ? "全部经历" : range.kind === "undated" ? "时间未记录"
  : range.from === range.to ? `第 ${range.from} 天` : `第 ${range.from}—${range.to} 天`;
export const rangeDays = (range: MemoryRange, now: number): DayRange => range.kind === "days" ? range : { from: 1, to: now };
export const clampDay = (day: number, now: number) => Math.max(1, Math.min(now, Math.round(Number.isFinite(day) ? day : 1)));
export function normalizeMemoryRange(range: MemoryRange, now: number): MemoryRange {
  if (range.kind !== "days") return range;
  const a = clampDay(range.from, now), b = clampDay(range.to, now);
  const from = Math.min(a, b), to = Math.max(a, b);
  return from === 1 && to === now ? allMemories : { kind: "days", from, to };
}
export function moveMemoryRange(range: DayRange, delta: number, now: number): DayRange {
  const step = Math.max(1 - range.from, Math.min(now - range.to, delta));
  return { from: range.from + step, to: range.to + step };
}
