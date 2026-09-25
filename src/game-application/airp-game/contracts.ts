import type { D5Departure } from "../../game-core/session";
import type { HeadRef } from "../contracts";
import type { ExpeditionGMLedger, ExpeditionDocument } from "../airp-expedition-gm/contracts";
import type { NodeLedger } from "../airp-expedition-play/contracts";
import type { LowMaterial } from "../airp-low/contracts";
import type { SettlementLedger } from "../airp-settlement/contracts";
import type { SettlementShare } from "../airp-settlement/share";
import type { GMShare } from "./gm-share-contracts";
export type { GMShare } from "./gm-share-contracts";

/** An extension of the ONE D5 save, not a nested gameplay copy or separate database. */
export type AirpGameState = {
  version: 1; worldHead: HeadRef; material: LowMaterial;
  preparation: { appraisalPlanVersion?: 1; commissionRewardVersion?: 1; departure: D5Departure; intent: string; documents: ExpeditionDocument[] } | null;
  gm: ExpeditionGMLedger; nodes: Record<string, NodeLedger>; settlement: SettlementLedger;
};
/** Compact proof: the original responses/frames live once in the owning state, not per fact. */
export type AirpGameProof = { version: 1; kind: "prepare" | "gm" | "node" | "settlement"; world: boolean; stateHash: string; settlement?: SettlementShare; gmShare?: GMShare };
