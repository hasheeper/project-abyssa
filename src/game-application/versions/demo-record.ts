import type { DemoCatalogRef } from "../../game-core/contracts";
import type { DemoSnapshot } from "../../game-core/session";
import type { JsonValue } from "../../game-core/battle";
import type { HeadRef, GameCommit } from "../contracts";

export type DemoFact = {
  version: 2 | 3;
  id: string;
  source: HeadRef;
  originRef: HeadRef | null;
  origin: "adventure" | "simulation";
  runRef: { kind: "expedition"; id: string } | null;
  encounterId: string | null;
  worldTime: DemoSnapshot["campaign"]["clock"];
  kind: string;
  actorId: string | null;
  payload: JsonValue;
  visibility: "party" | "internal";
};
export type DemoGameRecord = {
  schemaVersion: 2 | 3;
  head: HeadRef;
  contentRef: DemoCatalogRef;
  profileId: string;
  snapshot: DemoSnapshot;
  commits: GameCommit[];
  facts: DemoFact[];
  retractedFactIds: string[];
  undoAnchors: HeadRef[];
  originRef: HeadRef | null;
};
