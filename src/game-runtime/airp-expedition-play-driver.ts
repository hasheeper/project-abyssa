import { GenerationError, parseModel, type ModelConfiguration, type Usage } from "../game-application/airp-generation/contracts";
import { createNodeService, nodeStage } from "../game-application/airp-expedition-play/service";
import type { NodeHostPort } from "../game-application/airp-expedition-play/contracts";
import { lowHash } from "../game-application/airp-low/native";
import { createLowProvider } from "../game-infrastructure/airp-direct/low-provider";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";
import { callDiagnostics, type CallDiagnostics } from "../game-application/airp-generation/diagnostics";

/** One explicit stage per call. No Sol, audit, automatic retry, repair or model fallback. */
export function createNodeDriver(options: { provider?: ReturnType<typeof createLowProvider>; lock?: typeof withAirpBrowserLock; now?: () => number; id?: () => string } = {}) {
  const provider = options.provider ?? createLowProvider(), lock = options.lock ?? withAirpBrowserLock, now = options.now ?? Date.now, id = options.id ?? (() => crypto.randomUUID());
  let busy = false, active: AbortController | null = null, pending: { saveId: string; epoch: string; nodeId: string; attemptId: string; output: string; usage: Usage; at: number; diagnostics: CallDiagnostics } | null = null;
  let status = { phase: "idle", error: null as string | null };
  const listeners = new Set<() => void>();
  let snapshot = { ...status, busy, pendingResult: false };
  const publish = () => { snapshot = { ...status, busy, pendingResult: !!pending }; listeners.forEach(l => l()); };
  const save = async (port: NodeHostPort) => { if (!pending) return; const p = pending, service = createNodeService(port), s = await service.read();
    if (s.head.saveId !== p.saveId || s.head.epoch !== p.epoch) throw Error("Foreign pending result");
    const saved = await service.result(p.nodeId, p.attemptId, p.output, p.usage, p.at, p.diagnostics); pending = null;
    const j = saved.ledger.jobs.find(j => j.id === p.nodeId)!;
    const completed = j.attempts.find(a => a.id === p.attemptId);
    if (completed?.status !== "succeeded") throw new GenerationError("invalid-output", `原输出已保存：${completed?.diagnostics?.message ?? "结果未通过校验"}。详情见调用记录。`);
    status = { phase: j.text ? "readable" : "formatting-needed", error: null };
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async run(port: NodeHostPort, nodeId: string, connection: { config: ModelConfiguration; key: string }) {
      if (busy || pending) return; busy = true; const controller = new AbortController(); active = controller; status.error = null;
      publish();
      try {
        const service = createNodeService(port), before = await service.read();
        await lock(`abyssa-node:${before.head.saveId}:${before.head.epoch}`, controller.signal, async () => {
          let s = await service.read(), j = s.ledger.jobs.find(j => j.id === nodeId); if (!j) throw Error("Missing node");
          if (nodeStage(j) === "formatting") {
            s = await service.useFormatProtocol(nodeId); j = s.ledger.jobs.find(j => j.id === nodeId)!;
          }
          if (j.text || j.status === "completed") { status.phase = "readable"; return; }
          const stage = nodeStage(j); if (!stage) throw Error("No eligible stage; resolve interrupted request explicitly");
          const key = connection.key.trim(); if (!key || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存本阶段连接。");
          const config = parseModel(connection.config);
          if (JSON.stringify({ frame: j.frame, config }).includes(key)) throw new GenerationError("credential-in-input", "输入含凭据，拒绝记录。");
          const attemptId = id(); controller.signal.throwIfAborted();
          const request = await service.begin(nodeId, { id: attemptId, stage, model: config.model, connectionHash: lowHash(config), at: now() }); status.phase = stage; publish();
          let result;
          try { result = await provider(request, config, key, controller.signal); }
          catch (e) { try { await service.interrupt(nodeId, attemptId, now(), e instanceof GenerationError ? e.usage : undefined, callDiagnostics(e, config.model, [key])); } catch { /* Durable running marker prevents resending. */ } throw e; }
          if (controller.signal.aborted) await service.interrupt(nodeId, attemptId, now(), result.usage);
          pending = { saveId: s.head.saveId, epoch: s.head.epoch, nodeId, attemptId, output: result.text, usage: result.usage, at: now(), diagnostics: { ...result.diagnostics, ...callDiagnostics(null, config.model, [key]) } }; await save(port);
        });
      } catch (e) { status = { phase: "failed", error: e instanceof GenerationError ? e.message : pending ? "结果已返回但保存未完成；可重试保存，不重发模型。" : "当前节点未完成；检查任务状态，没有自动重试。" }; }
      finally { active = null; busy = false; publish(); }
    },
    cancel() { active?.abort(); },
    async retrySave(port: NodeHostPort) { if (busy || !pending) return; busy = true; publish(); try { await lock(`abyssa-node:${pending.saveId}:${pending.epoch}`, new AbortController().signal, () => save(port)); } catch { status = { phase: "failed", error: "保存仍未完成，保留当前页中的返回结果。" }; } finally { busy = false; publish(); } },
    async markInterrupted(port: NodeHostPort, nodeId: string) { if (busy || pending) return; const service = createNodeService(port), s = await service.read(), a = s.ledger.jobs.find(j => j.id === nodeId)?.attempts.find(a => a.status === "running"); if (a) await service.interrupt(nodeId, a.id, Math.max(now(), a.at)); },
    exportPending: () => JSON.stringify({ kind: "airp-node-unsaved", version: 1, pending }),
  };
}
