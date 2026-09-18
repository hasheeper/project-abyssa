import type { AirpHead, AirpInstance, AirpKnowledgeEntry, AirpSceneRole, AirpSortieDefinition } from "./airp";

/** Data-only AVG. Published handwritten readers still accept only their original three emotions. */
export type AirpFrameEmotion = "neutral" | "smile" | "joy" | "sad" | "angry" | "surprised" | "serious" | "closed" | "wry" | "flustered" | "displeased" | "confident" | "confused" | "panicked";
export type AirpFrame = { id: string; text: string } & (
  | { kind: "narration" }
  | { kind: "dialogue"; actorId: string; emotion: AirpFrameEmotion }
);
type Node = { id: string; cursor: number; sectionId: string };
export type AirpScriptNode = Node & (
  | { kind: "beat"; frames: AirpFrame[] }
  | { kind: "choice"; prompt: string; options: { id: "A" | "B" | "C"; label: string }[] }
  | { kind: "branch"; choiceId: string; variants: Record<"A" | "B" | "C", AirpFrame[]> }
);
export type AirpScript = {
  schemaVersion: 1; id: string; title: string; locale: "zh-CN";
  presentation: { stagePreset: string; backgroundId: string; defaultMode: "adv"; allowRp: false; initialSlots: { left: string } };
  player: { actorId: "kael"; nameToken: "{{user}}"; authoredSpeech: false };
  cast: string[]; sections: { id: string; title: string }[]; nodes: AirpScriptNode[];
};
export type AirpContent = {
  version: 1; definition: AirpSortieDefinition; scripts: Record<string, AirpScript>;
  /** First slice: Elora is reachable in the mansion common room at all four phases. */
  locationId: "mansion.common-room"; phases: ["dawn", "day", "dusk", "night"];
};
export type AirpFrozenScene = {
  id: string; instanceId: string; role: AirpSceneRole; templateId: string; templateVersion: 1;
  contentDigest: string; sourceHead: AirpHead; phase: number; source: "handwritten" | "rp";
  body: AirpScript; bodyHash: string;
};
export type AirpReading = { sceneId: string; node: number; choice: "A" | "B" | "C" | null; completed: boolean; paused: boolean };
export type AirpLiveState = {
  version: 1; instance: AirpInstance | null; scenes: AirpFrozenScene[];
  reading: AirpReading | null; carryFactId: string | null;
  memories: AirpKnowledgeEntry[];
  cooldowns: { themeKey: string; sourceFactId: string; fromPhase: number; untilPhase: number }[];
  lastBoundaryId: string | null;
};
