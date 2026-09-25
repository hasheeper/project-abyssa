import { expect, it } from "vitest";
import { directMaterial, directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { directorRuntime, directorPlan, directorScene } from "./airp-director-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";
import { creationEnvelope } from "./airp-writing-fixture";
import { inspectDirectAttempt } from "../airp-direct-gameplay/inspection";
import { bilingualParagraphs } from "../airp-generation/creative-output";
import { compileDirectorJob } from "../airp-director/jobs";

it("v5 legacy gameplay entrance persists and replays Chinese output without exposing intermediate records", async () => {
  const f = await directReturnGate("extracted"), material = directMaterial(5);
  await prepareDirect(f, material);
  const bodies: [string, string, string] = ["旁白：艾洛拉让出桌边。", "艾洛拉：「ここに。（放这儿吧。）」", "艾洛拉：「ありがとう。（谢谢。）」"], prose = bodies.join("\n");
  await simulateDirectStage(f, "planning", creationEnvelope(bodies));
  await simulateDirectStage(f, "writing", prose);
  const record = await simulateDirectStage(f, "formatting", JSON.stringify({creationRecord: "中文封装测试", lines: bilingualParagraphs(prose).map(p => ({speaker: p.speaker, emotion: "neutral", text: p.chinese}))}));
  const task = record.airpDirect!.tasks.at(-1)!;
  expect(task.source).toBe("browser-direct");
  const body = record.narrative.scenes.find(s => s.id === task.sceneId)!.body;
  expect(JSON.stringify(body)).not.toContain("CREATION_RECORD_ONLY"); expect(JSON.stringify(body)).not.toMatch(/[\u3040-\u30ff]/u);
  for (const attempt of task.attempts) expect(inspectDirectAttempt(record, task.sceneId, attempt.id).inputHash).toBe(attempt.inputHash);
  const restore = await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: "restore-v5-direct"});
  expect(restore).toMatchObject({ok: true});
  await readPoolConversation(f);
  await f.send({type: "airp-turn-in", instanceId: task.instanceId});
  await simulateDirectStage(f, "updater", JSON.stringify({summary: "艾洛拉说谢谢。", supports: [body.nodes[2].id], flags: []}));
  await f.send({type: "airp-direct-followup", instanceId: task.instanceId});
  await prepareDirect(f, material);
  const followupRecord = await f.read(), parent = followupRecord.airpDirect!.tasks.at(-1)!.context!.parent;
  expect(parent!.prose).toBe(bilingualParagraphs(prose).map(p => `${p.speaker}：${p.chinese}`).join("\n"));
  expect(parent!.prose).not.toMatch(/[\u3040-\u30ff]/u);
  expect(await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record: followupRecord}), clientRequestId: "restore-v5-followup"})).toMatchObject({ok: true});
}, 120000);

it("v5 GM offer/accept/action/feedback/end uses current prompts, Chinese read history and archive replay", async () => {
  const f = await directorRuntime(5);
  await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = (await f.read()).airpDirector!.events[0].id;
  for (let i = 0; i < 5; i++) {
    await directorScene(f, eventId);
    if (i === 0 || i === 2) await f.send({type: "airp-director-choose", eventId, choiceId: "participate"});
  }
  const record = await f.read(), state = record.airpDirector!;
  expect(state.events[0].status).toBe("resolved");
  const scenes = state.jobs.filter(j => j.kind === "scene"); expect(scenes).toHaveLength(5);
  for (const job of scenes) {
    expect(job.text!.lines[0].text).toBe("「能聊一会儿吗？」");
    expect(JSON.stringify(job.scene!.previous)).not.toContain("CREATION_RECORD_ONLY"); expect(JSON.stringify(job.scene!.previous)).not.toMatch(/[\u3040-\u30ff]/u);
    for (let i = 0; i < job.attempts.length; i++) expect(compileDirectorJob(state.materials[job.materialHash], {...job, attempts: job.attempts.slice(0, i), text: null}).stage).toBe(job.attempts[i].stage);
  }
  expect(await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: "restore-v5-gm"})).toMatchObject({ok: true});
}, 120000);
