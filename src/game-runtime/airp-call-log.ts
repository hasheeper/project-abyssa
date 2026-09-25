import type { DirectorJob, DirectorMaterial } from "../game-application/airp-director/contracts";
import type { NodeJob } from "../game-application/airp-expedition-play/contracts";
import { readLowWriting } from "../game-application/airp-low/output";
import { redactCallText, type CallDiagnostics } from "../game-application/airp-generation/diagnostics";
import type { Usage } from "../game-application/airp-generation/contracts";
import type { MemoryCorrection, MemoryView } from "../game-application/airp-memory/contracts";

export type CallLogEntry = { id: string; stage: string; status: string; model: string; at: number; endedAt: number | null;
  requestHash: string; usage: Usage; outcomeUnknown: boolean; output: string | null; diagnostics?: CallDiagnostics; offlineCheck?: string;
  memoryCorrections?: {id: string; targetIds: string[]; basisIds: string[]; status: string; reason: string; effectiveHead: unknown}[] };
function correctionLog(records: MemoryCorrection[], diagnostics?: MemoryView["diagnostics"]) {
  return records.map(r => { const d = diagnostics?.find(d => d.id === r.id); return {id: r.id, targetIds: r.changes.map(c => c.targetId), basisIds: r.basisIds,
    status: d?.status ?? (r.error ? "rejected" : r.waitForSceneId ? "pending-read" : "recorded"), reason: d?.reason ?? r.error ?? r.reason, effectiveHead: d?.effectiveHead ?? null}; });
}
function offlineCheck(job: DirectorJob | NodeJob, attempt: { stage: string; output: string | null; status: string; diagnostics?: CallDiagnostics }) {
  if (attempt.diagnostics?.message || attempt.stage !== "writing" || attempt.status !== "failed" || !attempt.output) return undefined;
  const frame = "frame" in job ? job.frame : job.lowFrame;
  if (!frame) return undefined;
  try { readLowWriting(attempt.output, frame, 4); return "旧正文格式规则离线复查通过；历史网络详情未记录，无法补造。"; }
  catch (error) { return `旧正文格式规则离线复查（非历史网络日志）：${error instanceof Error ? error.message : String(error)}。可保留原稿继续后处理。`; }
}
export function directorCallLog(job: DirectorJob, material?: DirectorMaterial, memoryDiagnostics?: MemoryView["diagnostics"]): CallLogEntry[] {
  return job.attempts.map((a, index) => {
    const slot = a.stage === "writing" ? "writing" : ["formatting", "memory"].includes(a.stage) ? "updater" : "planning";
    const connection = job.connections?.filter(c => c.stage === a.stage && job.attempts.findIndex(p => p.id === c.afterAttemptId) < index).at(-1);
    const records = job.memoryCorrections?.filter(r => r.attemptId === a.id) ?? [];
    return { ...a, model: a.diagnostics?.model ?? connection?.config.model ?? material?.models[slot].model ?? "历史模型未记录", requestHash: a.inputHash, offlineCheck: offlineCheck(job, a), ...(records.length ? {memoryCorrections: correctionLog(records, memoryDiagnostics)} : {}) };
  });
}
export function nodeCallLog(job: NodeJob): CallLogEntry[] { return job.attempts.map(a => ({ ...a, offlineCheck: offlineCheck(job, a) })); }
export function serializeCallLog(entries: CallLogEntry[], warnings: string[] = []): string {
  // This DTO deliberately excludes the frozen materials, endpoint configuration and headers.
  return JSON.stringify({ version: 1, warnings, calls: entries.map(a => ({ id: a.id, stage: a.stage, status: a.status, model: a.model,
    at: a.at, endedAt: a.endedAt, durationMs: a.endedAt === null ? null : a.endedAt - a.at, requestHash: a.requestHash,
    usage: a.usage, outcomeUnknown: a.outcomeUnknown, diagnostics: a.diagnostics, offlineCheck: a.offlineCheck, output: a.output, memoryCorrections: a.memoryCorrections })) }, (_key, value) => typeof value === "string" ? redactCallText(value) : value, 2);
}
