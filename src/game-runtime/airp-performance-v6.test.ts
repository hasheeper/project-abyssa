// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createGenerationController, defaultModels, defaultSpecification as newSpecification, parsePreset } from "./airp-generation";
import { v6GenerationResources, v6BuiltinGenerationPreset } from "../content/presentation/airp/generation-resources";
import { creationEnvelope } from "../game-application/testing/airp-writing-fixture";
import { performedParagraphs } from "../game-application/airp-generation/creative-output";
import { restoreRun } from "../game-application/airp-generation/run";

const bodies: [string, string, string] = ["旁白：纸页翻开。", "艾洛拉：「ここ？（这里？）」", "艾洛拉：「ありがとう。（谢谢。）」"];
const creator = creationEnvelope(bodies), draft = bodies.map((b, i) => i ? b.replace("艾洛拉：", `艾洛拉[${i === 1 ? "confused" : "smile"}]：`) : b).join("\n");
const edited = `<prose>${draft}</prose>`, scene = {creationRecord: "中文和表情保真", lines: performedParagraphs(draft).map(p => ({speaker: p.speaker, emotion: p.emotion, text: p.chinese}))};
const models = Object.fromEntries(Object.entries(defaultModels()).map(([slot, m]) => [slot, {...m, baseUrl: "https://example.invalid/v1"}])) as ReturnType<typeof defaultModels>;
const keys = {planning: "test-secret", writing: "test-secret", updater: "test-secret"};
const defaultSpecification = () => {
  const preset = parsePreset(JSON.stringify(v6BuiltinGenerationPreset));
  return {...newSpecification(), resources: structuredClone(v6GenerationResources), preset, orderId: preset.orders[0].id};
};
function fixture(outputs: string[]) {
  const data = new Map<string, string>();
  const storage = {getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => {data.set(k, v);}, removeItem: (k: string) => {data.delete(k);}};
  const provider = vi.fn(async () => ({text: outputs.shift()!, finishReason: "stop" as const, usage: {inputTokens: 1, outputTokens: 2, totalTokens: 3}}));
  return {provider, controller: createGenerationController({storage, provider})};
}
it("frozen v6 preserves chosen expressions, raw evidence and Chinese-only cache replay", async () => {
  const f = fixture([creator, edited, JSON.stringify(scene)]), spec = defaultSpecification();
  expect(spec.resources.version).toBe(6);
  for (const stage of ["planning", "writing", "formatting"] as const) f.controller.preview(spec, stage);
  expect(f.provider).not.toHaveBeenCalled();
  await f.controller.start(spec, models, keys);
  const run = f.controller.getSnapshot().run!;
  expect(run.status).toBe("ready"); expect(run.scene).toEqual(scene); expect(f.provider).toHaveBeenCalledTimes(3);
  expect(restoreRun(JSON.stringify(run)).scene).toEqual(scene);
  expect(JSON.stringify(run.scene)).not.toMatch(/[\u3040-\u30ff]|\[confused\]|\[smile\]/u);
  expect(run.attempts[1].output).toBe(edited);
});
it("rejects formatter emotion rewrites and repairs without repeating creator/editor", async () => {
  const wrong = {...scene, lines: scene.lines.map(l => ({...l, emotion: "neutral"}))};
  const f = fixture([creator, edited, JSON.stringify(wrong), JSON.stringify(scene)]);
  await f.controller.start(defaultSpecification(), models, keys);
  const run = f.controller.getSnapshot().run!;
  expect(run.status).toBe("ready"); expect(run.scene).toEqual(scene);
  expect(run.attempts.map(a => a.status)).toEqual(["succeeded", "succeeded", "failed", "succeeded"]);
  expect(run.attempts[2].error).toContain("表情");
  expect(restoreRun(JSON.stringify(run)).scene).toEqual(scene);
});
it("retains failed editor evidence/usage and does not send missing annotations to formatter", async () => {
  const f = fixture([creator, `<prose>${bodies.join("\n")}</prose>`]);
  await f.controller.start(defaultSpecification(), models, keys);
  expect(f.provider).toHaveBeenCalledTimes(2);
  expect(f.controller.getSnapshot().run?.attempts[1]).toMatchObject({status: "failed", usage: {totalTokens: 3}});
});
