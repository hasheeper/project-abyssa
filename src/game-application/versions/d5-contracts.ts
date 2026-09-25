import type { D5JourneyEvidence, D5JourneyFactPayload } from "./d5-journey-evidence";
import type { D5CatalogRef } from "../../game-core/contracts";
import type { D5ProgressEntry, D5ProgressEvent, D5RunRef, D5Snapshot, D5StoryAdvanceChoice, D5UserChoiceTone } from "../../game-core/session";
import type { DemoBattleCommand } from "../../game-core/battle";
import type { DemoItemTarget } from "../../game-core/session";
import type { CommandReceipt, GameCommit, GameStorePort, HeadRef } from "../contracts";
import type { DemoCommand } from "./demo-command";
import type { D5CombatEvidence, D5CombatFactPayload } from "./d5-combat-evidence";
import type { TutorialOperation } from "../../game-core/session";
import type { AirpNarrativeState, AirpPoolCommand, AirpIntent } from "../../game-core/contracts";
import type { AirpOnlineCommand, AirpOnlineIntent, AirpOnlineState } from "../airp/gameplay-contracts";
import type { AirpDirectCommand, AirpDirectIntent, AirpDirectState } from "../airp-direct-gameplay/contracts";
import type { DirectorCommand, DirectorIntent, DirectorState } from "../airp-director/contracts";
import type { AirpGameProof, AirpGameState } from "../airp-game/contracts";

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
} & ({ kind: "save-created"; payload: { profileId: string } } | { kind: "progression"; payload: D5ProgressEvent } | { kind: "combat"; payload: D5CombatFactPayload } | { kind: "journey"; payload: D5JourneyFactPayload } | { kind: "airp"; payload: AirpIntent } | { kind: "airp-online"; payload: AirpOnlineIntent } | {kind: "airp-direct"; payload: AirpDirectIntent} | {kind: "airp-director"; payload: DirectorIntent} | {kind: "airp-game"; payload: AirpGameProof});
export type D5GameRecord = {
  schemaVersion: 4;
  /** Required in content8, forbidden in earlier content; reconstructed from committed evidence. */
  narrative?: AirpNarrativeState;
  /** Content10 only; replayed connection, source selection and durable online intents. */
  airpOnline?: AirpOnlineState;
  /** Content18 only; independent, replayed browser-direct tasks and read memories. */
  airpDirect?: AirpDirectState;
  airpDirector?: DirectorState;
  /** Required (initially null) only in opt-in content22. */
  airpGame?: AirpGameState | null;
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
  airp?: AirpIntent;
  airpOnline?: AirpOnlineIntent;
  airpDirect?: AirpDirectIntent;
  airpDirector?: DirectorIntent;
  airpGame?: AirpGameProof;
  archiveOperation?: "restore";
};
export type D5Command =
  | import("../../game-core/contracts").ShopVisitCommand
  | import("../../game-core/contracts").FacilityCommand
  | {type: "start-expedition"; runId: string; routeId: string; partyIds: string[]; itemIds?: string[]; supplyQuantities?: Record<string, number>; seed: number}
  | { type: "advance-phase" }
  | { type: "select-game-start"; startAt: import("../../game-core/session").GameStartPoint; playerName?: string }
  | AirpPoolCommand
  | AirpOnlineCommand
  | AirpDirectCommand
  | DirectorCommand
  | (TutorialOperation & { runRef: Extract<D5RunRef, { kind: "expedition" }> })
  | {type:"advance-opening";step:number;choice:"continue"|"A"|"B"|"C"}
  | {type: "advance-shop-introduction"; shopId: string; step: number; choice: "continue" | "skip"}
  | { type: "advance-prologue"; shotId: string }
  | { type: "complete-prologue"; shotId: string; choice: "continue" | "skip" }
  | { type: "sell-loot"; shopId: string; instanceId: string; quoteVersion: number; quantity?: number }
  | { type: "appraise-loot"; shopId: string; instanceId: string; quoteVersion: number }
  | ({ type: "purchase-product" } & import("../../game-core/contracts").ProductPurchase)
  | { type: "purchase-supply"; shopId: string; definitionId: string; quantity: number; quoteVersion: number }
  | { type: "inherit-memory"; chapterId: string }
  | Exclude<DemoCommand, { type: "battle-command" | "undo" | "resume-run" | "use-item" | "start-expedition" }>
  | { type: "battle-command"; runRef: D5RunRef; command: DemoBattleCommand }
  | { type: "undo" | "resume-run"; runRef: D5RunRef }
  | { type: "use-item"; runRef: D5RunRef; instanceId: string; target: DemoItemTarget }
  | { type: "begin-memory"; chapterId: string }
  | { type: "advance-memory"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "history-opening" | "teaching" | "battle" | "return-pending"; choice: "continue" | "skip" }
  | { type: "read-memory"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "present-intro" | "history-opening" | "teaching" | "history-complete"; step: number; choice?: D5UserChoiceTone }
  | { type: "retry-memory" | "leave-memory"; runRef: Extract<D5RunRef, { kind: "memory" }> }
  | { type: "begin-story"; eventId: string; basisId: string }
  | { type: "advance-story"; sessionId: string; step: number; choice: D5StoryAdvanceChoice }
  | { type: "complete-story"; sessionId: string }
  | { type: "equip-equipment"; instanceId: string; ownerId: string; targetFaceId?: string }
  | { type: "unequip-equipment"; instanceId: string; ownerId: string }
  | { type: "transfer-equipment"; instanceId: string; fromOwnerId: string; toOwnerId: string; targetFaceId?: string };
export type D5Request = { protocolVersion: 4; saveId: string; expectedHead: HeadRef; clientRequestId: string; command: D5Command };
export type D5Store = GameStorePort<D5GameRecord, D5Receipt>;
