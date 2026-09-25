import type { D5GameRecord } from "../game-application";
import { check, emptyUsage, GenerationError, hash, type Completion, type Models } from "../game-application/airp-generation/contracts";
import { compileDirectInput } from "../game-application/airp-direct-gameplay/compile";
import type { AirpDirectCommand, DirectMaterial, DirectStage } from "../game-application/airp-direct-gameplay/contracts";
import { parseDirectMaterial } from "../game-application/airp-direct-gameplay/parse";
import { nextDirectStage, readTextForUpdate } from "../game-application/airp-direct-gameplay/reducer";
import { createDirectProvider, completionUrl } from "../game-infrastructure/airp-direct/provider";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";
import type { Keys } from "./airp-generation";
export { hash } from "../game-application/airp-generation/contracts";
export { inspectDirectAttempt, exportDirectDiagnostic } from "../game-application/airp-direct-gameplay/inspection";

export type DirectPlayerPort = {read(): Promise<D5GameRecord>; commit(command: AirpDirectCommand): Promise<D5GameRecord>};
type Pending = {saveId: string; epoch: string; stage: DirectStage; command: Extract<AirpDirectCommand, {type: "airp-direct-result"}>};
export type DirectOperation = {
  id: number; sceneId: string; saveId: string | null; epoch: string | null;
  mode: "generate" | "update" | "save"; stage: DirectStage | null; repair: boolean;
  phase: "preparing" | "waiting-lock" | "requesting" | "saving" | "cancelling" | "failed" | "save-failed" | "cancelled" | "complete";
  phaseStartedAt: number;
};
export type DirectDriverState = {busy: boolean; error: string | null; pendingResult: boolean; operation: DirectOperation | null};
const message = (error: unknown) => error instanceof GenerationError ? error.message
  : error instanceof Error && "code" in error && error.code === "AIRP_BROWSER_LOCK_UNAVAILABLE"
    ? "当前浏览器环境不支持同档并发锁，直连生成暂不可用。请使用支持 Web Locks 的浏览器，并通过 HTTPS 或 localhost 打开；仍可阅读已保存正文或选择手写稿。"
    : "本地提交或连接未完成；已保存的阶段不会重跑。请检查存档状态后显式重试。";

/** No mount-time work. All requests and retries are owned by an explicit user action. */
export function createDirectGameDriver(options: {
  provider?: ReturnType<typeof createDirectProvider>; lock?: typeof withAirpBrowserLock; now?: () => number; id?: () => string;
} = {}) {
  const provider = options.provider ?? createDirectProvider(), lock = options.lock ?? withAirpBrowserLock;
  const now = options.now ?? Date.now, id = options.id ?? (() => crypto.randomUUID());
  let state: DirectDriverState = {busy: false, error: null, pendingResult: false, operation: null}, active: AbortController | null = null, pending: Pending | null = null;
  let serial = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<DirectDriverState>) => {state = {...state, ...patch}; listeners.forEach(l => l());};
  const observe = (operationId: number, patch: Partial<DirectOperation>) => {
    if (state.operation?.id === operationId) publish({operation: {...state.operation, ...patch, phaseStartedAt: now()}});
  };
  const savePending = async (port: DirectPlayerPort) => {
    if (!pending) return;
    const current = await port.read();
    check(current.head.saveId === pending.saveId && current.head.epoch === pending.epoch, "未保存输出属于另一个档案，不能写入当前档案。");
    const existing = current.airpDirect?.tasks.flatMap(t => t.attempts).find(a => a.id === pending!.command.attemptId);
    if (existing?.status !== "running") {
      check(existing?.output === pending.command.output && existing.endedAt === pending.command.at, "输出已过期或来源已改选，不能覆盖。");
    } else await port.commit(pending.command);
    pending = null; publish({pendingResult: false});
  };
  async function run(port: DirectPlayerPort, sceneId: string, mode: "generate" | "update", material: DirectMaterial, supplied: {models: Models; keys: Keys}) {
    // A retained output has its own explicit, zero-network recovery operation.
    if (state.busy || pending) return;
    const controller = new AbortController(), operationId = ++serial; let sent = false;
    active = controller; publish({busy: true, error: null, operation: {id: operationId, sceneId, saveId: null, epoch: null, mode, stage: null, repair: false, phase: "preparing", phaseStartedAt: now()}});
    try {
      let record = await port.read();
      const identity = record.head;
      observe(operationId, {saveId: identity.saveId, epoch: identity.epoch, phase: "waiting-lock"});
      await lock(`abyssa-airp-direct:${identity.saveId}:${identity.epoch}`, controller.signal, async () => {
        observe(operationId, {phase: "preparing"});
        // Lock acquisition may follow another tab's successful commit.
        record = await port.read(); controller.signal.throwIfAborted();
        check(record.head.saveId === identity.saveId && record.head.epoch === identity.epoch, "档案已切换。");
        record = await port.read();
        let task = record.airpDirect?.tasks.find(t => t.sceneId === sceneId);
        check(task, "当前没有对应的直连场景。");
        const frozen = task.materialHash ? record.airpDirect!.materials[task.materialHash] : parseDirectMaterial(material);
        for (const slot of ["planning", "writing", "updater"] as const) {
          if (mode === "update" && slot !== "updater") continue;
          const key = supplied.keys[slot].trim();
          check(key && !/[\r\n]/.test(key), "请前往设置填写并保存当前连接。");
          check(completionUrl(supplied.models[slot].baseUrl) === completionUrl(frozen.models[slot].baseUrl), "续跑须为原冻结端点提供密钥；新设置不替换旧任务。");
          check(!JSON.stringify(frozen).includes(key), "非敏感资料或模型配置中包含Key，拒绝保存。");
        }
        if (task.source === "undecided") {
          check(mode === "generate", "尚未生成的场景不能整理记忆。");
          const materialHash = hash(frozen);
          record = await port.commit({type: "airp-direct-prepare", sceneId, materialHash, ...(record.airpDirect!.materials[materialHash] ? {} : {material: frozen})});
        }
        let repairs = 0;
        for (;;) {
          controller.signal.throwIfAborted(); record = await port.read();
          check(record.head.saveId === identity.saveId && record.head.epoch === identity.epoch, "档案已切换。");
          task = record.airpDirect!.tasks.find(t => t.sceneId === sceneId)!;
          const stage = nextDirectStage(task);
          if (!stage || mode === "generate" && stage === "updater") break;
          observe(operationId, {phase: "preparing", stage, repair: repairs > 0});
          check(mode === "update" ? stage === "updater" : stage !== "updater", "先完成并阅读正文，再整理记忆。");
          const interrupted = task.attempts.find(a => a.status === "running");
          if (interrupted) {
            await port.commit({type: "airp-direct-fail", sceneId, attemptId: interrupted.id, at: now(), error: "interrupted", outcomeUnknown: true, usage: emptyUsage()});
            continue;
          }
          check(record.narrative?.version === 2 && task.context, "场景输入缺失。");
          const slot = stage === "formatting" || stage === "updater" ? "updater" : stage;
          const input = compileDirectInput(frozen, task.context, task, stage, stage === "updater" ? readTextForUpdate(record.narrative, task) : undefined);
          check(Object.values(supplied.keys).every(key => !key.trim() || !JSON.stringify(input).includes(key.trim())), "输入包含Key，拒绝发送。");
          const attemptId = id();
          await port.commit({type: "airp-direct-begin", sceneId, stage, attemptId, at: now()});
          let result: Completion;
          try {
            controller.signal.throwIfAborted();
            observe(operationId, {phase: "requesting"}); sent = true;
            result = await provider({config: frozen.models[slot], messages: input.messages}, supplied.keys[slot], controller.signal);
            controller.signal.throwIfAborted();
            check(Object.values(supplied.keys).every(key => !key.trim() || !result.text.includes(key.trim())), "响应包含凭据，已拒绝保存。");
          } catch (error) {
            try {await port.commit({type: "airp-direct-fail", sceneId, attemptId, at: now(), error: controller.signal.aborted ? "cancelled" : "provider-error",
              outcomeUnknown: controller.signal.aborted || error instanceof GenerationError && error.outcomeUnknown, usage: error instanceof GenerationError ? error.usage : emptyUsage()});} catch { /* Refresh exposes the still-running attempt as interrupted; no automatic network retry. */ }
            throw error;
          }
          pending = {saveId: identity.saveId, epoch: identity.epoch, stage, command: {type: "airp-direct-result", sceneId, attemptId, at: now(), output: result.text, usage: result.usage}};
          publish({pendingResult: true, operation: {...state.operation!, phase: "saving", phaseStartedAt: now()}});
          await savePending(port); // On local failure keep this exact output in memory; never call the model to recover a save write.
          record = await port.read();
          const completed = record.airpDirect!.tasks.find(t => t.sceneId === sceneId)!.attempts.at(-1)!;
          if (completed.status !== "succeeded") {
            if ((stage === "formatting" || stage === "updater") && completed.error === "invalid-output" && repairs++ < 1) continue;
            throw new GenerationError("invalid-output", "输出未通过校验，原始响应已保存；请检查后再显式重试。");
          }
        }
      });
      observe(operationId, {phase: "complete"});
    } catch (error) {
      observe(operationId, {phase: pending ? "save-failed" : controller.signal.aborted ? "cancelled" : "failed"});
      publish({error: controller.signal.aborted ? sent ? "已取消；供应商结果可能未知，重试可能再次计费。" : "已停止本页操作；未发送模型请求。" : message(error)});
    } finally {if (active === controller) active = null; publish({busy: false});}
  }
  return {
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};}, getSnapshot: () => state, run,
    cancel() {
      if (!active || active.signal.aborted) return;
      active.abort();
      if (state.operation && state.operation.phase !== "saving") observe(state.operation.id, {phase: "cancelling"});
    },
    async retryCommit(port: DirectPlayerPort) {
      if (state.busy || !pending) return;
      const controller = new AbortController(), operationId = ++serial, retained = pending;
      active = controller;
      publish({busy: true, error: null, operation: {id: operationId, sceneId: retained.command.sceneId, saveId: retained.saveId, epoch: retained.epoch,
        stage: retained.stage, mode: "save", repair: false, phase: "waiting-lock", phaseStartedAt: now()}});
      try {
        await lock(`abyssa-airp-direct:${retained.saveId}:${retained.epoch}`, controller.signal, async () => {
          controller.signal.throwIfAborted(); observe(operationId, {phase: "saving"}); await savePending(port);
        });
        observe(operationId, {phase: "complete"});
      } catch (error) {
        observe(operationId, {phase: "save-failed"});
        publish({error: controller.signal.aborted ? "已停止等待；输出仍未保存，请保留本页。" : message(error)});
      } finally {if (active === controller) active = null; publish({busy: false});}
    },
    exportPending() {return JSON.stringify({kind: "airp-unsaved-output", version: 1, pending}, null, 2);},
  };
}
