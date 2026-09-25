import type { D5Catalog } from "./d5";
import * as v from "./validation";

export function validateOrdinaryExpeditions(catalog: D5Catalog) {
  const entries = v.record(catalog.expeditions, "expeditions");
  const reserved = [catalog.manor!.firstClearRouteId, catalog.manor!.maintenanceRouteId, catalog.tutorial!.routeId, catalog.combat.memory.routeId];
  const nodes = new Set(["tower", "church"]);
  for (const [id, raw] of Object.entries(entries)) {
    const d = v.record(raw, id, ["id", "nodeId", "name", "englishName", "skin", "unlock", "ending", "grantsGrowth", "brief"]);
    if (d.id !== id || reserved.includes(id)) v.invalid(id, "Ordinary route identity conflicts");
    const route = v.reference(catalog.routes, id, "expedition.route");
    const node = v.id(d.nodeId, "expedition.nodeId");
    if (nodes.has(node)) v.invalid(node, "Map node already assigned");
    nodes.add(node);
    v.text(d.name, id, 100); v.text(d.englishName, id, 100);
    v.choice(d.skin, ["timber", "hero-party"], id);
    v.choice(d.unlock, ["after-tutorial"], id); v.choice(d.ending, ["plain"], id);
    if (d.grantsGrowth !== false) v.invalid(id, "Ordinary growth rewards are not installed");
    const brief = v.record(d.brief, id, ["flavor", "threats"]);
    v.text(brief.flavor, id, 400);
    v.list(brief.threats, id, 4).forEach(text => v.text(text, id, 100));
    for (const roomId of route.layers.flat()) {
      const room = catalog.journey!.rooms[roomId];
      if (room.kind !== "battle") continue;
      for (const enemyId of catalog.encounters[room.encounterId].enemyIds) {
        if ([catalog.manor!.boss.definitionId, catalog.combat.memory.bossId, catalog.combat.memory.puppetId].includes(enemyId))
          v.invalid(id, "Story enemies cannot appear in an ordinary route");
      }
    }
  }
  for (const id of Object.keys(catalog.routes)) {
    if (!reserved.includes(id) && !entries[id]) v.invalid(id, "Ordinary route has no access definition");
  }
}
