import type { AirpPlayerCommand, AirpSortieDefinition, AirpSceneRole } from "./airp";
import { AIRP_LIMITS } from "./airp";
import * as v from "./validation";

export const AIRP_SCENE_ROLES: readonly AirpSceneRole[] = ["offer", "departure", "found", "return-extracted", "return-cleared", "retry", "declined", "expired"];

export function parseAirpCommand(raw: unknown): AirpPlayerCommand {
  v.assertJson(raw);
  const r = v.record(raw, "command");
  const type = v.choice(r.type, ["airp-open", "airp-defer", "airp-decline", "airp-turn-in", "airp-read", "airp-accept"], "command.type");
  v.record(r, "command", ["type", "instanceId", ...(["airp-read", "airp-accept"].includes(type) ? ["sceneId", "nodeId"] : []), ...(type === "airp-accept" ? ["optionId"] : [])]);
  const instanceId = v.id(r.instanceId, "command.instanceId");
  if (type === "airp-read" || type === "airp-accept") {
    const sceneId = v.id(r.sceneId, "sceneId"), nodeId = v.id(r.nodeId, "nodeId");
    return type === "airp-read" ? { type, instanceId, sceneId, nodeId }
      : { type, instanceId, sceneId, nodeId, optionId: v.choice(r.optionId, ["A", "B", "C"], "optionId") };
  }
  return { type, instanceId };
}

/** Allowlist references are supplied by the selected immutable content bundle. */
export function parseAirpSortieDefinition(raw: unknown, refs: {
  actorIds: readonly string[]; sceneIds: readonly string[];
  routes: Readonly<Record<string, readonly (readonly string[])[]>>;
}): AirpSortieDefinition {
  v.assertJson(raw);
  const d = v.record(raw, "definition", ["contractVersion", "id", "version", "tier", "form", "title", "themeKey", "tags", "actorIds", "offerPhases", "volatility", "acceptedDeadline", "cooldownPhases", "objective", "reward", "scenes"]);
  v.choice(d.contractVersion, [1], "contractVersion");
  v.id(d.id, "id"); v.number(d.version, "version", 1); v.choice(d.tier, ["ripple"], "tier"); v.choice(d.form, ["sortie"], "form");
  v.text(d.title, "title", 100); v.id(d.themeKey, "themeKey");
  if (!v.ids(d.tags, "tags", AIRP_LIMITS.tags).length) v.invalid("tags", "Expected a canonical topic");
  const actors = v.ids(d.actorIds, "actorIds", AIRP_LIMITS.actors);
  if (!actors.length || actors.some(actor => actor === "kael" || !refs.actorIds.includes(actor))) v.invalid("actorIds", "Expected registered NPC actors");
  v.number(d.offerPhases, "offerPhases", 1, 256); v.choice(d.volatility, ["inert", "consequential"], "volatility");
  if (d.acceptedDeadline !== null) v.invalid("acceptedDeadline", "First slice has no accepted deadline");
  v.choice(d.cooldownPhases, [256], "cooldownPhases");
  const o = v.record(d.objective, "objective", ["kind", "routeId", "roomDefinitionId", "layer", "roomIndex", "evidenceId", "successOutcomes", "onWipe"]);
  v.choice(o.kind, ["room-evidence-return"], "objective.kind");
  const route = v.reference(refs.routes, o.routeId, "objective.routeId");
  const layer = v.number(o.layer, "objective.layer", 1, route.length), index = v.number(o.roomIndex, "objective.roomIndex", 0, 63);
  if (route[layer - 1][index] !== v.id(o.roomDefinitionId, "objective.roomDefinitionId")) v.invalid("objective", "Room does not match frozen route slot");
  v.id(o.evidenceId, "objective.evidenceId");
  if (v.canonicalJson(o.successOutcomes) !== '["extracted","cleared"]') v.invalid("objective.successOutcomes", "Expected successful return policy");
  v.choice(o.onWipe, ["retry"], "objective.onWipe");
  const reward = v.record(d.reward, "reward", ["kind", "memoryKey"]);
  v.choice(reward.kind, ["memory-only"], "reward.kind"); v.id(reward.memoryKey, "reward.memoryKey");
  const scenes = v.record(d.scenes, "scenes", [...AIRP_SCENE_ROLES]);
  for (const role of AIRP_SCENE_ROLES) if (!refs.sceneIds.includes(v.id(scenes[role], `scenes.${role}`))) v.invalid(`scenes.${role}`, "Unknown authored fallback");
  return JSON.parse(JSON.stringify(d)) as AirpSortieDefinition;
}
