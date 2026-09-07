import type { D5CombatDefinitions } from "../../../contracts/d5";
import type {
  DemoContent,
  DemoProgress,
  DemoResolvedCharacter,
  DemoSuit,
} from "../../../contracts/demo";
import * as v from "../../../contracts/validation";

export function validateDemoProgress(
  content: DemoContent & { combat?: D5CombatDefinitions },
  raw: unknown,
): DemoProgress {
  v.assertJson(raw);
  const p = v.record(raw, "progress", ["appliedGrowthIds", "equipment"]);
  const ids = v.ids(p.appliedGrowthIds, "growth", 10);
  for (const id of ids) {
    const g = v.reference(content.growth, id, "growth");
    if (g.level === 3 && !ids.includes(`growth.${g.ownerId}.lv2`))
      v.invalid("growth", "Level 3 requires level 2");
  }
  const instances = new Set<string>(),
    owners = new Set<string>();
  const equipment = v.list(p.equipment, "equipment", 2).map((raw) => {
    const e = v.record(raw, "equipment", [
      "instanceId",
      "definitionId",
      "ownerId",
    ]);
    const instanceId = v.id(e.instanceId, "instanceId"),
      ownerId = v.id(e.ownerId, "ownerId"),
      definitionId = v.id(e.definitionId, "definitionId");
    v.reference(content.equipment, definitionId, "equipment");
    const ch = v.reference(content.characters, ownerId, "ownerId");
    if (instances.has(instanceId) || owners.has(ownerId))
      v.invalid("equipment", "Duplicate equipment instance or general slot");
    if (!ch.faces.some((f) => content.actions[f.actionId].kind === "blank"))
      v.invalid(
        "equipment",
        "Character has no native blank face",
        "equipment-inapplicable",
      );
    instances.add(instanceId);
    owners.add(ownerId);
    return { instanceId, definitionId, ownerId };
  });
  return { appliedGrowthIds: ids, equipment };
}
export function resolveDemoCharacter(
  content: DemoContent & { combat?: D5CombatDefinitions },
  rawProgress: DemoProgress,
  id: string,
): DemoResolvedCharacter {
  const progress = validateDemoProgress(content, rawProgress),
    ch = v.reference(content.characters, id, "character");
  const faces = structuredClone(ch.faces),
    sources: string[] = [];
  let level: 1 | 2 | 3 = 1;
  for (const g of Object.values(content.growth)
    .filter((g) => g.ownerId === id)
    .sort((a, b) => a.level - b.level)) {
    if (!progress.appliedGrowthIds.includes(g.id)) continue;
    level = g.level;
    sources.push(g.id);
    for (const slot of g.awaken) faces[slot - 1].fate = "awake";
    for (const slot of g.gild) faces[slot - 1].quality = "gild";
  }
  const teamMilestone =
    progress.appliedGrowthIds.filter((key) => content.growth[key].level === 3)
      .length >= 2;
  if (id === content.leaderId && teamMilestone) {
    faces[3].quality = "gild";
    sources.push(`growth.${id}.team-lv3-guard`);
  }
  for (const item of progress.equipment.filter((e) => e.ownerId === id)) {
    const def = content.equipment[item.definitionId];
    sources.push(item.instanceId);
    for (const f of faces)
      if (content.actions[f.actionId].kind === "blank") {
        f.actionId = `action.${def.replacement}`;
        f.power = def.power;
      }
  }
  return {
    id,
    level,
    maxHp: ch.maxHp,
    faction: ch.faction,
    suits: [...ch.suits],
    faces,
    covenantId: id === "marietta" && content.combat ? content.combat.mariettaCovenant.id : ch.covenantId,
    covenantStage: level === 3 ? 2 : 1,
    sources,
  };
}
export function resolveDemoParty(
  content: DemoContent & { combat?: D5CombatDefinitions },
  progress: DemoProgress,
  ids: string[],
) {
  v.ids(ids, "party", content.maxPartySize);
  if (!ids.includes(content.leaderId)) v.invalid("party", "Leader required");
  ids.forEach(id => { if (content.characters[id]?.release) v.invalid("party", "Character is not released", "unavailable-character"); });
  const members = ids.map((id) => resolveDemoCharacter(content, progress, id));
  const votes: Record<DemoSuit, number> = {
    earth: 0,
    light: 0,
    abyss: 0,
    beyond: 0,
  };
  for (const ch of members) for (const suit of new Set(ch.suits)) votes[suit]++;
  return {
    members,
    votes,
    resonance: {
      earth: votes.earth >= 4,
      rainy: members.filter((ch) => ch.faction === "hero").length === 4,
      sovereign: members.some((ch) => ch.faction === "sovereign"),
    },
  };
}
