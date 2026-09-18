import { AIRP_API, airpHash, type AirpInteractionReceipt, type AirpRpBinding, type AirpSceneRequest, type AirpSceneText } from "../airp/contracts";
import { prepareAirpScene } from "../airp/acceptance";

export function airpOnlineFixture() {
  const digest = "a".repeat(64);
  const binding: AirpRpBinding = {
    applicationId: "app-airp", releaseId: "release-airp-1", sessionId: "session-airp", threadId: "session-airp",
    branchId: "branch-airp", contractVersionId: "contract-airp-v1", writingPipelineVersionId: "pipeline-writing-v1", head: null,
  };
  const request: AirpSceneRequest = {
    version: AIRP_API.request, requestId: "request.return.1", mode: "play",
    source: { head: { saveId: "save.demo", epoch: "epoch.demo", revision: 18 }, content: { id: "abyssa.demo", version: 10, digest } },
    eventId: "instance.medicine-case.1", definitionId: "ripple.elora.old-medicine-case", task: "return",
    phase: 12, locationId: "mansion.common-room", actorIds: ["elora"], stance: "seasoned", outcome: "cleared",
    facts: [{ id: "fact.case-returned", phase: 12, summary: "从本次巡路带回了旧药箱。", knownBy: ["kael", "elora"] }],
    requiredFactIds: ["fact.case-returned"],
  };
  const ticket = prepareAirpScene(binding, request);
  const text: AirpSceneText = {
    creationRecord: "事实：药箱已带回。人物反应：先检查搭扣，再回应同行者。避免替主角发言。",
    lines: [
      { speaker: "narrator", emotion: "neutral", text: "药箱被放在桌边。" },
      { speaker: "elora", emotion: "wry", text: "搭扣还在。下次别拿它试石头的硬度。" },
    ],
  };
  const resultContent = {
    version: "pipeline-run-result-v1", pipelineArtifactVersionId: binding.writingPipelineVersionId,
    providerText: JSON.stringify(text), outputText: JSON.stringify(text), finishReason: "stop",
    usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
  };
  const resultHash = airpHash(resultContent);
  const nativeResult = { ...resultContent, id: "result-final", runId: "run-final", contentHash: resultHash, createdAt: 100 };
  const receipt: AirpInteractionReceipt = {
    version: "interaction-command-accepted-v1", replayed: false, floorId: "floor-7", floorRevision: 4,
    checkpointSnapshotId: "checkpoint-7", checkpointContentHash: "b".repeat(64),
  };
  const ref = (entryId: string, payloadHash: string) => ({ entryId, payloadHash, path: [] });
  const input = { id: "input-7", schemaId: AIRP_API.request, schemaVersion: 1, payload: request, payloadHash: ticket.requestHash, payloadAvailability: "available", source: { kind: "client-event" } };
  const output = { id: "output-7", schemaId: AIRP_API.output, schemaVersion: 1, payload: resultContent.outputText, payloadHash: airpHash(resultContent.outputText), payloadAvailability: "available", source: { kind: "pipeline-result", runId: nativeResult.runId, resultId: nativeResult.id } };
  const floor = {
    version: "floor-checkpoint-dto-v2", id: receipt.floorId, branchId: binding.branchId, revision: receipt.floorRevision, lifecycle: "committed",
    checkpoint: {
      availability: "persisted", incompleteReasons: [] as string[],
      snapshot: {
        version: "floor-checkpoint-snapshot-v5", id: receipt.checkpointSnapshotId, contentHash: receipt.checkpointContentHash,
        floorId: receipt.floorId, floorRevision: receipt.floorRevision,
        terminal: true, restorable: true, stateContinuable: true, incompleteReasons: [] as string[],
        contract: { artifactVersionId: binding.contractVersionId, contentHash: digest }, parent: null as null | { floorId: string; checkpointContentHash: string },
        inputs: [ref(input.id, input.payloadHash)], outputs: [ref(output.id, output.payloadHash)],
      },
    },
    sections: [{ entries: [input, output], executions: [{ runId: nativeResult.runId, floorId: receipt.floorId, childBranchId: binding.branchId, pipelineArtifactVersionId: binding.writingPipelineVersionId, status: "completed", result: { status: "available", id: nativeResult.id, contentHash: resultHash } }] }],
  };
  const page = {
    version: "thread-timeline-v6", thread: { id: binding.threadId, ownerSessionId: binding.sessionId, kind: "root" },
    context: { threadId: binding.threadId, context: { version: "application-runtime-v6", application: { id: binding.applicationId, releaseId: binding.releaseId } } },
    timeline: { threadId: binding.threadId, branchId: binding.branchId, floors: [floor], nextCursor: null as number | null },
  };
  const current = { head: { ...request.source.head }, contentDigest: digest, eventId: request.eventId, eligible: true };
  return { binding, request, ticket, text, receipt, nativeResult, page, floor, current };
}
