import type { AirpContent, AirpScript } from "./airp-live";
import type { D5Catalog } from "./d5";
import { AIRP_LIMITS } from "./airp";
import { parseAirpSortieDefinition } from "./airp-validation";
import * as v from "./validation";

export function validateAirpScript(raw: unknown, actors: readonly string[] = ["elora"]): AirpScript {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > AIRP_LIMITS.sceneBytes - 2048) v.invalid("script", "Leave room for frozen scene identity");
  const s = v.record(raw, "script", ["schemaVersion", "id", "title", "locale", "presentation", "player", "cast", "sections", "nodes"]);
  v.choice(s.schemaVersion, [1], "script.schemaVersion"); v.id(s.id, "script.id"); v.text(s.title, "title", 100); v.choice(s.locale, ["zh-CN"], "locale");
  if (v.canonicalJson(s.player) !== v.canonicalJson({ actorId: "kael", nameToken: "{{user}}", authoredSpeech: false }) || v.canonicalJson(s.cast) !== v.canonicalJson(["kael", ...actors])) v.invalid("script.cast", "Scene cast is fixed; player speech disabled");
  const p = v.record(s.presentation, "presentation", ["stagePreset", "backgroundId", "defaultMode", "allowRp", "initialSlots"]);
  v.choice(p.stagePreset, ["mansion-morning", "mansion-night"], "stagePreset");
  v.choice(p.backgroundId, ["mansion.first-morning", "mansion.night"], "backgroundId");
  if ((p.stagePreset === "mansion-morning") !== (p.backgroundId === "mansion.first-morning") || p.defaultMode !== "adv" || p.allowRp !== false || v.canonicalJson(p.initialSlots) !== v.canonicalJson({left: actors[0]})) v.invalid("presentation", "Unsupported authored stage");
  const sections = v.list(s.sections, "sections", 1).map(raw => { const section = v.record(raw, "section", ["id", "title"]); v.text(section.title, "section.title", 100); return v.id(section.id, "section.id"); });
  if (sections.length !== 1) v.invalid("sections", "Expected one short scene");
  let choiceId: string | null = null;
  const identities: string[] = [];
  const nodes = v.list(s.nodes, "nodes", 16);
  if (!nodes.length) v.invalid("nodes", "Empty script");
  nodes.forEach((raw, cursor) => {
    const n = v.record(raw, "node"), kind = v.choice(n.kind, ["beat", "choice", "branch"], "node.kind");
    v.record(n, "node", ["id", "cursor", "sectionId", "kind", ...(kind === "beat" ? ["frames"] : kind === "choice" ? ["prompt", "options"] : ["choiceId", "variants"])]);
    const id = v.id(n.id, "node.id"); identities.push(id);
    if (n.cursor !== cursor || !sections.includes(String(n.sectionId))) v.invalid("node", "Unstable cursor/section");
    const frames = (raw: unknown, prefix: string) => {
      const entries = v.list(raw, "frames", 1);
      if (entries.length !== 1) v.invalid("frames", "One frame per durable node");
      const f = v.record(entries[0], "frame"), kind = v.choice(f.kind, ["narration", "dialogue"], "frame.kind");
      v.record(f, "frame", ["id", "kind", "text", ...(kind === "dialogue" ? ["actorId", "emotion"] : [])]);
      if (f.id !== prefix) v.invalid("frame.id", "Node/frame identity differs");
      v.text(f.text, "frame.text", 320);
      if (kind === "dialogue") { v.choice(f.actorId, actors, "actorId"); v.choice(f.emotion, ["neutral", "smile", "serious"], "emotion"); }
    };
    if (kind === "beat") frames(n.frames, id);
    else if (kind === "choice") {
      if (choiceId) v.invalid("choice", "Only one decision per scene");
      choiceId = id; v.text(n.prompt, "prompt", 100);
      const keys = v.list(n.options, "options", 3).map(raw => { const o = v.record(raw, "option", ["id", "label"]); v.text(o.label, "label", 100); return v.choice(o.id, ["A", "B", "C"], "option.id"); });
      if (keys.join("") !== "ABC") v.invalid("options", "Expected A/B/C");
    } else {
      if (!choiceId || n.choiceId !== choiceId) v.invalid("branch", "Missing earlier decision");
      const variants = v.record(n.variants, "variants", ["A", "B", "C"]);
      for (const key of ["A", "B", "C"]) frames(variants[key], `${id}.${key}`);
    }
  });
  v.ids(identities, "node.ids");
  return structuredClone(raw) as AirpScript;
}

export function validateAirpContent(catalog: D5Catalog): AirpContent {
  const r = v.record(catalog.airp, "airp", ["version", "definition", "scripts", "locationId", "phases"]);
  v.choice(r.version, [1], "airp.version"); v.choice(r.locationId, ["mansion.common-room"], "airp.locationId");
  if (v.canonicalJson(r.phases) !== '["dawn","day","dusk","night"]') v.invalid("airp.phases", "Expected the shared first-slice availability rule");
  const scripts = v.record(r.scripts, "airp.scripts");
  for (const [id, script] of Object.entries(scripts)) if (validateAirpScript(script).id !== id) v.invalid("scripts", "Script identity differs");
  const definition = parseAirpSortieDefinition(r.definition, { actorIds: Object.keys(catalog.characters), sceneIds: Object.keys(scripts), routes: Object.fromEntries(Object.values(catalog.routes).map(route => [route.id, route.layers])) });
  if (definition.id !== "ripple.elora.old-medicine-case" || definition.volatility !== "inert" || definition.actorIds.join() !== "elora") v.invalid("airp.definition", "Only the first handwritten errand is installed");
  const room = catalog.journey!.rooms[definition.objective.roomDefinitionId];
  if (definition.objective.routeId !== catalog.manor!.maintenanceRouteId || room?.kind !== "battle") v.invalid("airp.objective", "Must be a maintenance battle");
  for (const [role, id] of Object.entries(definition.scenes)) {
    const nodes = (scripts[id] as AirpScript).nodes;
    if (nodes.filter(n => n.kind === "choice").length !== (role === "offer" ? 1 : 0) || nodes.filter(n => n.kind === "branch").length !== (role === "offer" ? 1 : 0)) v.invalid("airp.script", "Offer alone owns the acceptance decision");
  }
  return structuredClone(r) as AirpContent;
}
