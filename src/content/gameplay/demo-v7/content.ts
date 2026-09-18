import type { D5Catalog } from "../../../game-core/contracts";
import { MORNING_DEPARTURE_CATALOG_DATA } from "../demo-v6/content";

const previous = structuredClone(MORNING_DEPARTURE_CATALOG_DATA);
const groups = [
  ["tide-slime", "tide-slime"],
  ["lookout", "crossbowman"],
  ["hauler", "lookout", "crossbowman"],
  ["reef-hook-chief", "crossbowman", "crossbowman"],
];

/** O2 rules, published by O3-T after scene and recovery verification. */
export const TIDE_CAVE_CATALOG_DATA: D5Catalog = {
  ...previous,
  contentVersion: 7,
  enemies: {
    ...previous.enemies,
    ...Object.fromEntries(([
      ["tide-slime", "潮滩史莱姆", 3, 1, 0, "attack"],
      ["lookout", "望风刀手", 3, 1, 1, "attack"],
      ["crossbowman", "伏礁弩手", 5, 2, 1, "charge"],
      ["hauler", "驮货打手", 6, 1, 2, "attack"],
      ["reef-hook-chief", "退潮匪首·礁钩", 12, 2, 3, "attack"],
    ] as const).map(([key, name, hp, attack, bounty, behavior]) => {
      const id = `enemy.intro.${key}`;
      return [id, { id, name, hp, attack, bounty, behavior }];
    })),
  },
  encounters: {
    ...previous.encounters,
    ...Object.fromEntries(groups.map((enemies, i) => {
      const id = `encounter.tide-cave.${i + 1}`;
      return [id, { id, enemyIds: enemies.map(e => `enemy.intro.${e}`) }];
    })),
  },
  routes: {
    ...previous.routes,
    "intro.tide-cave.first": { id: "intro.tide-cave.first", layers: [groups.map((_, i) => `room.tide-cave.${i + 1}`)] },
  },
  journey: {
    ...previous.journey!,
    rooms: {
      ...previous.journey!.rooms,
      ...Object.fromEntries(groups.map((_, i) => {
        const id = `room.tide-cave.${i + 1}`;
        return [id, { id, kind: "battle", encounterId: `encounter.tide-cave.${i + 1}`, sceneId: i < 2 ? "scene.tide-cave.shore" : "scene.tide-cave.cargo" }];
      })),
    },
  },
  tutorial: {
    id: "chapter.tide-cave", routeId: "intro.tide-cave.first",
    partyIds: ["kael", "eustice", "elora", "kororo", "norma"],
    itemIds: ["item.food", "item.potion"],
    firstBattleSeed: 8267,
    reward: { id: "reward.tide-cave.return", gold: 8, cargoIds: ["cargo.herbs", "cargo.books", "cargo.workshop-parcel"] },
    stories: {
      "S3-1": { lastStep: 0 }, "S3-2": { lastStep: 0 }, "S3-3": { lastStep: 0 },
      "S3-4": { lastStep: 0, choiceStep: 0 }, "S3-5": { lastStep: 0 },
      "S4-1": { lastStep: 0 }, "S4-2": { lastStep: 0 },
    },
    arrivalStoryId: "S3-1", interludeStoryIds: ["S3-2", "S3-3", "S3-4"], returnStoryIds: ["S3-5", "S4-1", "S4-2"],
  },
};
