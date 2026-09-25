import { expect, it, vi } from "vitest";
import { directorTestJob, directorTestMaterial } from "../game-application/testing/airp-director-fixture";
import { compileDirectorJob, parseDirectorJobCommand, reduceDirectorJob } from "../game-application/airp-director/jobs";
import type { DirectorJobCommand } from "../game-application/airp-director/contracts";
import { directorHash } from "../game-core/session";
import { emptyUsage, type Completion } from "../game-application/airp-generation/contracts";
import { createDirectorDriver, type DirectorDriverPort, type DirectorDriverRecord } from "./airp-director-driver";

function fixture() {
  const material = directorTestMaterial(), job = directorTestJob(material);
  let record: DirectorDriverRecord = {head: {saveId: "test", epoch: "epoch", revision: 1}, jobs: [job], materials: {[job.materialHash]: material}};
  let failSave = false, serial = 0;
  const commands: DirectorJobCommand[] = [];
  const port: DirectorDriverPort = {read: async () => structuredClone(record), commit: async command => {
    if (failSave && command.type === "airp-director-result") throw Error("simulated storage failure");
    commands.push(command); record.jobs[0] = reduceDirectorJob(record.jobs[0], material, command); record.head.revision++;
    return structuredClone(record);
  }};
  const connection = {models: material.models, keys: {planning: "test-credential-only-in-memory", writing: "test-credential-only-in-memory", updater: "test-credential-only-in-memory"}};
  const plan = {version: 1, day: 1, reason: "测试留白，不是真实生成。", focus: null, entries: []};
  const completion = (value: unknown): Completion => ({text: JSON.stringify(value), usage: {inputTokens: 100, outputTokens: 50, totalTokens: 150}, finishReason: "stop"});
  const options = {now: () => 1000 + ++serial, id: () => `attempt:${++serial}`, lock: async <T>(_key: string, signal: AbortSignal, operation: () => Promise<T>) => {signal.throwIfAborted(); return operation();}};
  return {material, port, connection, plan, completion, options, commands, get record() {return record;}, failSave(value: boolean) {failSave = value;}, switchSave() {record = {...record, head: {...record.head, saveId: "other"}};}};
}
it("runs only by explicit action, records one default-large-model day request, and never resends a finished job", async () => {
  const f = fixture(), provider = vi.fn(async () => f.completion(f.plan)), d = createDirectorDriver({...f.options, provider});
  expect(provider).not.toHaveBeenCalled(); await d.run(f.port, "day:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(1); expect(d.getSnapshot()).toMatchObject({phase: "saved", busy: false});
  expect(f.record.jobs[0].acceptedEntries).toEqual([]); expect(f.record.jobs[0].attempts[0].usage.totalTokens).toBe(150);
  await d.run(f.port, "day:1", f.connection); expect(provider).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(f.record)).not.toContain(f.connection.keys.planning);
});
it("makes a separate semantic review request for a free card before yielding accepted entries", async () => {
  const f = fixture(), card = structuredClone(f.record.jobs[0].planning!.fixed[2].card);
  card.id = "free:new"; card.themeKey = "new.topic";
  const plan = {...f.plan, entries: [{id: "entry:free", fromPhase: 2, throughPhase: 2, basisIds: ["fact:1"], source: {kind: "free", card}}]};
  const provider = vi.fn(async () => f.completion(f.record.jobs[0].proposal ? {version: 1, planHash: directorHash(plan), decisions: [{entryId: "entry:free", verdict: "new", matchedSourceIds: [], reason: "新题测试"}]} : plan));
  const d = createDirectorDriver({...f.options, provider}); await d.run(f.port, "day:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(2); expect(f.record.jobs[0].attempts.map(a => a.stage)).toEqual(["director", "review"]);
  expect(f.record.jobs[0].acceptedEntries?.[0].origin).toBe("free");
});
it("keeps invalid raw output and usage without accepting it or retrying automatically", async () => {
  const f = fixture(), provider = vi.fn(async () => f.completion({rewardGold: 99})), d = createDirectorDriver({...f.options, provider});
  await d.run(f.port, "day:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(1); expect(f.record.jobs[0].acceptedEntries).toBeNull();
  expect(f.record.jobs[0].attempts[0]).toMatchObject({status: "failed", error: "invalid-output", output: "{\"rewardGold\":99}", usage: {totalTokens: 150}});
});
it("explicit day retry sends the exact validation error, preserving old messages/attempt and replay", async () => {
  const f = fixture(), initial = structuredClone(f.record.jobs[0]);
  const card = initial.planning!.fixed.find(fixed => fixed.card.load === "light")!.card;
  const invalid = { ...f.plan, focus: { kind: "new", id: "light-only" }, entries: [{ id: "light-only", fromPhase: 0, throughPhase: 3, basisIds: ["fact:1"], source: { kind: "fixed", definitionId: card.id } }] };
  const valid = { ...invalid, focus: null };
  const provider = vi.fn(async () => f.completion(provider.mock.calls.length === 1 ? invalid : valid));
  const driver = createDirectorDriver({ ...f.options, provider });
  await driver.run(f.port, "day:1", f.connection); expect(provider).toHaveBeenCalledTimes(1);
  const failed = structuredClone(f.record.jobs[0].attempts[0]);
  expect(failed).toMatchObject({ status: "failed", error: "invalid-output" });
  const original = compileDirectorJob(f.material, f.record.jobs[0]);
  const repaired = compileDirectorJob(f.material, f.record.jobs[0], undefined, 1);
  expect(repaired.messages.slice(0, -1)).toEqual(original.messages);
  expect(repaired.messages.at(-1)!.content).toContain("director.focus");
  expect(repaired.messages.at(-1)!.content).toContain("focus填null");
  await driver.run(f.port, "day:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(2); expect(f.record.jobs[0].attempts[0]).toEqual(failed);
  expect(f.record.jobs[0].attempts[1]).toMatchObject({ status: "succeeded", directorRepair: 1, inputHash: directorHash(repaired) });
  expect(f.record.jobs[0].proposal).toEqual(valid);
  expect(f.commands.reduce((job, command) => reduceDirectorJob(job, f.material, command), initial)).toEqual(f.record.jobs[0]);
  expect(() => compileDirectorJob(f.material, initial, undefined, 1)).toThrow();
  expect(() => parseDirectorJobCommand({ type: "airp-director-begin", jobId: "day:1", attemptId: "bad", stage: "director", at: 1, directorRepair: 2 })).toThrow();
});
it("resumes only malformed scene JSON after a fresh driver, retaining successful planning and writing verbatim", async () => {
  const f = fixture(), day = f.record.jobs[0], card = day.planning!.fixed[2].card;
  f.record.jobs[0] = {...day, id: "scene:1", kind: "scene", planning: null, scene: {
    version: 1, sourceKind: "gameplay", head: f.record.head, phase: 2, playerName: "测试玩家",
    eventId: "event:1", sceneId: "scene:1", role: "offer", actorIds: ["kororo"], locationId: "plaza",
    card, actionIndex: 0, occurrence: 0, intent: card.scenes.offer, choices: card.choices, selected: [],
    facts: [], memories: [], previous: [], taskReports: [], authorSource: null,
  }};
  const line = "「どうぞ。（请坐。）」", formatted = JSON.stringify({creationRecord: "逐段封装", lines: [{speaker: "kororo", emotion: "neutral", text: line}]});
  const malformed = formatted.replace(`${line}\"`, line);
  const outputs = ["第一段：情境。第二段：互动。第三段：等待回应。", `<planning>演出记录。</planning><prose>柯萝萝：${line}</prose>`, malformed, formatted];
  const provider = vi.fn(async (): Promise<Completion> => ({text: outputs.shift()!, usage: {inputTokens: 100, outputTokens: 50, totalTokens: 150}, finishReason: "stop"}));
  const first = createDirectorDriver({...f.options, provider}); await first.run(f.port, "scene:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(3); expect(f.record.jobs[0].text).toBeNull();
  expect(f.record.jobs[0].attempts.at(-1)).toMatchObject({stage: "formatting", status: "failed", output: malformed, error: "invalid-output"});
  const retained = structuredClone(f.record.jobs[0].attempts.slice(0, 2));
  const oldInput = compileDirectorJob(f.material, f.record.jobs[0]);
  const repairInput = compileDirectorJob(f.material, f.record.jobs[0], 1);
  expect(repairInput.messages.length).toBe(oldInput.messages.length + 1);
  expect(repairInput.messages.at(-1)).toEqual(oldInput.messages.at(-1));
  const leaked = f.connection.keys.updater;
  f.record.jobs[0].connections = [{stage: "formatting", afterAttemptId: f.record.jobs[0].attempts.at(-1)!.id, config: {...f.material.models.updater, model: leaked}}];
  const unsafe = structuredClone(f.connection); unsafe.models.updater.model = leaked;
  const blockedProvider = vi.fn(async () => f.completion(formatted));
  const blocked = createDirectorDriver({...f.options, provider: blockedProvider});
  await blocked.run(f.port, "scene:1", unsafe);
  expect(blockedProvider).not.toHaveBeenCalled();
  expect(f.record.jobs[0].attempts).toHaveLength(3);
  f.record.jobs[0].connections = undefined;
  expect(parseDirectorJobCommand({type: "airp-director-begin", jobId: "scene:1", attemptId: "old", stage: "formatting", at: 1})).not.toHaveProperty("formatRepair");
  const resumed = createDirectorDriver({...f.options, provider});
  expect(provider).toHaveBeenCalledTimes(3); await resumed.run(f.port, "scene:1", f.connection);
  expect(provider).toHaveBeenCalledTimes(4); expect(f.record.jobs[0].attempts.slice(0, 2)).toEqual(retained);
  expect(f.record.jobs[0].attempts.map(a => a.stage)).toEqual(["planning", "writing", "formatting", "formatting"]);
  expect(f.record.jobs[0].attempts[2]).not.toHaveProperty("formatRepair");
  expect(f.record.jobs[0].attempts[3]).toMatchObject({formatRepair: 1, inputHash: directorHash(repairInput)});
  expect(f.record.jobs[0].text?.lines[0].text).toBe(line);
});
it("rejects repair flags outside failed formatting without changing legacy attempt input", () => {
  const f = fixture();
  expect(() => compileDirectorJob(f.material, f.record.jobs[0], 1)).toThrow();
  expect(() => parseDirectorJobCommand({type: "airp-director-begin", jobId: "day:1", attemptId: "bad", stage: "formatting", at: 1, formatRepair: 2})).toThrow();
});
it("retries a failed local result save without a second model request", async () => {
  const f = fixture(), provider = vi.fn(async () => f.completion(f.plan)), d = createDirectorDriver({...f.options, provider}); f.failSave(true);
  await d.run(f.port, "day:1", f.connection); expect(d.getSnapshot().pendingResult).toBe(true);
  await d.run(f.port, "day:1", f.connection); expect(provider).toHaveBeenCalledTimes(1);
  f.failSave(false); await d.retryCommit(f.port);
  expect(provider).toHaveBeenCalledTimes(1); expect(f.record.jobs[0].acceptedEntries).toEqual([]); expect(d.getSnapshot().pendingResult).toBe(false);
});
it("marks a restored running attempt as unknown before an explicit retry", async () => {
  const f = fixture(); await f.port.commit({type: "airp-director-begin", jobId: "day:1", attemptId: "old", stage: "director", at: 1});
  const provider = vi.fn(async () => f.completion(f.plan)), d = createDirectorDriver({...f.options, provider});
  expect(provider).not.toHaveBeenCalled(); await d.run(f.port, "day:1", f.connection);
  expect(f.record.jobs[0].attempts[0]).toMatchObject({error: "interrupted", outcomeUnknown: true});
  expect(provider).toHaveBeenCalledTimes(1);
});
it("does not save a late response to another save", async () => {
  const f = fixture(), provider = vi.fn(async () => {f.switchSave(); return f.completion(f.plan);}), d = createDirectorDriver({...f.options, provider});
  await d.run(f.port, "day:1", f.connection);
  expect(f.commands.some(c => c.type === "airp-director-result")).toBe(false); expect(d.getSnapshot().pendingResult).toBe(true);
  expect(f.record.jobs[0].acceptedEntries).toBeNull();
});
it("records cancellation, suppresses echoed credentials, and rejects changed endpoints before requesting", async () => {
  const f = fixture(); let d: ReturnType<typeof createDirectorDriver>;
  d = createDirectorDriver({...f.options, provider: async () => {d.cancel(); return f.completion(f.plan);}});
  await d.run(f.port, "day:1", f.connection);
  expect(f.record.jobs[0].attempts[0]).toMatchObject({error: "cancelled", outcomeUnknown: true});
  const g = fixture(), echo = createDirectorDriver({...g.options, provider: async () => ({text: g.connection.keys.planning, usage: emptyUsage(), finishReason: "stop"})});
  await echo.run(g.port, "day:1", g.connection); expect(JSON.stringify(g.record)).not.toContain(g.connection.keys.planning);
  const h = fixture(), provider = vi.fn(async () => h.completion(h.plan)), other = createDirectorDriver({...h.options, provider});
  const connection = structuredClone(h.connection); connection.models.planning.baseUrl = "https://another.invalid/v1";
  await other.run(h.port, "day:1", connection); expect(provider).not.toHaveBeenCalled();
});
