import type { AirpHead } from "./airp";
import type { DirectorDayBudget, DirectorTheme } from "./airp-director";
import type { AppraisalCopy, AppraisalSlot } from "./expedition-appraisal";

/** Independent pre-departure protocol. Not a Catalog/save schema upgrade. */
export const EXPEDITION_GM_PROTOCOL = 1 as const;
export const EXPEDITION_GM_CAPACITY = { inputBytes: 2 * 1024 * 1024, outputBytes: 256 * 1024, nodes: 8, events: 2, definitions: 4 } as const;
export type ExpeditionSlot = {
  id: string; layer: number; roomIndex: number; roomDefinitionId: string;
  timing: "arrive" | "cleared" | "exit"; actorIds: string[]; actionIds: string[]; objectiveIds: string[];
};
export type ExpeditionCommission = {
  itemTemplateId?: string;
  eventId: string; stepId: string; definitionId: string; title: string;
  objectiveId: string; slotId: string; actorIds: string[]; basisIds: string[]; returnRequired: true;
};
export type ExpeditionEventBody = {
  title: string; themeKey: string; themeDescription: string; objectIds: string[]; actorIds: string[];
  load: "focus" | "light"; needsReturn: boolean; repeat: "once" | "after-cooldown";
};
export type ExpeditionReservation = {
  id: string; ownerId: string; day: number; load: "focus" | "light";
  themeKey: string; themeDescription: string; objectIds: string[];
};
export type ExpeditionSharedSchedule = {
  budget: DirectorDayBudget; reservations: ExpeditionReservation[]; themes: DirectorTheme[];
  existing: { id: string; load: "focus" | "light"; status: "offered" | "accepted" | "ready" }[];
  requiredStoryIds: string[]; busyFocus: boolean; uniqueCompletedIds: string[];
};
/** Asset module supplies declarations; no prices, RNG or inventory writer is defined here. */
export type ExpeditionItemTemplate = {
  id: string; digest: string; maxPerRun: number;
  fields: { key: string; label: string; maxLength: number; values: string[] | null }[];
};
export type ExpeditionPlanInput = {
  appraisalPlanVersion?: 1;
  appraisalSlots?: AppraisalSlot[];
  commissionRewardVersion?: 1;
  protocol: 1; head: AirpHead; phase: number;
  departure: { runId: string; routeId: string; partyIds: string[]; itemIds: string[]; commandHash: string; intent: string };
  capabilityId: string; slots: ExpeditionSlot[]; sourceIds: string[]; commissions: ExpeditionCommission[];
  schedule: ExpeditionSharedSchedule;
  fixedEvents: { id: string; body: ExpeditionEventBody; digest: string; sourceId: string }[];
  itemTemplates: ExpeditionItemTemplate[];
  limits: { nodes: number; events: number; definitions: number };
};
export type ExpeditionNodeLink = null
  | { kind: "commission"; eventId: string; stepId: string; role: "objective" | "feedback" }
  | { kind: "new-event"; eventKey: string; step: "offer" | "action" | "feedback" | "result" | "scene" };
export type ExpeditionPlanNode = {
  id: string; slotId: string; intent: string; actorIds: string[]; basisIds: string[]; actionIds: string[];
  prerequisites: { nodeId: string; outcome: "completed" | "skipped" }[];
  link: ExpeditionNodeLink; stop: "choice" | "program" | "scene-end"; itemKeys: string[];
};
export const EXPEDITION_ENDINGS = ["completed", "partial", "retreated", "failed", "unseen"] as const;
export type ExpeditionPlanProposal = {
  appraisalItems?: AppraisalCopy[];
  protocol: 1; taskId: string; inputHash: string;
  focus: { kind: "commission" | "exploration" | "new-event"; id: string | null; intent: string; basisIds: string[] };
  nodes: ExpeditionPlanNode[];
  events: { key: string; basisIds: string[]; source: { kind: "fixed"; definitionId: string } | { kind: "free"; body: ExpeditionEventBody } }[];
  itemDefinitions: { key: string; templateId: string; fields: Record<string, string> }[];
  endings: { outcome: typeof EXPEDITION_ENDINGS[number]; intent: string; basisIds: string[]; returnEventIds: string[] }[];
};
export type ExpeditionThemeReview = {
  protocol: 1; proposalHash: string;
  decisions: { eventKey: string; verdict: "new" | "same" | "uncertain"; matchedSourceIds: string[]; reason: string }[];
};
export type FrozenExpeditionItem = { id: string; key: string; templateId: string; templateDigest: string; fields: Record<string, string>; digest: string };
export type AcceptedExpeditionPlan = {
  id: string; inputHash: string; proposalHash: string; proposal: ExpeditionPlanProposal;
  events: { id: string; key: string; definitionId: string; body: ExpeditionEventBody; basisIds: string[] }[];
  reservations: ExpeditionReservation[]; itemDefinitions: FrozenExpeditionItem[]; review: ExpeditionThemeReview | null;
};
