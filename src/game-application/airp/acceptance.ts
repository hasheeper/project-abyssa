import * as v from "../../game-core/contracts";
import {
  airpDigest, airpHash, airpOpaqueId, parseAirpBinding, parseAirpRpHead, parseAirpSceneRequest, parseAirpSceneText,
  type AirpRpBinding, type AirpSceneRequest, type AirpSceneResult,
} from "./contracts";

export type AirpSceneTicket = {
  version: 1;
  binding: AirpRpBinding;
  request: AirpSceneRequest;
  requestHash: string;
};
export type AirpAcceptedScene = {
  version: 1;
  id: string;
  ticket: AirpSceneTicket;
  result: AirpSceneResult;
};
export type AirpSceneCurrent = {
  head: v.AirpHead;
  contentDigest: string;
  eventId: string;
  eligible: boolean;
};

/** Caller must persist this value through a game command before making the request. */
export function prepareAirpScene(binding: AirpRpBinding, request: AirpSceneRequest): AirpSceneTicket {
  const validated = parseAirpSceneRequest(request);
  return { version: 1, binding: parseAirpBinding(binding), request: validated, requestHash: airpHash(validated) };
}
export function parseAirpSceneTicket(raw: unknown): AirpSceneTicket {
  const r = v.record(raw, "ticket", ["version", "binding", "request", "requestHash"]);
  v.choice(r.version, [1], "ticket.version");
  const ticket = prepareAirpScene(parseAirpBinding(r.binding), parseAirpSceneRequest(r.request));
  if (ticket.requestHash !== r.requestHash) v.invalid("ticket.requestHash", "Frozen request changed");
  return ticket;
}

/** Validate a server-derived result again at the local transaction boundary. */
export function parseAirpSceneResult(raw: unknown, ticket: AirpSceneTicket): AirpSceneResult {
  v.assertJson(raw);
  const r = v.record(raw, "result", ["version", "requestId", "requestHash", "origin", "text", "textHash"]);
  v.choice(r.version, ["airp-scene-result-v1"], "result.version");
  if (r.requestId !== ticket.request.requestId || r.requestHash !== ticket.requestHash) v.invalid("result.request", "Result belongs to a different request", "airp-stale-result");
  const bindingKeys = ["applicationId", "releaseId", "sessionId", "threadId", "branchId", "contractVersionId", "writingPipelineVersionId"] as const;
  const origin = v.record(r.origin, "origin", [...bindingKeys, "floorId", "checkpointSnapshotId", "checkpointContentHash", "inputEntryId", "outputEntryId", "outputPayloadHash", "runId", "resultId", "resultHash"]);
  for (const key of bindingKeys) if (origin[key] !== ticket.binding[key]) v.invalid(`origin.${key}`, "Native source does not match the bound application", "airp-wrong-source");
  parseAirpRpHead({ floorId: origin.floorId, checkpointSnapshotId: origin.checkpointSnapshotId, checkpointContentHash: origin.checkpointContentHash });
  for (const key of ["inputEntryId", "outputEntryId", "runId", "resultId"]) airpOpaqueId(origin[key], `origin.${key}`);
  airpDigest(origin.resultHash, "resultHash");
  airpDigest(origin.outputPayloadHash, "outputPayloadHash");
  const text = parseAirpSceneText(r.text, ticket.request.actorIds), textHash = airpHash(text);
  if (textHash !== r.textHash) v.invalid("textHash", "Frozen body hash mismatch");
  return { version: "airp-scene-result-v1", requestId: ticket.request.requestId, requestHash: ticket.requestHash, origin: structuredClone(origin) as AirpSceneResult["origin"], text, textHash };
}

/** Pure admission decision. No remote call, State write, reward, clock or memory mutation. */
export function acceptAirpScene(ticketRaw: AirpSceneTicket, resultRaw: unknown, current: AirpSceneCurrent, existing: AirpAcceptedScene | null = null): AirpAcceptedScene {
  const ticket = parseAirpSceneTicket(ticketRaw);
  const result = parseAirpSceneResult(resultRaw, ticket);
  const id = `airp-online:${airpHash({ binding: ticket.binding, requestId: ticket.request.requestId, requestHash: ticket.requestHash })}`;
  // An exact replay remains valid after the local transaction advanced the head.
  if (existing) {
    if (existing.version !== 1 || existing.id !== id || v.canonicalJson(existing.ticket) !== v.canonicalJson(ticket) || v.canonicalJson(existing.result) !== v.canonicalJson(result))
      v.invalid("scene", "This request was already admitted with different content", "airp-result-conflict");
    if (current.head.saveId !== ticket.request.source.head.saveId || current.head.epoch !== ticket.request.source.head.epoch || current.contentDigest !== ticket.request.source.content.digest)
      v.invalid("scene", "Accepted scene belongs to a different game identity", "airp-stale-result");
    return structuredClone(existing);
  }
  if (!current.eligible || v.canonicalJson(current.head) !== v.canonicalJson(ticket.request.source.head) || current.eventId !== ticket.request.eventId || current.contentDigest !== ticket.request.source.content.digest)
    v.invalid("scene", "Game state changed while generation was running", "airp-stale-result");
  return { version: 1, id, ticket, result };
}

export type AirpReadConfirmation = {
  version: "airp-scene-confirmation-v1";
  requestId: string;
  sceneId: string;
  generationRequestId: string;
  generationRequestHash: string;
  source: v.AirpHead;
  factIds: string[];
  result: { floorId: string; checkpointSnapshotId: string; checkpointContentHash: string; outputEntryId: string; runId: string; resultId: string; resultHash: string; textHash: string };
};

/** Only call with a proven completed reading and facts from the local replay adapter. */
export function prepareAirpReadConfirmation(scene: AirpAcceptedScene, reading: { completed: boolean; head: v.AirpHead; factIds: string[] }): AirpReadConfirmation {
  const ticket = parseAirpSceneTicket(scene.ticket);
  const result = parseAirpSceneResult(scene.result, ticket);
  const expectedId = `airp-online:${airpHash({ binding: ticket.binding, requestId: ticket.request.requestId, requestHash: ticket.requestHash })}`;
  if (scene.version !== 1 || scene.id !== expectedId) v.invalid("scene.id", "Unbound accepted scene");
  const source = reading.head;
  v.record(source, "reading.head", ["saveId", "epoch", "revision"]);
  if (!reading.completed || source.saveId !== ticket.request.source.head.saveId || source.epoch !== ticket.request.source.head.epoch || !Number.isSafeInteger(source.revision) || source.revision <= ticket.request.source.head.revision)
    v.invalid("reading", "Confirm only this game's committed completed reading");
  const factIds = v.ids(reading.factIds, "reading.factIds", 64);
  if (!factIds.length) v.invalid("reading", "Completed reading needs durable evidence");
  const { floorId, checkpointSnapshotId, checkpointContentHash, outputEntryId, runId, resultId, resultHash } = result.origin;
  const confirmation = {
    version: "airp-scene-confirmation-v1" as const,
    sceneId: scene.id, generationRequestId: ticket.request.requestId, generationRequestHash: ticket.requestHash,
    source: { ...source }, factIds,
    result: { floorId, checkpointSnapshotId, checkpointContentHash, outputEntryId, runId, resultId, resultHash, textHash: result.textHash },
  };
  return { ...confirmation, requestId: `airp-confirm:${airpHash(confirmation)}` };
}
