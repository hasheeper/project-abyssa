import type { SettlementBatch, SettlementCommitGate, SettlementInput, SettlementPoint, SettlementProposal, SettlementReceipt } from "../../contracts/airp-settlement";
import { sha256 } from "../../contracts/sha256";
import { settlementTaskIdentity } from "../airp-settlement";

/** Isolated mechanics fixture only. Not approved balancing, character canon or an inventory adapter. */
export function settlementFixture(): SettlementInput {
  const head = { saveId: "cl-a-fixture", epoch: "epoch:1", revision: 10 };
  return {
    state: { protocol: 1, policyId: "fixture-only:1", head, phase: 8, affinity: [], actors: [
      { actorId: "npc-a", locationId: "hall", activity: null, conditions: [] },
      { actorId: "npc-b", locationId: "garden", activity: null, conditions: [] },
    ] },
    policy: {
      id: "fixture-only:1", actorIds: ["npc-a", "npc-b"], observerIds: ["player", "npc-a", "npc-b"], locationIds: ["hall", "garden"], endConditionIds: ["returned"],
      affinity: { initial: 0, min: -10, max: 10, eventAbsLimit: 5, grades: [{ id: "none", delta: 0 }, { id: "up", delta: 2 }, { id: "down", delta: -2 }, { id: "large", delta: 5 }] },
      activities: [{ id: "resting", busy: true, maxPhases: 4 }], conditions: [{ id: "tired", maxPhases: 8 }],
    },
    scope: { kind: "event", boundaryId: "event:closed", eventId: "event:1", actionId: null, runId: "run:1" },
    evidence: [
      { id: "fact:choice", head, phase: 8, eventId: "event:1", actionId: null, runId: "run:1", role: "current", authority: "fact", speakerId: null, knownBy: ["player", "npc-a"], kind: "program-fact", factId: "choice:actual" },
      { id: "read:1", head, phase: 8, eventId: "event:1", actionId: null, runId: "run:1", role: "current", authority: "fact", speakerId: null, knownBy: ["player", "npc-a"], kind: "read-paragraph", archive: { sceneId: "scene:read", paragraphId: "paragraph:1", digest: sha256("完整已读原文仍在原档案，此处仅绑定内容摘要指纹。") }, readAtRevision: 10 },
    ],
    grants: [
      { id: "grant:affinity", kind: "affinity", actorId: "npc-a", eventId: "event:1", accountId: "event" },
      { id: "grant:item", kind: "item", operation: { adapterId: "fixture-asset-adapter", operationId: "acquire:1", operationHash: sha256("frozen external asset operation") } },
      { id: "grant:actor", kind: "actor", actorId: "npc-a", changeId: "actual-transition:1", fields: ["location", "activity", "conditions"] },
    ],
    fullActorCards: [{ actorId: "npc-a", digest: sha256("fixture complete card, not a summary") }], openThreads: [], priorReceipts: [], actorLocks: [],
  };
}
export function settlementPoint(): SettlementPoint {
  return { kind: "fact", text: "记录本次已发生的行动和实际结果。", speakerId: null, knownBy: ["player", "npc-a"], basisIds: ["fact:choice"] };
}
export function settlementProposal(input: SettlementInput): SettlementProposal {
  return { protocol: 1, ...settlementTaskIdentity(input), affinity: [], items: [], actors: [], memory: { points: [], open: [], close: [], priorReceiptIds: [] } };
}
export function settlementGate(input: SettlementInput): SettlementCommitGate {
  return { head: { ...input.state.head }, receipts: input.priorReceipts, appliedItemOperations: [] };
}
/** Simulates a SUCCESSFUL transaction only inside tests. Production CL-B writer does not exist yet. */
export function fixtureReceipt(batch: SettlementBatch): SettlementReceipt {
  return { id: `receipt:${batch.taskId.split(":")[1]}`, taskId: batch.taskId, inputHash: batch.inputHash, committedHead: { ...batch.expectedHead, revision: batch.expectedHead.revision + 1 }, effects: batch.effects, memoryId: batch.memory.id };
}
