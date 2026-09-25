import { expect, it, vi } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { createDirectorDriver, type DirectorDriverPort } from "../../game-runtime/airp-director-driver";
import { emptyUsage, type Completion } from "../airp-generation/contracts";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { directorStage } from "./jobs";
import { LOW_FIELD_REPAIR_INSTRUCTION } from "../airp-low/prompt";

const response = (speaker = "旁白") => JSON.stringify({lines: [{speaker, emotion: "neutral", text: "门轴响了一声。"}, {speaker: "艾洛拉", emotion: "neutral", text: "「等一下，门还卡着呢。」"}],
  choices: ["认真倾听", "轻松打趣", "有所保留"], phase: {complete: false, reason: "等待玩家回应"}});
async function fixture(invalid?: string, priorFormatVersion?: 1) {
  const f = await formalAirpFixture(); await f.flow.sync();
  const material = directorTestMaterial();
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 12});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  await f.send({type: "airp-director-open", eventId: f.raw().airpDirector!.events[0].id});
  const id = f.raw().airpDirector!.reading!.jobId, job = () => f.raw().airpDirector!.jobs.find(j => j.id === id)!;
  await directorOutput(wf, job(), "writing", "门轴响了一声。艾洛拉说：等一下，门还卡着呢。");
  if (priorFormatVersion) await f.send({type: "airp-director-use-format", jobId: id, formatVersion: priorFormatVersion});
  if (invalid) {
    await f.send({type: "airp-director-begin", jobId: id, attemptId: "old-format", stage: "formatting", at: 10});
    await f.send({type: "airp-director-result", jobId: id, attemptId: "old-format", output: invalid, usage: {inputTokens: 50, outputTokens: 30, totalTokens: 80}, at: 11, diagnostics: {version: 1}});
    expect(job().attempts.at(-1)?.status).toBe("failed");
  }
  const port: DirectorDriverPort = {read: async () => ({head: f.raw().head, ...f.raw().airpDirector!}), async commit(command) {await f.send(command); return this.read();}};
  const connection = {models: material.models, keys: {planning: "", writing: "", updater: ""}};
  const lock = async <T>(_key: string, signal: AbortSignal, operation: () => Promise<T>) => {signal.throwIfAborted(); return operation();};
  return {...f, id, job, port, connection, lock};
}

it("continue restores a saved narrator alias without keys, network, rewritten attempts or changed old replay", async () => {
  const f = await fixture(response()), before = f.raw(), saved = structuredClone(f.job());
  expect(saved.attempts.at(-1)?.diagnostics?.message).toContain("说话者不在本场角色目录：旁白");
  const oldArchive = JSON.stringify({archiveVersion: 4, record: before});
  expect(readD5Archive(oldArchive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(before);
  const provider = vi.fn<() => Promise<Completion>>().mockRejectedValue(Error("Unexpected API call"));
  const driver = createDirectorDriver({provider, lowProvider: provider, lock: f.lock});
  await driver.run(f.port, f.id, f.connection);
  expect(driver.getSnapshot()).toMatchObject({phase: "saved", error: null});
  expect(provider).not.toHaveBeenCalled();
  expect(f.job()).toMatchObject({lowFormatVersion: 2, lowRevalidatedFormatting: "old-format", lowPhase: {complete: false}});
  expect(f.job().text!.lines.map(l => l.speaker)).toEqual(["narrator", "elora"]);
  expect(f.job().attempts).toEqual(saved.attempts); expect(f.job().lowFrame).toEqual(saved.lowFrame);
  expect(directorStage(f.job())).toBeNull();
  await f.send({type: "airp-director-show", jobId: f.id});
  expect(f.raw().airpDirector!.cursors[f.id]).toBe(0);
  const head = f.raw().head; await driver.run(f.port, f.id, f.connection);
  expect(f.raw().head).toEqual(head); expect(provider).not.toHaveBeenCalled();
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(readD5Archive(oldArchive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(before);
}, 45000);

it.each([undefined, 1] as const)("restores an emotion-label failure from format %s with no API call or changed history", async priorVersion => {
  const raw = JSON.parse(response("narrator")); raw.lines.push({speaker: "elora", emotion: "窘迫", text: "「我才没有窘迫！」"});
  const f = await fixture(JSON.stringify(raw), priorVersion), saved = structuredClone(f.job()), before = f.raw();
  expect(saved.attempts.at(-1)?.diagnostics?.message).toBe("第3段表情不在角色目录：窘迫");
  const provider = vi.fn<() => Promise<Completion>>().mockRejectedValue(Error("Unexpected API call"));
  const driver = createDirectorDriver({provider, lowProvider: provider, lock: f.lock});
  await driver.run(f.port, f.id, f.connection);
  expect(driver.getSnapshot().error).toBeNull(); expect(provider).not.toHaveBeenCalled();
  expect(f.job().text!.lines[2]).toEqual({speaker: "elora", emotion: "flustered", text: "「我才没有窘迫！」"});
  expect(f.job().lowWarnings?.join("\n")).toContain("第3段表情标记已规范为 flustered");
  expect(f.job().attempts).toEqual(saved.attempts); expect(f.job().lowFrame).toEqual(saved.lowFrame);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: before}), AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(before);
}, 45000);

it.each([undefined, "不在场的人"])("new/retried formatting uses strict narrator instructions and still accepts the alias (%s)", async invalidSpeaker => {
  const f = await fixture(invalidSpeaker && response(invalidSpeaker)), saved = structuredClone(f.job());
  const provider = vi.fn(async (request: {messages: {content: string}[]}): Promise<Completion> => {
    expect(request.messages[0].content).toContain(LOW_FIELD_REPAIR_INSTRUCTION);
    expect(JSON.parse(request.messages[1].content).rawDraft).toBe(saved.attempts[0].output);
    return {text: response(), usage: emptyUsage(), finishReason: "stop"};
  });
  const driver = createDirectorDriver({lowProvider: provider, lock: f.lock});
  await driver.run(f.port, f.id, {...f.connection, keys: {planning: "unused-test-key", writing: "unused-test-key", updater: "unused-test-key"}});
  expect(driver.getSnapshot().error).toBeNull(); expect(provider).toHaveBeenCalledTimes(1);
  expect(f.job().attempts.slice(0, saved.attempts.length)).toEqual(saved.attempts);
  expect(f.job().lowRevalidatedFormatting).toBeUndefined();
  expect(f.job().text!.lines[0].speaker).toBe("narrator");
  expect(f.job().lowFrame).toEqual(saved.lowFrame);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 45000);
