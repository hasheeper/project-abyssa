import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import type { SaveLocator } from "./navigation";

type Ready = Extract<PlayerSaveListEntry, { status: "ready" }>;
type Head = Ready["summary"]["head"];
export type ArchivedSave = { head: Head; successor: SaveLocator };
const key = "abyssa:archived-saves:v1";
const sameHead = (a: Head, b: Head) => a.saveId === b.saveId && a.epoch === b.epoch && a.revision === b.revision;
const sameSave = (a: SaveLocator, b: SaveLocator) => a.saveId === b.saveId && a.epoch === b.epoch;

/** Metadata only. Save records and receipts are never removed or rewritten. */
export function readSaveArchive(storage: Pick<Storage, "getItem">): ArchivedSave[] {
  try {
    const raw = JSON.parse(storage.getItem(key) ?? "null");
    if (raw?.version !== 1 || !Array.isArray(raw.entries)) return [];
    return raw.entries.filter((e: ArchivedSave) => e && typeof e.head?.saveId === "string" && typeof e.head.epoch === "string" && Number.isInteger(e.head.revision) && e.head.revision >= 0 && typeof e.successor?.saveId === "string" && typeof e.successor.epoch === "string");
  } catch { return []; }
}
export function writeSaveArchive(storage: Pick<Storage, "setItem">, entries: ArchivedSave[]) {
  storage.setItem(key, JSON.stringify({ version: 1, entries }));
}
export function archiveCandidates(saves: PlayerSaveListEntry[], current: SaveLocator | null): ArchivedSave[] {
  const ready = saves.filter((s): s is Ready => s.status === "ready");
  return ready.flatMap(source => {
    if (current && sameSave(source.summary.head, current) || source.summary.activeExpeditionId) return [];
    const successor = ready.find(s => s.saveId !== source.saveId && s.summary.supersedes && sameHead(s.summary.supersedes, source.summary.head));
    return successor ? [{ head: source.summary.head, successor: { saveId: successor.saveId, epoch: successor.summary.head.epoch } }] : [];
  });
}
export function isSaveArchived(save: PlayerSaveListEntry, entries: ArchivedSave[], saves: PlayerSaveListEntry[], current: SaveLocator | null): boolean {
  if (save.status !== "ready" || current && sameSave(save.summary.head, current)) return false;
  return entries.some(entry => sameHead(entry.head, save.summary.head) && saves.some(child => child.status === "ready" && sameSave(child.summary.head, entry.successor) && !!child.summary.supersedes && sameHead(child.summary.supersedes, entry.head)));
}
