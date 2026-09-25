import { emptyUsage, GenerationError, parseModel, type ModelConfiguration } from "../game-application/airp-generation/contracts";
import type { SettlementHostPort, SettlementResultCommand } from "../game-application/airp-settlement/contracts";
import { createSettlementService } from "../game-application/airp-settlement/service";
import { compileSettlementRequest, settlementHash } from "../game-application/airp-settlement/context";
import { completionUrl, createDirectProvider } from "../game-infrastructure/airp-direct/provider";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";

export type SettlementDriverStatus = {
  busy: boolean; jobId: string | null;
  phase: "idle" | "requesting" | "saving" | "applying" | "done" | "failed" | "cancelled";
  pendingResult: boolean; error: string | null;
};
/** One explicit attempt, no mount/reload requests and no automatic model/format-repair loop. */
export function createSettlementDriver(options: { provider?: ReturnType<typeof createDirectProvider>; lock?: typeof withAirpBrowserLock; now?: () => number; id?: () => string } = {}) {
  const provider = options.provider ?? createDirectProvider(), lock = options.lock ?? withAirpBrowserLock;
  const now = options.now ?? Date.now, id = options.id ?? (() => crypto.randomUUID());
  let status: SettlementDriverStatus = { busy: false, jobId: null, phase: "idle", pendingResult: false, error: null };
  let pending: { saveId: string; epoch: string; command: SettlementResultCommand } | null = null;
  let active: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SettlementDriverStatus>) => { status = { ...status, ...patch }; listeners.forEach(l => l()); };
  const jobIn = (s: Awaited<ReturnType<SettlementHostPort["read"]>>, jobId: string) => s.ledger.jobs.find(j => j.id === jobId) ?? (() => { throw new Error("Settlement task no longer exists"); })();
  const errorMessage = (error: unknown) => error instanceof GenerationError ? error.message : pending ? "结算结果已返回但保存未完成。保留此页并重试保存，不会再次调用模型。" : "结算尚未完成；已发生的程序结果保留。请检查待处理任务。";
  async function save(port: SettlementHostPort) {
    if (!pending) return;
    const retained = pending, service = createSettlementService(port), s = await service.read();
    if (s.head.saveId !== retained.saveId || s.head.epoch !== retained.epoch) throw new GenerationError("stale-task", "结果属于另一个档案，不能写入当前档案。");
    await service.result(retained.command);
    pending = null; publish({ pendingResult: false });
    const job = jobIn(await service.read(), retained.command.jobId);
    if (job.status !== "ready" && job.status !== "applied") throw new GenerationError("invalid-output", "结算未通过来源／结构校验，原响应和用量已保存；未修改变量或记忆。");
    publish({ phase: "applying" }); await service.apply(job.id);
  }
  async function run(port: SettlementHostPort, jobId: string, connection: { config: ModelConfiguration; key: string }) {
    if (status.busy || pending) return;
    const controller = new AbortController(); active = controller;
    publish({ busy: true, jobId, error: null });
    try {
      const service = createSettlementService(port), original = await service.read();
      await lock(`abyssa-airp-settlement:${original.head.saveId}:${original.head.epoch}`, controller.signal, async () => {
        const s = await service.read(), job = jobIn(s, jobId);
        if (s.head.saveId !== original.head.saveId || s.head.epoch !== original.head.epoch) throw new GenerationError("stale-task", "档案已切换，停止原结算。");
        if (job.status === "applied") return;
        if (job.status === "ready") { publish({ phase: "applying" }); await service.apply(jobId); return; }
        if (job.status === "running") throw new GenerationError("interrupted", "存在结果未知的已发送请求。请先明确标记中断，再手动续跑；刷新不会自动重发。");
        const key = connection.key.trim();
        if (!key || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存结算连接。");
        const config = parseModel(connection.config); completionUrl(config.baseUrl);
        const frame = job.frames.length - 1, request = compileSettlementRequest(job.frames[frame], frame), connectionHash = settlementHash(config);
        const previous = job.attempts.find(a => a.frame === frame);
        if (previous && previous.connectionHash !== connectionHash) throw new GenerationError("changed-connection", "同一冻结输入需使用原模型连接；更换连接请明确刷新任务。");
        if (JSON.stringify({ request, config }).includes(key)) throw new GenerationError("credential-in-input", "结算输入包含凭据，拒绝发送和记录。");
        const attemptId = id(); controller.signal.throwIfAborted();
        await service.begin(jobId, { id: attemptId, model: config.model, connectionHash, at: now() });
        publish({ phase: "requesting" });
        let result: Awaited<ReturnType<typeof provider>>;
        try {
          controller.signal.throwIfAborted(); result = await provider({ config, messages: request.messages }, key, controller.signal); controller.signal.throwIfAborted();
          if (result.text.includes(key)) throw new GenerationError("credential-in-output", "响应包含凭据，拒绝保存。", true, result.usage);
        } catch (error) {
          try { await service.fail(jobId, attemptId, { at: now(), error: controller.signal.aborted ? "cancelled" : "provider-error", outcomeUnknown: controller.signal.aborted || error instanceof GenerationError && error.outcomeUnknown, usage: error instanceof GenerationError ? error.usage : emptyUsage() }); }
          catch { /* Durable running marker remains. Never retry the network request automatically. */ }
          throw error;
        }
        pending = { saveId: s.head.saveId, epoch: s.head.epoch, command: { jobId, attemptId, output: result.text, usage: result.usage, at: now() } };
        publish({ pendingResult: true, phase: "saving" }); await save(port);
      });
      publish({ phase: "done" });
    } catch (error) { publish({ phase: controller.signal.aborted ? "cancelled" : "failed", error: errorMessage(error) }); }
    finally { active = null; publish({ busy: false }); }
  }
  return {
    run, getSnapshot: () => status, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel() { active?.abort(); },
    /** Explicit user recovery; only marks the old attempt, never starts a new call. */
    async markInterrupted(port: SettlementHostPort, jobId: string) {
      if (status.busy || pending) return;
      const service = createSettlementService(port), job = jobIn(await service.read(), jobId), attempt = job.attempts.find(a => a.status === "running");
      if (attempt) await service.fail(jobId, attempt.id, { at: Math.max(now(), attempt.startedAt), error: "interrupted", outcomeUnknown: true, usage: emptyUsage() });
    },
    async retrySave(port: SettlementHostPort) {
      if (status.busy || !pending) return;
      const retained = pending, controller = new AbortController(); active = controller; publish({ busy: true, error: null, phase: "saving" });
      try {
        await lock(`abyssa-airp-settlement:${retained.saveId}:${retained.epoch}`, controller.signal, async () => { controller.signal.throwIfAborted(); await save(port); });
        publish({ phase: "done" });
      } catch (error) { publish({ phase: "failed", error: errorMessage(error) }); }
      finally { active = null; publish({ busy: false }); }
    },
    exportPending() { return JSON.stringify({ kind: "airp-settlement-unsaved-result", version: 1, pending }); },
  };
}
