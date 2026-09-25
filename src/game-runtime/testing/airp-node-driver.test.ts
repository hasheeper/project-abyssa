import { describe, expect, it } from "vitest";
import { nodeFixture, mockNodeWriting } from "../../game-application/testing/airp-node-fixture";
import { createNodeDriver } from "../airp-expedition-play-driver";
import { createLowProvider } from "../../game-infrastructure/airp-direct/low-provider";
import { readLowWriting } from "../../game-application/airp-low/output";
import { compileLowFrame } from "../../game-application/airp-low/native";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileLowRequest } from "../../game-application/airp-low/output";
import { emptyUsage } from "../../game-application/airp-generation/contracts";
import { lowHash } from "../../game-application/airp-low/native";
import { nodeCallLog, serializeCallLog } from "../airp-call-log";

const config = { baseUrl: "https://example.invalid/v1", model: "mock", timeoutMs: 1000, max_tokens: 10 };
const connection = { config, key: "test-only-not-a-real-key" };
const lock = async <T>(_name: string, _signal: AbortSignal, fn: () => Promise<T>) => fn();
describe("CL-D explicit runtime stages", () => {
  it.each([false, true])("postprocesses an imperfect raw draft and preserves logs across reload (legacy=%s)", async legacy => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id);
    if (legacy) {
      const old = f.raw(), frame = old.nodes.jobs[0].frame!; frame.readerVersion = 3;
      const { requestHash: _hash, ...body } = frame; frame.requestHash = lowHash(body); f.restore(old);
    }
    const stages: string[] = [], draft = "艾洛拉说：先别碰！\n她扣住药箱。", formatted = { lines: [{ speaker: "elora", emotion: "serious", text: "「先别碰！」" }, { speaker: "narrator", emotion: "neutral", text: "她扣住药箱。" }], choices: ["仔细观察", "帮她一把", "暂不参与"] };
    const driver = createNodeDriver({ lock, provider: async request => {
      stages.push(request.stage);
      if (request.stage === "formatting") expect(JSON.parse(request.messages[1].content).rawDraft).toBe(draft);
      return { text: request.stage === "writing" ? draft : JSON.stringify(formatted), usage: emptyUsage(), finishReason: "stop", diagnostics: { version: 1, httpStatus: 200, requestId: "node-request" } };
    } });
    await driver.run(f.nodePort, id, connection); const original = structuredClone(f.raw().nodes.jobs[0].attempts[0]);
    expect(original.status).toBe(legacy ? "failed" : "succeeded");
    if (legacy) { await f.nodes.usePostprocessing(id); expect(stages).toEqual(["writing"]); }
    await driver.run(f.nodePort, id, connection);
    const job = f.raw().nodes.jobs[0]; expect(job.text).toEqual(formatted); expect(stages).toEqual(["writing", "formatting"]);
    expect(job.attempts[0]).toEqual(original); expect(job.frame?.readerVersion).toBe(legacy ? 3 : 5);
    const log = serializeCallLog(nodeCallLog(job)); expect(log).toContain("node-request"); expect(log).not.toContain(connection.key);
    f.restore(f.raw()); expect((await f.nodes.read()).ledger.jobs[0].text).toEqual(formatted);
    await f.nodes.readLine(id, 0); expect(f.raw().nodes.jobs[0].reads).toHaveLength(1);
  }, 20000);
  it("calls writing then formatting only; reread/restore is zero network", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id); const stages: string[] = [];
    const driver = createNodeDriver({ lock, provider: async request => { stages.push(request.stage); return { text: request.stage === "writing" ? mockNodeWriting() : JSON.stringify(readLowWriting(mockNodeWriting(), f.raw().nodes.jobs[0].frame!).text), usage: emptyUsage(), finishReason: "stop" }; } });
    await driver.run(f.nodePort, id, connection); expect(stages).toEqual(["writing"]); expect(driver.getSnapshot().phase).toBe("formatting-needed");
    await driver.run(f.nodePort, id, connection); expect(stages).toEqual(["writing", "formatting"]); expect(driver.getSnapshot().phase).toBe("readable");
    await driver.run(f.nodePort, id, connection); expect(stages).toHaveLength(2); expect(JSON.stringify(f.raw())).not.toContain(connection.key);
  }, 20000);
  it.each([false, true])("retries a returned result save without another model call (lost response=%s)", async after => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id); let calls = 0;
    const driver = createNodeDriver({ lock, provider: async () => { calls++; return { text: mockNodeWriting(), usage: emptyUsage(), finishReason: "stop" }; } });
    f.failOnce(r => !!r.nodes.jobs[0].attempts[0]?.output, after);
    await driver.run(f.nodePort, id, connection); expect(driver.getSnapshot().pendingResult).toBe(true);
    const snapshot = await f.nodes.read(); let foreignWrites = 0;
    await driver.retrySave({ read: async () => ({ ...snapshot, head: { ...snapshot.head, saveId: "another-save" } }), commit: async () => { foreignWrites++; return snapshot; } });
    expect(foreignWrites).toBe(0); expect(driver.getSnapshot().pendingResult).toBe(true);
    await driver.retrySave(f.nodePort); expect(driver.getSnapshot().pendingResult).toBe(false); expect(calls).toBe(1); expect(f.raw().nodes.jobs[0].attempts[0].status).toBe("succeeded");
  }, 20000);
  it("no key makes no call; provider failure does not retry", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id); let calls = 0;
    const driver = createNodeDriver({ lock, provider: async () => { calls++; throw Error("No connection"); } });
    await driver.run(f.nodePort, id, { config, key: "" }); expect(calls).toBe(0);
    await driver.run(f.nodePort, id, connection); expect(calls).toBe(1); expect(f.raw().nodes.jobs[0].attempts[0].status).toBe("interrupted");
  }, 20000);
  it("cancels an uncooperative provider without accepting its late draft", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id);
    let signalSent!: () => void, release!: () => void;
    const sent = new Promise<void>(resolve => { signalSent = resolve; }), returned = new Promise<void>(resolve => { release = resolve; });
    const driver = createNodeDriver({ lock, provider: async () => { signalSent(); await returned; return { text: mockNodeWriting(), usage: emptyUsage(), finishReason: "stop" }; } });
    const pending = driver.run(f.nodePort, id, connection); await sent; driver.cancel(); release(); await pending;
    const job = f.raw().nodes.jobs[0]; expect(job.attempts[0].status).toBe("failed"); expect(job.attempts[0].outcomeUnknown).toBe(true); expect(job.attempts[0].output).toBe(mockNodeWriting()); expect(job.text).toBeNull();
  }, 20000);
});
describe("CL-D native streaming transport", () => {
  const frame = compileLowFrame(lowR8Source, { id: "transport", actors: { elora: "艾洛拉" }, player: { id: "kael", name: "凯尔" }, scenario: "当前入口。", userInput: "当前任务。" });
  it("preserves native sampling and discards provider-private reasoning", async () => {
    let body: any;
    const provider = createLowProvider(async (_url, init) => { body = JSON.parse(String(init?.body)); return new Response('data: {"choices":[{"delta":{"content":"正文","reasoning_content":"PRIVATE"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":2,"total_tokens":10}}\n\ndata: [DONE]\n', { headers: { "content-type": "text/event-stream" } }); });
    const r = await provider(compileLowRequest(frame), config, connection.key, new AbortController().signal);
    expect(body.max_tokens).toBe(65535); expect(body.stream).toBe(true); expect(body.reasoning_effort).toBe("low"); expect(body.n).toBe(1);
    expect(r.text).toBe("正文"); expect(r.usage.totalTokens).toBe(10); expect(JSON.stringify(r)).not.toContain("PRIVATE");
  });
  it("does not retry truncation or HTTP errors", async () => {
    let calls = 0; const provider = createLowProvider(async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: "partial" }, finish_reason: "length" }] }), { headers: { "content-type": "application/json" } }); });
    await expect(provider(compileLowRequest(frame), config, connection.key, new AbortController().signal)).rejects.toThrow(/截断/); expect(calls).toBe(1);
  });
});
