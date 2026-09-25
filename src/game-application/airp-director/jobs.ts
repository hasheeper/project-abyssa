import * as v from "../../game-core/contracts";
import { directorHash, validateDirectorPlan } from "../../game-core/session";
import { emptyUsage } from "../airp-generation/contracts";
import { parseDirectUsage } from "../airp-direct-gameplay/parse";
import { compileDirectorInput } from "./compile";
import { acceptDirectorText, compileDirectorScene, directorActorNames, directorProse, validateDirectorWriting } from "./scene";
import { usesCreativeProtocol, validateCreativeStage } from "../airp-generation/creative-output";
import { DIRECTOR_RUNTIME_LIMITS, type DirectorJob, type DirectorJobCommand, type DirectorMaterial, type DirectorStage } from "./contracts";
import { compileDirectorLow, directorLowFrame, directorLowWriting } from "./low";
import { acceptLowText, acceptLowDraft } from "../airp-low/output";
import { parseCallDiagnostics, redactCallText } from "../airp-generation/diagnostics";
import { compileDayRepair } from "./day-repair";
import type { LowMaterial, LowText } from "../airp-low/contracts";
import { lowHash } from "../airp-low/native";
import { compileSceneGM, readSceneGMEvaluation, readSceneGMPlan } from "./scene-gm";
import { correctionEnvelope } from "../airp-memory/effective";

function installLowText(job: DirectorJob, text: LowText) {
  job.text = { creationRecord: "Low中文保真封装", lines: text.lines }; job.lowChoices = text.choices;
  if (text.phase) job.lowPhase = text.phase;
  if (text.formatWarnings?.length) job.lowWarnings = [...(job.lowWarnings ?? []), ...text.formatWarnings];
  if (text.fidelity) {
    job.lowFidelity = text.fidelity;
    job.lowWarnings = [...(job.lowWarnings ?? []), text.fidelity.mode === "canonical" ? text.fidelity.restored ? "封装与原中文不一致：显示原稿逐段中文，封装原响应保留可查。" : "中文逐段保真核对一致。" : "原稿未能可靠逐段解析：使用模型提取结果，未宣称逐字保真。"];
  }
}

export function directorStage(job: DirectorJob): DirectorStage | null {
  if (job.kind === "memory") return job.excerpt ? null : "memory";
  if (job.kind === "day") return job.proposal ? job.proposal.entries.some(e => e.source.kind === "free") && !job.review ? "review" : null : "director";
  const managed = (job.lowContextVersion ?? 0) >= 14;
  if (managed && job.lowContextVersion! < 16 && !job.sceneGMPlan) return "scene-plan";
  for (const stage of (job.lowFrame ? ["writing", "formatting"] : ["planning", "writing", "formatting"]) as ("planning" | "writing" | "formatting")[]) if (!(stage === "writing" && job.lowRevalidatedWriting || stage === "formatting" && job.lowRevalidatedFormatting) && !job.attempts.some(a => a.stage === stage && a.status === "succeeded")) return stage;
  return managed && !job.sceneGMEvaluation ? "scene-evaluate" : null;
}
export function parseDirectorJobCommand(raw: unknown): DirectorJobCommand {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > DIRECTOR_RUNTIME_LIMITS.commandBytes) v.invalid("director.command", "Command exceeds capacity", "airp-capacity");
  const r = v.record(raw, "director.jobCommand"), type = v.choice(r.type, ["airp-director-begin", "airp-director-result", "airp-director-fail", "airp-director-use-format"], "director.type");
  if (type === "airp-director-use-format") {
    v.record(r, "director.jobCommand", ["type", "jobId", "formatVersion"]);
    return { type, jobId: v.id(r.jobId, "jobId"), formatVersion: v.choice(r.formatVersion, [1, 2], "formatVersion") };
  }
  v.record(r, "director.jobCommand", ["type", "jobId", "attemptId", "at", ...(type === "airp-director-begin" ? ["stage", ...("formatRepair" in r ? ["formatRepair"] : []), ...("directorRepair" in r ? ["directorRepair"] : [])] : type === "airp-director-result" ? ["output", "usage"] : ["error", "outcomeUnknown", "usage"])], type === "airp-director-begin" ? [] : ["diagnostics"]);
  const common = {type, jobId: v.id(r.jobId, "jobId"), attemptId: v.id(r.attemptId, "attemptId"), at: v.number(r.at, "at")};
  if (type === "airp-director-begin") return {...common, type, stage: v.choice(r.stage, ["director", "review", "planning", "writing", "formatting", "memory", "scene-plan", "scene-evaluate"], "stage"),
    ...(r.formatRepair === undefined ? {} : {formatRepair: v.choice(r.formatRepair, [1] as const, "formatRepair")}),
    ...(r.directorRepair === undefined ? {} : {directorRepair: v.choice(r.directorRepair, [1] as const, "directorRepair")})};
  const diagnostics = r.diagnostics === undefined ? {} : { diagnostics: parseCallDiagnostics(r.diagnostics) };
  if (type === "airp-director-result") return {...common, type, output: v.text(r.output, "output", DIRECTOR_RUNTIME_LIMITS.commandBytes), usage: parseDirectUsage(r.usage), ...diagnostics};
  return {...common, type, error: v.choice(r.error, ["provider-error", "cancelled", "interrupted"], "error"), outcomeUnknown: v.boolean(r.outcomeUnknown, "outcomeUnknown"), usage: parseDirectUsage(r.usage), ...diagnostics};
}
export function compileDirectorJob(material: DirectorMaterial, job: DirectorJob, formatRepair?: 1, directorRepair?: 1) {
  const stage = directorStage(job);
  if (!stage) v.invalid("director.job", "This job already has all outputs");
  if (stage === "scene-plan" || stage === "scene-evaluate") return compileSceneGM(job, stage, material.resources.sources);
  if (directorRepair !== undefined && (job.kind !== "day" || stage !== "director" || formatRepair !== undefined)) v.invalid("director.repair", "Only a failed day proposal can use technical repair");
  if (job.lowFrame && (stage === "writing" || stage === "formatting")) return compileDirectorLow(job, stage);
  if (formatRepair !== undefined && (stage !== "formatting" || !job.attempts.some(a => a.stage === "formatting" && a.error === "invalid-output")))
    v.invalid("director.formatRepair", "Repair requires a previous invalid formatting attempt");
  if (job.kind === "memory") {
    if (!job.scene || !job.text) v.invalid("director.memory", "Missing fully read source");
    const messages = [{role: "system" as const, content: "你只整理已经读完的这一场记忆摘录，不创作、不加载文学预设。不推断情绪、奖励或未发生任务结果。选取至多8段值得后续承接的原文，严格JSON：{sourceSceneId,quotes:[{line:原数组从0开始的索引,text:该段text逐字全文}]}。没有需摘录的内容可以空数组。原文全文仍由程序保存，摘录不替代原文。"},
      {role: "user" as const, content: JSON.stringify({sourceSceneId: job.scene.sceneId, readLines: job.text.lines, facts: job.scene.facts, selected: job.scene.selected})}];
    return {stage, messages, bytes: messages.reduce((n, m) => n + v.utf8Size(m.content), 0), contextHash: directorHash(job.scene), selectedMemoryIds: [], diagnostics: ["独立读后摘录，仅已读来源"]};
  }
  if (job.kind === "scene" && (stage === "planning" || stage === "writing" || stage === "formatting")) return compileDirectorScene(material, job, stage, formatRepair);
  if (!job.planning) v.invalid("director.job", "Missing day context");
  const input = compileDirectorInput(material, job.planning, stage === "review" ? job.proposal : undefined, job.gmContext);
  return directorRepair === 1 ? compileDayRepair(input, job) : input;
}

/** Pure durable attempt transition, shared by execution and later historical replay. */
export function reduceDirectorJob(previous: DirectorJob, material: DirectorMaterial, raw: DirectorJobCommand, lowMaterial?: LowMaterial): DirectorJob {
  const command = parseDirectorJobCommand(raw), job = structuredClone(previous);
  if (command.jobId !== job.id) v.invalid("director.job", "Response belongs to another task", "airp-stale-result");
  if (directorHash(material) !== job.materialHash) v.invalid("director.material", "Task material cannot change during retry");
  if (command.type === "airp-director-use-format") {
    if (job.lowFormatVersion === command.formatVersion) return job;
    if ((job.lowFormatVersion ?? 0) > command.formatVersion) v.invalid("director.format", "Cannot downgrade an adopted field protocol");
    if (!job.lowFrame || (job.lowReadVersion ?? job.lowFrame.readerVersion ?? 1) < 5 || job.text || directorStage(job) !== "formatting" || job.attempts.some(a => a.status === "running"))
      v.invalid("director.format", "Only idle unfinished postprocessing can adopt the field protocol");
    job.lowFormatVersion = command.formatVersion;
    const saved = job.attempts.filter(a => a.stage === "formatting").at(-1);
    if (saved?.status === "failed" && saved.error === "invalid-output" && saved.output) {
      try {
        const text = acceptLowText(saved.output, directorLowWriting(job), job.lowFrame, job.lowReadVersion, job.lowFormatVersion);
        installLowText(job, text); job.lowRevalidatedFormatting = saved.id;
        job.lowWarnings = [...(job.lowWarnings ?? []), "已离线恢复保存的封装响应；未重新调用模型，原失败记录保留。"];
      } catch { /* Other output defects still require explicit postprocessing; never invent text. */ }
    }
    return job;
  }
  if (command.type === "airp-director-begin") {
    if (job.attempts.some(a => a.id === command.attemptId || a.status === "running")) v.invalid("director.attempt", "Duplicate or concurrently running attempt");
    if (job.attempts.length >= DIRECTOR_RUNTIME_LIMITS.attemptsPerJob) v.invalid("director.attempt", "Attempt capacity exhausted; existing outputs retained", "airp-capacity");
    const input = compileDirectorJob(material, job, command.formatRepair, command.directorRepair);
    if (input.stage !== command.stage) v.invalid("director.stage", "Cannot skip a prerequisite stage");
    job.attempts.push({id: command.attemptId, stage: command.stage, ordinal: job.attempts.filter(a => a.stage === command.stage).length + 1,
      inputHash: directorHash(input), ...(command.formatRepair === undefined ? {} : {formatRepair: command.formatRepair}), ...(command.directorRepair === undefined ? {} : {directorRepair: command.directorRepair}),
      at: command.at, endedAt: null, status: "running", output: null, usage: emptyUsage(), outcomeUnknown: false, error: null});
    return job;
  }
  const attempt = job.attempts.find(a => a.id === command.attemptId);
  if (!attempt || attempt.status !== "running" || command.at < attempt.at) v.invalid("director.attempt", "No matching live attempt", "airp-stale-result");
  attempt.endedAt = command.at; attempt.usage = command.usage;
  if (command.diagnostics) attempt.diagnostics = command.diagnostics;
  if (command.type === "airp-director-fail") {
    attempt.status = "failed"; attempt.error = command.error; attempt.outcomeUnknown = command.outcomeUnknown; return job;
  }
  attempt.output = command.output;
  try {
    const input = compileDirectorJob(material, job, attempt.formatRepair, attempt.directorRepair);
    if (directorHash(input) !== attempt.inputHash) v.invalid("director.input", "Frozen input hash differs");
    if (job.kind === "memory") {
      const r = v.record(JSON.parse(command.output), "memory", ["sourceSceneId", "quotes"]);
      if (r.sourceSceneId !== job.scene!.sceneId) v.invalid("memory", "Foreign source");
      const quotes = v.list(r.quotes, "quotes", 8).map(raw => {
        const q = v.record(raw, "quote", ["line", "text"]), line = v.number(q.line, "line", 0, job.text!.lines.length - 1);
        const text = v.text(q.text, "text", 12000);
        if (job.text!.lines[line].text !== text) v.invalid("quote", "Excerpt must be verbatim, never a invented memory");
        return {line, text};
      });
      if (new Set(quotes.map(q => q.line)).size !== quotes.length) v.invalid("quotes", "Duplicate excerpt");
      job.excerpt = {sourceSceneId: job.scene!.sceneId, quotes}; attempt.status = "succeeded"; return job;
    }
    if (job.kind === "scene") {
      if (!command.output.trim()) v.invalid("director.output", "Empty response");
      if (job.lowFrame) {
        if (attempt.stage === "scene-plan") {
          const plan = readSceneGMPlan(command.output);
          if (!lowMaterial || lowHash(lowMaterial) !== job.lowFrame.materialHash) v.invalid("scene-gm", "Original full Low material is required to apply GM pacing");
          const frame = directorLowFrame(lowMaterial!, job.scene!, job.lowContextVersion, 6, plan);
          job.sceneGMPlan = plan; job.lowFrame = frame;
        } else if (attempt.stage === "scene-evaluate") {
          job.sceneGMEvaluation = readSceneGMEvaluation(command.output, job);
          job.lowPhase = {complete: job.sceneGMEvaluation.complete, reason: job.sceneGMEvaluation.reason};
          if (job.lowPhase.complete) job.lowChoices = [];
        } else if (attempt.stage === "writing") job.lowWarnings = acceptLowDraft(command.output, job.lowFrame, job.lowReadVersion).warnings;
        else if (attempt.stage === "formatting") {
          installLowText(job, acceptLowText(command.output, directorLowWriting(job), job.lowFrame, job.lowReadVersion, job.lowFormatVersion));
        } else v.invalid("director.stage", "Low does not have a planning stage");
        attempt.status = "succeeded"; return job;
      }
      if (usesCreativeProtocol(material.resources.version) && attempt.stage === "planning") validateCreativeStage("planning", command.output, "", Object.fromEntries(job.scene!.actorIds.map(id => [id, directorActorNames[id]])), material.resources.version);
      if (attempt.stage === "writing") validateDirectorWriting(command.output, material, job);
      if (attempt.stage === "formatting") job.text = acceptDirectorText(command.output, directorProse(material, job), job.scene!.actorIds, material.resources.version);
      attempt.status = "succeeded";
      return job;
    }
    const output: unknown = JSON.parse(command.output);
    if (!job.planning) v.invalid("director.context", "Planning input missing");
    if (attempt.stage === "director") {
      const proposal = v.parseDirectorPlan(correctionEnvelope(output, !!job.gmContext?.memoryContext));
      // Structural parsing is not acceptance: free themes still need the separate review.
      if (!proposal.entries.some(e => e.source.kind === "free")) {
        const accepted = validateDirectorPlan({...job.planning, proposal});
        job.acceptedEntries = accepted.entries;
      }
      job.proposal = proposal;
    } else if (attempt.stage === "review") {
      const accepted = validateDirectorPlan({...job.planning, proposal: job.proposal, review: output});
      job.review = accepted.review; job.acceptedEntries = accepted.entries;
    } else v.invalid("director.stage", "Scene task needs a scene result reader");
    attempt.status = "succeeded";
  } catch (error) {
    // Preserve the untrusted raw response and billable usage, without publishing anything.
    attempt.status = "failed"; attempt.error = "invalid-output";
    // Only new log-aware commands gain fields; replay of old receipts stays byte-identical.
    if (command.diagnostics) attempt.diagnostics = { ...command.diagnostics, code: "invalid-output", message: redactCallText(error instanceof Error ? error.message : String(error)).slice(0, 20000) };
  }
  return job;
}
