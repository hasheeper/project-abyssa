import { record, choice, type DirectorCapabilities, type DirectorResidentCast } from "../../game-core/contracts";

/** Configuration cannot add arbitrary NPCs or locations. */
export function parseResidentCast(raw: unknown): DirectorResidentCast {
  const r = record(raw, "residentCast", ["version", "locations"]);
  choice(r.version, [1], "residentCast.version");
  const schedules = record(r.locations, "residentCast.locations", ["marietta", "abyssa"]);
  const locations: DirectorCapabilities["locations"] = {};
  for (const id of ["marietta", "abyssa"]) {
    const s = record(schedules[id], "residentCast.schedule", ["dawn", "day", "dusk", "night"]);
    const allowed = id === "marietta" ? ["maid", "dining", "array"] : ["abyssa", "terrace"];
    locations[id] = Object.fromEntries(Object.entries(s).map(([phase, place]) => [phase, place === null ? null : choice(place, allowed, "residentCast.location")])) as DirectorCapabilities["locations"][string];
  }
  return {version: 1, locations};
}

export function withResidentCapabilities(base: DirectorCapabilities, cast?: DirectorResidentCast): DirectorCapabilities {
  if (!cast) return base;
  return {...base, actorIds: [...new Set([...base.actorIds, ...Object.keys(cast.locations)])],
    locationIds: [...new Set([...base.locationIds, ...Object.values(cast.locations).flatMap(s => Object.values(s).filter((p): p is string => p !== null))])],
    locations: {...base.locations, ...cast.locations}};
}
