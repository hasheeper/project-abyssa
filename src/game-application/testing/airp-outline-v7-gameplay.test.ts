import { expect, it } from "vitest";
import { directMaterial, directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { directorRuntime, directorPlan, directorOutput } from "./airp-director-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";
import { outlineV7, proseV7 } from "./airp-outline-fixture";
import { performedParagraphs } from "../airp-generation/creative-output";
import { compileDirectorJob } from "../airp-director/jobs";

const prose = proseV7;
const formatted = JSON.stringify({creationRecord: "演出表情保真", lines: performedParagraphs(prose).map(p => ({speaker: p.speaker, emotion: p.emotion, text: p.chinese}))});

it.each([7, 8] as const)("direct v%i commits writer expressions into actual AVG and keeps history annotation-free", async version => {
  const f = await directReturnGate("extracted"), material = directMaterial(version);
  await prepareDirect(f, material);
  await simulateDirectStage(f, "planning", outlineV7);
  await simulateDirectStage(f, "writing", prose);
  const record = await simulateDirectStage(f, "formatting", formatted), task = record.airpDirect!.tasks.at(-1)!;
  expect(task.attempts.map(a => a.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  const body = record.narrative.scenes.find(s => s.id === task.sceneId)!.body;
  expect(JSON.stringify(body)).toContain('"emotion":"confused"'); expect(JSON.stringify(body)).toContain('"emotion":"smile"');
  expect(JSON.stringify(body)).not.toMatch(/\[confused\]|\[smile\]|[\u3040-\u30ff]/u);
  expect(await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: "restore-v7-direct"})).toMatchObject({ok: true});
  await readPoolConversation(f); await f.send({type: "airp-turn-in", instanceId: task.instanceId});
  await simulateDirectStage(f, "updater", JSON.stringify({summary: "艾洛拉说不用急的。", supports: [body.nodes[5].id], flags: []}));
  await f.send({type: "airp-direct-followup", instanceId: task.instanceId}); await prepareDirect(f, material);
  expect((await f.read()).airpDirect!.tasks.at(-1)!.context!.parent!.prose).not.toMatch(/\[confused\]|\[smile\]|[\u3040-\u30ff]/u);
}, 120000);

it.each([7, 8] as const)("GM v%i persists expression IDs, reads Chinese only, and replays frozen compiler inputs", async version => {
  const f = await directorRuntime(version);
  await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = (await f.read()).airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId});
  let state = (await f.read()).airpDirector!, job = state.jobs.find(j => j.id === state.reading!.jobId)!;
  job = await directorOutput(f, job, "planning", outlineV7);
  job = await directorOutput(f, job, "writing", `<prose>${prose}</prose>`);
  job = await directorOutput(f, job, "formatting", formatted);
  expect(job.text!.lines.map(l => l.emotion)).toEqual(["neutral", "confused", "wry", "neutral", "serious", "smile"]);
  await f.send({type: "airp-director-show", jobId: job.id});
  for (let cursor = 0; cursor < job.text!.lines.length; cursor++) await f.send({type: "airp-director-read", jobId: job.id, cursor});
  await f.send({type: "airp-director-choose", eventId, choiceId: "participate"}); await f.send({type: "airp-director-open", eventId});
  const record = await f.read(); state = record.airpDirector!;
  const next = state.jobs.find(j => j.id === state.reading!.jobId)!;
  expect(next.scene!.previous[0].text).toContain("不用急的。"); expect(JSON.stringify(next.scene!.previous)).not.toMatch(/\[confused\]|\[smile\]|[\u3040-\u30ff]/u);
  for (let i = 0; i < job.attempts.length; i++) expect(compileDirectorJob(state.materials[job.materialHash], {...job, attempts: job.attempts.slice(0, i), text: null}).stage).toBe(job.attempts[i].stage);
  expect(await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: "restore-v7-gm"})).toMatchObject({ok: true});
}, 120000);
