import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { tideBattleStage, tideStory, tideStoryEdition } from "../../../content/presentation/tide-cave";

/** All tutorial battle layers and inter-battle controls share the authored location. */
export function tideScene(view: DemoJourneyView) {
  const tutorial = view.tutorial;
  if (!tutorial?.runRef) return undefined;
  const edition = tideStoryEdition(view.contentRef.contentVersion);
  // Reading can move the party before the old room's Continue button is pressed.
  // The cache follows S3-3; chapter retries retain later read IDs, so never use the last ID globally.
  const interlude = `S3-${(tutorial.encounter ?? 2) + 1}`;
  const storyId = tutorial.canClaim ? "S4-1"
    : !tutorial.story && !view.battle && tutorial.readStoryIds.includes(interlude) ? interlude : undefined;
  return storyId ? tideStory(storyId, edition).stages.at(-1)! : tideBattleStage(tutorial.encounter, edition);
}
