import { builtinGenerationPreset, generationResources, legacyBuiltinGenerationPreset, legacyGenerationResources, v5BuiltinGenerationPreset, v5GenerationResources, v6BuiltinGenerationPreset, v6GenerationResources, v7BuiltinGenerationPreset, v7GenerationResources } from "../../content/presentation/airp/generation-resources";
import { parsePreset } from "../airp-generation/preset";
import { hash } from "../airp-generation/contracts";
import type { DirectMaterial, DirectStage } from "../airp-direct-gameplay/contracts";
import { poolTestRuntime } from "./airp-pool-playthrough";
import { writingEnvelope } from "./airp-writing-fixture";
export { directReturnGate } from "./airp-direct-patrol";

// Existing replay fixtures deliberately remain v4; newer contracts opt in explicitly.
export const directMaterial = (version: 4 | 5 | 6 | 7 | 8 = 4): DirectMaterial => {
  const preset = parsePreset(JSON.stringify(version === 8 ? builtinGenerationPreset : version === 7 ? v7BuiltinGenerationPreset : version === 6 ? v6BuiltinGenerationPreset : version === 5 ? v5BuiltinGenerationPreset : legacyBuiltinGenerationPreset));
  const model = {baseUrl: "https://example.invalid/v1", model: "test-only-model", timeoutMs: 1000};
  return {version: 2, resources: structuredClone(version === 8 ? generationResources : version === 7 ? v7GenerationResources : version === 6 ? v6GenerationResources : version === 5 ? v5GenerationResources : legacyGenerationResources), preset, orderId: preset.orders[0].id,
    models: {planning: {...model}, writing: {...model}, updater: {...model}}};
};
export async function prepareDirect(f: ReturnType<typeof poolTestRuntime>, material: DirectMaterial = directMaterial()) {
  const r = await f.read(), task = r.airpDirect!.tasks.at(-1)!, materialHash = hash(material);
  await f.send({type: "airp-direct-prepare", sceneId: task.sceneId, materialHash, ...(r.airpDirect!.materials[materialHash] ? {} : {material})});
  return task.sceneId;
}
export async function simulateDirectStage(f: ReturnType<typeof poolTestRuntime>, stage: DirectStage, output: string) {
  const r = await f.read(), task = r.airpDirect!.tasks.at(-1)!;
  // This helper accepts mock story prose; raw/malformed response tests dispatch directly.
  const version = r.airpDirect!.materials[task.materialHash!].resources.version;
  if (stage === "writing" && version >= 4) output = version >= 5 ? `<prose>${output}</prose>` : writingEnvelope(output);
  const attemptId = `test-attempt:${r.head.revision}:${stage}`, at = 1000 + r.head.revision * 10;
  await f.send({type: "airp-direct-begin", sceneId: task.sceneId, attemptId, stage, at});
  return f.send({type: "airp-direct-result", sceneId: task.sceneId, attemptId, at: at + 1, output, usage: {inputTokens: null, outputTokens: null, totalTokens: null}});
}
