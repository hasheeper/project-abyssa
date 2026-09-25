import { beforeAll, describe, expect, it } from "vitest";
import { writingEnvelope } from "../game-application/testing/airp-writing-fixture";
import { directMaterial, directReturnGate, prepareDirect } from "../game-application/testing/airp-direct-playthrough";
import { poolTestRuntime, readPoolConversation, type PoolRecord } from "../game-application/testing/airp-pool-playthrough";
import { createDirectGameDriver, type DirectPlayerPort, type DirectDriverState } from "./airp-direct-driver";
import { GenerationError, emptyUsage } from "../game-application/airp-generation/contracts";
import type { CompletionRequest } from "../game-application/airp-generation/contracts";
import { createAiConfiguration, effectiveAiConfiguration } from "./airp-configuration";

let gate: PoolRecord;
beforeAll(async () => {gate = await (await directReturnGate("extracted")).read();}, 120000);
const key = "private-credential-not-for-saves", keys = {planning: key, writing: key, updater: key};
const material = directMaterial();
const portOf = (f: ReturnType<typeof poolTestRuntime>): DirectPlayerPort => ({read: f.read, commit: f.send});
const lock = async <T,>(_key: string, signal: AbortSignal, run: () => Promise<T>) => {signal.throwIfAborted(); return run();};
const dialogue = "「戻ってきてくれて、よかった。（你能回来真是太好了。）」";
const draft = `箱子停在桌边。\n${dialogue}`;
const formatted = JSON.stringify({creationRecord: "保留原文", lines: [{speaker: "narrator", emotion: "neutral", text: "箱子停在桌边。"}, {speaker: "elora", emotion: "smile", text: dialogue}]});
const successful = (text: string) => ({text, usage: {inputTokens: 12, outputTokens: 3, totalTokens: 15}, finishReason: "stop" as const});

describe("explicit browser-direct orchestration (no network)", () => {
  it("stops after malformed writing, retaining paid evidence without a formatter call", async () => {
    const f = poolTestRuntime(gate), port = portOf(f); let calls = 0;
    const driver = createDirectGameDriver({lock, provider: async () => successful(++calls === 1 ? "三段规划" : "<planning>只有废案，没有终稿</planning>")});
    await driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    expect(calls).toBe(2);
    const record = await f.read(), task = record.airpDirect!.tasks[0];
    expect(task.attempts).toHaveLength(2);
    expect(task.attempts[1]).toMatchObject({status: "failed", error: "invalid-output", output: "<planning>只有废案，没有终稿</planning>", usage: {totalTokens: 15}});
    expect(task.source).toBe("requested"); expect(record.airpDirect!.memories).toEqual([]);
    expect(driver.getSnapshot().error).not.toBeNull();
  }, 60000);

  it("durably reserves each call, keeps actual inputs reconstructible, and never summarizes unread prose", async () => {
    const f = poolTestRuntime(gate), port = portOf(f), seen: CompletionRequest[] = [];
    const driver = createDirectGameDriver({lock, provider: async request => {
      const r = await f.read(); expect(r.airpDirect!.tasks[0].attempts.at(-1)?.status).toBe("running");
      seen.push(request); return successful(["三段模拟规划", writingEnvelope(draft), formatted][seen.length - 1]);
    }});
    const observed: DirectDriverState[] = [];
    driver.subscribe(() => observed.push(driver.getSnapshot()));
    expect(seen).toHaveLength(0);
    await driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    expect(driver.getSnapshot().error).toBeNull(); expect(seen).toHaveLength(3);
    expect(observed.filter(s => s.operation?.phase === "requesting").map(s => s.operation?.stage)).toEqual(["planning", "writing", "formatting"]);
    expect(observed.some(s => s.operation?.phase === "waiting-lock")).toBe(true);
    expect(observed.filter(s => s.pendingResult).every(s => s.operation?.phase === "saving")).toBe(true);
    expect(driver.getSnapshot().operation).toMatchObject({saveId: gate.head.saveId, epoch: gate.head.epoch, sceneId: gate.airpDirect!.tasks[0].sceneId, phase: "complete"});
    const r = await f.read(); expect(r.airpDirect!.memories).toEqual([]); expect(JSON.stringify(r)).not.toContain(key);
    expect(seen[2].messages).toHaveLength(2); expect(JSON.stringify(seen[2])).not.toContain("三段模拟规划");
    expect(createDirectGameDriver({lock}).getSnapshot().busy).toBe(false);
    await driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    expect(seen).toHaveLength(3);
  }, 60000);

  it("retains a successful output after a local write fails and saves it without a second paid request", async () => {
    const f = poolTestRuntime(gate), base = portOf(f); let fail = true, calls = 0;
    let holdSaveWait = false, enteredWait!: () => void;
    const waiting = new Promise<void>(resolve => {enteredWait = resolve;});
    const port: DirectPlayerPort = {...base, commit: async command => {
      if (fail && command.type === "airp-direct-result") throw Error("injected local quota failure");
      return base.commit(command);
    }};
    const driver = createDirectGameDriver({lock: async (name, signal, run) => {
      if (holdSaveWait) {enteredWait(); await new Promise<void>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), {once: true}));}
      return lock(name, signal, run);
    }, provider: async () => {calls++; return successful("三段模拟规划");}});
    await driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    expect(calls).toBe(1); expect(driver.getSnapshot().pendingResult).toBe(true);
    expect(driver.getSnapshot().operation).toMatchObject({phase: "save-failed", stage: "planning"});
    const retained = driver.getSnapshot();
    await driver.run(port, "another-scene", "generate", material, {models: material.models, keys});
    expect(driver.getSnapshot()).toBe(retained); expect(calls).toBe(1);
    expect(driver.exportPending()).not.toContain(key);
    const output = driver.exportPending(); holdSaveWait = true;
    const saving = driver.retryCommit(port); await waiting;
    expect(driver.getSnapshot().operation).toMatchObject({mode: "save", phase: "waiting-lock"});
    driver.cancel(); await saving;
    expect(driver.exportPending()).toBe(output); expect(calls).toBe(1);
    expect(driver.getSnapshot()).toMatchObject({busy: false, pendingResult: true});
    holdSaveWait = false;
    fail = false; await driver.retryCommit(port);
    expect(calls).toBe(1); expect(driver.getSnapshot().pendingResult).toBe(false);
    expect((await f.read()).airpDirect!.tasks[0].attempts[0]).toMatchObject({status: "succeeded", output: "三段模拟规划"});
  }, 60000);

  it("refuses a changed credential endpoint and fails closed when browser locks are unavailable", async () => {
    const f = poolTestRuntime(gate), port = portOf(f); let calls = 0;
    await prepareDirect(f);
    const driver = createDirectGameDriver({lock, provider: async () => {calls++; throw Error();}});
    const models = structuredClone(material.models); models.planning.baseUrl = "https://other.invalid/v1";
    await driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models, keys});
    expect(calls).toBe(0); expect(driver.getSnapshot().error).toContain("原冻结端点");
    const noLock = createDirectGameDriver({lock: async () => {throw new GenerationError("no-lock", "浏览器不支持同档锁。");}});
    await noLock.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    expect(noLock.getSnapshot().error).toContain("同档锁");
    expect((await f.read()).airpDirect!.tasks[0].attempts).toHaveLength(0);
  }, 60000);

  it("does not accept a provider that resolves late after cancellation", async () => {
    const f = poolTestRuntime(gate), port = portOf(f); let release: (() => void) | undefined;
    const called = new Promise<void>(resolve => {release = resolve;}); let respond: ((r: ReturnType<typeof successful>) => void) | undefined;
    const response = new Promise<ReturnType<typeof successful>>(resolve => {respond = resolve;});
    const driver = createDirectGameDriver({lock, provider: async () => {release!(); return response;}});
    const run = driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    await called; driver.cancel(); respond!(successful("late output")); await run;
    const attempt = (await f.read()).airpDirect!.tasks[0].attempts[0];
    expect(attempt).toMatchObject({status: "interrupted", output: null, error: "cancelled", outcomeUnknown: true, usage: emptyUsage()});
  }, 60000);

  it("starts updater only after read and delivery and supports explicit retry", async () => {
    const f = poolTestRuntime(gate), port = portOf(f); let calls = 0;
    const driver = createDirectGameDriver({lock, provider: async () => {
      calls++;
      if (calls <= 3) return successful(["三段规划", writingEnvelope(draft), formatted][calls - 1]);
      throw new GenerationError("http-error", "模拟暂时故障", true);
    }});
    const sceneId = gate.airpDirect!.tasks[0].sceneId;
    await driver.run(port, sceneId, "generate", material, {models: material.models, keys});
    await driver.run(port, sceneId, "update", material, {models: material.models, keys});
    expect(calls).toBe(3);
    await readPoolConversation(f); await f.send({type: "airp-turn-in", instanceId: gate.airpDirect!.tasks[0].instanceId});
    const snapshot = (await f.read()).snapshot;
    await driver.run(port, sceneId, "update", material, {models: material.models, keys});
    expect(calls).toBe(4); expect((await f.read()).snapshot).toEqual(snapshot);
    expect((await f.read()).airpDirect!.memories).toEqual([]);
  }, 60000);

  it("shares page configuration without persisting keys in the material", () => {
    const config = createAiConfiguration(); config.patch({baseUrl: material.models.planning.baseUrl, commonKey: key});
    expect(effectiveAiConfiguration(config.getSnapshot()).keys.planning).toBe(key);
    expect(JSON.stringify(effectiveAiConfiguration(config.getSnapshot()).material)).not.toContain(key);
    expect(createAiConfiguration().getSnapshot().commonKey).toBe("");
  });

  it("cancels lock waiting without sending a request or marking a paid attempt", async () => {
    let waiting!: () => void, calls = 0, commits = 0;
    const entered = new Promise<void>(resolve => {waiting = resolve;});
    const driver = createDirectGameDriver({provider: async () => {calls++; return successful("unused");}, lock: async (_key, signal) => {
      waiting(); await new Promise<void>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), {once: true})); throw Error("unreachable");
    }});
    const port: DirectPlayerPort = {read: async () => gate, commit: async () => {commits++; return gate;}};
    const running = driver.run(port, gate.airpDirect!.tasks[0].sceneId, "generate", material, {models: material.models, keys});
    await entered; expect(driver.getSnapshot().operation?.phase).toBe("waiting-lock");
    driver.cancel(); expect(driver.getSnapshot().operation?.phase).toBe("cancelling"); await running;
    expect(calls).toBe(0); expect(commits).toBe(0); expect(driver.getSnapshot().error).toContain("未发送");
  });
});
