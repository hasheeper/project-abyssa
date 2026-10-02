import { expect, it } from "vitest";
import { codexFeedback } from "./CodexFeedback";
import type { CodexData, CodexEntryData } from "../../game-runtime/codex-types";
import type { AnyGameRecord } from "../../game-application";
import type { CommittedBatch } from "../session";

it("notifies once per species upgrade, ignores repeats, rollback, replay and another save", () => {
  const before = {head: {saveId: "a", epoch: "a", revision: 1}} as AnyGameRecord;
  const after = {head: {saveId: "a", epoch: "a", revision: 2}} as AnyGameRecord;
  const entry = (stage: CodexEntryData["stage"]) => ({id: "slime", name: "浊泥史莱姆", stage} as CodexEntryData);
  const data = (stage: CodexEntryData["stage"]): CodexData => ({status: "ready", entries: [entry(stage)], encountered: 0, defeated: 0});
  let old: CodexEntryData["stage"] = "unknown", next: CodexEntryData["stage"] = "seen";
  const query = (record: AnyGameRecord) => data(record === before ? old : next);
  const batch: CommittedBatch = {before, after, receipts: [], presentable: true};
  expect(codexFeedback(batch, query).map(e => e.kind === "notice" && e.message)).toEqual(["图鉴收录 · 浊泥史莱姆"]);
  old = "seen"; next = "defeated";
  expect(codexFeedback(batch, query).map(e => e.kind === "notice" && e.message)).toEqual(["图鉴补全 · 浊泥史莱姆"]);
  old = "unknown";
  expect(codexFeedback(batch, query)).toHaveLength(1);
  old = next;
  expect(codexFeedback(batch, query)).toEqual([]);
  next = "seen";
  expect(codexFeedback(batch, query)).toEqual([]);
  old = "unknown";
  expect(codexFeedback({...batch, presentable: false}, query)).toEqual([]);
  expect(codexFeedback({...batch, after: {...after, head: {...after.head, saveId: "b"}}}, query)).toEqual([]);
});
