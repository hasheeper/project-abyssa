import type { D5GameRecord, D5Receipt } from "./d5-contracts";
import type { DemoCatalogRef } from "../../game-core/contracts";
import type { DemoCommand } from "./demo-command";
export type { DemoCommand } from "./demo-command";
import type {
  DemoEvent,
} from "../../game-core/battle";
import type {
  HeadRef,
  CommandReceipt,
  GameRecord,
  GameStorePort,
} from "../contracts";

export type {DemoFact, DemoGameRecord} from "./demo-record";
import type {DemoGameRecord} from "./demo-record";
export type DemoReceipt = Omit<
  CommandReceipt,
  "version" | "contentRef" | "events"
> & { version: 2 | 3; contentRef: DemoCatalogRef; events: DemoEvent[] };
export type DemoRequest = {
  protocolVersion: 2 | 3;
  saveId: string;
  clientRequestId: string;
  expectedHead: HeadRef;
  command: DemoCommand;
};
export type AnyGameRecord = GameRecord | DemoGameRecord | D5GameRecord;
export type AnyReceipt = CommandReceipt | DemoReceipt | D5Receipt;
export type VersionedGameStore = GameStorePort<AnyGameRecord, AnyReceipt>;
