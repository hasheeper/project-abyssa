export type TutorialLesson = "roll" | "fix" | "action" | "end-turn" | "reroll" | "guard" | "heal" | "item" | "hand" | "covenant";
export type TutorialLessonEvidence = { kind: TutorialLesson; eventId: string; encounterId: string; attempt: number };
export type TutorialStoryChoice = { storyId: string; step: number; choice: "A" | "B" | "C" };
export type TutorialGuideProof = {stepId: string; roomId: string; encounterId: string | null; attempt: number; eventIds: string[]};
export type TutorialGuideState = {
  version: 1; planId: string; mode: "guided" | "free"; reason: null | "completed" | "exited";
  cursor: number; proofs: TutorialGuideProof[]; exitEventId: string | null;
};
export type TutorialRunState<BaseState> = {
  stage: "story" | "active" | "failed" | "claimable";
  attempt: number;
  continuationSeed: number;
  hintsEnabled: boolean;
  story: { id: string; step: number } | null;
  choices: TutorialStoryChoice[];
  readStoryIds: string[];
  lessons: TutorialLessonEvidence[];
  undoLessons: TutorialLessonEvidence[][];
  /** Whole unmodified opening state, including the allowance's original instance identities. */
  entry: BaseState;
  checkpoint: { state: BaseState; lessons: TutorialLessonEvidence[]; guide?: TutorialGuideState };
  guide?: TutorialGuideState;
  undoGuides?: TutorialGuideState[];
};
export type TutorialProgress =
  | { status: "pending" }
  | { status: "active"; runId: string }
  | { status: "exempt"; reason: "pre-tutorial-save" | "player-skipped" }
  | { status: "completed"; runId: string; terminalId: string; claimId: string; rewardId: string; cargoIds: string[] };
export type TutorialOperation =
  | { type: "tutorial-read"; storyId: string; step: number; choice: "continue" | "A" | "B" | "C" }
  | { type: "tutorial-retry"; attempt: number; scope: "encounter" | "chapter" }
  | { type: "tutorial-hints"; enabled: boolean }
  | { type: "tutorial-guide"; planId: string; attempt: number; mode: "free" }
  | { type: "tutorial-observe"; planId: string; attempt: number; stepId: string; basis: string };

export const TUTORIAL_LESSONS: TutorialLesson[] = ["roll", "fix", "action", "end-turn", "reroll", "guard", "heal", "item", "hand", "covenant"];
