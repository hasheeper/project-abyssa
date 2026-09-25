import {directorHash} from "../../game-core/session";
import type {CoveredAcceptance, DirectorEvent, DirectorJob, DirectorState, SceneGMEvaluation} from "./contracts";

export function acceptanceCoverageInput(job: DirectorJob) {
  const scene = job.scene!;
  const read = job.gmContext?.tasks.find(e => e.id === scene.eventId)?.readSceneIds ?? [];
  return {currentSceneId: job.id, previousSceneIds: scene.previous.filter(p => read.includes(p.sceneId)).map(p => p.sceneId),
    candidates: scene.role === "offer" && (scene.dialogue?.turn ?? 0) > 0 ? scene.choices : []};
}

/** Optional advice is tolerant: discard bad skip metadata, not the valid prose/completion. */
export function readAcceptanceCoverage(raw: unknown, job: DirectorJob, complete: boolean): Pick<SceneGMEvaluation, "coveredAcceptance" | "coverageWarnings"> {
  if (raw === undefined) return {};
  const input = acceptanceCoverageInput(job), accepted: CoveredAcceptance[] = [], warnings: string[] = [];
  const ids = new Set([input.currentSceneId, ...input.previousSceneIds]);
  if (!Array.isArray(raw) || raw.length > input.candidates.length) warnings.push("忽略不可用的接单对白覆盖标记；保留正常阶段回应。");
  else for (const entry of raw) {
    const p = entry as Partial<CoveredAcceptance> | null;
    if (!complete || !p || !input.candidates.some(c => c.id === p.choiceId) || accepted.some(c => c.choiceId === p.choiceId) ||
      typeof p.reason !== "string" || !p.reason.trim() || p.reason.length > 3000 || !Array.isArray(p.basisSceneIds) ||
      !p.basisSceneIds.length || p.basisSceneIds.length > ids.size || p.basisSceneIds.some(id => typeof id !== "string" || !ids.has(id))) {
      warnings.push("忽略无有效同事件依据的接单对白覆盖标记；保留正常阶段回应。"); continue;
    }
    accepted.push({choiceId: p.choiceId!, reason: p.reason, basisSceneIds: [...new Set(p.basisSceneIds)]});
  }
  return {coveredAcceptance: accepted, ...(warnings.length ? {coverageWarnings: warnings} : {})};
}

/** Eligibility is rechecked against the actual choice, not the model's prediction. */
export function coveredAcceptanceForChoice(state: DirectorState, event: DirectorEvent, job: DirectorJob | undefined, choiceId: string, phase: number) {
  const scene = job?.scene, reading = state.reading, evaluation = job?.sceneGMEvaluation;
  if (!job || (job.lowContextVersion ?? 0) < 20 || !scene || !evaluation?.complete || evaluation.unresolved.length ||
    scene.role !== "offer" || event.role !== "offer" || scene.eventId !== event.id || scene.phase !== phase || event.deferredUntil > scene.phase ||
    scene.actionIndex !== event.actionIndex || scene.occurrence !== event.occurrence || directorHash(scene.card) !== directorHash(event.card) ||
    !reading || reading.paused || reading.jobId !== job.id || reading.cursor !== job.text?.lines.length || event.readSceneIds.at(-1) !== job.id) return null;
  return evaluation.coveredAcceptance?.find(c => c.choiceId === choiceId && c.basisSceneIds.every(id => event.readSceneIds.includes(id))) ?? null;
}
