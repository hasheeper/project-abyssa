import { expect, it } from "vitest";
import type { SettlementMemoryPoint, SettlementThread, SettlementProposal } from "../../game-core/contracts";
import { admitMemoryCorrections, effectiveMemory, effectiveThreads, memoryHash, memoryTargets } from "./effective";
import type { MemoryContext, MemoryChange } from "./contracts";
import { clbInput } from "../testing/airp-settlement-fixture";
import { createSettlementFrame, compileSettlementRequest, emptySettlementProposal } from "../airp-settlement/context";
import { normalizeSettlementMemory } from "../airp-settlement/memory";
import { sceneMemoryContext } from "./d5";

const head = (revision: number) => ({saveId: "test", epoch: "epoch:1", revision});
function fixture() {
  const scope = {kind: "event" as const, boundaryId: "boundary:1", eventId: "event:1", actionId: null, runId: null};
  const point: SettlementMemoryPoint = {kind: "fact", text: "模拟错误：已经交付", speakerId: null, knownBy: ["kael", "elora"], basisIds: ["old:1"]};
  const thread: SettlementThread = {...point, id: "thread:1", text: "等待确认", scope, topicKey: "confirm", until: "resolved"};
  const targets = memoryTargets([{id: "memory:1", phase: 2, scope, points: [point, {...point}]}], [thread]);
  const context: MemoryContext = {...effectiveMemory(targets, []), sourceHead: head(10), evidence: [{id: "read:1", knownBy: point.knownBy, head: head(8)}]};
  const change = (kind: MemoryChange["kind"], i = 0): MemoryChange => ({kind, targetId: targets[i].id, expectedHash: targets[i].hash,
    ...(kind === "replace-summary" ? {text: "模拟更正：尚未交付"} : kind === "merge-summary" ? {duplicateOf: {targetId: targets[1].id, expectedHash: targets[1].hash}} : {})});
  const owner = {jobId: "gm:1", attemptId: "attempt:1", recordedHead: head(11)};
  const admit = (changes: MemoryChange[], basisIds = ["read:1"], ctx = context) => admitMemoryCorrections({memoryCorrections: [{reason: "模拟事实更正", basisIds, changes}]}, ctx, owner);
  return {point, thread, targets, context, change, owner, admit};
}
it("M1/M2/M3 replace, merge and close retain original content/attribution and do not touch effects", () => {
  const f = fixture(), original = structuredClone(f.targets);
  const records = f.admit([f.change("replace-summary", 0), f.change("close-thread", 2)]);
  const view = effectiveMemory(f.targets, records);
  expect(view.targets[0].value).toEqual({...f.point, text: "模拟更正：尚未交付", basisIds: ["old:1", "read:1"]});
  expect(effectiveThreads(view)).toEqual([]); expect(view.closed[0].target.value).toEqual(f.thread);
  expect(view.diagnostics[0].status).toBe("applied"); expect(f.targets).toEqual(original);
  const merged = effectiveMemory(f.targets, f.admit([f.change("merge-summary")]));
  expect(merged.targets.map(t => t.id)).not.toContain(f.targets[0].id);
  expect(merged.targets[0]).toEqual(f.targets[1]);
  expect(records[0].before).toEqual([f.targets[0], f.targets[2]]);
});
it("M4 pending current-text group is atomic until final actual read, including stale-target conflict", () => {
  const f = fixture(), ctx = sceneMemoryContext(f.context, "scene:1", ["elora"], [{speaker: "elora", text: "这件事情已确认。"}]);
  const pending = f.admit([f.change("replace-summary"), f.change("close-thread", 2)], ["current:scene:1:0"], ctx);
  expect(effectiveMemory(f.targets, pending).targets).toEqual(f.targets);
  expect(effectiveMemory(f.targets, pending).diagnostics[0].status).toBe("pending");
  const read = effectiveMemory(f.targets, pending, {"scene:1": head(14)});
  expect(read.closed).toHaveLength(1); expect(read.diagnostics[0].effectiveHead).toEqual(head(14));
  const first = f.admit([f.change("replace-summary")]).map(r => ({...r, id: "earlier:1"}));
  const conflict = effectiveMemory(f.targets, [...pending, ...first], {"scene:1": head(14)});
  expect(conflict.diagnostics.find(d => d.id === pending[0].id)?.status).toBe("rejected");
  expect(effectiveThreads(conflict)).toHaveLength(1); // no half-applied close
});
it("M6 bad hashes/missing basis/forbidden fields reject only their dependency group", () => {
  const f = fixture(), valid = {reason: "关闭", basisIds: ["read:1"], changes: [f.change("close-thread", 2)]};
  for (const bad of [{...valid, basisIds: ["candidate:1"]}, {...valid, changes: [{...f.change("replace-summary"), expectedHash: "0".repeat(64)}]}, {...valid, changes: [{...f.change("replace-summary"), kind: "award-item"}]}]) {
    const records = admitMemoryCorrections({memoryCorrections: [bad, valid]}, f.context, f.owner);
    expect(records[0].error).not.toBeNull(); expect(records[1].error).toBeNull();
    expect(effectiveThreads(effectiveMemory(f.targets, records))).toEqual([]);
  }
  const dependent = f.admit([f.change("close-thread", 2), {...f.change("replace-summary"), expectedHash: "0".repeat(64)}]);
  expect(effectiveThreads(effectiveMemory(f.targets, dependent))).toHaveLength(1);
  const raw = admitMemoryCorrections({memoryCorrections: "not-array"}, f.context, f.owner);
  expect(raw[0].error).not.toBeNull();
});
it("private narration cannot rewrite a shared memory; unchosen attitudes have no admissible source", () => {
  const f = fixture(), ctx = sceneMemoryContext(f.context, "scene:1", ["elora"], [{speaker: "narrator", text: "尚未公开的秘密"}]);
  expect(f.admit([f.change("replace-summary")], ["current:scene:1:0"], ctx)[0].error).toContain("知情");
  expect(f.admit([f.change("replace-summary")], ["candidate:1"])[0].error).not.toBeNull();
});
it("M5 same old evidence cannot reopen closed matter; real new promise gets a non-colliding identity", () => {
  const {input, materials} = clbInput(); input.grants = [];
  const p = emptySettlementProposal(input), point = {kind: "fact" as const, speakerId: null, text: "继续确认", knownBy: ["player", "npc-a"], basisIds: [input.evidence[0].id]};
  const thread: SettlementThread = {...point, id: "closed:1", scope: input.scope, until: "resolved", topicKey: "confirm"};
  const target = memoryTargets([], [thread])[0], at = input.evidence[0].head.revision;
  input.openThreads = [thread];
  materials.memoryView = {version: 1, targets: [], closed: [{target, correctionId: "gm:1", reason: "已确认", effectiveHead: {...input.state.head, revision: at}}], diagnostics: []};
  const frame = createSettlementFrame(input, materials);
  p.memory.open = [{...point, key: "confirm", until: "resolved"}];
  p.memory.close = [{id: thread.id, basisIds: point.basisIds}];
  const raw = JSON.stringify(p), normalized = normalizeSettlementMemory(frame, p) as SettlementProposal;
  expect(normalized.memory.open).toEqual([]); expect(normalized.memory.close).toEqual([]); expect(JSON.stringify(p)).toBe(raw);
  expect(JSON.parse(compileSettlementRequest(frame, 0).messages[1].content).input.openThreads).toEqual([]);
  expect(frame.input.openThreads).toEqual([thread]);
  const fresh = structuredClone(frame); fresh.input.evidence[0].head.revision = at + 1;
  const renewed = normalizeSettlementMemory(fresh, p) as SettlementProposal;
  expect(renewed.memory.open[0].text).toBe(point.text); expect(renewed.memory.open[0].key).toMatch(/^renewed:/);
  expect(memoryHash(frame.input)).not.toBe(memoryHash(fresh.input));
});
