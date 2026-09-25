import type { ExpeditionPlanInput, ExpeditionPlanProposal, ExpeditionSlot, ExpeditionCommission, SettlementScope } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";

/** Public committed handoff. No RNG, model material or pending numerical effects. */
export type GMShare = {
  memoryCorrections?: import("../airp-memory/contracts").MemoryCorrection[];
  version: 1; sourceHead: HeadRef;
  plans: {
    jobId: string; frameIndex: number; frameVersion: 1; frameHead: HeadRef; promptVersion: string;
    /** Ledger binding status; actual departure may precede recordStarted and remains proved by journey facts. */
    inputHash: string; proposalHash: string; status: "accepted" | "started"; acceptedAt: HeadRef; startFactId: string | null;
    departure: ExpeditionPlanInput["departure"]; proposal: ExpeditionPlanProposal;
    slots: ExpeditionSlot[]; commissions: ExpeditionCommission[];
  }[];
  reads: { sourceId: string; sceneId: string; runId: string; text: string; knownBy: string[]; head: HeadRef }[];
  pendingSettlements: { jobId: string; frameIndex: number; scope: SettlementScope; status: "pending" | "running" | "ready" | "failed" | "stale" }[];
};
