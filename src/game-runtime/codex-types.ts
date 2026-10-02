import type { HeadRef } from "../game-application";
export type CodexStage = "unknown" | "seen" | "defeated";
export type CodexSource = HeadRef & { factId: string; definitionId: string; encounterId: string;
  contentVersion: number; worldTime: { day: number; phase: "dawn" | "day" | "dusk" | "night" }; location: string };
export type CodexEntryData = {
  id: string; number: string; stage: CodexStage;
  name: string; englishName: string; family: string; description: string;
  tags: readonly string[]; facts: readonly { label: string; value: string }[];
  note?: { text: string; source: string };
  dropIds: readonly string[]; dropsStatus: "locked" | "recorded" | "unavailable" | "none";
  firstEncounter?: CodexSource; firstDefeat?: CodexSource;
};
export type CodexData = { status: "ready"; entries: readonly CodexEntryData[]; encountered: number; defeated: number }
  | { status: "unavailable"; message: string };
