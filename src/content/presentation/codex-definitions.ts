import observations from "../../assets/codex/observations/catalog.json";

/** Explicit species aliases. Shared artwork alone never joins discovery. */
const definitions: Record<string, readonly string[]> = {
  "enemy.slime.mire": ["enemy.intro.tide-slime", "enemy.tide-reef.slime"],
  "enemy.beast.reef-crab": ["enemy.tide-reef.reef-crab"],
  "enemy.beast.shell-leech": ["enemy.tide-reef.shell-leech"],
  "enemy.outlaw.blade": ["enemy.intro.lookout", "enemy.tide-reef.blade"],
  "enemy.outlaw.crossbow": ["enemy.intro.crossbowman", "enemy.tide-reef.crossbow"],
  "enemy.outlaw.hauler": ["enemy.intro.hauler", "enemy.tide-reef.hauler"],
  "enemy.outlaw.chief": ["enemy.intro.reef-hook-chief"],
  "old-manor.clockwork-beast": ["enemy.old-manor.clockwork-beast", "enemy.memory.clockwork-beast"],
  "old-manor.waiting-guest": ["enemy.old-manor.waiting-guest"],
  "old-manor.platter-bearer": ["enemy.old-manor.platter-bearer"],
  "old-manor.mending-maid": ["enemy.old-manor.mending-maid"],
  "old-manor.curtain-butler": ["enemy.old-manor.curtain-butler"],
  "old-manor.puppet-heiress": ["enemy.old-manor.puppet-heiress"],
  "memory.marietta": ["enemy.memory.marietta"],
};

/** Enemy-associated tables only; room curios and room mechanisms are excluded. */
const lootTables: Record<string, string> = {
  "enemy.slime.mire": "table.loot.mire", "enemy.beast.reef-crab": "table.loot.reef-crab",
  "enemy.beast.shell-leech": "table.loot.shell-leech", "enemy.outlaw.blade": "table.loot.blade",
  "enemy.outlaw.crossbow": "table.loot.crossbow", "enemy.outlaw.hauler": "table.loot.hauler",
  "old-manor.waiting-guest": "table.loot.guest", "old-manor.platter-bearer": "table.loot.waiter",
  "old-manor.mending-maid": "table.loot.maid", "old-manor.clockwork-beast": "table.loot.clockwork",
};

export const codexDefinitions = observations.map((item, index) => ({
  id: item.id, number: String(index + 1).padStart(3, "0"), name: item.name, englishName: item.englishName,
  family: item.family, traits: item.traits,
  description: item.id === "enemy.slime.mire" ? "浊泥色的半透明躯体，泥水中夹杂着碎石与贝壳。" : item.description,
  enemyIds: definitions[item.id], lootTableId: lootTables[item.id],
}));
export const codexEntryByEnemy = new Map(codexDefinitions.flatMap(entry => entry.enemyIds.map(id => [id, entry.id] as const)));

export const codexSceneNames: Record<string, string> = {
  "scene.tide-reef.shore": "雾滩洞口", "scene.tide-reef.grotto": "洞内石阶", "scene.tide-reef.boardwalk": "走私栈道",
  "scene.tide-cave.shore": "退潮岩窟 · 洞口", "scene.tide-cave.cargo": "退潮岩窟 · 货场",
  "old-manor.welcoming-hall": "迎客门厅", "old-manor.service-corridor": "服务走廊", "old-manor.banquet-hall": "宴会厅",
  "scene.memory.clockwork": "旧日战斗", "scene.memory.marietta": "旧日战斗",
};
