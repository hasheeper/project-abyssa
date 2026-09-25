// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createGenerationController, defaultModels, defaultSpecification as currentSpecification, importPreset } from "./airp-generation";
import { legacyGenerationResources, legacyBuiltinGenerationPreset } from "../content/presentation/airp/generation-resources";
import { parsePreset } from "../game-application/airp-generation/preset";
import { GenerationError, emptyUsage, type Completion, type Models } from "../game-application/airp-generation/contracts";
import { createPreviewCache, RUN_CACHE_KEY, BUDGET_KEY, type PreviewStorage } from "../game-infrastructure/airp-direct/cache";
import { keminiSource, keminiOriginalModules, keminiPlanningChecklist } from "../content/presentation/airp/kemini-profile";
import { editorialFixture, writingEnvelope } from "../game-application/testing/airp-writing-fixture";
import { restoreRun } from "../game-application/airp-generation/run";
// This file preserves v2-v4 replay semantics; v5 has its own lifecycle tests.
const defaultSpecification = () => {const preset = parsePreset(JSON.stringify(legacyBuiltinGenerationPreset)); return {...currentSpecification(), resources: structuredClone(legacyGenerationResources), preset, orderId: preset.orders[0].id};};

const key = "fixture-key-never-exported", keys = { planning: key, writing: key, updater: key };
const models = (): Models => Object.fromEntries(Object.entries(defaultModels()).map(([k, v]) => [k, { ...v, baseUrl: "https://test.invalid/v1" }])) as Models;
const dialogue = "「お疲れさまでした。箱はこちらに。（辛苦了。箱子请放这边。）」";
const draft = `旁白：空药箱回到了休息室。\n艾洛拉：${dialogue}`;
const formatted = JSON.stringify({ creationRecord: "仅保留正文。", lines: [{ speaker: "narrator", emotion: "neutral", text: "空药箱回到了休息室。" }, { speaker: "elora", emotion: "smile", text: dialogue }] });
const completion = (text: string): Completion => ({ text, finishReason: "stop", usage: { inputTokens: 12, outputTokens: 24, totalTokens: 36 } });
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
function setup(outputs = ["本场大纲", writingEnvelope(draft), formatted], saved: PreviewStorage | null = storage()) {
  const provider = vi.fn().mockImplementation(async () => {
    const output = outputs.shift(); if (!output) throw Error("Unexpected call"); return completion(output);
  });
  let id = 0, time = 1000;
  return { provider, saved, controller: createGenerationController({ storage: saved, provider, id: () => `id-${++id}`, now: () => ++time }) };
}
describe("generation lifecycle", () => {
  it("uses the verified Sol planning ID without changing writing or formatting roles", () => {
    const defaults = defaultModels();
    expect(defaults.planning).toEqual({ baseUrl: "", model: "gpt-5.6-sol", timeoutMs: 180000, max_tokens: 32768 });
    expect(defaults.writing.model).toBe("gemini-3.8-flash");
    expect(defaults.updater.model).toBe("deepseek-flash");
    expect(defaults.updater.max_tokens).toBe(32768);
    const template = JSON.parse(readFileSync(new URL("../../config/airp-test.example.json", import.meta.url), "utf8"));
    expect(Object.fromEntries(Object.entries(template.models).map(([slot, config]) => [slot, (config as { model: string }).model])))
      .toEqual(Object.fromEntries(Object.entries(defaults).map(([slot, config]) => [slot, config.model])));
  });
  it("does not call on creation, previews or subscription", () => {
    const { controller, provider } = setup(); controller.subscribe(() => {}); controller.preview(defaultSpecification(), "writing"); controller.cancel();
    expect(provider).not.toHaveBeenCalled(); expect(controller.getSnapshot().calls).toBe(0);
  });
  it("runs three stages once, freezes actual inputs, restores ready AVG and exports no key", async () => {
    const { controller, provider, saved } = setup(); const spec = defaultSpecification();
    await controller.start(spec, models(), keys);
    const state = controller.getSnapshot(); expect(state.run?.status).toBe("ready"); expect(state.calls).toBe(3);
    expect(provider).toHaveBeenCalledTimes(3);
    expect(state.run?.attempts[1].output).toBe(writingEnvelope(draft));
    expect(JSON.parse(provider.mock.calls[2][0].messages[1].content).draft).toBe(draft);
    expect(JSON.stringify(controller.preview(spec, "formatting"))).not.toContain("EDITORIAL_ONLY");
    expect(JSON.stringify(state.run?.scene)).not.toContain("EDITORIAL_ONLY");
    expect(provider.mock.calls[1][0].messages.some((m: any) => m.content.includes("本场大纲"))).toBe(true);
    for (const source of spec.resources.sources) expect(provider.mock.calls[2][0].messages.some((m: any) => m.content.includes(source.text))).toBe(false);
    expect(controller.exportRecord()).not.toContain(key);
    controller.setCursor(1); const restored = createGenerationController({ storage: saved, provider });
    expect(restored.getSnapshot().run?.cursor).toBe(1); expect(restored.getSnapshot().run?.status).toBe("ready"); expect(provider).toHaveBeenCalledTimes(3);
  });
  it("retries only invalid Formatting once with identical draft and bounded feedback", async () => {
    const { controller, provider } = setup(["大纲", writingEnvelope(draft), "not JSON", formatted]);
    await controller.start(defaultSpecification(), models(), keys);
    expect(controller.getSnapshot().run?.status).toBe("ready"); expect(provider).toHaveBeenCalledTimes(4);
    const first = JSON.parse(provider.mock.calls[2][0].messages[1].content), repair = JSON.parse(provider.mock.calls[3][0].messages[1].content);
    expect(repair.draft).toBe(first.draft); expect(repair).not.toHaveProperty("outline"); expect(repair.feedback.previousOutput).toBe("not JSON");
    expect(controller.getSnapshot().run?.attempts[2].usage.totalTokens).toBe(36);
  });
  it("never loops when both format attempts fail", async () => {
    const { controller, provider } = setup(["大纲", writingEnvelope(draft), "bad", "bad-again"]);
    await controller.start(defaultSpecification(), models(), keys); await controller.resume(keys);
    expect(provider).toHaveBeenCalledTimes(4); expect(controller.getSnapshot().run?.status).toBe("failed"); expect(controller.getSnapshot().run?.scene).toBeNull();
  });
  it("preserves the successful outline across failure/reload and resumes Writing", async () => {
    const saved = storage(), { controller, provider } = setup(["大纲"], saved);
    provider.mockImplementationOnce(async () => completion("大纲")).mockImplementationOnce(async () => { throw new GenerationError("rate-limit", "限流"); });
    await controller.start(defaultSpecification(), models(), keys);
    expect(controller.getSnapshot().run?.attempts.map(a => a.status)).toEqual(["succeeded", "failed"]);
    const resumed = setup([writingEnvelope(draft), formatted], saved); expect(resumed.provider).not.toHaveBeenCalled();
    await resumed.controller.resume(keys); expect(resumed.provider).toHaveBeenCalledTimes(2); expect(resumed.controller.getSnapshot().calls).toBe(4);
    expect(resumed.controller.getSnapshot().run?.status).toBe("ready");
  });
  it("counts failed requests and stops at the explicit budget", async () => {
    const { controller, provider } = setup(); controller.setLimit(1);
    await controller.start(defaultSpecification(), models(), keys);
    expect(provider).toHaveBeenCalledTimes(1); expect(controller.getSnapshot().run?.status).toBe("failed"); expect(controller.getSnapshot().error).toContain("上限");
  });
  it("will not call if usage accounting cannot be saved", async () => {
    const { controller, provider } = setup(undefined, null); await controller.start(defaultSpecification(), models(), keys);
    expect(provider).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toContain("计数无法保存");
  });
  it("keeps in-memory results and reports a run-cache write failure", async () => {
    const s = storage(); const broken = { ...s, setItem: (key: string, value: string) => { if (key === RUN_CACHE_KEY) throw Error("quota"); s.setItem(key, value); } };
    const { controller } = setup(undefined, broken); await controller.start(defaultSpecification(), models(), keys);
    expect(controller.getSnapshot().run?.status).toBe("ready"); expect(controller.getSnapshot().cacheWarning).toContain("未保存");
  });
  it("blocks invalid presets and embedded credentials before a paid request", async () => {
    const { controller, provider } = setup(); const spec = defaultSpecification(); spec.preset.planningPrefix = "{{unknown}}";
    await controller.start(spec, models(), keys); expect(provider).not.toHaveBeenCalled();
    spec.preset.planningPrefix = key; await controller.start(spec, models(), keys); expect(provider).not.toHaveBeenCalled(); expect(controller.exportRecord()).not.toContain(key);
  });
  it("invalidates prior-output preview when the scenario changes", async () => {
    const { controller } = setup(); await controller.start(defaultSpecification(), models(), keys);
    const spec = defaultSpecification(); spec.playerName = "新名字";
    expect(JSON.stringify(controller.preview(spec, "formatting").messages)).not.toContain(draft);
    expect(JSON.stringify(controller.preview(spec, "writing").messages)).toContain("等待本次大纲");
  });
  it("rejects late cancelled responses, including after a new task starts", async () => {
    const saved = storage(); let resolve!: (c: Completion) => void;
    const provider = vi.fn().mockImplementationOnce(() => new Promise<Completion>(r => { resolve = r; })).mockResolvedValueOnce(completion("大纲2")).mockResolvedValueOnce(completion(writingEnvelope(draft))).mockResolvedValueOnce(completion(formatted));
    const controller = createGenerationController({ storage: saved, provider });
    const old = controller.start(defaultSpecification(), models(), keys); controller.cancel();
    expect(controller.getSnapshot().run?.attempts[0].outcomeUnknown).toBe(true);
    await controller.start(defaultSpecification(), models(), keys); const id = controller.getSnapshot().run?.id;
    resolve(completion("晚到旧结果")); await old;
    expect(controller.getSnapshot().run?.id).toBe(id); expect(controller.getSnapshot().run?.status).toBe("ready"); expect(controller.exportRecord()).not.toContain("晚到旧结果");
  });
  it("stores failed probe evidence and invalidates successful probes on key/config/reload changes", async () => {
    const saved = storage(), { controller, provider } = setup(["连接成功"], saved), model = models().planning;
    await controller.probe("planning", model, key); expect(controller.probeMatches("planning", model, key)).toBe(true);
    expect(controller.probeMatches("planning", model, "different-key")).toBe(false);
    const restored = createGenerationController({ storage: saved, provider });
    expect(restored.getSnapshot().probes).toHaveLength(1); expect(restored.probeMatches("planning", model, key)).toBe(false);
    provider.mockRejectedValueOnce(new GenerationError("authentication", "认证失败")); await restored.probe("planning", model, key);
    expect(restored.getSnapshot().probes.at(-1)?.status).toBe("failed"); expect(restored.getSnapshot().calls).toBe(2);
    expect(restored.exportRecord()).not.toContain(key);
  });
  it("retains partial known usage on a failed stage", async () => {
    const { controller, provider } = setup(); provider.mockRejectedValueOnce(new GenerationError("truncated", "截断", false, { ...emptyUsage(), outputTokens: 2400 }));
    await controller.start(defaultSpecification(), models(), keys); expect(controller.getSnapshot().run?.attempts[0].usage.outputTokens).toBe(2400);
  });
  it("preserves corrupt cache and treats corrupt budgets as exhausted", () => {
    const saved = storage(); saved.setItem(RUN_CACHE_KEY, "broken-json"); saved.setItem(BUDGET_KEY, "broken-budget");
    const cache = createPreviewCache(saved); expect(cache.read().run).toBeNull(); expect(saved.getItem(RUN_CACHE_KEY)).toBe("broken-json"); expect(cache.budget()).toEqual({ calls: 12, limit: 12 });
  });
  it.each([`<planning>${editorialFixture}</planning>`, writingEnvelope("「おかえり。」"), writingEnvelope("「おかえり。」（欢迎回来。）")])("keeps malformed paid writing evidence without downstream calls: %s", async malformed => {
    const {controller, provider, saved} = setup(["大纲", malformed]);
    await controller.start(defaultSpecification(), models(), keys);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().run).toMatchObject({status: "failed", scene: null});
    expect(controller.getSnapshot().run?.attempts[1]).toMatchObject({status: "failed", output: malformed, usage: {totalTokens: 36}});
    const restored = createGenerationController({storage: saved, provider});
    expect(restored.getSnapshot().run?.attempts[1].output).toBe(malformed);
    expect(provider).toHaveBeenCalledTimes(2);
    const forged = structuredClone(controller.getSnapshot().run!);
    forged.attempts[1].status = "succeeded"; forged.attempts[1].error = null;
    expect(() => restoreRun(JSON.stringify(forged))).toThrow();
  });
  it.each([2, 3])("retains plain writer output for frozen resource version %s", async version => {
    const spec = defaultSpecification(); spec.resources.version = version;
    const legacyDraft = "艾洛拉：欢迎回来。", legacyFormatted = JSON.stringify({creationRecord: "旧中文正文", lines: [{speaker: "elora", emotion: "smile", text: "欢迎回来。"}]});
    const {controller, provider, saved} = setup(["旧大纲", legacyDraft, legacyFormatted]);
    await controller.start(spec, models(), keys);
    expect(controller.getSnapshot().run?.status).toBe("ready");
    expect(JSON.parse(provider.mock.calls[2][0].messages[1].content).draft).toBe(legacyDraft);
    const restored = createGenerationController({storage: saved, provider});
    expect(restored.getSnapshot().run?.status).toBe("ready");
  });
});

describe("reviewed sources", () => {
  it("retains original preset modules and expands the three-part checklist without paraphrase", () => {
    for (const module of keminiOriginalModules) expect(createHash("sha256").update(module.content).digest("hex")).toBe(module.sha256);
    const core = keminiOriginalModules.find(m => m.identifier === "fd9adcfd-bbbe-447e-8be6-4f1d87e50da7")!;
    expect(core.content).toContain(keminiPlanningChecklist);
    const s = defaultSpecification();
    const reference = keminiOriginalModules.find(m => m.identifier === "a443f257-0f5d-4286-a1ff-f60653ed6400")!.content;
    expect(s.preset.planningPrefix).toContain(reference); expect(s.preset.modules[0].content).toContain(reference);
    const roleGuide = keminiOriginalModules.find(m => m.identifier === "d07b0943-0502-41b7-b126-a15998d4eca0")!.content;
    expect(s.preset.planningPrefix).toContain(roleGuide); expect(s.preset.modules[0].content).toContain(roleGuide);
    if (process.env.ABYSSA_AIRP_PRESET) {
      const original = JSON.parse(readFileSync(process.env.ABYSSA_AIRP_PRESET, "utf8"));
      for (const module of keminiOriginalModules) expect(module.content, module.identifier).toBe(original.prompts.find((m: any) => m.identifier === module.identifier).content ?? "");
    }
  });
  it("matches every complete original document and source SHA", () => {
    for (const source of defaultSpecification().resources.sources) {
      const bytes = readFileSync(source.path); expect(createHash("sha256").update(bytes).digest("hex"), source.path).toBe(source.sha256);
      expect(source.text, source.id).toBe(bytes.toString("utf8"));
    }
  });
  it("keeps Kemini source provenance and two separate default prefixes", () => {
    expect(keminiSource.sha256).toHaveLength(64); const s = defaultSpecification();
    expect(s.preset.planningPrefix).toContain("你负责大纲而非正文"); expect(s.preset.modules[0].content).toContain("你负责正文");
    // Portable basic import still uses the declared order; unknown exports aren't guessed.
    expect(() => importPreset("{}")).toThrow();
  });
});
