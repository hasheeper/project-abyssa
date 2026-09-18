import * as v from "../../game-core/contracts";

/** External application protocol. This does not widen content 8/9's save readers. */
export const AIRP_API = {
  request: "airp-scene-request-v1",
  output: "airp-action-output-v1",
  confirmation: "airp-scene-confirmation-v1",
  discard: "airp-scene-discard-v1",
  generateAction: "generate-scene",
  confirmAction: "confirm-scene",
  discardAction: "discard-scene",
  requestBytes: 32 * 1024,
  textBytes: 24 * 1024,
} as const;

export const AIRP_TEXT_EMOTIONS = [
  "neutral", "smile", "joy", "sad", "angry", "surprised", "serious", "closed",
  "wry", "flustered", "displeased", "confident", "confused", "panicked",
] as const;
export type AirpTextEmotion = (typeof AIRP_TEXT_EMOTIONS)[number];
export type AirpRpHead = { floorId: string; checkpointSnapshotId: string; checkpointContentHash: string };
export type AirpRpBinding = {
  applicationId: string;
  releaseId: string;
  sessionId: string;
  threadId: string;
  branchId: string;
  contractVersionId: string;
  writingPipelineVersionId: string;
  head: AirpRpHead | null;
};
export type AirpSceneRequest = {
  version: typeof AIRP_API.request;
  requestId: string;
  mode: "play" | "development";
  source: {
    head: v.AirpHead;
    content: { id: string; version: number; digest: string };
  };
  eventId: string;
  definitionId: string;
  task: "return" | "followup";
  phase: number;
  locationId: string;
  actorIds: string[];
  stance: v.AirpStance;
  outcome: "extracted" | "cleared";
  facts: { id: string; phase: number; summary: string; knownBy: string[] }[];
  requiredFactIds: string[];
};

/** Visible creative notes are separate from the body, never hidden model reasoning. */
export type AirpSceneText = {
  creationRecord: string;
  lines: { speaker: string; emotion: AirpTextEmotion; text: string }[];
};
export type AirpInteractionReceipt = AirpRpHead & {
  version: "interaction-command-accepted-v1";
  replayed: boolean;
  floorRevision: number;
};
export type AirpSceneResult = {
  version: "airp-scene-result-v1";
  requestId: string;
  requestHash: string;
  origin: {
    applicationId: string;
    releaseId: string;
    sessionId: string;
    threadId: string;
    branchId: string;
    contractVersionId: string;
    floorId: string;
    checkpointSnapshotId: string;
    checkpointContentHash: string;
    inputEntryId: string;
    outputEntryId: string;
    outputPayloadHash: string;
    runId: string;
    resultId: string;
    resultHash: string;
    writingPipelineVersionId: string;
  };
  text: AirpSceneText;
  textHash: string;
};

export function airpHash(value: unknown): string { return v.sha256(v.canonicalJson(value)); }
export function airpDigest(value: unknown, path: string): string {
  const result = v.text(value, path, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) v.invalid(path, "Expected SHA-256 digest");
  return result;
}
/** rp identifiers are opaque: never infer type or owner from their prefix. */
export function airpOpaqueId(value: unknown, path: string): string {
  const result = v.text(value, path, 200);
  if (/[\u0000-\u001f\u007f]/.test(result)) v.invalid(path, "Control character in identifier");
  return result;
}
function head(raw: unknown): v.AirpHead {
  const r = v.record(raw, "source.head", ["saveId", "epoch", "revision"]);
  return { saveId: v.id(r.saveId, "saveId"), epoch: v.id(r.epoch, "epoch"), revision: v.number(r.revision, "revision") };
}
export function parseAirpRpHead(raw: unknown): AirpRpHead {
  const r = v.record(raw, "rp.head", ["floorId", "checkpointSnapshotId", "checkpointContentHash"]);
  return {
    floorId: airpOpaqueId(r.floorId, "floorId"),
    checkpointSnapshotId: airpOpaqueId(r.checkpointSnapshotId, "checkpointSnapshotId"),
    checkpointContentHash: airpDigest(r.checkpointContentHash, "checkpointContentHash"),
  };
}
export function parseAirpBinding(raw: unknown): AirpRpBinding {
  const fields = ["applicationId", "releaseId", "sessionId", "threadId", "branchId", "contractVersionId", "writingPipelineVersionId"] as const;
  const r = v.record(raw, "rp.binding", [...fields, "head"]);
  const ids = Object.fromEntries(fields.map(key => [key, airpOpaqueId(r[key], key)])) as Omit<AirpRpBinding, "head">;
  // AIRP-4 starts with a root thread; Child support must use its own explicit binding contract.
  if (ids.sessionId !== ids.threadId) v.invalid("rp.binding", "AIRP requires its bound root thread");
  return { ...ids, head: r.head === null ? null : parseAirpRpHead(r.head) };
}
export function parseAirpSceneRequest(raw: unknown): AirpSceneRequest {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > AIRP_API.requestBytes) v.invalid("request", "AIRP input budget exceeded");
  const r = v.record(raw, "request", ["version", "requestId", "mode", "source", "eventId", "definitionId", "task", "phase", "locationId", "actorIds", "stance", "outcome", "facts", "requiredFactIds"]);
  v.choice(r.version, [AIRP_API.request], "request.version");
  const source = v.record(r.source, "source", ["head", "content"]);
  const content = v.record(source.content, "content", ["id", "version", "digest"]);
  const actorIds = v.ids(r.actorIds, "actorIds", 5);
  if (!actorIds.length || actorIds.includes("kael") || actorIds.includes("narrator")) v.invalid("actorIds", "Only non-player actors are writable");
  const phase = v.number(r.phase, "phase");
  const facts = v.list(r.facts, "facts", 24).map(raw => {
    const f = v.record(raw, "fact", ["id", "phase", "summary", "knownBy"]);
    const knownBy = v.ids(f.knownBy, "knownBy", 6);
    if (!actorIds.every(id => knownBy.includes(id))) v.invalid("fact.knownBy", "Filter non-shared facts before sending");
    return { id: v.id(f.id, "fact.id"), phase: v.number(f.phase, "fact.phase", 0, phase), summary: v.text(f.summary, "fact.summary", 320), knownBy };
  });
  v.ids(facts.map(f => f.id), "fact.ids");
  const requiredFactIds = v.ids(r.requiredFactIds, "requiredFactIds", 24);
  if (!requiredFactIds.length || requiredFactIds.some(id => !facts.some(f => f.id === id))) v.invalid("requiredFactIds", "Required evidence is missing");
  return {
    version: AIRP_API.request, requestId: v.id(r.requestId, "requestId"),
    mode: v.choice(r.mode, ["play", "development"], "mode"),
    source: { head: head(source.head), content: { id: v.id(content.id, "content.id"), version: v.number(content.version, "content.version", 1), digest: airpDigest(content.digest, "content.digest") } },
    eventId: v.id(r.eventId, "eventId"), definitionId: v.id(r.definitionId, "definitionId"),
    task: v.choice(r.task, ["return", "followup"], "task"), phase,
    locationId: v.id(r.locationId, "locationId"), actorIds,
    stance: v.choice(r.stance, ["iron", "seasoned", "pragmatic"], "stance"),
    outcome: v.choice(r.outcome, ["extracted", "cleared"], "outcome"), facts, requiredFactIds,
  };
}
export function parseAirpSceneText(raw: unknown, actorIds: readonly string[]): AirpSceneText {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > AIRP_API.textBytes) v.invalid("text", "AIRP text budget exceeded");
  const r = v.record(raw, "text", ["creationRecord", "lines"]);
  const lines = v.list(r.lines, "text.lines", 32).map(raw => {
    const l = v.record(raw, "line", ["speaker", "emotion", "text"]);
    const speaker = v.choice(l.speaker, ["narrator", ...actorIds], "speaker");
    const emotion = v.choice(l.emotion, AIRP_TEXT_EMOTIONS, "emotion");
    if (speaker === "narrator" && emotion !== "neutral") v.invalid("emotion", "Narration has no actor expression");
    return { speaker, emotion, text: v.text(l.text, "line.text", 600) };
  });
  if (!lines.length) v.invalid("text.lines", "Empty scene");
  return { creationRecord: v.text(r.creationRecord, "creationRecord", 1200), lines };
}
export function parseAirpReceipt(raw: unknown): AirpInteractionReceipt {
  const r = v.record(raw, "receipt", ["version", "replayed", "floorId", "floorRevision", "checkpointSnapshotId", "checkpointContentHash"]);
  return {
    version: v.choice(r.version, ["interaction-command-accepted-v1"], "receipt.version"),
    replayed: v.boolean(r.replayed, "replayed"), floorRevision: v.number(r.floorRevision, "floorRevision", 1),
    ...parseAirpRpHead({ floorId: r.floorId, checkpointSnapshotId: r.checkpointSnapshotId, checkpointContentHash: r.checkpointContentHash }),
  };
}

export function airpInteraction(binding: AirpRpBinding, request: AirpSceneRequest) {
  const b = parseAirpBinding(binding), payload = parseAirpSceneRequest(request);
  return {
    version: "submit-interaction-command-v2" as const,
    branchId: b.branchId, interactionContractArtifactVersionId: b.contractVersionId,
    actionKey: AIRP_API.generateAction, payload, expectedBranchHead: b.head,
    clientRequestId: payload.requestId, trustedEntryInput: null,
  };
}
