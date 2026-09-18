/** Versioned data, not executable scripts or a second combat engine. */
export type TutorialGuideTarget = { kind: "member"; id: string } | { kind: "enemy"; definitionId: string; ordinal: number };
export type TutorialGuideInput =
  | { kind: "roll" | "reroll" | "end-turn" | "automatic" }
  | { kind: "fix"; actorId: string }
  | { kind: "act"; actorId: string; choice: "attack" | "guard" | "heal"; target: TutorialGuideTarget }
  | { kind: "story"; storyId: string }
  | { kind: "advance" }
  | { kind: "item"; definitionId: string; actorId: string }
  | { kind: "event"; actorId: string }
  | { kind: "observe-result" };
export type TutorialGuideEvidence = { type: string; actorId?: string; payload?: Record<string, string | number | boolean | null> };
export type TutorialGuideStep = {
  id: string; roomId: string; round: number | null; instructionId: string;
  input: TutorialGuideInput; evidence: TutorialGuideEvidence[];
};
export type TutorialGuideDefinition = {
  version: 1; id: string; continuationSeed: number;
  /** v12+ independently authors the event draw; battle RNG remains unchanged. */
  eventSeed?: number;
  nodes: { roomId: string; battle: number | null; storyAfter: string | null }[];
  steps: TutorialGuideStep[];
};
