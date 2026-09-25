import type { HeadRef } from "../game-application/contracts";
import { emptyUsage, GenerationError, hash, type Models, type ModelSlot } from "../game-application/airp-generation/contracts";
import type { DirectorJob, DirectorJobCommand, DirectorMaterial } from "../game-application/airp-director/contracts";
import { compileDirectorJob, directorStage } from "../game-application/airp-director/jobs";
import { completionUrl, createDirectProvider } from "../game-infrastructure/airp-direct/provider";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";
import { createLowProvider } from "../game-infrastructure/airp-direct/low-provider";
import { compileLowRequest } from "../game-application/airp-low/output";
import { directorLowWriting } from "../game-application/airp-director/low";
import { callDiagnostics } from "../game-application/airp-generation/diagnostics";

export type DirectorDriverRecord = {head: HeadRef; jobs: DirectorJob[]; materials: Record<string, DirectorMaterial>};
export type DirectorDriverPort = {read(): Promise<DirectorDriverRecord>; commit(command: DirectorJobCommand): Promise<DirectorDriverRecord>};
type Pending = {saveId: string; epoch: string; command: Extract<DirectorJobCommand, {type: "airp-director-result"}>};
export type DirectorDriverStatus = {busy: boolean; jobId: string | null; stage: string | null; phase: "idle" | "waiting-lock" | "requesting" | "saving" | "saved" | "failed" | "cancelled"; pendingResult: boolean; error: string | null};

/** Task-driven, not mount-driven. Reload never resends a request on its own. */
export function createDirectorDriver(options: {provider?: ReturnType<typeof createDirectProvider>; lowProvider?: ReturnType<typeof createLowProvider>; lock?: typeof withAirpBrowserLock; now?: () => number; id?: () => string} = {}) {
  const provider = options.provider ?? createDirectProvider(), lock = options.lock ?? withAirpBrowserLock, now = options.now ?? Date.now, id = options.id ?? (() => crypto.randomUUID());
  const lowProvider = options.lowProvider ?? createLowProvider();
  let status: DirectorDriverStatus = {busy: false, jobId: null, stage: null, phase: "idle", pendingResult: false, error: null};
  let active: AbortController | null = null, pending: Pending | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<DirectorDriverStatus>) => {status = {...status, ...patch}; listeners.forEach(l => l());};
  const readJob = (record: DirectorDriverRecord, jobId: string) => {
    const job = record.jobs.find(j => j.id === jobId);
    if (!job) throw new GenerationError("stale-task", "原任务已不存在，未发起新调用。");
    return job;
  };
  const savePending = async (port: DirectorDriverPort) => {
    if (!pending) return;
    const record = await port.read(), retained = pending;
    if (record.head.saveId !== retained.saveId || record.head.epoch !== retained.epoch) throw new GenerationError("stale-task", "输出属于另一个档案；不能写入当前档案。");
    const attempt = readJob(record, retained.command.jobId).attempts.find(a => a.id === retained.command.attemptId);
    if (attempt?.status === "running") await port.commit(retained.command);
    else if (attempt?.output !== retained.command.output || attempt.endedAt !== retained.command.at) throw new GenerationError("stale-task", "原请求状态已改变，保留输出等待检查。");
    pending = null; publish({pendingResult: false});
  };
  const report = (error: unknown, cancelled: boolean) => publish({phase: cancelled ? "cancelled" : "failed", error: cancelled ? "已取消；已发送请求的上游结果可能未知，重试可能再次计费。"
    : error instanceof GenerationError ? error.message : pending ? "结果已返回但尚未保存；请保留此页，重试保存不会重新调用。" : "任务未完成。已保存阶段保留，请检查后手动重试。"});
  async function run(port: DirectorDriverPort, jobId: string, connection: {models: Models; keys: Record<ModelSlot, string>}) {
    if (status.busy || pending) return;
    const controller = new AbortController(); active = controller;
    publish({busy: true, jobId, stage: null, phase: "waiting-lock", error: null});
    try {
      const identity = (await port.read()).head;
      await lock(`abyssa-airp-director:${identity.saveId}:${identity.epoch}`, controller.signal, async () => {
        for (;;) {
          controller.signal.throwIfAborted(); const record = await port.read();
          if (record.head.saveId !== identity.saveId || record.head.epoch !== identity.epoch) throw new GenerationError("stale-task", "档案已切换，停止原任务。");
          const job = readJob(record, jobId), material = record.materials[job.materialHash], stage = directorStage(job);
          if (!stage) break;
          if (!material) throw new GenerationError("missing-material", "原任务全文资料缺失，不能使用摘要续跑。");
          const running = job.attempts.find(a => a.status === "running");
          if (running) {
            await port.commit({type: "airp-director-fail", jobId, attemptId: running.id, at: now(), error: "interrupted", outcomeUnknown: true, usage: emptyUsage()});
            continue;
          }
          if (stage === "formatting" && job.lowFrame && (job.lowReadVersion ?? job.lowFrame.readerVersion ?? 1) >= 5 && job.lowFormatVersion !== 2) {
            await port.commit({type: "airp-director-use-format", jobId, formatVersion: 2});
            continue; // A saved alias-only failure may now be readable without a paid call.
          }
          const slot: ModelSlot = stage === "writing" ? "writing" : stage === "formatting" || stage === "memory" ? "updater" : "planning";
          const model = job.connections?.filter(c => c.stage === stage).at(-1)?.config ?? material.models[slot];
          const key = connection.keys[slot].trim();
          if (!key || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存 API 连接。");
          if (completionUrl(connection.models[slot].baseUrl) !== completionUrl(model.baseUrl)) throw new GenerationError("changed-endpoint", "续跑须使用已确认的连接；更换后请先确认使用当前连接。");
          if (job.lowFrame && hash(connection.models[slot]) !== hash(model)) throw new GenerationError("changed-connection", "当前阶段配置已改变，请先确认使用当前连接再重试。");
          const formatRepair = !job.lowFrame && stage === "formatting" && job.attempts.some(a => a.stage === "formatting" && a.error === "invalid-output") ? 1 as const : undefined;
          const directorRepair = job.kind === "day" && stage === "director" && job.attempts.filter(a => a.stage === "director").at(-1)?.error === "invalid-output" ? 1 as const : undefined;
          const input = compileDirectorJob(material, job, formatRepair, directorRepair), secrets = Object.values(connection.keys).map(k => k.trim()).filter(Boolean);
          if (secrets.some(k => JSON.stringify({input, material, model}).includes(k))) throw new GenerationError("credential-in-input", "输入或资料包含凭据，拒绝保存或发送。");
          const attemptId = id(); await port.commit({type: "airp-director-begin", jobId, attemptId, stage, at: now(), ...(formatRepair === undefined ? {} : {formatRepair}), ...(directorRepair === undefined ? {} : {directorRepair})});
          publish({stage, phase: "requesting"});
          let result: Awaited<ReturnType<typeof provider>>;
          try {
            controller.signal.throwIfAborted();
            result = job.lowFrame && (stage === "writing" || stage === "formatting") ? await lowProvider(compileLowRequest(job.lowFrame, stage === "formatting" ? directorLowWriting(job) : undefined, job.lowReadVersion, job.lowFormatVersion), model, key, controller.signal)
              : await provider({config: model, messages: input.messages}, key, controller.signal);
            controller.signal.throwIfAborted();
            if (secrets.some(k => result.text.includes(k))) throw new GenerationError("credential-in-output", "响应包含凭据，拒绝保存。", true);
          } catch (error) {
            try {await port.commit({type: "airp-director-fail", jobId, attemptId, at: now(), error: controller.signal.aborted ? "cancelled" : "provider-error",
              outcomeUnknown: controller.signal.aborted || error instanceof GenerationError && error.outcomeUnknown, usage: error instanceof GenerationError ? error.usage : emptyUsage(), diagnostics: callDiagnostics(error, model.model, secrets)});} catch { /* Reload shows the durable running attempt; never silently resend it. */ }
            throw error;
          }
          pending = {saveId: identity.saveId, epoch: identity.epoch, command: {type: "airp-director-result", jobId, attemptId, output: result.text, usage: result.usage, at: now(), diagnostics: { ...result.diagnostics, ...callDiagnostics(null, model.model, secrets) }}};
          publish({pendingResult: true, phase: "saving"}); await savePending(port);
          const completed = readJob(await port.read(), jobId).attempts.find(a => a.id === attemptId);
          if (completed?.status !== "succeeded") throw new GenerationError("invalid-output", `${stage === "formatting" ? "后处理" : stage === "scene-plan" ? "GM分派" : stage === "scene-evaluate" ? "GM评估" : stage}失败：${completed?.diagnostics?.message ?? "结果未通过校验"}。原响应与用量已保存，可在调用记录查看。`);
        }
      });
      publish({phase: "saved"});
    } catch (error) {report(error, controller.signal.aborted);}
    finally {if (active === controller) active = null; publish({busy: false});}
  }
  return {
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};}, getSnapshot: () => status, run,
    cancel() {active?.abort();},
    async retryCommit(port: DirectorDriverPort) {
      if (status.busy || !pending) return;
      const retained = pending, controller = new AbortController(); active = controller; publish({busy: true, phase: "waiting-lock", error: null});
      try {
        await lock(`abyssa-airp-director:${retained.saveId}:${retained.epoch}`, controller.signal, async () => {controller.signal.throwIfAborted(); publish({phase: "saving"}); await savePending(port);});
        publish({phase: "saved"});
      } catch (error) {report(error, controller.signal.aborted);}
      finally {if (active === controller) active = null; publish({busy: false});}
    },
    exportPending() {return JSON.stringify({kind: "airp-director-unsaved-output", version: 1, pending}, null, 2);},
  };
}
