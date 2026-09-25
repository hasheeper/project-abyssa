import type { SettlementMemory, SettlementState } from "../../game-core/contracts";
import { parseSettlementProposal } from "../../game-core/contracts";
import type { SettlementLedger } from "./contracts";

/** Replayable boundary handoff: short state/memory plus current read originals, never cards/model requests. */
export type SettlementShare = {
  taskId: string; assessment: "model" | "mechanical" | "program-only";
  state: SettlementState;
  locationActorIds: string[];
  memory: Pick<SettlementMemory, "id" | "phase" | "scope" | "points" | "opened" | "closed">;
  read: { sceneId: string; text: string; knownBy: string[]; sourceId: string }[];
};
export function shareSettlement(ledger: SettlementLedger, taskId: string): SettlementShare {
  const job = ledger.jobs.find(j => j.id === taskId && j.status === "applied"), receipt = ledger.receipts.find(r => r.taskId === taskId);
  if (!job || !receipt || !job.prepared) throw Error("Only committed settlements can be shared");
  const state = structuredClone(job.frames.at(-1)!.input.state);
  for (const e of receipt.effects) {
    if (e.kind === "actor") state.actors = [...state.actors.filter(a => a.actorId !== e.actorId), structuredClone(e.after)];
    if (e.kind === "affinity") state.affinity = [...state.affinity.filter(a => a.actorId !== e.actorId), { actorId: e.actorId, value: e.after }];
  }
  state.head = structuredClone(receipt.committedHead);
  const { id, phase, scope, points, opened, closed } = job.prepared.memory;
  const frame = job.frames.at(-1)!;
  const accepted = job.revalidatedAttemptId ? job.attempts.find(a => a.id === job.revalidatedAttemptId) : job.attempts.filter(a => a.frame === job.frames.length - 1 && a.status === "succeeded").at(-1);
  const locationActorIds = job.mode === "model" && accepted?.output ? parseSettlementProposal(JSON.parse(accepted.output)).actors.filter(a => a.locationId !== undefined).flatMap(a => {
    const grant = frame.input.grants.find(g => g.id === a.grantId); return grant?.kind === "actor" ? [grant.actorId] : [];
  }) : [];
  const read = frame.input.evidence.filter(e => e.kind === "read-paragraph" && e.role === "current").map(e => ({ sceneId: e.kind === "read-paragraph" ? e.archive.sceneId : "", text: frame.materials.evidence.find(s => s.sourceId === e.id)!.text, knownBy: e.knownBy, sourceId: e.id }));
  return structuredClone({ taskId, assessment: job.mode, state, locationActorIds, memory: { id, phase, scope, points, opened, closed }, read });
}
