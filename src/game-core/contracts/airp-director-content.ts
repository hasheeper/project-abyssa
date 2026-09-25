import * as v from "./validation";
import { sha256 } from "./sha256";
import { parseDirectorCard } from "./airp-director-validation";
import type { D5Catalog } from "./d5";

export function validateDirectorContent(catalog: D5Catalog) {
  const c = v.record(catalog.airpDirector, "airpDirector", ["version", "fixed", "capabilities", "authorSources", "demoStart"]);
  v.choice(c.version, [1], "director.version");
  const start = v.record(c.demoStart, "demoStart", ["id", "routeId"]);
  v.choice(start.id, ["start.airp.patrol"], "demoStart.id");
  v.choice(start.routeId, [catalog.manor!.maintenanceRouteId], "demoStart.routeId");
  const cap = v.record(c.capabilities, "capabilities", ["actorIds", "locationIds", "objectIds", "locations", "objectives"]);
  const actors = v.ids(cap.actorIds, "actorIds", 4), locations = v.ids(cap.locationIds, "locationIds", 32), objects = v.ids(cap.objectIds, "objectIds", 32);
  if (actors.length !== 4 || actors.some(id => !["eustice", "norma", "elora", "kororo"].includes(id))) v.invalid("actorIds", "Unsupported director cast");
  const schedules = v.record(cap.locations, "locations", actors);
  for (const actor of actors) {
    const schedule = v.record(schedules[actor], "schedule", ["dawn", "day", "dusk", "night"]);
    for (const place of Object.values(schedule)) if (place !== null) v.choice(place, locations, "location");
  }
  const objectives = v.record(cap.objectives, "objectives");
  for (const [id, raw] of Object.entries(objectives)) {
    v.id(id, "objective.id");
    const o = v.record(raw, "objective", ["routeId", "roomDefinitionId", "layer", "roomIndex", "objectIds"]);
    v.reference(catalog.routes, v.id(o.routeId, "routeId"), "routeId");
    v.reference(catalog.journey!.rooms, v.id(o.roomDefinitionId, "roomDefinitionId"), "roomDefinitionId");
    v.number(o.layer, "layer", 0, 64); v.number(o.roomIndex, "roomIndex", 0, 128);
    for (const object of v.ids(o.objectIds, "objectIds", 8)) v.choice(object, objects, "objectId");
  }
  const sources = v.list(c.authorSources, "authorSources", 32).map(raw => {
    const s = v.record(raw, "authorSource", ["id", "body", "digest"]); v.id(s.id, "sourceId");
    if (sha256(v.canonicalJson(s.body)) !== s.digest) v.invalid("authorSource", "Author source digest differs");
    return s;
  });
  const fixedIds: string[] = [];
  for (const raw of v.list(c.fixed, "fixed", 32)) {
    const f = v.record(raw, "fixed", ["card", "authorStatus", "sourceId", "sourceDigest"]), card = parseDirectorCard(f.card);
    v.choice(f.authorStatus, ["working-draft", "approved"], "authorStatus");
    if (fixedIds.includes(card.id)) v.invalid("fixed", "Duplicate definition");
    fixedIds.push(card.id);
    if (!sources.some(s => s.id === f.sourceId && s.digest === f.sourceDigest)) v.invalid("fixed", "Exact author source missing");
    for (const actor of card.actorIds) v.choice(actor, actors, "actorId");
    for (const action of card.actions) if (action.kind === "patrol") v.reference(objectives, action.objectiveId, "objectiveId");
  }
}
