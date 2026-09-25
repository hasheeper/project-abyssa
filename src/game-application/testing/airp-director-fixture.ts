import { directorDocuments, activatedDirectorDocuments } from "../../content/presentation/airp/director-documents";
import { builtinGenerationPreset, generationResources, legacyBuiltinGenerationPreset, legacyGenerationResources, v5BuiltinGenerationPreset, v5GenerationResources, v6BuiltinGenerationPreset, v6GenerationResources, v7BuiltinGenerationPreset, v7GenerationResources } from "../../content/presentation/airp/generation-resources";
import { DIRECTOR_CAPABILITIES, DIRECTOR_FIXED_CARDS, directorAuthorSource } from "../../content/gameplay/airp-director/content";
import { canonicalJson, emptyDirectorBudget } from "../../game-core/contracts";
import { directorHash } from "../../game-core/session";
import { parsePreset } from "../airp-generation/preset";
import type { DirectorJob, DirectorMaterial, DirectorPlanningContext } from "../airp-director/contracts";

// Version-specific fixtures also guard historical input replay.
export function directorTestMaterial(version: 4 | 5 | 6 | 7 | 8 = 4): DirectorMaterial {
  const preset = parsePreset(JSON.stringify(version === 8 ? builtinGenerationPreset : version === 7 ? v7BuiltinGenerationPreset : version === 6 ? v6BuiltinGenerationPreset : version === 5 ? v5BuiltinGenerationPreset : legacyBuiltinGenerationPreset));
  const model = {baseUrl: "https://example.invalid/v1", model: "test-only-model", timeoutMs: 1000};
  return {version: 2, resources: {...structuredClone(version === 8 ? generationResources : version === 7 ? v7GenerationResources : version === 6 ? v6GenerationResources : version === 5 ? v5GenerationResources : legacyGenerationResources), sources: structuredClone(version >= 7 ? activatedDirectorDocuments : directorDocuments)}, preset, orderId: preset.orders[0].id,
    models: {planning: {...model}, writing: {...model}, updater: {...model}}};
}
export function directorTestContext(): DirectorPlanningContext {
  return {version: 1, sourceKind: "gameplay", playerName: "测试玩家", capabilities: structuredClone(DIRECTOR_CAPABILITIES), fixed: structuredClone(DIRECTOR_FIXED_CARDS),
    authorSources: DIRECTOR_FIXED_CARDS.map(f => ({id: f.sourceId, text: canonicalJson(directorAuthorSource(f.sourceId)), digest: f.sourceDigest})),
    world: {head: {saveId: "test", epoch: "epoch", revision: 1}, phase: 0, eligible: true, availableActorIds: [...DIRECTOR_CAPABILITIES.actorIds], occupiedActorIds: [], sourceIds: ["fact:1"],
      existing: [], requiredStoryIds: [], busyFocus: false, themes: [], uniqueCompletedIds: [], followups: []},
    tasks: [], facts: [{id: "fact:1", phase: 0, text: "开发fixture：玩家进入洋馆，不是真实API或游玩证据。", knownBy: ["kael"], evidenceIds: ["fact:1"]}], memories: [], budget: emptyDirectorBudget(1)};
}
export function directorTestJob(material = directorTestMaterial()): DirectorJob {
  return {id: "day:1", kind: "day", materialHash: directorHash(material), planning: directorTestContext(), scene: null, attempts: [], proposal: null, review: null, acceptedEntries: null, text: null};
}
