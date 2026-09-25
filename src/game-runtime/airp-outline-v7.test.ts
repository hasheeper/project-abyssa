// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createGenerationController, defaultModels, defaultSpecification as currentSpecification } from "./airp-generation";
import { outlineSpecificationV7 } from "../game-application/testing/airp-outline-specification";
import { outlineV7, proseV7 } from "../game-application/testing/airp-outline-fixture";
import { performedParagraphs } from "../game-application/airp-generation/creative-output";
import { restoreRun } from "../game-application/airp-generation/run";

const scene = {creationRecord: '中文表情保真', lines: performedParagraphs(proseV7).map(p => ({speaker: p.speaker, emotion: p.emotion, text: p.chinese}))};
const models = Object.fromEntries(Object.entries(defaultModels()).map(([slot, m]) => [slot, {...m, baseUrl: 'https://example.invalid/v1'}])) as ReturnType<typeof defaultModels>;
const keys = {planning: 'test-key', writing: 'test-key', updater: 'test-key'};
function fixture(outputs: string[]) {
  const data = new Map<string, string>();
  const storage = {getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => {data.set(k, v);}, removeItem: (k: string) => {data.delete(k);}};
  const provider = vi.fn(async () => ({text: outputs.shift()!, finishReason: 'stop' as const, usage: {inputTokens: 1, outputTokens: 2, totalTokens: 3}}));
  return {provider, controller: createGenerationController({storage, provider})};
}
it.each([7, 8] as const)('v%i completes outline to authored prose to Chinese, restores without coercing to another version', async version => {
  const f = fixture([outlineV7, `<prose>${proseV7}</prose>`, JSON.stringify(scene)]), spec = (version === 7 ? outlineSpecificationV7() : currentSpecification());
  expect(spec.resources.version).toBe(version);
  for (const stage of ['planning', 'writing', 'formatting'] as const) f.controller.preview(spec, stage);
  expect(f.provider).not.toHaveBeenCalled();
  await f.controller.start(spec, models, keys);
  const run = f.controller.getSnapshot().run!;
  expect(run.status).toBe('ready'); expect(run.scene).toEqual(scene); expect(f.provider).toHaveBeenCalledTimes(3);
  expect(run.attempts[0].output).toBe(outlineV7); expect(run.attempts[1].output).toContain(proseV7);
  expect(restoreRun(JSON.stringify(run)).scene).toEqual(scene);
  expect(JSON.stringify(run.scene)).not.toMatch(/[\u3040-\u30ff]|\[confused\]|scene_plan/u);
});
it.each([7, 8] as const)('v%i rejects a Sol story before calling Gemini and retains the failed raw response', async version => {
  const raw = '<Interleaving><thinking>旧协议</thinking>艾洛拉：「好了。」</Interleaving>', f = fixture([raw]);
  await f.controller.start((version === 7 ? outlineSpecificationV7() : currentSpecification()), models, keys);
  expect(f.provider).toHaveBeenCalledTimes(1);
  expect(f.controller.getSnapshot().run!.attempts[0]).toMatchObject({status: 'failed', output: raw, usage: {totalTokens: 3}});
});
it.each([7, 8] as const)('v%i retries only a malformed formatter, without recalling the outline or author', async version => {
  const wrong = {...scene, lines: scene.lines.map(l => ({...l, emotion: 'neutral'}))};
  const f = fixture([outlineV7, `<prose>${proseV7}</prose>`, JSON.stringify(wrong), JSON.stringify(scene)]);
  await f.controller.start((version === 7 ? outlineSpecificationV7() : currentSpecification()), models, keys);
  const run = f.controller.getSnapshot().run!;
  expect(run.attempts.map(a => a.status)).toEqual(['succeeded', 'succeeded', 'failed', 'succeeded']);
  expect(restoreRun(JSON.stringify(run)).scene).toEqual(scene);
});
