import type { HeadRef } from "../contracts";
import type { D5GameRecord } from "./d5-contracts";

export function copyEvidenceRecords(record: D5GameRecord): D5GameRecord[] {
  const records: D5GameRecord[] = [];
  let current = record;
  for (;;) {
    records.push(current);
    if (current.originRef?.kind !== "copy" || current.originRef.source.schemaVersion !== 4) break;
    current = current.originRef.source;
  }
  return records.reverse();
}

export function withinEvidenceHead(head: HeadRef, limits: readonly HeadRef[]): boolean {
  return Number.isSafeInteger(head.revision) && head.revision >= 0 && limits.some(limit =>
    head.saveId === limit.saveId && head.epoch === limit.epoch && head.revision <= limit.revision);
}

export function compareEvidenceHeads(left: HeadRef, right: HeadRef, limits: readonly HeadRef[]): number {
  const leftIndex = limits.findIndex(limit => left.saveId === limit.saveId && left.epoch === limit.epoch);
  const rightIndex = limits.findIndex(limit => right.saveId === limit.saveId && right.epoch === limit.epoch);
  return leftIndex === rightIndex ? left.revision - right.revision : leftIndex - rightIndex;
}

export function copyOriginHeads(record: D5GameRecord): HeadRef[] {
  return copyEvidenceRecords(record).slice(0, -1).map(source => source.head);
}

export function copyWorldHead(record: D5GameRecord): HeadRef | null {
  let current = record;
  while (current.airpGame?.worldHead.revision === 0 && current.originRef?.kind === "copy" && current.originRef.source.schemaVersion === 4) {
    current = current.originRef.source;
  }
  return current.airpGame?.worldHead ?? null;
}

export function withCopyEvidence(record: D5GameRecord): D5GameRecord {
  const records = copyEvidenceRecords(record);
  return { ...record, facts: records.flatMap(source => source.facts), commits: records.flatMap(source => source.commits),
    retractedFactIds: records.flatMap(source => source.retractedFactIds) };
}
