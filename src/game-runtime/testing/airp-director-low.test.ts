import { expect, it, vi } from "vitest";
import { formalAirpFixture } from "../../game-application/testing/airp-game-fixture";
import { directorTestMaterial } from "../../game-application/testing/airp-director-fixture";
import { directorPlan } from "../../game-application/testing/airp-director-playthrough";
import { mockNodeWriting } from "../../game-application/testing/airp-node-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { readLowWriting } from "../../game-application/airp-low/output";
import { emptyUsage } from "../../game-application/airp-generation/contracts";
import { createDirectorDriver, type DirectorDriverPort } from "../airp-director-driver";
import { readD5Archive } from "../../game-application/versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { directorCallLog, serializeCallLog } from "../airp-call-log";
import type { LowRequest } from "../../game-application/airp-low/contracts";

it.each([false, true])("v5 raw draft reaches postprocessor and only failed postprocessing retries (historical failed draft=%s)", async historical => {
  const f = await formalAirpFixture(), material = directorTestMaterial(); await f.flow.sync();
  await f.send({ type: "airp-director-configure", material, lowMaterial: lowR8Source, ...(historical ? {} : { lowReadVersion: 5 as const }) });
  await directorPlan({ read: async () => f.raw(), send: f.send }, { kind: "fixed", definitionId: "ripple.elora.old-medicine-case" });
  await f.send({ type: "advance-phase" }); await f.send({ type: "advance-phase" });
  await f.send({ type: "airp-director-open", eventId: f.raw().airpDirector!.events[0].id });
  const jobId = f.raw().airpDirector!.reading!.jobId, current = () => f.raw().airpDirector!.jobs.find(j => j.id === jobId)!;
  const port: DirectorDriverPort = { read: async () => ({ head: f.raw().head, ...f.raw().airpDirector! }), async commit(c) { await f.send(c); return this.read(); } };
  const draft = '艾洛拉：先别碰。\n她按住搭扣。\n「这里还卡着东西。」';
  const formatted = { lines: [{ speaker: "elora", emotion: "neutral", text: "「先别碰。」" }, { speaker: "narrator", emotion: "neutral", text: "她按住搭扣。" }, { speaker: "elora", emotion: "serious", text: "「这里还卡着东西。」" }], choices: ["先观察", "主动帮忙", "暂且离开"] };
  let serial = 0, formats = 0;
  const lowProvider = vi.fn(async (request: LowRequest) => {
    if (request.stage === "formatting") {
      expect(JSON.parse(request.messages[1].content).rawDraft).toBe(draft);
      expect(JSON.parse(request.messages[1].content)).not.toHaveProperty("expected");
    }
    return { text: request.stage === "writing" ? draft : ++formats === 1 ? "broken JSON" : JSON.stringify(formatted), usage: { inputTokens: 33500, outputTokens: 35, totalTokens: 33535 }, finishReason: "stop" as const, diagnostics: { version: 1 as const, httpStatus: 200, requestId: `request-${serial}`, finishReason: "stop" } };
  });
  const driver = createDirectorDriver({ lowProvider, now: () => ++serial, id: () => `v5:${++serial}`, lock: async (_key, _signal, op) => op() });
  const connection = { models: material.models, keys: { planning: "test-only-secret", writing: "test-only-secret", updater: "test-only-secret" } };
  await driver.run(port, jobId, connection);
  const writingAttempt = structuredClone(current().attempts[0]);
  if (historical) {
    expect(current().attempts).toHaveLength(1); expect(writingAttempt.status).toBe("failed");
    expect(writingAttempt.diagnostics?.message).toContain("Plan");
    await f.send({ type: "airp-director-revalidate-low", jobId, readerVersion: 5 });
    await driver.run(port, jobId, connection);
  } else expect(writingAttempt.status).toBe("succeeded");
  expect(current().attempts.at(-1)?.stage).toBe("formatting"); expect(current().attempts.at(-1)?.status).toBe("failed");
  expect(current().attempts.at(-1)?.diagnostics?.message).toBeTruthy(); expect(current().text).toBeNull();
  await driver.run(port, jobId, connection);
  expect(lowProvider.mock.calls.map(([r]) => r.stage)).toEqual(["writing", "formatting", "formatting"]);
  expect(current().attempts[0]).toEqual(writingAttempt); expect(current().text?.lines).toEqual(formatted.lines);
  const log = serializeCallLog(directorCallLog(current(), material), current().lowWarnings);
  expect(log).toContain("broken JSON"); expect(log).toContain("33535"); expect(log).toContain(draft.split("\n")[0]);
  expect(log).not.toContain(connection.keys.writing); expect(log).not.toContain(material.models.writing.baseUrl);
  await f.send({ type: "airp-director-show", jobId });
  await f.send({ type: "airp-director-read", jobId, cursor: 0 });
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 40000);

it("formal manor Low uses only the Low transport, confirms a failed-stage connection, and restores without resending prose", async () => {
  const f = await formalAirpFixture(), material = directorTestMaterial(); await f.flow.sync();
  await f.send({ type: "airp-director-configure", material, lowMaterial: lowR8Source });
  await directorPlan({ read: async () => f.raw(), send: f.send }, { kind: "fixed", definitionId: "ripple.elora.old-medicine-case" });
  await f.send({ type: "advance-phase" }); await f.send({ type: "advance-phase" });
  await f.send({ type: "airp-director-open", eventId: f.raw().airpDirector!.events[0].id });
  const jobId = f.raw().airpDirector!.reading!.jobId, current = () => f.raw().airpDirector!.jobs.find(j => j.id === jobId)!;
  const port: DirectorDriverPort = {
    read: async () => ({ head: f.raw().head, ...f.raw().airpDirector! }),
    async commit(command) { await f.send(command); return this.read(); },
  };
  let serial = 0;
  const options = { now: () => ++serial, id: () => `low:${++serial}`, lock: async <T>(_key: string, signal: AbortSignal, op: () => Promise<T>) => { signal.throwIfAborted(); return op(); } };
  const connection = { models: structuredClone(material.models), keys: { planning: "test-secret-only", writing: "test-secret-only", updater: "test-secret-only" } };
  const writing = mockNodeWriting(), formatted = JSON.stringify(readLowWriting(writing, current().lowFrame!).text);
  const outputs = [writing, "invalid JSON", formatted];
  const provider = vi.fn(async () => { throw Error("Legacy transport must not be called for Low"); });
  const lowProvider = vi.fn(async () => ({ text: outputs.shift()!, usage: emptyUsage(), finishReason: "stop" as const }));
  await expect(f.send({ type: "airp-director-reconnect", jobId, config: connection.models.writing })).rejects.toThrow();
  const first = createDirectorDriver({ ...options, provider, lowProvider }); await first.run(port, jobId, connection);
  expect(provider).not.toHaveBeenCalled(); expect(lowProvider).toHaveBeenCalledTimes(2);
  expect(current().attempts.map(a => [a.stage, a.status])).toEqual([["writing", "succeeded"], ["formatting", "failed"]]);
  const original = structuredClone(current().attempts[0]);
  connection.models.updater = { ...connection.models.updater, baseUrl: "https://changed.invalid/v1", model: "replacement-formatter" };
  const resumed = createDirectorDriver({ ...options, provider, lowProvider });
  await resumed.run(port, jobId, connection); expect(lowProvider).toHaveBeenCalledTimes(2);
  await f.send({ type: "airp-director-reconnect", jobId, config: connection.models.updater });
  expect(lowProvider).toHaveBeenCalledTimes(2); expect(current().connections).toHaveLength(1);
  await resumed.run(port, jobId, connection);
  expect(lowProvider).toHaveBeenCalledTimes(3); expect(provider).not.toHaveBeenCalled();
  expect(current().attempts[0]).toEqual(original);
  expect(current().attempts.map(a => a.stage)).toEqual(["writing", "formatting", "formatting"]);
  expect(current().text!.lines).toEqual(readLowWriting(writing, current().lowFrame!).text.lines);
  expect(current().lowChoices).toHaveLength(3);
  await resumed.run(port, jobId, connection); expect(lowProvider).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(f.raw())).not.toContain(connection.keys.writing);
  await expect(f.send({ type: "airp-director-reconnect", jobId, config: connection.models.writing })).rejects.toThrow();
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 30000);
