import type { D5Catalog, D5Definitions } from "../../../game-core/contracts";
import { FULL_MANOR_CATALOG_DATA } from "../demo-v1/manor-full";

// Independent D5 assembly. No mutations of the published v2/v3 data or default registration.
const base = structuredClone(FULL_MANOR_CATALOG_DATA);
delete base.characters.marietta.release;
base.enemies["enemy.memory.marietta"] = { id: "enemy.memory.marietta", hp: 18, attack: 3, bounty: 0, behavior: "idle", name: "玛丽埃塔·提线魔女", artId: "memory.marietta" };
base.enemies["enemy.memory.ceremonial-puppet"] = { id: "enemy.memory.ceremonial-puppet", hp: 3, attack: 1, bounty: 0, behavior: "attack", name: "旧日侍偶", artId: "old-manor.waiting-guest" };
base.encounters["encounter.memory.marietta"] = { id: "encounter.memory.marietta", enemyIds: ["enemy.memory.marietta", ...Array<string>(3).fill("enemy.memory.ceremonial-puppet")] };
base.routes["memory.marietta"] = { id: "memory.marietta", layers: [["room.memory.marietta"]] };
base.journey!.rooms["room.memory.marietta"] = { id: "room.memory.marietta", kind: "battle", encounterId: "encounter.memory.marietta", sceneId: "scene.memory.marietta" };
const growthEvents: D5Definitions["growthEvents"] = {};
for (const growthId of Object.keys(base.growth)) {
  const id = `event.${growthId}`;
  growthEvents[id] = { id, growthId, lastStep: 5 };
}
export const D5_CATALOG_DATA: D5Catalog = {
  ...base,
  contentVersion: 2,
  rulesVersion: 4,
  combat: {
    mariettaCovenant: { id: "covenant.marietta", pattern: "broad-full-house", budgets: [1, 2] },
    memory: { routeId: "memory.marietta", roomId: "room.memory.marietta", encounterId: "encounter.memory.marietta", bossId: "enemy.memory.marietta", puppetId: "enemy.memory.ceremonial-puppet", reorderBudget: 2, judgmentPower: 3 },
  },
  progression: {
    chapter: {
      id: "chapter.marietta.memory", templateId: "profile.memory.marietta.v1",
      encounterId: "encounter.memory.marietta", bossId: "enemy.memory.marietta",
      puppetId: "enemy.memory.ceremonial-puppet", storyId: "story.marietta.return",
      rewardId: "reward.marietta.memory", unlockId: "unlock.marietta.sortie",
      partyIds: ["kael", "eustice", "elora", "kororo", "norma"],
      progress: { appliedGrowthIds: ["eustice", "elora", "kororo", "norma"].map(id => `growth.${id}.lv2`), equipment: [] },
      bossHp: 18, puppetHp: 3, puppetCount: 3,
      supplies: [{ definitionId: "item.potion", charges: 2 }, { definitionId: "item.ward", charges: 2 }],
    },
    growthEvents,
    gift: { eventId: "event.demo.preparation-gift", rewardId: "reward.demo.preparation-gift", definitionIds: ["equipment.spare-blade", "equipment.emergency-pouch"], lastStep: 5 },
    returnLastStep: 7,
    memoryLastSteps: { "present-intro": 7, "history-opening": 8, teaching: 5, "history-complete": 8 },
  },
};
