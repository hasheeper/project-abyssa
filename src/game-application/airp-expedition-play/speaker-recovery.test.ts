import { expect, it, vi } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { createNodeDriver } from "../../game-runtime/airp-expedition-play-driver";
import { emptyUsage, type Completion } from "../airp-generation/contracts";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { LOW_FIELD_REPAIR_INSTRUCTION } from "../airp-low/prompt";

const response = JSON.stringify({lines: [{speaker: "旁白", emotion: "neutral", text: "门轴响了一声。"}, {speaker: "艾洛拉", text: "「等一下，门还卡着呢。」"}], choices: ["认真倾听", "轻松打趣", "有所保留"]});
async function fixture(failed: boolean, invalid = response, priorFormatVersion?: 1) {
  const f = await formalAirpFixture(), plan = await f.prepare(), permit = await f.flow.gm.departurePermit(plan);
  await f.send({type: "start-expedition", ...permit.departure}); await f.flow.sync();
  const id = airpGameView(f.raw())!.node!.id;
  await f.flow.nodes.open(id);
  await f.flow.nodes.begin(id, {id: "writing", stage: "writing", model: "mock", connectionHash: "2".repeat(64), at: 1});
  await f.flow.nodes.result(id, "writing", "门轴响了一声。艾洛拉说：等一下，门还卡着呢。", emptyUsage(), 2);
  if (priorFormatVersion) await f.flow.nodes.useFormatProtocol(id, priorFormatVersion);
  if (failed) {
    await f.flow.nodes.begin(id, {id: "old-format", stage: "formatting", model: "mock", connectionHash: "2".repeat(64), at: 3});
    await f.flow.nodes.result(id, "old-format", invalid, emptyUsage(), 4);
  }
  const job = () => airpGameView(f.raw())!.node!;
  const lock = async <T>(_key: string, signal: AbortSignal, operation: () => Promise<T>) => {signal.throwIfAborted(); return operation();};
  return {...f, id, job, lock};
}
it("expedition continue recovers the saved response offline and keeps the original failure and archive valid", async () => {
  const f = await fixture(true), before = f.raw(), saved = structuredClone(f.job());
  expect(saved.attempts.at(-1)).toMatchObject({status: "failed", diagnostics: {code: "invalid-output"}});
  const provider = vi.fn<() => Promise<Completion>>().mockRejectedValue(Error("Unexpected API call"));
  const driver = createNodeDriver({provider, lock: f.lock});
  await driver.run(f.flow.host.nodes, f.id, {config: {baseUrl: "https://unused.invalid/v1", model: "unused", timeoutMs: 1000}, key: ""});
  expect(driver.getSnapshot()).toMatchObject({phase: "readable", error: null}); expect(provider).not.toHaveBeenCalled();
  expect(f.job().text!.lines.map(l => l.speaker)).toEqual(["narrator", "elora"]);
  expect(f.job().formattingRevalidation).toEqual({attemptId: "old-format", formatVersion: 2});
  expect(f.job().attempts).toEqual(saved.attempts); expect(f.job().frame).toEqual(saved.frame);
  await f.flow.nodes.readLine(f.id, 0);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: before}), AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(before);
}, 30000);
it("expedition restores a format-v1 emotion error offline with original usage and Chinese intact", async () => {
  const raw = JSON.parse(response); raw.lines[0].speaker = "narrator"; raw.lines.push({speaker: "elora", emotion: "窘迫", text: "「我才没有窘迫！」"});
  const f = await fixture(true, JSON.stringify(raw), 1), saved = structuredClone(f.job()), before = f.raw();
  expect(saved.attempts.at(-1)?.diagnostics?.message).toBe("第3段表情不在角色目录：窘迫");
  const provider = vi.fn<() => Promise<Completion>>().mockRejectedValue(Error("Unexpected API call"));
  const driver = createNodeDriver({provider, lock: f.lock});
  await driver.run(f.flow.host.nodes, f.id, {config: {baseUrl: "https://unused.invalid/v1", model: "unused", timeoutMs: 1000}, key: ""});
  expect(driver.getSnapshot()).toMatchObject({phase: "readable", error: null}); expect(provider).not.toHaveBeenCalled();
  expect(f.job().text!.lines[2]).toEqual({speaker: "elora", emotion: "flustered", text: "「我才没有窘迫！」"});
  expect(f.job().formattingRevalidation).toEqual({attemptId: "old-format", formatVersion: 2});
  expect(f.job().attempts).toEqual(saved.attempts); expect(f.job().frame).toEqual(saved.frame);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: before}), AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(before);
}, 30000);
it("expedition requests require narrator and normalize a new alias response", async () => {
  const f = await fixture(false), saved = structuredClone(f.job());
  const provider = vi.fn(async (request: {messages: {content: string}[]}): Promise<Completion> => {
    expect(request.messages[0].content).toContain(LOW_FIELD_REPAIR_INSTRUCTION);
    return {text: response, usage: emptyUsage(), finishReason: "stop"};
  });
  const driver = createNodeDriver({provider, lock: f.lock});
  await driver.run(f.flow.host.nodes, f.id, {config: {baseUrl: "https://unused.invalid/v1", model: "mock", timeoutMs: 1000}, key: "test-key-not-sent"});
  expect(driver.getSnapshot().error).toBeNull(); expect(provider).toHaveBeenCalledTimes(1);
  expect(f.job().text!.lines[0].speaker).toBe("narrator"); expect(f.job().frame).toEqual(saved.frame);
}, 30000);
