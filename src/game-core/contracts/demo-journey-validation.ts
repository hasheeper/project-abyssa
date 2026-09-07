import type { DemoCatalog, DemoRoomDef } from "./demo";
import * as v from "./validation";

export function demoRoom(catalog: Pick<DemoCatalog, "routes" | "journey" | "encounters">, routeId: string, layer: number, room: number): DemoRoomDef {
  const id = catalog.routes[routeId].layers[layer - 1][room];
  return catalog.journey ? catalog.journey.rooms[id] : { id, kind: "battle", encounterId: id, sceneId: "fixture" };
}
export function demoEncounterId(catalog: Pick<DemoCatalog, "routes" | "journey" | "encounters">, routeId: string, layer: number, room: number) {
  const def = demoRoom(catalog, routeId, layer, room);
  if (def.kind !== "battle") v.invalid("room", "Room is not a battle");
  return def.encounterId;
}

/** A release has no executable references to future rooms, enemies or abilities. */
export function validateDemoJourney(catalog: DemoCatalog) {
  const j = v.record(catalog.journey, "journey", ["rooms", "events", "items", "defaultItems", "defaultRouteId", "defaultProfileId", "depthPercent", "handBonusCapPercent"]);
  const rooms = v.record(j.rooms, "rooms"), events = v.record(j.events, "events"), items = v.record(j.items, "items");
  for (const [id, raw] of Object.entries(rooms)) {
    const r = v.record(raw, id), kind = v.choice(r.kind, ["battle", "event", "exit"], id);
    v.record(r, id, ["id", "kind", "sceneId", kind === "battle" ? "encounterId" : kind === "event" ? "eventId" : "canContinue"]);
    if (r.id !== id) v.invalid(id, "Room identity mismatch");
    v.id(id, "roomId"); v.id(r.sceneId, "sceneId");
    if (kind === "battle") v.reference(catalog.encounters, r.encounterId, id);
    else if (kind === "event") v.reference(events, r.eventId, id);
    else v.boolean(r.canContinue, id);
  }
  for (const [id, raw] of Object.entries(events)) {
    const e = v.record(raw, id, ["id", "name", "text", "kind", "cost", "reward"]);
    if (e.id !== id) v.invalid(id, "Event identity mismatch");
    v.id(id, "eventId"); v.text(e.name, id, 100); v.text(e.text, id, 2000);
    v.choice(e.kind, ["register", "relic", ...(catalog.rulesVersion === 3 ? ["seats"] : [])], id); v.number(e.cost, id, 0, 100); v.number(e.reward, id, 0, 100);
    if (e.kind !== "relic" && (e.cost !== 0 || e.reward !== 0)) v.invalid(id, "Reading cannot pay rewards");
  }
  const kinds = ["food", "potion", "ward", "holy-water", "maintenance-kit", "lucky-charm", "divination-slip"];
  if (Object.keys(items).length !== kinds.length) v.invalid("items", "Seven supply definitions required");
  for (const [id, raw] of Object.entries(items)) {
    const item = v.record(raw, id, ["id", "name", "kind", "capacity"]);
    v.choice(item.kind, kinds, id); v.text(item.name, id, 100); v.number(item.capacity, id, 1, 4);
    if (item.id !== id || id !== `item.${item.kind}`) v.invalid(id, "Item identity mismatch");
  }
  v.ids(j.defaultItems, "defaultItems", 4).forEach(id => v.reference(items, id, "defaultItems"));
  v.reference(catalog.routes, j.defaultRouteId, "defaultRouteId");
  v.reference(catalog.profiles, j.defaultProfileId, "defaultProfileId");
  const depth = v.list(j.depthPercent, "depthPercent", 5);
  depth.forEach(n => v.number(n, "depth", 100, 300));
  v.number(j.handBonusCapPercent, "handBonusCapPercent", 0, 500);
  for (const route of Object.values(catalog.routes)) {
    if (route.layers.length !== depth.length) v.invalid(route.id, "Layer multipliers differ");
    const visited = new Set<string>(); let hasExit = false;
    route.layers.forEach((ids, layer) => {
      if (catalog.journey!.rooms[ids[0]].kind !== "battle") v.invalid(route.id, "A layer starts with a battle");
      ids.forEach((id, index) => {
        if (visited.has(id)) v.invalid(id, "Room is used twice in route"); visited.add(id);
        const room = catalog.journey!.rooms[id];
        if (room.kind === "exit") {
          hasExit = true;
          if (index !== ids.length - 1 || (room.canContinue && layer === route.layers.length - 1)) v.invalid(id, "Invalid exit placement");
        }
      });
    });
    const last = route.layers.at(-1)!;
    if (!hasExit || catalog.journey!.rooms[last.at(-1)!].kind !== (catalog.rulesVersion === 3 ? "battle" : "exit")) v.invalid(route.id, "Route has no valid terminal room");
  }
}
