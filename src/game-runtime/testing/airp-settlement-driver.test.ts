import { describe, expect, it } from "vitest";
import { clbHost, clbInput, clbProposal } from "../../game-application/testing/airp-settlement-fixture";
import { emptyUsage, GenerationError } from "../../game-application/airp-generation/contracts";
import { createSettlementDriver } from "../airp-settlement-driver";
import { createDirectProvider } from "../../game-infrastructure/airp-direct/provider";

const connection = { config: { baseUrl: "https://unit.invalid/v1", model: "fixture-model", timeoutMs: 1000 }, key: "unit-secret-not-persisted" };
const lock = async <T>(_name: string, _signal: AbortSignal, fn: () => Promise<T>): Promise<T> => fn();
async function fixture(items = false) {
  const { input, materials } = clbInput(), host = clbHost(input), jobId = await host.service.enqueue(input, materials);
  let calls = 0, tick = 1;
  const driver = createSettlementDriver({ lock, now: () => tick++, id: () => `attempt:${tick}`,
    provider: async () => { calls++; return { text: JSON.stringify(clbProposal(input, items)), usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, finishReason: "stop" }; } });
  return { ...host, driver, jobId, calls: () => calls };
}
describe("CL-B explicit network driver", () => {
  it("runs a single model attempt and applies a durable result; rerunning costs zero", async () => {
    const f = await fixture(); expect(f.calls()).toBe(0);
    await f.driver.run(f.port, f.jobId, connection); expect(f.driver.getSnapshot().phase).toBe("done"); expect(f.calls()).toBe(1);
    await f.driver.run(f.port, f.jobId, connection); expect(f.calls()).toBe(1);
    expect(JSON.stringify(f.raw())).not.toContain(connection.key);
    expect(JSON.stringify(f.raw())).not.toContain(connection.config.baseUrl);
  });
  it.each([false, true])("retains output for save retry without another request (lost acknowledgement=%s)", async after => {
    const f = await fixture(); f.failOnce(r => r.ledger.jobs[0].status === "ready", after);
    await f.driver.run(f.port, f.jobId, connection);
    expect(f.driver.getSnapshot().pendingResult).toBe(true); expect(f.calls()).toBe(1);
    expect(f.driver.exportPending()).not.toContain(connection.key);
    await f.driver.retrySave(f.port); expect(f.driver.getSnapshot().phase).toBe("done"); expect(f.calls()).toBe(1); expect(f.raw().ledger.memories).toHaveLength(1);
  });
  it("does not resend when asset implementation or final atomic save is unavailable", async () => {
    const f = await fixture(true); f.assetsReady(false);
    await f.driver.run(f.port, f.jobId, connection); expect(f.driver.getSnapshot().phase).toBe("failed"); expect(f.calls()).toBe(1);
    f.assetsReady(true); await f.driver.run(f.port, f.jobId, connection); expect(f.driver.getSnapshot().phase).toBe("done"); expect(f.calls()).toBe(1); expect(f.raw().itemCount).toBe(1);
  });
  it("restores an unknown running request without automatic resend; interruption is explicit", async () => {
    const f = await fixture();
    await f.service.begin(f.jobId, { id: "interrupted:1", model: connection.config.model, connectionHash: "1".repeat(64), at: 0 });
    await f.driver.run(f.port, f.jobId, connection); expect(f.calls()).toBe(0); expect(f.driver.getSnapshot().error).toContain("结果未知");
    await f.driver.markInterrupted(f.port, f.jobId); expect(f.calls()).toBe(0);
    expect(f.raw().ledger.jobs[0].attempts[0]).toMatchObject({ status: "interrupted", outcomeUnknown: true });
  });
  it("keeps provider failure pending with unknown usage and never loops", async () => {
    const f = await fixture(); let calls = 0;
    const driver = createSettlementDriver({ lock, now: () => 10, id: () => "failed:1", provider: async () => { calls++; throw new GenerationError("network", "network failed", true); } });
    await driver.run(f.port, f.jobId, connection);
    expect(calls).toBe(1); expect(f.raw().ledger.jobs[0].attempts[0]).toMatchObject({ status: "failed", outcomeUnknown: true, usage: emptyUsage() }); expect(f.raw().ledger.memories).toEqual([]);
  });
  it("uses the existing OAI Chat provider with a dedicated small-model task and in-memory key", async () => {
    const f = await fixture(); let body: any;
    const provider = createDirectProvider(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(clbProposal(f.input)) } }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }), { status: 200 });
    });
    const driver = createSettlementDriver({ lock, provider, now: () => 1, id: () => "oai:1" });
    await driver.run(f.port, f.jobId, connection);
    expect(driver.getSnapshot().phase).toBe("done"); expect(body.model).toBe("fixture-model"); expect(body.stream).toBe(false);
    expect(body.messages[0].content).toContain("事后结算器"); expect(body.messages).toHaveLength(2); expect(body.tools).toBeUndefined();
  });
  it("rejects credential echo without saving it", async () => {
    const f = await fixture();
    const driver = createSettlementDriver({ lock, now: () => 1, id: () => "echo:1", provider: async () => ({ text: connection.key, usage: emptyUsage(), finishReason: "stop" }) });
    await driver.run(f.port, f.jobId, connection); expect(driver.getSnapshot().phase).toBe("failed");
    expect(JSON.stringify(f.raw())).not.toContain(connection.key); expect(driver.exportPending()).not.toContain(connection.key);
  });
  it("cancellation retains an unknown paid attempt, and a pending result cannot cross saves", async () => {
    const f = await fixture(); let started!: () => void;
    const hasStarted = new Promise<void>(resolve => { started = resolve; });
    const driver = createSettlementDriver({ lock, now: () => 1, id: () => "cancel:1", provider: async (_request, _key, signal) => {
      started(); return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new GenerationError("cancelled", "cancelled", true)), { once: true }));
    } });
    const running = driver.run(f.port, f.jobId, connection); await hasStarted; driver.cancel(); await running;
    expect(f.raw().ledger.jobs[0].attempts[0]).toMatchObject({ error: "cancelled", outcomeUnknown: true });
    expect(f.raw().ledger.memories).toEqual([]);
    const pending = await fixture(); pending.failOnce(r => r.ledger.jobs[0].status === "ready");
    await pending.driver.run(pending.port, pending.jobId, connection);
    const otherInput = clbInput().input; otherInput.state.head = { ...otherInput.state.head, saveId: "different-save" };
    const other = clbHost(otherInput);
    await pending.driver.retrySave(other.port);
    expect(pending.driver.getSnapshot().pendingResult).toBe(true); expect(other.raw().ledger.jobs).toEqual([]); expect(pending.calls()).toBe(1);
  });
});
