import { emptyUsage } from "../airp-generation/contracts";
import type { DirectorJob } from "../airp-director/contracts";
import { directorHash } from "../../game-core/session";
import { poolTestRuntime } from "./airp-pool-playthrough";
import { directorTestMaterial } from "./airp-director-fixture";
import { creationEnvelope } from "./airp-writing-fixture";
import { OUTLINE_PREFLIGHT } from "../airp-generation/outline-output";
import { mockNodeWriting } from "./airp-node-fixture";
import { readLowWriting } from "../airp-low/output";

export async function directorRuntime(version: 4 | 5 | 6 | 7 | 8 = 4) {
  const f = poolTestRuntime(undefined, "director-test");
  // Historical CL-A–D evidence is content19, regardless of the current title shortcut.
  const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 19, profileId: "profile.demo.first-run", saveId: "director-test", epoch: "director-epoch", clientRequestId: "create-director"});
  if (!created.ok) throw Error(JSON.stringify(created));
  await f.send({type: "select-game-start", startAt: "airp-director", playerName: "凯尔"});
  await f.send({type: "airp-director-configure", material: directorTestMaterial(version)});
  return f;
}
export type DirectorFixture = Awaited<ReturnType<typeof directorRuntime>>;
type DirectorWorkflow = { read(): Promise<import("../versions/d5-contracts").D5GameRecord>; send(command: import("../versions/d5-contracts").D5Command): Promise<unknown> };
export async function directorOutput(f: DirectorWorkflow, job: DirectorJob, stage: "director" | "review" | "planning" | "writing" | "formatting" | "memory" | "scene-plan" | "scene-evaluate", output: string) {
  const revision = (await f.read()).head.revision, attemptId = `attempt:${revision}`, at = 1000 + revision * 10;
  await f.send({type: "airp-director-begin", jobId: job.id, attemptId, stage, at});
  await f.send({type: "airp-director-result", jobId: job.id, attemptId, at: at + 1, output, usage: emptyUsage()});
  const result = (await f.read()).airpDirector!.jobs.find(j => j.id === job.id)!;
  if (result.attempts.at(-1)?.status !== "succeeded") throw Error(`Mock ${stage} failed validation`);
  return result;
}
export async function directorPlan(f: DirectorWorkflow, source: unknown | null, replan = false) {
  await f.send({type: replan ? "airp-director-prepare-replan" : "airp-director-prepare-day"});
  let job = (await f.read()).airpDirector!.jobs.at(-1)!;
  const c = job.planning!, phase = c.world.phase, day = c.budget.day;
  const s = source as {kind?: string; card?: {load: string}; definitionId?: string; eventId?: string; parentId?: string} | null;
  const card = s?.card ?? c.fixed.find(f => f.card.id === s?.definitionId)?.card ?? c.world.reserves?.find(r => r.eventId === s?.eventId)?.card ?? c.world.followups.find(f => f.parentId === s?.parentId)?.card;
  const proposal = {version: 1, day, reason: "测试替身，不是真实模型证据", focus: source && card?.load === "focus" ? {kind: "new", id: "entry"} : null,
    entries: source ? [{id: "entry", fromPhase: Math.max(phase, (day - 1) * 4 + 2), throughPhase: (day - 1) * 4 + 3, basisIds: [c.world.sourceIds[0]], source}] : []};
  job = await directorOutput(f, job, "director", JSON.stringify(proposal));
  if ((source as {kind?: string})?.kind === "free") job = await directorOutput(f, job, "review", JSON.stringify({version: 1, planHash: directorHash(proposal), decisions: [{entryId: "entry", verdict: "new", matchedSourceIds: [], reason: "测试独立复核"}]}));
  await f.send({type: "airp-director-accept-day", jobId: job.id});
  return job;
}
export async function directorScene(f: DirectorWorkflow, eventId: string) {
  await f.send({type: "airp-director-open", eventId});
  const state = (await f.read()).airpDirector!;
  let job = state.jobs.find(j => j.id === state.reading!.jobId)!;
  if (!job.text && job.lowFrame) {
    const writing = mockNodeWriting();
    job = await directorOutput(f, job, "writing", writing);
    job = await directorOutput(f, job, "formatting", JSON.stringify(readLowWriting(writing, job.lowFrame!).text));
  } else if (!job.text) {
    const actor = job.scene!.actorIds[0], names: Record<string, string> = {elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
    const line = "「少し、いい？（能聊一会儿吗？）」";
    const version = state.materials[job.materialHash].resources.version, v5 = version >= 5;
    job = await directorOutput(f, job, "planning", version >= 7 ? OUTLINE_PREFLIGHT : v5 ? creationEnvelope(["旁白：测试场景。", `${names[actor]}：${line}`, "旁白：测试动作。"]) : "第一段：当前场景。第二段：当前互动。第三段：等待选择。");
    job = await directorOutput(f, job, "writing", `${v5 ? "" : "<planning>测试用创作记录。</planning>"}<prose>${names[actor]}${version >= 6 ? "[neutral]" : ""}：${line}</prose>`);
    job = await directorOutput(f, job, "formatting", JSON.stringify({creationRecord: "保真测试", lines: [{speaker: actor, emotion: "neutral", text: v5 ? "「能聊一会儿吗？」" : line}]}));
  }
  await f.send({type: "airp-director-show", jobId: job.id});
  for (let cursor = (await f.read()).airpDirector!.cursors[job.id] ?? 0; cursor < job.text!.lines.length; cursor++) await f.send({type: "airp-director-read", jobId: job.id, cursor});
  return (await f.read()).airpDirector!.events.find(e => e.id === eventId)!;
}
