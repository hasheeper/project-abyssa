import type { DemoCatalog } from "./demo";
import * as v from "./validation";

/** Version 3 capabilities are closed and cannot leak into a published version 2 package. */
export function validateManorContent(catalog: DemoCatalog) {
  const m = v.record(catalog.manor, "manor", ["firstClearRouteId", "maintenanceRouteId", "boss", "firstClearReward", "storyId"]);
  const first = v.reference(catalog.routes, m.firstClearRouteId, "firstClearRouteId");
  const maintenance = v.reference(catalog.routes, m.maintenanceRouteId, "maintenanceRouteId");
  if (first.id === maintenance.id || Object.keys(catalog.routes).length !== 2) v.invalid("manor.routes", "Two distinct routes required");
  const b = v.record(m.boss, "boss", ["definitionId", "guestId", "maxGuests", "summonBudget"]);
  const boss = v.reference(catalog.enemies, b.definitionId, "boss.definitionId");
  const guest = v.reference(catalog.enemies, b.guestId, "boss.guestId");
  if (boss.behavior !== "heiress" || guest.behavior !== "attack" || boss.id === guest.id) v.invalid("boss", "Invalid boss or guest behavior");
  v.number(b.maxGuests, "maxGuests", 1, 3); v.number(b.summonBudget, "summonBudget", 0, 12);
  const reward = v.record(m.firstClearReward, "firstClearReward", ["id", "gold"]);
  v.choice(reward.id, ["reward.old-manor.first-clear"], "reward.id"); v.number(reward.gold, "reward.gold", 0, 1000);
  v.choice(m.storyId, ["story.old-manor.release"], "storyId");
  if (!catalog.journey) v.invalid("journey", "Manor requires rooms");
  for (const route of [first, maintenance]) {
    if (route.layers.length !== 5) v.invalid("route", "Five layers required");
    const exits: number[] = [];
    route.layers.forEach((rooms, i) => rooms.forEach(id => {
      const room = catalog.journey!.rooms[id];
      if (room.kind === "exit") { exits.push(i + 1); if (!room.canContinue) v.invalid("exit", "Third layer continues"); }
      if (room.kind !== "battle") return;
      const ids = catalog.encounters[room.encounterId].enemyIds;
      if (route === maintenance && ids.some(id => ["heiress", "butler"].includes(catalog.enemies[id].behavior))) v.invalid("maintenance", "Released enemies cannot return");
      if (ids.includes(boss.id)) {
        if (route !== first || i !== 4 || ids.filter(id => id === boss.id).length !== 1 || ids.some(id => id !== boss.id && id !== guest.id) || ids.length - 1 > (b.maxGuests as number)) v.invalid("boss", "Invalid first-clear formation");
      }
    }));
    if (v.canonicalJson(exits) !== "[3]") v.invalid("exit", "Only the third layer has an exit");
    const last = catalog.journey.rooms[route.layers[4].at(-1)!];
    if (last.kind !== "battle") v.invalid("route", "Final battle required");
    if (route === first && !catalog.encounters[last.encounterId].enemyIds.includes(boss.id)) v.invalid("boss", "First clear needs heiress");
  }
}
