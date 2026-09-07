import type { DemoContent, DemoGrowth } from "../../../game-core/contracts";
import { DEMO_CHARACTERS, DEMO_ACTIONS } from "./characters";

const upgrades: [string, number, number][] = [
  ["eustice", 6, 5],
  ["elora", 4, 3],
  ["kororo", 3, 5],
  ["norma", 3, 4],
  ["marietta", 5, 2],
];
const growth: Record<string, DemoGrowth> = {};
for (const [ownerId, awaken, gild] of upgrades) {
  for (const level of [2, 3] as const) {
    const id = `growth.${ownerId}.lv${level}`;
    growth[id] = {
      id,
      ownerId,
      level,
      awaken: level === 2 ? [awaken] : [],
      gild: level === 2 ? [gild] : [],
    };
  }
}
/** Draft rules modules, not a release Catalog. Marietta's covenant is deliberately unresolved until D5. */
export const DEMO_CONTENT: DemoContent = {
  characters: DEMO_CHARACTERS,
  actions: DEMO_ACTIONS,
  leaderId: "kael",
  maxPartySize: 5,
  initialParty: ["kael", "eustice", "elora", "kororo", "norma"],
  covenants: {
    "covenant.eustice": {
      id: "covenant.eustice",
      pattern: "flush",
      effect: "threat-damage",
      stages: [
        { min: 2, max: 2 },
        { min: 2, max: 4 },
      ],
    },
    "covenant.elora": {
      id: "covenant.elora",
      pattern: "triple",
      effect: "healing",
      stages: [
        { min: 1, max: 1 },
        { min: 1, max: 2 },
      ],
    },
    "covenant.kororo": {
      id: "covenant.kororo",
      pattern: "straight",
      effect: "execution-damage",
      stages: [
        { min: 1, max: 1 },
        { min: 1, max: 2 },
      ],
    },
    "covenant.norma": {
      id: "covenant.norma",
      pattern: "two-pair-blank",
      effect: "knives",
      stages: [
        { min: 1, max: 2 },
        { min: 2, max: 3 },
      ],
    },
  },
  growth,
  equipment: {
    "equipment.spare-blade": {
      id: "equipment.spare-blade",
      slot: "general",
      replacement: "attack",
      power: 1,
      scope: "all-native-blanks",
    },
    "equipment.emergency-pouch": {
      id: "equipment.emergency-pouch",
      slot: "general",
      replacement: "heal",
      power: 1,
      scope: "all-native-blanks",
    },
  },
};
