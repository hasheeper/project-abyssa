import { GenerationError, parseModel, type ModelConfiguration } from "../game-application/airp-generation/contracts";
import { expeditionPlanHash } from "../game-core/session";
import type { ExpeditionGMHostPort } from "../game-application/airp-expedition-gm/contracts";
import { compileExpeditionRequest } from "../game-application/airp-expedition-gm/context";
import { createExpeditionGMService, currentExpeditionFrame, nextExpeditionStage } from "../game-application/airp-expedition-gm/service";
import { completionUrl, createDirectProvider } from "../game-infrastructure/airp-direct/provider";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";

/** One explicit network stage per call; theme review is separate, never a hidden retry/loop. */
export function createExpeditionGMDriver(options: { provider?: ReturnType<typeof createDirectProvider>; lock?: typeof withAirpBrowserLock; now?: () => number; id?: () => string } = {}) {
  const provider = options.provider ?? createDirectProvider(), lock = options.lock ?? withAirpBrowserLock, now = options.now ?? Date.now, newId = options.id ?? (() => crypto.randomUUID());
  let status = { busy: false, jobId: null as string | null, phase: "idle", pendingResult: false, error: null as string | null };
  let pending: { saveId: string; epoch: string; jobId: string; attemptId: string; output: string; usage: import("../game-application/airp-generation/contracts").Usage; at: number } | null = null;
  let active: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<typeof status>) => { status = { ...status, ...patch }; listeners.forEach(f => f()); };
  const errorText = (error: unknown) => error instanceof GenerationError ? error.message : pending ? "GM结果已返回，保存未完成；保留此页重试保存，不会重新调用。" : "副本规划未完成，请检查待处理计划；没有开始副本或发放奖励。";
  async function save(port: ExpeditionGMHostPort) {
    if (!pending) return;
    const retained = pending, service = createExpeditionGMService(port), s = await service.read();
    if (s.head.saveId !== retained.saveId || s.head.epoch !== retained.epoch) throw new GenerationError("stale-task", "结果属于另一档案，不能保存到当前档案。");
    await service.result(retained.jobId, retained.attemptId, retained.output, retained.usage, retained.at);
    pending = null; publish({ pendingResult: false });
    const job = (await service.read()).ledger.jobs.find(j => j.id === retained.jobId)!;
    if (job.status === "review") { publish({ phase: "review-needed" }); return; }
    if (!["ready", "accepted", "started"].includes(job.status)) throw new GenerationError("invalid-output", "计划未通过校验，原始响应和用量已保留；未接纳计划。");
    await service.accept(retained.jobId); publish({ phase: "accepted" });
  }
  return {
    getSnapshot: () => status,
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
    async run(port: ExpeditionGMHostPort, jobId: string, connection: { config: ModelConfiguration; key: string }) {
      if (status.busy || pending) return;
      const controller = new AbortController(); active = controller; publish({ busy: true, jobId, error: null });
      try {
        const service = createExpeditionGMService(port), before = await service.read();
        await lock(`abyssa-expedition-gm:${before.head.saveId}:${before.head.epoch}`, controller.signal, async () => {
          const s = await service.read();
          if (s.head.saveId !== before.head.saveId || s.head.epoch !== before.head.epoch) throw new GenerationError("stale-task", "档案已切换。");
          const job = s.ledger.jobs.find(j => j.id === jobId); if (!job) throw new Error("Missing trip plan");
          if (["accepted", "started"].includes(job.status)) { publish({ phase: job.status }); return; }
          if (job.status === "ready") { await service.accept(jobId); publish({ phase: "accepted" }); return; }
          const stage = nextExpeditionStage(job); if (!stage) throw new Error("No callable stage; resolve interrupted/stale/cancelled plan explicitly");
          const key = connection.key.trim();
          if (!key || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存 GM 连接。");
          const config = parseModel(connection.config); completionUrl(config.baseUrl);
          const request = compileExpeditionRequest(currentExpeditionFrame(job), job.frames.length - 1, stage === "review" ? job.prepared!.proposal : undefined);
          if (JSON.stringify({ request, config }).includes(key)) throw new GenerationError("credential-in-input", "输入包含凭据，拒绝发送和记录。");
          const attemptId = newId(); controller.signal.throwIfAborted();
          await service.begin(jobId, { id: attemptId, stage, model: config.model, connectionHash: expeditionPlanHash(config), at: now() }); publish({ phase: stage });
          let result: Awaited<ReturnType<typeof provider>>;
          try {
            controller.signal.throwIfAborted(); result = await provider({ config, messages: request.messages }, key, controller.signal); controller.signal.throwIfAborted();
            if (result.text.includes(key)) throw new GenerationError("credential-in-output", "响应包含凭据，拒绝保存。", true, result.usage);
          } catch (error) {
            try { await service.fail(jobId, attemptId, now(), error instanceof GenerationError ? error.usage : undefined, !(error instanceof GenerationError) || error.outcomeUnknown); } catch { /* Keep the durable running marker; never resend automatically. */ }
            throw error;
          }
          pending = { saveId: s.head.saveId, epoch: s.head.epoch, jobId, attemptId, output: result.text, usage: result.usage, at: now() }; publish({ pendingResult: true, phase: "saving" }); await save(port);
        });
      } catch (error) { publish({ phase: controller.signal.aborted ? "cancelled" : "failed", error: errorText(error) }); }
      finally { active = null; publish({ busy: false }); }
    },
    cancel() { active?.abort(); },
    async markInterrupted(port: ExpeditionGMHostPort, jobId: string) {
      if (status.busy || pending) return;
      const service = createExpeditionGMService(port), s = await service.read(), a = s.ledger.jobs.find(j => j.id === jobId)?.attempts.find(a => a.status === "running");
      if (a) await service.fail(jobId, a.id, Math.max(now(), a.at));
    },
    async retrySave(port: ExpeditionGMHostPort) {
      if (status.busy || !pending) return;
      const retained = pending, controller = new AbortController(); active = controller; publish({ busy: true, error: null });
      try { await lock(`abyssa-expedition-gm:${retained.saveId}:${retained.epoch}`, controller.signal, () => save(port)); }
      catch (error) { publish({ phase: "failed", error: errorText(error) }); }
      finally { active = null; publish({ busy: false }); }
    },
    exportPending() { return JSON.stringify({ kind: "airp-expedition-gm-unsaved", version: 1, pending }); },
  };
}
