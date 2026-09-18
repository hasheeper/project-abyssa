import type { D5Catalog } from "../../../game-core/contracts";
import { GUIDED_TIDE_CATALOG_DATA } from "../demo-v11/content";

const previous = structuredClone(GUIDED_TIDE_CATALOG_DATA);
const tutorial = previous.tutorial!;
const {"S4-2": _unpublishedCommission, ...stories} = tutorial.stories;

/** New-game release: the authored locksmith and chapter ending are gameplay
 * identities. Never rewrite the published v11 guide or its saved evidence. */
export const CHAPTER_ONE_CATALOG_DATA: D5Catalog = {
  ...previous,
  contentVersion: 12,
  tutorial: {
    ...tutorial,
    stories,
    returnStoryIds: ["S3-5", "S4-1"],
    guide: {
      ...tutorial.guide!, id: "tide.guide.v2", eventSeed: 7,
      steps: tutorial.guide!.steps.map(step => step.id !== "E1.attempt" ? step : {
        ...step, input: {kind: "event", actorId: "norma"},
        evidence: [
          {type: "event-resolved", actorId: "norma", payload: {method: "strong", cost: 0, reward: 0}},
          {type: "room-completed"}
        ]
      })
    }
  }
};
