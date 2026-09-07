import type { DemoCatalog, DemoItemKind } from "../../../game-core/contracts";
import { DEMO_CONTENT } from "./content";

const content = structuredClone(DEMO_CONTENT);
content.characters.marietta.covenantId = null;
content.characters.marietta.release = { kind: "dossier-only", deferredCovenantId: "covenant.marietta", reason: "先通庄园，再完成回忆开放亲征" };
const enemy = "enemy.old-manor.", encounter = "encounter.old-manor.first.", room = "room.old-manor.first.";
const supplies: [DemoItemKind, string, number][] = [["food", "食物", 4], ["potion", "药水", 2], ["ward", "护符", 2], ["holy-water", "圣水", 2], ["maintenance-kit", "保养工具", 1], ["lucky-charm", "幸运符", 1], ["divination-slip", "卦签", 2]];
export const MANOR_CATALOG_DATA: DemoCatalog = {
  ...content, catalogId: "abyssa.demo.manor-segment", contentVersion: 1, rulesVersion: 2,
  enemies: Object.fromEntries([
    { id: `${enemy}waiting-guest`, name: "候席客", artId: "old-manor.waiting-guest", hp: 3, attack: 1, bounty: 3, behavior: "attack" as const },
    { id: `${enemy}platter-bearer`, name: "执盘侍者", artId: "old-manor.platter-bearer", hp: 5, attack: 3, bounty: 5, behavior: "charge" as const },
    { id: `${enemy}mending-maid`, name: "缝补女佣", artId: "old-manor.mending-maid", hp: 3, attack: 0, bounty: 3, behavior: "repair" as const },
    { id: `${enemy}curtain-butler`, name: "落幕管家", artId: "old-manor.curtain-butler", hp: 16, attack: 3, bounty: 12, behavior: "butler" as const },
  ].map(e => [e.id, e])),
  encounters: {
    [`${encounter}foyer`]: { id: `${encounter}foyer`, enemyIds: Array(3).fill(`${enemy}waiting-guest`) },
    [`${encounter}service`]: { id: `${encounter}service`, enemyIds: ["platter-bearer", "mending-maid", "waiting-guest"].map(id => enemy + id) },
    [`${encounter}butler`]: { id: `${encounter}butler`, enemyIds: [`${enemy}curtain-butler`] },
  },
  routes: { "old-manor.segment-3": { id: "old-manor.segment-3", layers: [[room + "foyer", room + "register"], [room + "service", room + "relic"], [room + "butler", room + "exit"]] } },
  profiles: { "profile.demo.first-run": { id: "profile.demo.first-run", availableCharacterIds: [...content.initialParty], progress: { appliedGrowthIds: [], equipment: [] } } },
  journey: {
    defaultRouteId: "old-manor.segment-3", defaultProfileId: "profile.demo.first-run",
    defaultItems: ["item.food", "item.potion", "item.ward", "item.holy-water"],
    depthPercent: [100, 125, 150], handBonusCapPercent: 200,
    rooms: {
      [room + "foyer"]: { id: room + "foyer", kind: "battle", encounterId: encounter + "foyer", sceneId: "old-manor.welcoming-hall" },
      [room + "register"]: { id: room + "register", kind: "event", eventId: "event.old-manor.register", sceneId: "old-manor.welcoming-hall" },
      [room + "service"]: { id: room + "service", kind: "battle", encounterId: encounter + "service", sceneId: "old-manor.service-corridor" },
      [room + "relic"]: { id: room + "relic", kind: "event", eventId: "event.old-manor.relic", sceneId: "old-manor.service-corridor" },
      [room + "butler"]: { id: room + "butler", kind: "battle", encounterId: encounter + "butler", sceneId: "old-manor.service-corridor" },
      [room + "exit"]: { id: room + "exit", kind: "exit", canContinue: false, sceneId: "old-manor.service-corridor" },
    },
    events: {
      "event.old-manor.register": { id: "event.old-manor.register", kind: "register", name: "迎宾簿", text: "宾客栏一再被补写，主人栏却空着。首席女仆的名字列在执行者一页。规矩比人活得久。", cost: 0, reward: 0 },
      "event.old-manor.relic": { id: "event.old-manor.relic", kind: "relic", name: "遗物整理", text: "松脱的红线缠住一匣遗物。你可以请一位仍有余力的伙伴尝试保全，也可以谨慎绕行。", cost: 2, reward: 4 },
    },
    items: Object.fromEntries(supplies.map(([kind, name, capacity]) => [`item.${kind}`, { id: `item.${kind}`, kind, name, capacity }])),
  },
};
