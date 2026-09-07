import type { D5JourneyEvidence, D5JourneyFactPayload } from "./d5-journey-evidence";
import type { D5CatalogRef } from "../../game-core/contracts";
import type { D5ProgressEntry, D5ProgressEvent, D5RunRef, D5Snapshot } from "../../game-core/session";
import type { DemoBattleCommand } from "../../game-core/battle";
import type { DemoItemTarget } from "../../game-core/session";
import type { CommandReceipt, GameCommit, GameStorePort, HeadRef } from "../contracts";
import type { DemoCommand } from "./demo-command";
import type { D5CombatEvidence, D5CombatFactPayload } from "./d5-combat-evidence";

export type D5Fact = {
  version: 4;
  id: string;
  source: HeadRef;
  origin: "present" | "memory" | "adventure";
  runRef: D5RunRef | null;
  /** New facts belong to the local save; origin evidence lives on the record. */
  originRef: null;
  worldTime: D5Snapshot["campaign"]["clock"];
  visibility: "party";
} & ({ kind: "save-created"; payload: { profileId: string } } | { kind: "progression"; payload: D5ProgressEvent } | { kind: "combat"; payload: D5CombatFactPayload } | { kind: "journey"; payload: D5JourneyFactPayload });
export type D5GameRecord = {
  schemaVersion: 4;
  head: HeadRef;
  contentRef: D5CatalogRef;
  profileId: string;
  snapshot: D5Snapshot;
  commits: GameCommit[];
  facts: D5Fact[];
  /** Committed progression grants are irrevocable; combat retractions are introduced with C. */
  retractedFactIds: string[];
  undoAnchors: [];
  originRef: null | {kind: "copy" | "upgrade" | "cycle"; source: D5GameRecord | import("./demo-record").DemoGameRecord};
};
export type D5Receipt = Omit<CommandReceipt, "version" | "contentRef" | "events"> & {
  version: 4;
  contentRef: D5CatalogRef;
  events: D5ProgressEntry[];
  combat?: D5CombatEvidence;
  journey?: D5JourneyEvidence;
};
export type D5Command =
  | { type: "purchase-supply"; shopId: string; definitionId: string; quantity: number; quoteVersion: number }
  | { type: "inherit-memory"; chapterId: string }
  | Exclude<DemoCommand, { type: "battle-command" | "undo" | "resume-run" | "use-item" }>
  | { type: "battle-command"; runRef: D5RunRef; command: DemoBattleCommand }
  | { type: "undo" | "resume-run"; runRef: D5RunRef }
  | { type: "use-item"; runRef: D5RunRef; instanceId: string; target: DemoItemTarget }
  | { type: "begin-memory"; chapterId: string }
  | { type: "advance-memory"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "history-opening" | "teaching" | "battle" | "return-pending"; choice: "continue" | "skip" }
  | { type: "read-memory"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "present-intro" | "history-opening" | "teaching" | "history-complete"; step: number }
  | { type: "retry-memory" | "leave-memory"; runRef: Extract<D5RunRef, { kind: "memory" }> }
  | { type: "begin-story"; eventId: string; basisId: string }
  | { type: "advance-story"; sessionId: string; step: number; choice: "continue" | "skip" | "later" }
  | { type: "complete-story"; sessionId: string }
  | { type: "equip-equipment"; instanceId: string; ownerId: string }
  | { type: "unequip-equipment"; instanceId: string; ownerId: string }
  | { type: "transfer-equipment"; instanceId: string; fromOwnerId: string; toOwnerId: string };
export type D5Request = { protocolVersion: 4; saveId: string; expectedHead: HeadRef; clientRequestId: string; command: D5Command };
export type D5Store = GameStorePort<D5GameRecord, D5Receipt>;
