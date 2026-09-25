import * as v from "./validation";
import type { D5Catalog } from "./d5";
import { validateTutorialGuide } from "./tutorial-guide-validation";

export function validateTutorialDefinitions(catalog: D5Catalog) {
  const guided = catalog.contentVersion >= 11;
  const t = v.record(catalog.tutorial, "tutorial", ["id", "routeId", "partyIds", "itemIds", "firstBattleSeed", "reward", "stories", "arrivalStoryId", "interludeStoryIds", "returnStoryIds", ...(guided ? ["guide"] : [])]);
  v.choice(t.id, ["chapter.tide-cave"], "tutorial.id");
  v.choice(t.routeId, ["intro.tide-cave.first"], "tutorial.routeId");
  if (v.canonicalJson(t.partyIds) !== '["kael","eustice","elora","kororo","norma"]' || v.canonicalJson(t.itemIds) !== '["item.food","item.potion"]') v.invalid("tutorial", "Fixed five heroes and basic supplies required");
  v.number(t.firstBattleSeed, "tutorial.firstBattleSeed", 0, 0xffffffff);
  const reward = v.record(t.reward, "tutorial.reward", ["id", "gold", "cargoIds"]);
  v.choice(reward.id, ["reward.tide-cave.return"], "tutorial.reward.id");
  v.number(reward.gold, "tutorial.reward.gold", 0, catalog.contentVersion >= 17 ? 10_000 : 100);
  if (v.canonicalJson(reward.cargoIds) !== '["cargo.herbs","cargo.books","cargo.workshop-parcel"]') v.invalid("tutorial.reward", "All three cargo facts are required");
  const route = v.reference(catalog.routes, t.routeId, "tutorial.routeId");
  const expectedRooms = ["room.tide-cave.1", "room.tide-cave.2", ...(guided ? ["room.tide-cave.event.intro"] : []), "room.tide-cave.3", "room.tide-cave.4"];
  const expectedLayers = catalog.contentVersion >= 14
    ? [[expectedRooms[0]], [expectedRooms[1], expectedRooms[2]], [expectedRooms[3]], [expectedRooms[4]]]
    : [expectedRooms];
  if (v.canonicalJson(route.layers) !== v.canonicalJson(expectedLayers)) v.invalid("tutorial.route", "Ordered version-specific opening route required");
  let battle = 0;
  for (const id of route.layers.flat()) {
    const room = v.reference(catalog.journey!.rooms, id, "tutorial.room");
    if (guided && id === "room.tide-cave.event.intro") {
      v.record(room, "tutorial.event.room", ["id", "kind", "eventId", "sceneId"]);
      if (room.id !== id || room.kind !== "event" || room.eventId !== "event.tide-cave.cache") v.invalid("tutorial.event", "Dedicated intro event required");
      const event = v.reference(catalog.journey!.events, room.eventId, "tutorial.event");
      if (event.kind !== "relic" || event.cost !== 0 || event.reward !== 0) v.invalid("tutorial.event", "Intro event has no fee or reward");
      continue;
    }
    battle++;
    if (id !== `room.tide-cave.${battle}` || room.id !== id || room.kind !== "battle" || room.encounterId !== `encounter.tide-cave.${battle}`) v.invalid("tutorial.room", "Ordered battle room required");
    v.record(room, "tutorial.room", ["id", "kind", "encounterId", "sceneId"]);
    v.id(room.sceneId, "sceneId");
    const encounter = v.reference(catalog.encounters, room.encounterId, "tutorial.encounter");
    if (encounter.enemyIds.some(id => !id.startsWith("enemy.intro."))) v.invalid("tutorial.enemies", "Opening enemies must not award manor progress");
  }
  const stories = v.record(t.stories, "tutorial.stories");
  const order = [v.id(t.arrivalStoryId, "arrivalStoryId"), ...v.ids(t.interludeStoryIds, "interludeStoryIds", 3), ...v.ids(t.returnStoryIds, "returnStoryIds", 3)];
  const expectedStories = ["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1", ...(catalog.contentVersion < 12 ? ["S4-2"] : [])];
  if (v.canonicalJson(order) !== v.canonicalJson(expectedStories) || Object.keys(stories).length !== order.length) v.invalid("tutorial.stories", "Version-specific story slots required");
  for (const id of order) {
    const s = v.record(stories[id], id, ["lastStep"], ["choiceStep"]);
    const last = v.number(s.lastStep, "lastStep", 0, 100);
    if (s.choiceStep !== undefined) v.number(s.choiceStep, "choiceStep", 0, last);
    if ((id === "S3-4") !== (s.choiceStep !== undefined)) v.invalid(id, "Only the cargo ledge has a decision beat");
  }
  if (guided) validateTutorialGuide(catalog);
}
