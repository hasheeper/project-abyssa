import {
  validateDemoCatalog,
  type DemoCatalog,
  type DemoProgress,
} from "../../game-core/contracts";
import { DEMO_CONTENT } from "../../content/gameplay/demo-v1/content";

export const demoProgress = (level: 1 | 2 | 3 = 1): DemoProgress => ({
  appliedGrowthIds: Object.values(DEMO_CONTENT.growth)
    .filter((g) => g.level <= level)
    .map((g) => g.id),
  equipment: [],
});
/** Executable test Catalog only. Marietta actions are testable, her deferred covenant is explicitly absent. */
export function demoFixture(edit?: (data: DemoCatalog) => void) {
  const content = structuredClone(DEMO_CONTENT);
  content.characters.marietta.covenantId = null;
  const data: DemoCatalog = {
    ...content,
    catalogId: "abyssa.fixture.demo-d1",
    contentVersion: 1,
    rulesVersion: 2,
    enemies: {
      "test.attacker": {
        id: "test.attacker",
        hp: 12,
        attack: 2,
        bounty: 7,
        behavior: "attack",
      },
      "test.charger": {
        id: "test.charger",
        hp: 13,
        attack: 3,
        bounty: 11,
        behavior: "charge",
      },
      "test.sealer": {
        id: "test.sealer",
        hp: 20,
        attack: 0,
        bounty: 5,
        behavior: "seal",
      },
    },
    encounters: {
      "test.room": {
        id: "test.room",
        enemyIds: ["test.attacker", "test.charger", "test.sealer"],
      },
    },
    routes: {
      "test.route": {
        id: "test.route",
        layers: [["test.room", "test.room"], ["test.room"]],
      },
    },
    profiles: Object.fromEntries(
      ([1, 2, 3] as const).map((level) => [
        `test.lv${level}`,
        {
          id: `test.lv${level}`,
          progress: demoProgress(level),
          availableCharacterIds: Object.keys(content.characters),
        },
      ]),
    ),
  };
  edit?.(data);
  return validateDemoCatalog(data);
}
export const DEMO_FIXTURE = demoFixture();
