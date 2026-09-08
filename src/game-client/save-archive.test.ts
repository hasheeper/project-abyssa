import { expect, it } from "vitest";
import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import { archiveCandidates, isSaveArchived, readSaveArchive, writeSaveArchive } from "./save-archive";

type Ready = Extract<PlayerSaveListEntry, { status: "ready" }>;
const source = { status: "ready", saveId: "old", summary: { head: { saveId: "old", epoch: "e", revision: 12 }, activeExpeditionId: null } } as Ready;
const child = { status: "ready", saveId: "new", summary: { head: { saveId: "new", epoch: "e2", revision: 3 }, supersedes: source.summary.head, activeExpeditionId: null } } as Ready;
const current = child.summary.head;
it("archives only an unchanged, validated upgrade source; never the current save", () => {
  expect(archiveCandidates([source, child], current)).toEqual([{ head: source.summary.head, successor: { saveId: "new", epoch: "e2" } }]);
  expect(archiveCandidates([source, child], source.summary.head)).toEqual([]);
  expect(archiveCandidates([{ ...source, summary: { ...source.summary, head: { ...source.summary.head, revision: 13 } } }, child], current)).toEqual([]);
  expect(archiveCandidates([source, { ...child, summary: { ...child.summary, supersedes: undefined } }], current)).toEqual([]);
});
it("restores visibility when either lineage or source head changes; storage leaves saves untouched", () => {
  const saves = structuredClone([source, child]), entries = archiveCandidates(saves, current);
  let value = ""; const storage = { getItem: () => value, setItem: (_key: string, data: string) => { value = data; } };
  writeSaveArchive(storage, entries);
  expect(isSaveArchived(source, readSaveArchive(storage), saves, current)).toBe(true);
  expect(isSaveArchived(source, entries, [source], current)).toBe(false);
  expect(isSaveArchived(source, entries, saves, source.summary.head)).toBe(false);
  const changed = { ...source, summary: { ...source.summary, head: { ...source.summary.head, revision: 13 } } };
  expect(isSaveArchived(changed, entries, [changed, child], current)).toBe(false);
  writeSaveArchive(storage, []);
  expect(isSaveArchived(source, readSaveArchive(storage), saves, current)).toBe(false);
  expect(saves).toEqual([source, child]);
});
it("ignores corrupt archive hints and does not hide unreadable saves", () => {
  expect(readSaveArchive({ getItem: () => "bad json" })).toEqual([]);
  expect(readSaveArchive({ getItem: () => JSON.stringify({ version: 1, entries: [null, {}] }) })).toEqual([]);
  expect(isSaveArchived({ status: "unavailable", saveId: "old", error: { code: "storage-unavailable" } } as PlayerSaveListEntry, archiveCandidates([source, child], current), [source, child], current)).toBe(false);
});
