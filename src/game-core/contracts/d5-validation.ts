import * as v from "./validation";
import { sha256 } from "./sha256";
import { validateManorCatalog } from "./demo-validation";
import type { D5Catalog, D5CatalogRef, ValidatedD5Catalog } from "./d5";

export function validateD5Catalog(raw: unknown, expected?: D5CatalogRef): ValidatedD5Catalog {
  v.assertJson(raw);
  const c = v.record(raw, "catalog"), { progression, combat, economy, prologue, opening, ...common } = c;
  v.choice(c.rulesVersion, [4], "rulesVersion");
  const version = v.choice(c.contentVersion, [2, 3, 4, 5, 6], "contentVersion"), clockwork = version >= 3;
  if (version >= 4) {
    const opening = v.record(prologue, "prologue", ["id", "shotIds"]);
    v.choice(opening.id, ["prologue.first-morning"], "prologue.id");
    const shots = v.ids(opening.shotIds, "prologue.shotIds", 32);
    if (shots.length !== 17 || shots[0] !== "A1-01" || shots.at(-1) !== "title-card") v.invalid("prologue.shotIds", "A complete ordered prologue is required");
  } else if (prologue !== undefined) v.invalid("prologue", "Published earlier catalogs have no prologue");
  if (version >= 5) {
    const intro = v.record(opening, "opening", version === 5 ? ["id", "lastStep", "choiceSteps"] : ["id", "lastStep", "choiceSteps", "choiceOptions"]);
    v.choice(intro.id, ["opening.first-morning"], "opening.id");
    v.choice(intro.lastStep, [version === 5 ? 66 : 119], "opening.lastStep");
    if (v.canonicalJson(intro.choiceSteps) !== (version === 5 ? "[6,24,42,58]" : "[6,24,42,58,96]")) v.invalid("opening.choiceSteps", "Authored decision cursors differ");
    if (version === 6 && v.canonicalJson(intro.choiceOptions) !== v.canonicalJson({"6":["A","B","C"],"24":["A","B","C"],"42":["A","B","C"],"58":["A","B","C"],"96":["A","B"]})) v.invalid("opening.choiceOptions", "Authored decision options differ");
  } else if (opening !== undefined) v.invalid("opening", "Earlier catalogs have no first-morning scene");
  v.choice(c.catalogId, ["abyssa.demo"], "catalogId");
  // Reuse the frozen reader only for the common definition schema. The persisted ref stays v4.
  const routes = { ...v.record(common.routes, "routes") }, journey = v.record(common.journey, "journey"), rooms = { ...v.record(journey.rooms, "rooms") };
  const memoryRoute = routes["memory.marietta"], memoryRoom = rooms["room.memory.marietta"];
  delete routes["memory.marietta"]; delete rooms["room.memory.marietta"];
  const shared = validateManorCatalog({ ...common, rulesVersion: 3, routes, journey: { ...journey, rooms } });
  const rules = v.record(combat, "combat", ["mariettaCovenant", "memory"]);
  if (v.canonicalJson(rules.mariettaCovenant) !== v.canonicalJson({ id: "covenant.marietta", pattern: "broad-full-house", budgets: [1, 2] })) v.invalid("combat.covenant", "Wrong covenant definition");
  const encounterId = clockwork ? "encounter.memory.clockwork" : "encounter.memory.marietta";
  const bossId = clockwork ? "enemy.memory.clockwork-beast" : "enemy.memory.marietta";
  if (v.canonicalJson(rules.memory) !== v.canonicalJson({ routeId: "memory.marietta", roomId: "room.memory.marietta", encounterId, bossId, puppetId: "enemy.memory.ceremonial-puppet", reorderBudget: 2, judgmentPower: 3 })) v.invalid("combat.memory", "Wrong memory rules");
  const p = v.record(progression, "progression", ["chapter", "growthEvents", "gift", "returnLastStep", "memoryLastSteps"]);
  if (v.canonicalJson(p.memoryLastSteps) !== v.canonicalJson({"present-intro":7,"history-opening":8,teaching:5,"history-complete":8})) v.invalid("memoryLastSteps", "Historical script cursors differ");
  const ch = v.record(p.chapter, "chapter", ["id", "templateId", "encounterId", "bossId", "puppetId", "storyId", "rewardId", "unlockId", "partyIds", "progress", "bossHp", "puppetHp", "puppetCount", "supplies"]);
  const identity = {
    id: "chapter.marietta.memory", templateId: clockwork ? "profile.memory.clockwork.v1" : "profile.memory.marietta.v1", encounterId,
    bossId, puppetId: "enemy.memory.ceremonial-puppet", storyId: "story.marietta.return",
    rewardId: "reward.marietta.memory", unlockId: "unlock.marietta.sortie",
  };
  for (const [key, value] of Object.entries(identity)) v.choice(ch[key], [value], `chapter.${key}`);
  const party = ["kael", "eustice", "elora", "kororo", "norma"];
  if (v.canonicalJson(ch.partyIds) !== v.canonicalJson(party)) v.invalid("chapter.partyIds", "Historical party is fixed");
  if (v.canonicalJson(shared.data.initialParty) !== v.canonicalJson(party)) v.invalid("initialParty", "D5 begins with all five heroes");
  party.forEach(id => v.reference(shared.data.characters, id, "chapter.partyIds"));
  const historical = { appliedGrowthIds: party.slice(1).map(id => `growth.${id}.lv2`), equipment: [] };
  if (v.canonicalJson(ch.progress) !== v.canonicalJson(historical)) v.invalid("chapter.progress", "Historical configuration differs");
  v.number(ch.bossHp, "bossHp", 1, 100);
  v.choice(ch.puppetHp, [3], "puppetHp"); v.choice(ch.puppetCount, [clockwork ? 0 : 3], "puppetCount");
  const boss = shared.data.enemies[bossId], puppet = shared.data.enemies["enemy.memory.ceremonial-puppet"];
  if (!boss || boss.hp !== ch.bossHp || boss.attack !== 3 || boss.bounty !== 0 || boss.behavior !== (clockwork ? "charge" : "idle") || !puppet || puppet.hp !== 3 || puppet.attack !== 1 || puppet.bounty !== 0 || puppet.behavior !== "attack") v.invalid("memory.enemies", "Historical definitions differ");
  if (v.canonicalJson(shared.data.encounters[encounterId]?.enemyIds) !== v.canonicalJson([boss.id, ...Array<string>(clockwork ? 0 : 3).fill(puppet.id)]) || v.canonicalJson(memoryRoute) !== v.canonicalJson({id: "memory.marietta", layers: [["room.memory.marietta"]]})) v.invalid("memory.route", "Historical encounter differs");
  if (v.canonicalJson(memoryRoom) !== v.canonicalJson({id: "room.memory.marietta", kind: "battle", encounterId, sceneId: clockwork ? "scene.memory.clockwork" : "scene.memory.marietta"}) || shared.data.characters.marietta.release) v.invalid("memory", "Missing executable character or room");
  if (v.canonicalJson(ch.supplies) !== v.canonicalJson([{ definitionId: "item.potion", charges: 2 }, { definitionId: "item.ward", charges: 2 }])) v.invalid("chapter.supplies", "Historical supply package differs");
  for (const id of ["item.potion", "item.ward"]) v.reference(shared.data.journey!.items, id, "chapter.supplies");
  const events = v.record(p.growthEvents, "growthEvents");
  const growthIds = ["eustice", "elora", "kororo", "norma", "marietta"].flatMap(id => [2, 3].map(level => `growth.${id}.lv${level}`));
  if (v.canonicalJson(Object.keys(shared.data.growth).sort()) !== v.canonicalJson([...growthIds].sort())) v.invalid("growth", "Exactly five characters at levels 2 and 3 required");
  const expectedIds = growthIds.map(id => `event.${id}`);
  if (v.canonicalJson(Object.keys(events).sort()) !== v.canonicalJson(expectedIds.sort())) v.invalid("growthEvents", "Exactly ten growth events required");
  for (const [id, rawEvent] of Object.entries(events)) {
    const event = v.record(rawEvent, id, ["id", "growthId", "lastStep"]);
    if (event.id !== id || `event.${event.growthId}` !== id) v.invalid(id, "Event/grant identity differs");
    v.reference(shared.data.growth, event.growthId, id); v.choice(event.lastStep, [5], id);
  }
  const gift = v.record(p.gift, "gift", ["eventId", "rewardId", "definitionIds", "lastStep"]);
  v.choice(gift.eventId, ["event.demo.preparation-gift"], "gift.eventId");
  v.choice(gift.rewardId, ["reward.demo.preparation-gift"], "gift.rewardId");
  v.choice(gift.lastStep, [5], "gift.lastStep"); v.choice(p.returnLastStep, [7], "returnLastStep");
  const equipment = ["equipment.spare-blade", "equipment.emergency-pouch"];
  if (v.canonicalJson(gift.definitionIds) !== v.canonicalJson(equipment)) v.invalid("gift", "Exactly the two agreed items required");
  for (const id of equipment) v.reference(shared.data.equipment, id, "gift.definitionIds");
  const profile = v.reference(shared.data.profiles, shared.data.journey!.defaultProfileId, "profile");
  if (Object.keys(shared.data.profiles).length !== 1 || profile.progress.appliedGrowthIds.length || profile.progress.equipment.length || v.canonicalJson(profile.availableCharacterIds) !== v.canonicalJson(party)) v.invalid("profile", "D5 starts with the unchanged five heroes and no grants");
  if (clockwork) {
    const e = v.record(economy, "economy", ["shopId", "quoteVersion", "freeItemIds", "prices"]);
    v.choice(e.shopId, ["shop.mansion"], "shopId"); v.choice(e.quoteVersion, [1], "quoteVersion");
    if (v.canonicalJson(e.freeItemIds) !== v.canonicalJson(["item.food", "item.potion"])) v.invalid("freeItemIds", "Basic food and healing remain free");
    const prices = v.record(e.prices, "prices");
    const paid = Object.keys(shared.data.journey!.items).filter(id => !(e.freeItemIds as string[]).includes(id)).sort();
    if (v.canonicalJson(Object.keys(prices).sort()) !== v.canonicalJson(paid)) v.invalid("prices", "Exactly the five tactical supplies are sold");
    Object.values(prices).forEach(p => v.number(p, "price", 1, 100));
    const route = shared.data.routes[shared.data.manor!.maintenanceRouteId], room = shared.data.journey!.rooms[route.layers[4][0]];
    if (room.kind !== "battle" || v.canonicalJson(shared.data.encounters[room.encounterId].enemyIds) !== v.canonicalJson(["enemy.old-manor.clockwork-beast"])) v.invalid("maintenance", "Clockwork beast must close maintenance");
  } else if (economy !== undefined) v.invalid("economy", "Published content v2 has no shop");
  const ref: D5CatalogRef = { catalogId: shared.ref.catalogId, contentVersion: version, rulesVersion: 4, digest: sha256(v.canonicalJson(raw)) };
  if (expected && v.canonicalJson(expected) !== v.canonicalJson(ref)) v.invalid("contentRef", "D5 content identity differs", "content-mismatch");
  return v.freezeData({ data: structuredClone(raw) as D5Catalog, ref, shared });
}
