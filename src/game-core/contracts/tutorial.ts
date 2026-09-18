import type { TutorialGuideDefinition } from "./tutorial-guide";
/** Content-owned opening route. Prose and art live outside the gameplay catalog. */
export type TutorialDefinitions = {
  id: "chapter.tide-cave";
  routeId: "intro.tide-cave.first";
  partyIds: string[];
  itemIds: string[];
  firstBattleSeed: number;
  reward: { id: "reward.tide-cave.return"; gold: number; cargoIds: string[] };
  stories: Record<string, { lastStep: number; choiceStep?: number }>;
  arrivalStoryId: string;
  interludeStoryIds: string[];
  returnStoryIds: string[];
  /** Content 11 and later. Absence retains the frozen four-room policy. */
  guide?: TutorialGuideDefinition;
};
