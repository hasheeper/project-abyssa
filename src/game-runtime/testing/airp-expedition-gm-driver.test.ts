import { describe, expect, it } from "vitest";
import { GenerationError, emptyUsage } from "../../game-application/airp-generation/contracts";
import { clcHost, clcProposal } from "../../game-application/testing/airp-expedition-gm-fixture";
import { createExpeditionGMDriver } from "../airp-expedition-gm-driver";

const config = { baseUrl: "https://test.invalid/v1", model: "test-gm", timeoutMs: 10000 };
const noLock = async <T>(_name: string, _signal: AbortSignal, run: () => Promise<T>) => run();
function fixture() {
  const host = clcHost(); let calls = 0;
  const driver = createExpeditionGMDriver({ provider: async () => { calls++; return { text: JSON.stringify(clcProposal(host.packet)), usage: emptyUsage(), finishReason: "stop" }; }, lock: noLock, now: () => 100, id: () => "attempt:runtime" });
  return { host, driver, calls: () => calls };
}
describe("CL-C explicit GM network driver", () => {
  it("calls once and restores an accepted task with zero further calls or credential persistence", async () => {
    const f = fixture(), id = await f.host.service.enqueue();
    await f.driver.run(f.host.port, id, { config, key: "secret-test-credential" }); await f.driver.run(f.host.port, id, { config, key: "" });
    expect(f.calls()).toBe(1); expect(f.driver.getSnapshot().phase).toBe("accepted");
    expect(JSON.stringify(f.host.raw())).not.toContain("secret-test-credential"); expect(JSON.stringify(f.host.raw())).not.toContain(config.baseUrl);
  });
  it.each([false, true])("keeps returned output when saving failed (committed=%s), retrying with no network", async after => {
    const f = fixture(), id = await f.host.service.enqueue(); f.host.failOnce(r => r.ledger.jobs[0].attempts[0]?.output !== null && r.ledger.jobs[0].status === "ready", after);
    await f.driver.run(f.host.port, id, { config, key: "secret-test-credential" }); expect(f.driver.getSnapshot().pendingResult).toBe(true);
    await f.driver.retrySave(f.host.port); expect(f.calls()).toBe(1); expect(f.driver.getSnapshot()).toMatchObject({ phase: "accepted", pendingResult: false });
  });
  it("does not retry a provider error or silently alter the model", async () => {
    const host = clcHost(), id = await host.service.enqueue(); let calls = 0;
    const driver = createExpeditionGMDriver({ provider: async () => { calls++; throw new GenerationError("http-error", "HTTP 500", true); }, lock: noLock, now: () => 100, id: () => "attempt:error" });
    await driver.run(host.port, id, { config, key: "secret-test-credential" }); expect(calls).toBe(1); expect(host.raw().ledger.jobs[0].status).toBe("failed");
    expect(host.raw().ledger.jobs[0].attempts[0].model).toBe("test-gm");
  });
  it("does not dispatch without a key or automatically restart an interrupted request", async () => {
    const f = fixture(), id = await f.host.service.enqueue(); await f.driver.run(f.host.port, id, { config, key: "" }); expect(f.calls()).toBe(0);
    await f.host.service.begin(id, { id: "unknown-result", stage: "plan", model: "test-gm", connectionHash: "1".repeat(64), at: 1 });
    await f.driver.run(f.host.port, id, { config, key: "secret-test-credential" }); expect(f.calls()).toBe(0);
    await f.driver.markInterrupted(f.host.port, id); expect(f.host.raw().ledger.jobs[0].status).toBe("failed");
  });
  it("refuses to save a returned result into another epoch", async () => {
    const f = fixture(), id = await f.host.service.enqueue(); f.host.failOnce(r => r.ledger.jobs[0].status === "ready");
    await f.driver.run(f.host.port, id, { config, key: "secret-test-credential" });
    const other = clcHost(); other.mutate(r => { r.head.epoch = "another"; r.context.rules.head.epoch = "another"; });
    await f.driver.retrySave(other.port); expect(f.driver.getSnapshot().pendingResult).toBe(true); expect(other.raw().ledger.jobs).toEqual([]); expect(f.calls()).toBe(1);
  });
});
