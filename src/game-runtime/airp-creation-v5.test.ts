// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createGenerationController, defaultModels, defaultSpecification as currentSpecification, resolveGenerationModels } from "./airp-generation";
import { v5BuiltinGenerationPreset, v5GenerationResources } from "../content/presentation/airp/generation-resources";
import { parsePreset } from "../game-application/airp-generation/preset";
import { creationEnvelope } from "../game-application/testing/airp-writing-fixture";
import { bilingualParagraphs } from "../game-application/airp-generation/creative-output";
import { restoreRun } from "../game-application/airp-generation/run";
const defaultSpecification = () => {const preset = parsePreset(JSON.stringify(v5BuiltinGenerationPreset)); return {...currentSpecification(), resources: structuredClone(v5GenerationResources), preset, orderId: preset.orders[0].id};};

const bodies: [string, string, string] = ["旁白：艾洛拉让出桌边。", "艾洛拉：「ここに。（放这儿吧。）」", "艾洛拉：「ありがとう。（谢谢。）」"];
const creation = creationEnvelope(bodies), prose = bodies.join("\n"), edited = `<prose>${prose}</prose>`;
const scene = {creationRecord: "只提取中文", lines: bilingualParagraphs(prose).map(p => ({speaker: p.speaker, emotion: "neutral", text: p.chinese}))};
const models = () => Object.fromEntries(Object.entries(defaultModels()).map(([slot, m]) => [slot, {...m, baseUrl: "https://example.invalid/v1"}])) as ReturnType<typeof defaultModels>;
const keys = {planning: "fixture-secret", writing: "fixture-secret", updater: "fixture-secret"};
function setup(outputs: (string | Error)[], existing?: Map<string, string>) {
  const data = existing ?? new Map<string, string>(), storage = {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => {data.set(key, value);}, removeItem: (key: string) => {data.delete(key);}};
  const provider = vi.fn(async () => {const output = outputs.shift(); if (output instanceof Error) throw output; if (!output) throw Error("Unexpected call"); return {text: output, finishReason: "stop" as const, usage: {inputTokens: 12, outputTokens: 24, totalTokens: 36}};});
  return {data, provider, controller: createGenerationController({storage, provider})};
}
it("current default runs three actual compiler stages, saves raw bilingual evidence, restores Chinese only", async () => {
  const f = setup([creation, edited, JSON.stringify(scene)]), spec = defaultSpecification();
  expect(spec.resources.version).toBe(5); f.controller.preview(spec, "writing"); expect(f.provider).not.toHaveBeenCalled();
  await f.controller.start(spec, models(), keys);
  const run = f.controller.getSnapshot().run!;
  expect(run.error).toBeNull(); expect(run.status).toBe("ready"); expect(run.scene).toEqual(scene); expect(f.provider).toHaveBeenCalledTimes(3);
  expect(run.attempts[0].output).toBe(creation); expect(run.attempts[1].output).toBe(edited);
  expect(JSON.stringify(run.attempts[1].input)).not.toContain("CREATION_RECORD_ONLY");
  expect(JSON.stringify(run.scene)).not.toMatch(/[\u3040-\u30ff]/u);
  expect(f.controller.exportRecord()).not.toContain(keys.planning);
  f.controller.setCursor(1);
  const restored = setup([], f.data); expect(restored.controller.getSnapshot().run).toMatchObject({status: "ready", cursor: 1, scene}); expect(restored.provider).not.toHaveBeenCalled();
  expect(restoreRun(JSON.stringify(run)).scene).toEqual(scene);
});
it("keeps invalid creation evidence and billable usage; never starts editor", async () => {
  const f = setup(["旧的大纲"]); await f.controller.start(defaultSpecification(), models(), keys);
  expect(f.provider).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot().run?.attempts[0]).toMatchObject({status: "failed", output: "旧的大纲", usage: {totalTokens: 36}});
  const forged = structuredClone(f.controller.getSnapshot().run!); forged.attempts[0].status = "succeeded"; forged.attempts[0].error = null;
  expect(() => restoreRun(JSON.stringify(forged))).toThrow();
});
it("resumes from preserved creation after editor failure and repairs Chinese extraction once", async () => {
  const f = setup([creation, new Error("provider unavailable")]); await f.controller.start(defaultSpecification(), models(), keys);
  expect(f.controller.getSnapshot().run?.attempts.map(a => a.status)).toEqual(["succeeded", "failed"]);
  const resumed = setup([edited, JSON.stringify({...scene, lines: scene.lines.map((l, i) => ({...l, text: bilingualParagraphs(prose)[i].text}))}), JSON.stringify(scene)], f.data);
  await resumed.controller.resume(keys);
  expect(resumed.provider).toHaveBeenCalledTimes(3); expect(resumed.controller.getSnapshot().calls).toBe(5);
  expect(resumed.controller.getSnapshot().run?.scene).toEqual(scene);
  expect(resumed.controller.getSnapshot().run?.attempts.at(-1)?.input.messages.at(-1)?.content).toContain("previousOutput");
});
it("preserves explicit output limits and applies imported sampling to the v5 creator only", () => {
  const spec = defaultSpecification(), configured = models(); spec.preset.sampling = {temperature: 0.7, max_tokens: 65536};
  configured.planning.max_tokens = 9000;
  expect(resolveGenerationModels(configured, spec.preset, 5).planning).toMatchObject({max_tokens: 9000, temperature: 0.7});
  expect(resolveGenerationModels(configured, spec.preset, 5).writing.temperature).toBeUndefined();
  expect(resolveGenerationModels(configured, spec.preset, 4).writing.temperature).toBe(0.7);
});
