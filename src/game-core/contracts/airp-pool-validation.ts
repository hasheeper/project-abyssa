import type { AirpCard, AirpPoolCommand, AirpPoolContent } from "./airp-pool";
import type { D5Catalog } from "./d5";
import { parseAirpCommand, parseAirpSortieDefinition } from "./airp-validation";
import { validateAirpScript } from "./airp-live-validation";
import * as v from "./validation";

export function parseAirpPoolCommand(raw: unknown): AirpPoolCommand {
  v.assertJson(raw);
  const c = v.record(raw, "command");
  if (c.type !== "airp-visit" && c.type !== "airp-finish") return parseAirpCommand(raw);
  v.record(c, "command", ["type", "instanceId", ...(c.type === "airp-visit" ? ["actorId", "locationId"] : [])]);
  const instanceId = v.id(c.instanceId, "instanceId");
  return c.type === "airp-finish" ? { type: c.type, instanceId }
    : { type: c.type, instanceId, actorId: v.id(c.actorId, "actorId"), locationId: v.id(c.locationId, "locationId") };
}

export function validateAirpPoolContent(catalog: D5Catalog): AirpPoolContent {
  const c = v.record(catalog.airp, "airp", ["version", "cards", "scripts", "availability", "locations", "scheduler"]);
  v.choice(c.version, [2], "airp.version");
  const locations = v.record(c.locations, "locations"), availability = v.record(c.availability, "availability");
  for (const [id, label] of Object.entries(locations)) { v.id(id, "location"); v.text(label, "location.label", 80); }
  for (const [actor, raw] of Object.entries(availability)) {
    if (!catalog.characters[actor] || actor === "kael") v.invalid("availability", "Expected registered NPC");
    const schedule = v.record(raw, "schedule", ["dawn", "day", "dusk", "night"]);
    if (!Object.values(schedule).some(x => x !== null)) v.invalid("schedule", "Unreachable actor");
    for (const location of Object.values(schedule)) if (location !== null) v.reference(locations, location, "location");
  }
  const scheduler = v.record(c.scheduler, "scheduler", ["dailyOffers", "maxOpen", "maxPerForm", "formOrder"]);
  v.number(scheduler.dailyOffers, "dailyOffers", 1, 8); v.number(scheduler.maxOpen, "maxOpen", 1, 8); v.choice(scheduler.maxPerForm, [1], "maxPerForm");
  if (v.ids(scheduler.formOrder, "formOrder", 4).sort().join() !== "household,liaison,sortie,vignette") v.invalid("formOrder", "Four forms exactly once");
  const scripts = v.record(c.scripts, "scripts"), used = new Set<string>();
  const cards = v.list(c.cards, "cards", 30);
  if (!cards.length) v.invalid("cards", "Empty pool");
  const ids: string[] = [];
  for (const raw of cards) {
    const d = v.record(raw, "card", ["id", "version", "tier", "title", "themeKey", "tags", "actorIds", "giverId", "offerPhases", "volatility", "cooldownPhases", "repeat", "scenes", "summary", "aftermath", "objective"]);
    ids.push(v.id(d.id, "card.id")); v.choice(d.version, [1], "card.version"); v.choice(d.tier, ["ripple"], "tier");
    v.id(d.themeKey, "themeKey"); v.ids(d.tags, "tags", 8); v.text(d.title, "title", 100); v.text(d.summary, "summary", 320);
    const actors = v.ids(d.actorIds, "actorIds", 5);
    if (!actors.length || actors.some(a => !availability[a]) || actors[0] !== d.giverId) v.invalid("actorIds", "Giver first; every actor needs a reachable schedule");
    v.number(d.offerPhases, "offerPhases", 1, 256); v.choice(d.cooldownPhases, [256], "cooldownPhases"); v.choice(d.repeat, ["once", "after-cooldown"], "repeat");
    const volatility = v.choice(d.volatility, ["inert", "consequential"], "volatility");
    if (volatility === "consequential") v.text(d.aftermath, "aftermath", 320); else if (d.aftermath !== null) v.invalid("aftermath", "Inert events have no automatic consequences");
    const o = v.record(d.objective, "objective"), form = v.choice(o.form, ["sortie", "liaison", "household", "vignette"], "form");
    v.record(o, "objective", ["form", ...(form === "sortie" ? ["spec", "itemLabel"] : form === "liaison" ? ["targetActorId"] : ["actionLabel"])]);
    const scenes = v.record(d.scenes, "scenes");
    const required = ["offer", "declined", "expired", "offer-reserve", ...(volatility === "consequential" ? ["aftermath"] : []), ...(form === "sortie" ? ["departure", "found", "return-extracted", "return-cleared", "retry", "offer-setback"] : form === "liaison" ? ["target", "complete"] : form === "household" ? ["complete"] : [])];
    v.record(scenes, "scenes", required);
    for (const [role, id] of Object.entries(scenes)) {
      const script = validateAirpScript(v.reference(scripts, id, "scene"), actors);
      if (script.id !== id) v.invalid("script.id", "Script identity differs"); used.add(script.id);
      const choices = script.nodes.filter(n => n.kind === "choice").length;
      if (choices !== (role.startsWith("offer") && form !== "vignette" ? 1 : 0)) v.invalid("scene.choice", "Only offers own one decision; vignettes need only explicit finish");
    }
    if (form === "sortie") {
      const spec = parseAirpSortieDefinition(o.spec, { actorIds: actors, sceneIds: Object.keys(scripts), routes: Object.fromEntries(Object.values(catalog.routes).map(r => [r.id, r.layers])) });
      if (spec.id !== d.id || spec.themeKey !== d.themeKey || spec.actorIds.join() !== actors.join() || spec.objective.routeId !== catalog.manor!.maintenanceRouteId || catalog.journey!.rooms[spec.objective.roomDefinitionId]?.kind !== "battle" || d.repeat !== "once") v.invalid("sortie", "Sortie must bind a one-time published maintenance target");
      for (const [role, id] of Object.entries(spec.scenes)) if (scenes[role] !== id) v.invalid("scenes", "Patrol scene references differ");
      v.text(o.itemLabel, "itemLabel", 40);
    } else if (form === "liaison") {
      if (!actors.includes(String(o.targetActorId)) || o.targetActorId === d.giverId) v.invalid("targetActorId", "Liaison requires another registered participant");
    } else v.text(o.actionLabel, "actionLabel", 80);
  }
  v.ids(ids, "card.ids", 30);
  if (Object.keys(scripts).some(id => !used.has(id))) v.invalid("scripts", "Unreferenced authored text");
  return structuredClone(c) as AirpPoolContent;
}

export function airpCard(content: AirpPoolContent, id: string): AirpCard {
  const card = content.cards.find(d => d.id === id);
  if (!card) v.invalid("definition", "Unknown card");
  return card;
}
