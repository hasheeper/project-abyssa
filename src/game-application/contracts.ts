import type { CatalogRef, ValidatedCatalog } from "../game-core/contracts";
import type { BattleEvent, JsonValue } from "../game-core/battle";
import type { GameSnapshot, CampaignState } from "../game-core/session";

export type HeadRef = { saveId: string; epoch: string; revision: number };
export type GameFact = {
  version: 1;
  id: string;
  source: HeadRef;
  origin: "adventure" | "imported" | "simulation";
  expeditionId: string | null;
  encounterId: string | null;
  worldTime: CampaignState["clock"];
  kind: string;
  payload: JsonValue;
  visibility:
    | { type: "party"; actorIds: string[] }
    | { type: "player" }
    | { type: "internal" };
  originRef?: HeadRef;
};
export type GameCommit = {
  ref: HeadRef;
  previous: HeadRef | null;
  requestId: string;
  kind: string;
  factIds: string[];
};
export type GameRecord = {
  schemaVersion: 1;
  head: HeadRef;
  contentRef: CatalogRef;
  snapshot: GameSnapshot;
  commits: GameCommit[];
  facts: GameFact[];
  retractedFactIds: string[];
  undoAnchors: HeadRef[];
  pendingSettlement: {
    expeditionId: string;
    terminalRef: HeadRef;
    settlementId: string;
  } | null;
  originRef: HeadRef | null;
};
export type ReceiptError = { code: string; path: string; message: string };
export type CommandReceipt = {
  version: 1;
  saveId: string;
  epoch: string;
  requestId: string;
  fingerprint: string;
  contentRef: CatalogRef | null;
  status: "committed" | "rejected";
  before: HeadRef | null;
  after: HeadRef | null;
  error: ReceiptError | null;
  events: BattleEvent[];
  factIds: string[];
};
/** Storage only compares envelopes. Version-specific readers validate every value after reading. */
export type StoredRecord = {
  schemaVersion: number;
  head: HeadRef;
  contentRef: {
    catalogId: string;
    contentVersion: number;
    rulesVersion: number;
    digest: string;
  };
  commits: unknown[];
};
export type StoredReceipt = Omit<
  CommandReceipt,
  "version" | "contentRef" | "events"
> & {
  version: number;
  contentRef: StoredRecord["contentRef"] | null;
  events: unknown[];
};
export type CommitProposal<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
> = {
  saveId: string;
  epoch: string;
  requestId: string;
  fingerprint: string;
  expectedHead: HeadRef | null;
  candidate: R | null;
  receipt: C;
};
export type CommitResult<C extends StoredReceipt = CommandReceipt> = {
  receipt: C;
  replayed: boolean;
};
export type SaveSummary = {
  head: HeadRef;
  contentRef: CatalogRef;
  activeExpeditionId: string | null;
};
export type SaveListEntry =
  | {
      status: "ready";
      saveId: string;
      summary: SaveSummary;
      clock: CampaignState["clock"];
    }
  | { status: "unavailable"; saveId: string; error: ReceiptError };

/** Stores perform one atomic compare-and-write across snapshot and request receipt. */
export interface GameStorePort<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
> {
  read(saveId: string): Promise<R | null>;
  listSaveIds(): Promise<string[]>;
  receipt(saveId: string, epoch: string, requestId: string): Promise<C | null>;
  commit(proposal: CommitProposal<R, C>): Promise<CommitResult<C>>;
}
export class GameStorageError extends Error {
  constructor(
    public readonly code:
      | "storage-unavailable"
      | "storage-quota"
      | "storage-blocked"
      | "storage-aborted",
    message: string,
  ) {
    super(message);
    this.name = "GameStorageError";
  }
}
export type ApplicationResult =
  | { ok: true; receipt: CommandReceipt; replayed: boolean }
  | { ok: false; error: ReceiptError; receipt?: CommandReceipt };
export type LoadResult =
  { ok: true; record: GameRecord } | { ok: false; error: ReceiptError };
export type ApplicationDependencies = {
  catalog: ValidatedCatalog;
  store: GameStorePort;
};
export type {
  CatalogRef,
  ValidatedCatalog,
  GameSnapshot,
  CampaignState,
  BattleEvent,
  JsonValue,
};
