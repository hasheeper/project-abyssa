import * as v from "../../game-core/contracts";
import { parseModel, type Usage } from "../airp-generation/contracts";
import { validateGenerationMaterial } from "../airp-generation/validate-spec";
import { DIRECT_LIMITS, DIRECT_STAGES, type AirpDirectCommand, type AirpDirectIntent, type DirectMaterial } from "./contracts";

export function parseDirectMaterial(raw: unknown): DirectMaterial {
  v.assertJson(raw);
  const r = v.record(raw, "direct.material", ["version", "resources", "preset", "orderId", "models"]);
  v.choice(r.version, [1, 2], "direct.material.version");
  const material = raw as DirectMaterial;
  validateGenerationMaterial(material);
  v.choice(material.resources.version, [3, 4, 5, 6, 7, 8], "direct.resources.version");
  const models = v.record(r.models, "models", ["planning", "writing", "updater"]);
  for (const slot of ["planning", "writing", "updater"] as const) {
    const model = v.record(models[slot], `models.${slot}`, ["baseUrl", "model", "timeoutMs"], ["temperature", "top_p", "max_tokens"]);
    parseModel(model);
    // Do not persist credentials in URLs, query strings, fragments or arbitrary config fields.
    if (!/^https?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]{1,5})?(?:\/[a-z0-9._~%-]+)*\/?$/i.test(String(model.baseUrl)))
      v.invalid("baseUrl", "Use a plain HTTP(S) endpoint without credentials, query or fragment");
  }
  return structuredClone(material);
}
export function parseDirectUsage(raw: unknown): Usage {
  const r = v.record(raw, "usage", ["inputTokens", "outputTokens", "totalTokens"]);
  for (const value of Object.values(r)) if (value !== null) v.number(value, "usage", 0, Number.MAX_SAFE_INTEGER);
  return structuredClone(raw) as Usage;
}
export function parseAirpDirectCommand(raw: unknown): AirpDirectCommand {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > DIRECT_LIMITS.commandBytes) v.invalid("direct", "Direct command exceeds defensive capacity; no text was truncated", "airp-capacity");
  const r = v.record(raw, "direct.command");
  const type = v.choice(r.type, ["airp-direct-prepare", "airp-direct-begin", "airp-direct-result", "airp-direct-fail", "airp-direct-handwritten", "airp-direct-followup"], "direct.type");
  if (type === "airp-direct-followup") {
    v.record(r, "direct.command", ["type", "instanceId"]);
    return {type, instanceId: v.id(r.instanceId, "instanceId")};
  }
  const sceneId = v.id(r.sceneId, "sceneId");
  if (type === "airp-direct-handwritten") {v.record(r, "command", ["type", "sceneId"]); return {type, sceneId};}
  if (type === "airp-direct-prepare") {
    v.record(r, "command", ["type", "sceneId", "materialHash"], ["material"]);
    const materialHash = v.text(r.materialHash, "materialHash", 64);
    if (!/^[a-f0-9]{64}$/.test(materialHash)) v.invalid("materialHash", "Invalid material hash");
    const material = r.material === undefined ? undefined : parseDirectMaterial(r.material);
    if (material && v.sha256(v.canonicalJson(material)) !== materialHash) v.invalid("materialHash", "Material hash differs");
    return {type, sceneId, materialHash, ...(material ? {material} : {})};
  }
  const attemptId = v.id(r.attemptId, "attemptId"), at = v.number(r.at, "at", 0, Number.MAX_SAFE_INTEGER);
  if (type === "airp-direct-begin") {
    v.record(r, "command", ["type", "sceneId", "attemptId", "stage", "at"]);
    return {type, sceneId, attemptId, at, stage: v.choice(r.stage, DIRECT_STAGES, "stage")};
  }
  if (type === "airp-direct-result") {
    v.record(r, "command", ["type", "sceneId", "attemptId", "at", "output", "usage"]);
    return {type, sceneId, attemptId, at, output: v.text(r.output, "output", DIRECT_LIMITS.commandBytes), usage: parseDirectUsage(r.usage)};
  }
  v.record(r, "command", ["type", "sceneId", "attemptId", "at", "error", "outcomeUnknown", "usage"]);
  return {type, sceneId, attemptId, at, error: v.choice(r.error, ["provider-error", "cancelled", "interrupted"], "error"),
    outcomeUnknown: v.boolean(r.outcomeUnknown, "outcomeUnknown"), usage: parseDirectUsage(r.usage)};
}
export function parseAirpDirectIntent(raw: unknown): AirpDirectIntent {
  const r = v.record(raw, "direct.intent", ["version", "command"]);
  return {version: v.choice(r.version, [1], "version"), command: parseAirpDirectCommand(r.command)};
}
