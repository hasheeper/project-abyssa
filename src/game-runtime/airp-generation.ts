import { compileInput, contextValues } from "../game-application/airp-generation/context";
import { check, emptyUsage, GenerationError, hash, parseModel, stageSlot, STAGES, type Attempt, type CompiledInput, type CompletionRequest, type Models, type ModelSlot, type Preset, type ProbeRecord, type RunRecord, type Specification } from "../game-application/airp-generation/contracts";
import { compilePreset, parsePreset } from "../game-application/airp-generation/preset";
import { acceptGeneratedText } from "../game-application/airp-generation/scene";
import { createRun, lastOutput, lastProse } from "../game-application/airp-generation/run";
import { readWritingOutput } from "../game-application/airp-generation/writing";
import { createDirectProvider, completionUrl } from "../game-infrastructure/airp-direct/provider";
import { createPreviewCache, type PreviewStorage } from "../game-infrastructure/airp-direct/cache";
import { builtinGenerationPreset, generationResources, generationSamples } from "../content/presentation/airp/generation-resources";
import { keminiSource } from "../content/presentation/airp/kemini-profile";
import { sha256 } from "../game-core/contracts";
import { planningPreflight, usesCreativeProtocol, usesPerformanceProtocol, validateCreativeStage } from "../game-application/airp-generation/creative-output";
export { parseTestConfig } from "../game-infrastructure/airp-direct/test-config";

export type { Models, ModelConfiguration, ModelSlot, Specification, RunRecord, Preset, GenerationStage, CompiledInput } from "../game-application/airp-generation/contracts";
export { parsePreset, compileInput, completionUrl };
export const samples = generationSamples;
export const builtinPresetFile = () => JSON.stringify(builtinGenerationPreset, null, 2);
export function importPreset(text: string, name?: string) {
  if (sha256(text) !== keminiSource.sha256) return parsePreset(text, name);
  const preset = parsePreset(builtinPresetFile());
  preset.notes.push(`识别 ${keminiSource.filename} / ${keminiSource.sha256}；使用AIRP v8条目分流版，不按原酒馆全部条目执行。原文片段按来源位置、阶段、相对顺序／角色注入，Sol仅做三段式大纲，Gemini负责正文、台词与表情，格式化仅提取中文。不执行酒馆扩展脚本。`);
  return preset;
}
export function defaultSpecification(): Specification {
  const preset = parsePreset(builtinPresetFile());
  return { playerName: "你", sample: structuredClone(samples[0]), resources: structuredClone(generationResources), preset, orderId: preset.orders[0].id };
}
export const defaultModels = (): Models => ({
  planning: { baseUrl: "", model: "gpt-5.6-sol", timeoutMs: 180000, max_tokens: 32768 },
  writing: { baseUrl: "", model: "gemini-3.8-flash", timeoutMs: 180000, max_tokens: 16384 },
  updater: { baseUrl: "", model: "deepseek-flash", timeoutMs: 180000, max_tokens: 32768 },
});
export type Keys = Record<ModelSlot, string>;
export function resolveGenerationModels(models: Models, preset: Preset, resourceVersion = 4): Models {
  const slot = resourceVersion === 5 || resourceVersion === 6 ? "planning" : "writing";
  return { ...models, [slot]: { ...preset.sampling, ...Object.fromEntries(Object.entries(models[slot]).filter(([, value]) => value !== undefined)) } as Models["writing"] };
}
export type GenerationSnapshot = { run: RunRecord | null; busy: boolean; error: string | null; cacheWarning: string | null; calls: number; limit: number; probes: ProbeRecord[] };
const explanation = (error: unknown) => error instanceof GenerationError ? `${error.message}（${error.code}）` : "输入或运行记录无效，请检查配置与预设。";

/** Explicit user actions own requests; subscribers and render never start work. */
export function createGenerationController(options: { storage?: PreviewStorage | null; provider?: ReturnType<typeof createDirectProvider>; now?: () => number; id?: () => string } = {}) {
  let storage = options.storage;
  if (storage === undefined) { try { storage = sessionStorage; } catch { storage = null; } }
  const cache = createPreviewCache(storage), saved = cache.read(), budget = cache.budget();
  const now = options.now ?? Date.now, id = options.id ?? (() => crypto.randomUUID()), provider = options.provider ?? createDirectProvider();
  let snapshot: GenerationSnapshot = { run: saved.run, busy: false, error: null, cacheWarning: saved.error, calls: budget.calls, limit: budget.limit, probes: cache.probes() };
  const listeners = new Set<() => void>(); let active: AbortController | null = null;
  // Credential matching is deliberately private and never part of the snapshot/export.
  const probeKeys = new Map<ModelSlot, string>();
  let pendingProbe: { id: string; slot: ModelSlot; config: Models[ModelSlot]; startedAt: number } | null = null;
  const publish = (patch: Partial<GenerationSnapshot>, persist = true) => {
    snapshot = { ...snapshot, ...patch };
    if (persist) snapshot = { ...snapshot, cacheWarning: cache.save(snapshot.run) ? null : "未保存：刷新可能丢失试读进度，请导出当前记录。" };
    listeners.forEach(listener => listener());
  };
  const reserve = () => {
    check(snapshot.calls < snapshot.limit, "已到本次调用上限，停止发送。可以在配置中明确调整上限。", "call-budget");
    const next = { calls: snapshot.calls + 1, limit: snapshot.limit };
    check(cache.saveBudget(next), "调用计数无法保存，暂不发送请求。", "budget-storage");
    publish(next, false);
  };
  const saveProbe = (record: ProbeRecord) => {
    const probes = [...snapshot.probes, record].slice(-100);
    publish({ probes, ...(!cache.saveProbes(probes) ? { cacheWarning: "连接记录未保存，刷新会丢失，请导出当前记录。" } : {}) }, false);
  };
  const validateRequest = (request: CompletionRequest, key: string) => {
    check(key.trim() && !/[\r\n]/.test(key), "请前往设置填写并保存 API 连接。", "missing-key"); parseModel(request.config); completionUrl(request.config.baseUrl);
    check(!JSON.stringify(request).includes(key.trim()), "提示词或非敏感配置中包含 Key，请先移除。", "credential-in-prompt");
  };
  async function execute(keys: Keys) {
    const controller = new AbortController(); active = controller;
    publish({ busy: true, error: null });
    try {
      for (const stage of STAGES) {
        let run = snapshot.run!;
        if (lastOutput(run, stage)) continue;
        for (;;) {
          run = snapshot.run!;
          controller.signal.throwIfAborted();
          const prior = run.attempts.filter(a => a.stage === stage), last = prior.at(-1);
          check(run.attempts.length < 32, "本任务尝试次数已到上限。", "attempt-budget");
          check(stage !== "formatting" || prior.length < 2, "格式化两次尝试均未完成，请检查原文和记录后重新生成。", "format-budget");
          const input = compileInput(stage, run.spec, lastOutput(run, "planning"), lastProse(run), stage === "formatting" && last?.output ? { previousOutput: last.output, error: last.error ?? "请按严格JSON及原文保真规则修复。" } : undefined);
          const slot = stageSlot(stage), config = run.models[slot], key = keys[slot];
          validateRequest({ config, messages: input.messages }, key); reserve();
          const attempt: Attempt = { id: id(), stage, ordinal: prior.length + 1, startedAt: now(), endedAt: null, config: structuredClone(config), input, status: "running", output: null, usage: emptyUsage(), error: null, outcomeUnknown: false };
          run = { ...run, stage, status: "running", error: null, attempts: [...run.attempts, attempt] }; publish({ run });
          try {
            const result = await provider({ config, messages: input.messages }, key, controller.signal);
            if (controller.signal.aborted || active !== controller) return;
            check(Object.values(keys).every(secret => !secret.trim() || !result.text.includes(secret.trim())), "响应包含凭据，已拒绝保存。", "credential-in-response");
            attempt.output = result.text; attempt.usage = result.usage; attempt.endedAt = now();
            if (usesCreativeProtocol(run.spec.resources.version) && stage !== "formatting") validateCreativeStage(stage, result.text, lastOutput(run, "planning"), undefined, run.spec.resources.version);
            else if (stage === "writing") readWritingOutput(result.text, run.spec.resources.version);
            if (stage === "formatting") run.scene = acceptGeneratedText(result.text, lastProse(run), run.spec.resources.version);
            attempt.status = "succeeded";
            publish({ run: { ...run, attempts: [...run.attempts] } }); break;
          } catch (error) {
            if (controller.signal.aborted || active !== controller) return;
            attempt.status = "failed"; attempt.error = explanation(error); attempt.endedAt = now(); attempt.outcomeUnknown = error instanceof GenerationError && error.outcomeUnknown;
            if (error instanceof GenerationError && Object.values(error.usage).some(value => value !== null)) attempt.usage = error.usage;
            publish({ run: { ...run, attempts: [...run.attempts], error: attempt.error } });
            if (stage === "formatting" && error instanceof GenerationError && error.code === "invalid-scene" && prior.length < 1) continue;
            throw error;
          }
        }
      }
      if (!controller.signal.aborted) publish({ run: { ...snapshot.run!, status: "ready", error: null }, busy: false });
    } catch (error) {
      if (!controller.signal.aborted && active === controller) publish({ run: { ...snapshot.run!, status: "failed", error: explanation(error) }, error: explanation(error) });
    } finally { if (active === controller) { active = null; publish({ busy: false }); } }
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    preview(spec: Specification, stage: typeof STAGES[number]): CompiledInput {
      const run = snapshot.run, same = run && hash(run.spec) === hash(spec);
      const placeholder = usesCreativeProtocol(spec.resources.version) ? planningPreflight(spec.resources.version) : "（等待本次大纲）";
      const draftPlaceholder = usesPerformanceProtocol(spec.resources.version) ? "旁白：等待本次正文。" : "（等待本次正文）";
      return compileInput(stage, spec, same ? lastOutput(run, "planning") || placeholder : placeholder, same ? lastProse(run) || draftPlaceholder : draftPlaceholder);
    },
    async start(spec: Specification, models: Models, keys: Keys) {
      if (snapshot.busy) return;
      try {
        const effective = resolveGenerationModels(structuredClone(models), spec.preset, spec.resources.version);
        if (!usesCreativeProtocol(spec.resources.version)) { const compiled = compilePreset(spec.preset, spec.orderId, contextValues(spec, "（预检大纲）").values); check(compiled.messages.length, "预设为空。"); }
        const run = createRun(id(), now(), spec, effective);
        check(Object.values(keys).every(key => !key.trim() || !JSON.stringify(run).includes(key.trim())), "试读资料或配置包含 Key，请移除后再生成。", "credential-in-prompt");
        for (const slot of ["planning", "writing", "updater"] as const) validateRequest({ config: run.models[slot], messages: [] }, keys[slot]);
        publish({ run, error: null }); await execute({ ...keys });
      } catch (error) { publish({ error: explanation(error) }, false); }
    },
    async resume(keys: Keys) { if (!snapshot.busy && snapshot.run && snapshot.run.status !== "ready") await execute({ ...keys }); },
    cancel() {
      if (!active) return;
      active?.abort(); active = null;
      if (pendingProbe) {
        const p = pendingProbe; pendingProbe = null;
        saveProbe({ id: p.id, slot: p.slot, config: p.config, configuration: hash(p.config), status: "interrupted", text: null, usage: emptyUsage(), error: "已取消，供应商端结果未知。", outcomeUnknown: true, elapsedMs: now() - p.startedAt });
      }
      let run = snapshot.run;
      if (run?.status === "running") run = { ...run, status: "interrupted", error: "已取消；供应商端结果未知，重试可能再次计费。", attempts: run.attempts.map(a => a.status === "running" ? { ...a, status: "interrupted", endedAt: now(), outcomeUnknown: true, error: "已取消" } : a) };
      publish({ run, busy: false });
    },
    async probe(slot: ModelSlot, model: Models[ModelSlot], key: string) {
      if (snapshot.busy) return;
      const controller = new AbortController(); active = controller; publish({ busy: true, error: null }, false);
      try {
        const request = { config: parseModel(model), messages: [{ role: "user" as const, content: "连接检查。请只回复：连接成功。" }] };
        validateRequest(request, key); reserve(); const started = now();
        const probeId = id(); pendingProbe = { id: probeId, slot, config: request.config, startedAt: started };
        const result = await provider(request, key, controller.signal);
        if (!controller.signal.aborted && active === controller) {
          probeKeys.set(slot, key.trim());
          saveProbe({ id: probeId, slot, config: request.config, configuration: hash(request.config), status: "succeeded", text: result.text, usage: result.usage, error: null, outcomeUnknown: false, elapsedMs: now() - started });
          pendingProbe = null;
        }
      } catch (error) {
        if (!controller.signal.aborted && active === controller) {
          if (pendingProbe) { const p = pendingProbe; pendingProbe = null; saveProbe({ id: p.id, slot, config: p.config, configuration: hash(p.config), status: "failed", text: null, usage: error instanceof GenerationError ? error.usage : emptyUsage(), error: explanation(error), outcomeUnknown: error instanceof GenerationError && error.outcomeUnknown, elapsedMs: now() - p.startedAt }); }
          publish({ error: explanation(error) }, false);
        }
      }
      finally { if (active === controller) { active = null; publish({ busy: false }, false); } }
    },
    probeMatches(slot: ModelSlot, model: Models[ModelSlot], key: string) { try { const probe = snapshot.probes.filter(p => p.slot === slot).at(-1); return probe?.status === "succeeded" && probe.configuration === hash(parseModel(model)) && probeKeys.get(slot) === key.trim(); } catch { return false; } },
    setCursor(cursor: number) { const run = snapshot.run; if (run?.scene && cursor >= 0 && cursor < run.scene.lines.length) publish({ run: { ...run, cursor } }); },
    setLimit(limit: number) { if (snapshot.busy || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return; if (cache.saveBudget({ calls: snapshot.calls, limit })) publish({ limit }, false); },
    clear() { if (!snapshot.busy) publish({ run: null, error: null }); },
    exportRecord() { return JSON.stringify({ kind: "abyssa-airp-preview", version: 2, run: snapshot.run, probes: snapshot.probes, calls: snapshot.calls, limit: snapshot.limit }, null, 2); },
  };
}
