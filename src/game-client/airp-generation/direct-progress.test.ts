import { describe, expect, it } from "vitest";
import type { DirectDriverState, DirectOperation } from "../../game-runtime/airp-direct-driver";
import type { DirectAttempt, DirectProgressFacts, DirectTask } from "../../game-runtime/airp-direct-progress";
import { directElapsed, projectDirectProgress } from "./direct-progress";

const task: DirectTask = {id: "task", sceneId: "scene", instanceId: "instance", task: "return", source: "undecided", context: null, materialHash: null, attempts: [], bodyHash: null, read: null, memoryId: null};
const facts: DirectProgressFacts = {task, saveId: "save", epoch: "epoch", generating: true, canGenerate: true, canUpdate: false, capacityReached: false};
const idle: DirectDriverState = {busy: false, error: null, pendingResult: false, operation: null};
const operation: DirectOperation = {id: 1, sceneId: "scene", saveId: "save", epoch: "epoch", mode: "generate", stage: "writing", repair: false, phase: "requesting", phaseStartedAt: 1000};
const attempt = (patch: Partial<DirectAttempt> = {}): DirectAttempt => ({id: "a", stage: "planning", ordinal: 1, startedAt: 1000, endedAt: 2000, inputHash: "hash", status: "succeeded", output: "outline", usage: {inputTokens: null, outputTokens: null, totalTokens: null}, error: null, outcomeUnknown: false, ...patch});
const project = (f = facts, d = idle, issue: string | null = null) => projectDirectProgress(f, d, true, issue);

describe("direct generation affordances", () => {
  it("labels current v5 stages without renaming frozen v4 tasks", () => {
    expect(projectDirectProgress(facts, idle, true, null, 5).rail.map(s => s.label)).toEqual(["创作", "润色", "格式化"]);
    expect(projectDirectProgress(facts, idle, true, null, 6).rail.map(s => s.label)).toEqual(["创作", "润色", "格式化"]);
    expect(projectDirectProgress(facts, idle, true, null, 7).rail.map(s => s.label)).toEqual(["大纲", "正文", "格式化"]);
    expect(projectDirectProgress(facts, idle, true, null, 4).rail.map(s => s.label)).toEqual(["大纲", "正文", "格式化"]);
  });
  it("offers configuration without claiming connectivity", () => {
    expect(project().primary).toBe("generate");
    expect(project(facts, idle, "请填写Key")).toMatchObject({primary: "settings", canHandwrite: true, clockSince: null});
  });
  it.each([
    ["waiting-lock", "正在等待此存档的其他操作", "停止等待"],
    ["requesting", "正在生成正文", "取消请求"],
    ["saving", "正文已返回，正在保存", null],
    ["cancelling", "正在停止本页操作", null],
    ["preparing", "正在准备生成", null],
  ] as const)("projects %s from real driver observation", (phase, title, cancelLabel) => {
    expect(project(facts, {...idle, busy: true, operation: {...operation, phase}})).toMatchObject({title, cancelLabel, primary: null, canHandwrite: false});
  });
  it("never flashes a failure for normal saving, and only offers local recovery after failure", () => {
    const state = {...idle, busy: true, pendingResult: true, operation: {...operation, phase: "saving" as const}};
    expect(project(facts, state)).toMatchObject({tone: "active", primary: null, note: null});
    expect(project(facts, {...state, busy: false, operation: {...operation, phase: "save-failed"}})).toMatchObject({tone: "warning", primary: "save", canHandwrite: false, canExportPending: true});
    // A recovered receipt in another tab must not hide this page's retained output.
    expect(project({...facts, task: {...task, memoryId: "other-tab-saved"}}, {...state, busy: false, operation: {...operation, phase: "save-failed"}}).primary).toBe("save");
  });
  it.each(["sceneId", "saveId", "epoch"] as const)("isolates busy, error and pending by %s", key => {
    const state = {...idle, error: "foreign error", pendingResult: true, operation: {...operation, [key]: "other"}};
    const view = project(facts, state);
    expect(view).toMatchObject({detailError: null, primary: null, canExportPending: false, cancelLabel: null, clockSince: null, canHandwrite: false});
    expect(view.title).not.toContain("未保存"); expect(view.note).toContain("另一场");
  });
  it("shows persisted running as unconfirmed, never as a live timer", () => {
    const view = project({...facts, task: {...task, source: "requested", attempts: [attempt({status: "running", endedAt: null, output: null})]}});
    expect(view).toMatchObject({title: "上次执行结果待确认", primary: "generate", clockSince: null, cancelLabel: null});
    expect(view.rail[0].status).toBe("待确认"); expect(view.note).toContain("其他页面");
  });
  it("does not offer exhausted retries, but preserves legal handwriting", () => {
    expect(project({...facts, capacityReached: true})).toMatchObject({title: "本任务已达重试上限", primary: null, canHandwrite: true});
  });
  it("only marks a stage complete from persisted success", () => {
    const view = project({...facts, task: {...task, attempts: [attempt()] }}, {...idle, busy: true, pendingResult: true, operation: {...operation, phase: "saving"}});
    expect(view.rail.map(s => s.status)).toEqual(["已保存", "保存中", "待执行"]);
  });
  it("treats memory as independent work and preserves delivery after failure", () => {
    const f = {...facts, generating: false, canGenerate: false, canUpdate: true, task: {...task, source: "browser-direct" as const, attempts: [attempt({stage: "updater", status: "failed", output: null, error: "provider-error"})]}};
    expect(project(f)).toMatchObject({primary: "update", primaryLabel: "重新整理记忆", note: "阅读和交付已保存，只需重试记忆整理。"});
    expect(project(f).rail).toHaveLength(3);
    expect(project({...f, task: {...f.task, memoryId: "saved"}})).toMatchObject({title: "本场记忆已保存", primary: null});
  });
  it("does not leak stale errors after handwritten selection or another tab's success", () => {
    const d = {...idle, error: "old error", operation: {...operation, phase: "failed" as const}};
    expect(project({...facts, task: {...task, source: "handwritten"}}, d).detailError).toBeNull();
    expect(project({...facts, task: {...task, attempts: [attempt({stage: "writing"})]}}, d).detailError).toBeNull();
  });
  it("labels real repair attempts without invented percentage or remaining time", () => {
    const view = project(facts, {...idle, busy: true, operation: {...operation, stage: "formatting", repair: true}});
    expect(view.title).toBe("正在修复格式"); expect(view.clockSince).toBe(1000);
    expect(directElapsed(1000, 85000)).toBe("01:24"); expect(directElapsed(1000, 0)).toBe("00:00");
  });
});
