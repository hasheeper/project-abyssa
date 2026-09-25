import type { DemoCatalog, DemoCatalogRef, DemoProgress, ValidatedDemoCatalog } from "./demo";
import type { TutorialDefinitions } from "./tutorial";
import type { AirpContent, AirpScript } from "./airp-live";
import type { AirpPoolContent } from "./airp-pool";

/** Versioned identity, access and presentation for additional ordinary routes. */
export type OrdinaryExpeditionDefinition = {
  id: string; nodeId: string; name: string; englishName: string;
  skin: "timber" | "hero-party";
  unlock: "after-tutorial"; ending: "plain"; grantsGrowth: false;
  brief: {flavor: string; threats: string[]};
};

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
  contentVersion: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28;
  facilities?: import("./facilities").FacilityContent;
  shop?: import("./shop").ShopContent;
  expeditions?: Record<string, OrdinaryExpeditionDefinition>;
  airpDirector?: import("./airp-director").DirectorContent;
  shopIntroduction?: {id: "story.shop.first-visit"; shopId: "shop.mansion"; lastStep: number};
  tutorialSkipReward?: import("./start-reward").StartRewardContent;
  loot?: import("./loot").LootContent;
  airp?: AirpContent | AirpPoolContent;
  airpOnline?: { version: 1; definitionId: string; followup: AirpScript };
  airpDirect?: {version: 1; definitionId: "ripple.elora.old-medicine-case"; demoStart: {id: "start.airp.patrol"; routeId: string}; followup: AirpScript};
  tutorial?: TutorialDefinitions;
  progression: D5Definitions;
  combat: D5CombatDefinitions;
  economy?: { shopId: "shop.mansion"; quoteVersion: 1 | 2; unit?: "copper-lira"; freeItemIds: string[]; prices: Record<string, number> };
  opening?: {id: "opening.first-morning"; lastStep: number; choiceSteps: number[]; choiceOptions?: Record<string, ("A"|"B"|"C")[]>};
  prologue?: { id: "prologue.first-morning"; shotIds: string[] };
};
export type D5CombatDefinitions = {
  mariettaCovenant: { id: "covenant.marietta"; pattern: "broad-full-house"; budgets: [1, 2] };
  memory: { routeId: "memory.marietta"; roomId: "room.memory.marietta"; encounterId: D5Definitions["chapter"]["encounterId"]; bossId: D5Definitions["chapter"]["bossId"]; puppetId: "enemy.memory.ceremonial-puppet"; reorderBudget: 2; judgmentPower: 3 };
};
export type D5CatalogRef = Omit<DemoCatalogRef, "rulesVersion" | "contentVersion"> & {
  rulesVersion: 4;
  contentVersion: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28;
};
export type ValidatedD5Catalog = {
  readonly data: D5Catalog;
  readonly ref: D5CatalogRef;
  /** Structural reader for unchanged manor definitions/terminals, never a v4 combat dispatcher. */
  readonly shared: ValidatedDemoCatalog;
};
