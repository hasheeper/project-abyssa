import { acceptAirpScene } from "../airp/acceptance";
import { AIRP_API, airpHash, type AirpInteractionReceipt } from "../airp/contracts";
import { prepareAirpConfirmationTicket, prepareAirpDiscardTicket } from "../airp/control";
import { decodeAirpNativeResult, inspectAirpTimelinePage } from "../airp/rp-wire";
import { airpOnlineFixture } from "./airp-online-fixture";

export function airpControlFixture(action: "confirm-scene" | "discard-scene" = "confirm-scene") {
  const f = airpOnlineFixture();
  const output = inspectAirpTimelinePage(f.page, f.ticket, f.receipt).output!;
  const result = decodeAirpNativeResult(f.nativeResult, f.ticket, f.receipt, output);
  const scene = acceptAirpScene(f.ticket, result, f.current);
  const head = { floorId: f.receipt.floorId, checkpointSnapshotId: f.receipt.checkpointSnapshotId, checkpointContentHash: f.receipt.checkpointContentHash };
  const ticket = action === "confirm-scene" ? prepareAirpConfirmationTicket(scene, { completed: true, head: { ...f.current.head, revision: 21 }, factIds: ["fact.read"] }) : prepareAirpDiscardTicket(f.ticket, head);
  const receipt: AirpInteractionReceipt = { ...f.receipt, floorId: "floor-8", checkpointSnapshotId: "checkpoint-8", checkpointContentHash: "c".repeat(64) };
  const input = { id: "control-input", schemaId: ticket.payload.version, schemaVersion: 1,
    payload: { ...ticket.payload, ...(action === "confirm-scene" ? { trustedScene: JSON.stringify(f.text) } : {}) },
    payloadHash: "", payloadAvailability: "available", source: { kind: "client-event" } };
  input.payloadHash = airpHash(input.payload);
  const nativeOutput = { id: "control-output", schemaId: AIRP_API.output, schemaVersion: 1,
    payload: JSON.stringify(action === "confirm-scene" ? { confirmedRequestId: f.request.requestId } : { discardedRequestId: f.request.requestId }),
    payloadHash: "", payloadAvailability: "available", source: { kind: "program-result", executionId: "program-execution", stepKey: "airp-domain" } };
  nativeOutput.payloadHash = airpHash(nativeOutput.payload);
  const ref = (entryId: string, payloadHash: string) => ({ entryId, payloadHash, path: [] });
  const steps: Record<string, unknown>[] = [{ kind: "program", stepId: "program-step" }, ...(action === "confirm-scene" ? [{ kind: "proposal", outcome: "accepted-change", updaterRunId: "updater-run" }] : [])];
  const floor = {
    ...f.floor, id: receipt.floorId,
    checkpoint: { ...f.floor.checkpoint, snapshot: { ...f.floor.checkpoint.snapshot, id: receipt.checkpointSnapshotId, contentHash: receipt.checkpointContentHash, floorId: receipt.floorId,
      parent: { floorId: head.floorId, checkpointContentHash: head.checkpointContentHash },
      inputs: [ref(input.id, input.payloadHash)], outputs: [ref(nativeOutput.id, nativeOutput.payloadHash)],
      stateLedger: { version: "floor-state-ledger-v3", status: "certified", steps } } },
    sections: [{ entries: [input, nativeOutput], executions: action === "confirm-scene" ? [{ runId: "updater-run", status: "completed", pipelineArtifactVersionId: "updater-version", floorId: receipt.floorId, childBranchId: f.binding.branchId }] : [] }],
  };
  const page = { ...f.page,
    context: { ...f.page.context, context: { ...f.page.context.context,
      packageResources: [{ logicalKey: "pipeline.updater", artifactId: "updater-artifact", artifactVersionId: "updater-version" }],
      artifacts: [{ kind: "interaction-contract", artifactVersionId: f.binding.contractVersionId, document: { actions: { "confirm-scene": { stateUpdater: { pipelineArtifactId: "updater-artifact", failureMode: "required" } } } } }],
    } }, timeline: { ...f.page.timeline, floors: [floor] } };
  return { ...f, scene, ticket, receipt, input, nativeOutput, floor, page };
}
