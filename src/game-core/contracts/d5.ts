import type { DemoCatalog, DemoCatalogRef, DemoProgress, ValidatedDemoCatalog } from "./demo";

/** The D5 package remains unpublished until its combat and application capabilities exist. */
export type D5Definitions = {
  chapter: {
    id: "chapter.marietta.memory";
    templateId: "profile.memory.marietta.v1" | "profile.memory.clockwork.v1";
    encounterId: "encounter.memory.marietta" | "encounter.memory.clockwork";
    bossId: "enemy.memory.marietta" | "enemy.memory.clockwork-beast";
    puppetId: "enemy.memory.ceremonial-puppet";
    storyId: "story.marietta.return";
    rewardId: "reward.marietta.memory";
    unlockId: "unlock.marietta.sortie";
    partyIds: string[];
    progress: DemoProgress;
    bossHp: number;
    puppetHp: number;
    puppetCount: number;
    supplies: { definitionId: string; charges: number }[];
  };
  growthEvents: Record<string, { id: string; growthId: string; lastStep: number }>;
  gift: {
    eventId: "event.demo.preparation-gift";
    rewardId: "reward.demo.preparation-gift";
    definitionIds: string[];
    lastStep: number;
  };
  returnLastStep: number;
  memoryLastSteps: Record<"present-intro" | "history-opening" | "teaching" | "history-complete", number>;
};
export type D5Catalog = Omit<DemoCatalog, "rulesVersion" | "contentVersion"> & {
  rulesVersion: 4;
  contentVersion: 2 | 3 | 4 | 5 | 6;
  progression: D5Definitions;
  combat: D5CombatDefinitions;
  economy?: { shopId: "shop.mansion"; quoteVersion: 1; freeItemIds: string[]; prices: Record<string, number> };
  opening?: {id: "opening.first-morning"; lastStep: number; choiceSteps: number[]; choiceOptions?: Record<string, ("A"|"B"|"C")[]>};
  prologue?: { id: "prologue.first-morning"; shotIds: string[] };
};
export type D5CombatDefinitions = {
  mariettaCovenant: { id: "covenant.marietta"; pattern: "broad-full-house"; budgets: [1, 2] };
  memory: { routeId: "memory.marietta"; roomId: "room.memory.marietta"; encounterId: D5Definitions["chapter"]["encounterId"]; bossId: D5Definitions["chapter"]["bossId"]; puppetId: "enemy.memory.ceremonial-puppet"; reorderBudget: 2; judgmentPower: 3 };
};
export type D5CatalogRef = Omit<DemoCatalogRef, "rulesVersion" | "contentVersion"> & {
  rulesVersion: 4;
  contentVersion: 2 | 3 | 4 | 5 | 6;
};
export type ValidatedD5Catalog = {
  readonly data: D5Catalog;
  readonly ref: D5CatalogRef;
  /** Structural reader for unchanged manor definitions/terminals, never a v4 combat dispatcher. */
  readonly shared: ValidatedDemoCatalog;
};
