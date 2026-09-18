import * as v from "../../game-core/contracts";
import { AIRP_API, airpDigest, airpHash, airpOpaqueId, parseAirpBinding, parseAirpSceneText, type AirpInteractionReceipt, type AirpRpBinding, type AirpSceneResult } from "./contracts";
import { parseAirpSceneTicket, type AirpSceneTicket } from "./acceptance";
import { parseAirpControlTicket, type AirpControlTicket } from "./control";

/** Decode only required public DTO fields; additional native audit fields remain host-owned. */
export type AirpNativeOutput = {
  inputEntryId: string;
  outputEntryId: string;
  runId: string;
  resultId: string;
  resultHash: string;
  payload: unknown;
};

function same(actual: unknown, expected: unknown, path: string): void {
  if (v.canonicalJson(actual) !== v.canonicalJson(expected)) v.invalid(path, "rp source or commit identity mismatch", "airp-wrong-source");
}
function checkRef(raw: unknown, id: string, hash: string): boolean {
  const r = v.record(raw, "checkpoint.ref");
  return r.entryId === id && r.payloadHash === hash && Array.isArray(r.path) && r.path.length === 0;
}
/** Common exact-floor proof. A Program receipt and a model result have different consumers. */
function inspectCommitPage(raw: unknown, binding: AirpRpBinding, receipt: AirpInteractionReceipt) {
  v.assertJson(raw);
  const b = parseAirpBinding(binding);
  const r = v.record(raw, "timeline.page");
  same(r.version, "thread-timeline-v6", "timeline.version");
  const thread = v.record(r.thread, "thread"), timeline = v.record(r.timeline, "timeline");
  same(thread.id, b.threadId, "thread.id"); same(thread.ownerSessionId, b.sessionId, "thread.owner"); same(thread.kind, "root", "thread.kind");
  const context = v.record(r.context, "context"), runtime = v.record(context.context, "runtime");
  same(context.threadId, b.threadId, "context.threadId"); same(runtime.version, "application-runtime-v6", "runtime.version");
  const application = v.record(runtime.application, "runtime.application");
  same(application.id, b.applicationId, "application.id"); same(application.releaseId, b.releaseId, "application.releaseId");
  same(timeline.threadId, b.threadId, "timeline.threadId"); same(timeline.branchId, b.branchId, "timeline.branchId");
  const nextCursor = timeline.nextCursor === null ? null : v.number(timeline.nextCursor, "nextCursor");
  const floors = v.list(timeline.floors, "floors", 200).map(f => v.record(f, "floor"));
  const matches = floors.filter(f => f.id === receipt.floorId);
  if (matches.length > 1) v.invalid("timeline", "Duplicate target floor");
  const floor = matches[0];
  if (!floor) return { commit: null, nextCursor };
  same(floor.version, "floor-checkpoint-dto-v2", "floor.version"); same(floor.branchId, b.branchId, "floor.branchId");
  same(floor.revision, receipt.floorRevision, "floor.revision");
  if (floor.lifecycle !== "committed") v.invalid("floor", "AIRP floor has not committed successfully", "airp-incomplete");
  const checkpoint = v.record(floor.checkpoint, "checkpoint"), snapshot = v.record(checkpoint.snapshot, "checkpoint.snapshot");
  same(checkpoint.availability, "persisted", "checkpoint.availability");
  same(snapshot.version, "floor-checkpoint-snapshot-v5", "checkpoint.version");
  same(snapshot.id, receipt.checkpointSnapshotId, "checkpoint.id");
  same(snapshot.contentHash, receipt.checkpointContentHash, "checkpoint.hash");
  same(snapshot.floorId, receipt.floorId, "checkpoint.floorId"); same(snapshot.floorRevision, receipt.floorRevision, "checkpoint.revision");
  if (snapshot.terminal !== true || snapshot.restorable !== true || snapshot.stateContinuable !== true || v.list(snapshot.incompleteReasons, "incompleteReasons").length || v.list(checkpoint.incompleteReasons, "checkpoint.incompleteReasons").length)
    v.invalid("checkpoint", "Terminal, restorable and continuable state is required", "airp-incomplete");
  same(v.record(snapshot.contract, "checkpoint.contract").artifactVersionId, b.contractVersionId, "checkpoint.contract");
  if (b.head) {
    const parent = v.record(snapshot.parent, "checkpoint.parent");
    same(parent.floorId, b.head.floorId, "checkpoint.parent.floorId");
    same(parent.checkpointContentHash, b.head.checkpointContentHash, "checkpoint.parent.hash");
  } else same(snapshot.parent, null, "checkpoint.parent");
  const sections = v.list(floor.sections, "sections", 64).map(raw => v.record(raw, "section"));
  const entries = sections.flatMap(s => v.list(s.entries, "entries", 512).map(raw => v.record(raw, "entry")));
  return { commit: { snapshot, entries, sections, runtime }, nextCursor };
}

export function inspectAirpTimelinePage(raw: unknown, rawTicket: AirpSceneTicket, receipt: AirpInteractionReceipt): { output: AirpNativeOutput | null; nextCursor: number | null } {
  const ticket = parseAirpSceneTicket(rawTicket), b = ticket.binding;
  const { commit, nextCursor } = inspectCommitPage(raw, b, receipt);
  if (!commit) return { output: null, nextCursor };
  const { snapshot, entries, sections } = commit;
  const input = entries.filter(e => e.schemaId === AIRP_API.request && e.schemaVersion === 1 && v.record(e.source, "entry.source").kind === "client-event");
  if (input.length !== 1) v.invalid("input", "Expected exactly one AIRP client input");
  const inputId = airpOpaqueId(input[0].id, "input.id");
  same(input[0].payloadAvailability, "available", "input.availability");
  same(input[0].payload, ticket.request, "input.payload"); same(input[0].payloadHash, ticket.requestHash, "input.hash");
  if (!v.list(snapshot.inputs, "checkpoint.inputs").some(ref => checkRef(ref, inputId, ticket.requestHash))) v.invalid("input", "Input is not bound by the checkpoint");
  const outputEntries = entries.filter(e => e.schemaId === AIRP_API.output && e.schemaVersion === 1 && v.record(e.source, "entry.source").kind === "pipeline-result");
  if (outputEntries.length !== 1) v.invalid("output", "Expected exactly one final AIRP output");
  const output = outputEntries[0], outputId = airpOpaqueId(output.id, "output.id");
  same(output.payloadAvailability, "available", "output.availability");
  // Native Workflow V1 output Entries are strings, even when the model writes JSON.
  v.text(output.payload, "output.payload", AIRP_API.textBytes);
  same(output.payloadHash, airpHash(output.payload), "output.hash");
  if (!v.list(snapshot.outputs, "checkpoint.outputs").some(ref => checkRef(ref, outputId, String(output.payloadHash)))) v.invalid("output", "Output is not bound by the checkpoint");
  const source = v.record(output.source, "output.source");
  const runId = airpOpaqueId(source.runId, "output.runId"), resultId = airpOpaqueId(source.resultId, "output.resultId");
  const executions = sections.flatMap(s => v.list(s.executions, "executions", 64).map(raw => v.record(raw, "execution"))).filter(e => e.runId === runId);
  if (executions.length !== 1) v.invalid("execution", "Final output has no unique execution");
  const execution = executions[0], availability = v.record(execution.result, "execution.result");
  same(execution.floorId, receipt.floorId, "execution.floorId");
  same(execution.childBranchId, b.branchId, "execution.branchId");
  same(execution.pipelineArtifactVersionId, b.writingPipelineVersionId, "execution.pipeline");
  same(execution.status, "completed", "execution.status");
  same(availability.status, "available", "execution.result.status"); same(availability.id, resultId, "execution.result.id");
  const resultHash = airpDigest(availability.contentHash, "execution.result.hash");
  return { output: { inputEntryId: inputId, outputEntryId: outputId, runId, resultId, resultHash, payload: output.payload }, nextCursor };
}

/** Confirm/discard success is a certified Program/State commit, never arbitrary outputText. */
export function inspectAirpControlTimelinePage(raw: unknown, rawTicket: AirpControlTicket, receipt: AirpInteractionReceipt): { committed: boolean; nextCursor: number | null } {
  const ticket = parseAirpControlTicket(rawTicket), b = ticket.binding;
  const { commit, nextCursor } = inspectCommitPage(raw, b, receipt);
  if (!commit) return { committed: false, nextCursor };
  const { snapshot, entries, sections, runtime } = commit;
  const input = entries.filter(e => e.schemaId === ticket.payload.version && e.schemaVersion === 1 && v.record(e.source, "entry.source").kind === "client-event");
  if (input.length !== 1) v.invalid("input", "Expected exactly one bound AIRP control input");
  const payload = v.record(input[0].payload, "control.input"), inputId = airpOpaqueId(input[0].id, "input.id");
  const { trustedScene, ...untrusted } = payload;
  if (ticket.action === AIRP_API.confirmAction) {
    const text = v.text(trustedScene, "trustedScene", AIRP_API.textBytes);
    same(airpHash(text), ticket.scene.result.origin.outputPayloadHash, "trustedScene.hash");
    let decoded: unknown;
    try { decoded = JSON.parse(text); } catch { v.invalid("trustedScene", "Invalid trusted scene JSON"); }
    same(parseAirpSceneText(decoded, ticket.scene.ticket.request.actorIds), ticket.scene.result.text, "trustedScene.body");
    same(untrusted, ticket.payload, "control.input");
  } else same(payload, ticket.payload, "control.input");
  same(input[0].payloadAvailability, "available", "control.input.availability");
  const inputHash = airpHash(payload);
  same(input[0].payloadHash, inputHash, "control.input.hash");
  const inputs = v.list(snapshot.inputs, "checkpoint.inputs");
  if (inputs.length !== 1 || !checkRef(inputs[0], inputId, inputHash)) v.invalid("input", "Control input is not bound by the checkpoint");
  const outputs = entries.filter(e => e.schemaId === AIRP_API.output && e.schemaVersion === 1 && v.record(e.source, "entry.source").kind === "program-result");
  if (outputs.length !== 1) v.invalid("output", "Expected one AIRP Program receipt");
  const output = outputs[0], outputId = airpOpaqueId(output.id, "output.id");
  const expected = ticket.action === AIRP_API.confirmAction ? { confirmedRequestId: ticket.payload.generationRequestId } : { discardedRequestId: ticket.payload.generationRequestId };
  same(output.payloadAvailability, "available", "control.output.availability");
  const outputText = v.text(output.payload, "control.output", 1024);
  let decoded: unknown;
  try { decoded = JSON.parse(outputText); } catch { v.invalid("control.output", "Invalid Program receipt"); }
  same(decoded, expected, "control.output");
  same(output.payloadHash, airpHash(outputText), "control.output.hash");
  if (!v.list(snapshot.outputs, "checkpoint.outputs").some(ref => checkRef(ref, outputId, airpHash(outputText)))) v.invalid("output", "Program receipt is not bound by the checkpoint");
  const ledger = v.record(snapshot.stateLedger, "stateLedger");
  same(ledger.version, "floor-state-ledger-v3", "ledger.version");
  same(ledger.status, "certified", "ledger.status");
  const steps = v.list(ledger.steps, "ledger.steps").map(s => v.record(s, "ledger.step"));
  if (!steps.some(s => s.kind === "program")) v.invalid("state", "Missing certified Program transition", "airp-incomplete");
  if (ticket.action === AIRP_API.confirmAction) {
    const resources = v.list(runtime.packageResources, "runtime.packageResources").map(r => v.record(r, "resource"));
    const updaters = resources.filter(r => r.logicalKey === "pipeline.updater");
    if (updaters.length !== 1) v.invalid("updater", "Missing frozen updater resource");
    const artifacts = v.list(runtime.artifacts, "runtime.artifacts").map(a => v.record(a, "artifact"));
    const contracts = artifacts.filter(a => a.kind === "interaction-contract" && a.artifactVersionId === b.contractVersionId);
    if (contracts.length !== 1) v.invalid("contract", "Missing frozen AIRP contract");
    const actions = v.record(v.record(contracts[0].document, "contract.document").actions, "actions");
    const updater = v.record(v.record(actions[AIRP_API.confirmAction], "confirm.action").stateUpdater, "stateUpdater");
    same(updater.pipelineArtifactId, updaters[0].artifactId, "updater.pipeline");
    same(updater.failureMode, "required", "updater.failureMode");
    const executions = sections.flatMap(s => v.list(s.executions, "executions").map(e => v.record(e, "execution")));
    const accepted = steps.filter(s => s.kind === "proposal" && (s.outcome === "accepted-change" || s.outcome === "accepted-noop"));
    if (!accepted.some(s => executions.some(e => e.runId === s.updaterRunId && e.pipelineArtifactVersionId === updaters[0].artifactVersionId && e.status === "completed" && e.floorId === receipt.floorId && e.childBranchId === b.branchId)))
      v.invalid("updater", "The required memory update has no accepted native execution", "airp-incomplete");
  }
  return { committed: true, nextCursor };
}

export function decodeAirpNativeResult(raw: unknown, ticket: AirpSceneTicket, receipt: AirpInteractionReceipt, output: AirpNativeOutput): AirpSceneResult {
  v.assertJson(raw);
  const r = v.record(raw, "pipeline.result");
  same(r.version, "pipeline-run-result-v1", "result.version"); same(r.id, output.resultId, "result.id");
  same(r.runId, output.runId, "result.runId"); same(r.pipelineArtifactVersionId, ticket.binding.writingPipelineVersionId, "result.pipeline");
  same(r.contentHash, output.resultHash, "result.hash");
  if (r.finishReason !== "stop") v.invalid("result.finishReason", "Truncated or unsuccessful generation cannot be admitted", "airp-incomplete");
  const outputText = v.text(r.outputText, "outputText", AIRP_API.textBytes), providerText = v.text(r.providerText, "providerText", 256 * 1024);
  // This is the public result-store hash definition, not just a hash of outputText.
  const hash = airpHash({ version: r.version, pipelineArtifactVersionId: r.pipelineArtifactVersionId, providerText, outputText, finishReason: r.finishReason, usage: r.usage });
  same(hash, output.resultHash, "result.contentHash");
  let decoded: unknown;
  try { decoded = JSON.parse(outputText); } catch { v.invalid("outputText", "Expected one JSON object, without fences or repair"); }
  same(outputText, output.payload, "result.entryPayload");
  const text = parseAirpSceneText(decoded, ticket.request.actorIds), b = ticket.binding;
  return {
    version: "airp-scene-result-v1", requestId: ticket.request.requestId, requestHash: ticket.requestHash,
    origin: {
      applicationId: b.applicationId, releaseId: b.releaseId, sessionId: b.sessionId, threadId: b.threadId, branchId: b.branchId,
      contractVersionId: b.contractVersionId, writingPipelineVersionId: b.writingPipelineVersionId,
      floorId: receipt.floorId, checkpointSnapshotId: receipt.checkpointSnapshotId, checkpointContentHash: receipt.checkpointContentHash,
      inputEntryId: output.inputEntryId, outputEntryId: output.outputEntryId, outputPayloadHash: airpHash(output.payload), runId: output.runId, resultId: output.resultId, resultHash: output.resultHash,
    },
    text, textHash: airpHash(text),
  };
}
