import { builtinPresetFile, defaultModels, importPreset, parseTestConfig, resolveGenerationModels, type Models, type ModelSlot, type Preset } from "./airp-generation";
import { generationResources } from "../content/presentation/airp/generation-resources";
import type { DirectMaterial } from "../game-application/airp-direct-gameplay/contracts";
import { createAiConnectionPersistence } from "./airp-connection-persistence";
import type { ConnectionVault } from "../game-infrastructure/airp-direct/connection-vault";
export { assertNoCredentialInPublicConfig } from "../game-application/airp-generation/credentials";

export type AiConnectionValues = {baseUrl: string; commonKey: string; models: Models; separate: Record<ModelSlot, boolean>; keys: Record<ModelSlot, string>};
export type AiConfiguration = AiConnectionValues & {preset: Preset; orderId: string};
export function createAiConfiguration(vault?: ConnectionVault) {
  const preset = importPreset(builtinPresetFile());
  const emptyConnection = (): AiConnectionValues => ({baseUrl: "", commonKey: "", models: defaultModels(), separate: {planning: false, writing: false, updater: false}, keys: {planning: "", writing: "", updater: ""}});
  let state: AiConfiguration = {...emptyConnection(), preset, orderId: preset.orders[0].id};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(l => l());
  const persistence = createAiConnectionPersistence(() => state, value => {state = {...state, ...(value ?? emptyConnection())}; notify();}, notify, vault);
  const patch = (patch: Partial<AiConfiguration>) => {
    state = {...state, ...patch};
    if (["baseUrl", "commonKey", "models", "separate", "keys"].some(k => Object.hasOwn(patch, k))) persistence.changed(); else notify();
  };
  void persistence.initialize();
  return {
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};}, getSnapshot: () => state, patch,
    persistence,
    importConfig(text: string) {const c = parseTestConfig(text); patch({baseUrl: c.baseUrl, commonKey: c.apiKey, models: c.models, separate: c.separate, keys: c.keys});},
    importPreset(text: string, name?: string) {const preset = importPreset(text, name); patch({preset, orderId: preset.orders.length === 1 ? preset.orders[0].id : ""});},
    clearKeys() {patch({commonKey: "", keys: {planning: "", writing: "", updater: ""}});},
  };
}
/** All callers share this instance; saved connections restore locally on startup. */
export const aiConfiguration = createAiConfiguration();
export function effectiveAiConnection(state: AiConnectionValues) {
  const models = Object.fromEntries((["planning", "writing", "updater"] as const).map(slot => [slot,
    {...state.models[slot], baseUrl: state.separate[slot] ? state.models[slot].baseUrl : state.baseUrl}])) as Models;
  const keys = Object.fromEntries((["planning", "writing", "updater"] as const).map(slot => [slot, state.separate[slot] ? state.keys[slot] : state.commonKey])) as Record<ModelSlot, string>;
  return {models, keys};
}
export function effectiveAiConfiguration(state: AiConfiguration) {
  const connection = effectiveAiConnection(state), keys = connection.keys;
  const models = resolveGenerationModels(connection.models, state.preset, generationResources.version);
  const material: DirectMaterial = {version: 2, resources: structuredClone(generationResources), preset: structuredClone(state.preset), orderId: state.orderId, models};
  return {models, keys, material};
}
