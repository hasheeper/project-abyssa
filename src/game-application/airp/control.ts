import * as v from "../../game-core/contracts";
import { AIRP_API, airpHash, parseAirpBinding, parseAirpRpHead, type AirpRpBinding } from "./contracts";
import { parseAirpSceneResult, parseAirpSceneTicket, prepareAirpReadConfirmation, type AirpAcceptedScene, type AirpReadConfirmation, type AirpSceneTicket } from "./acceptance";

export type AirpControlTicket = {
  version: 1;
  binding: AirpRpBinding;
} & (
  | { action: "confirm-scene"; scene: AirpAcceptedScene; payload: AirpReadConfirmation }
  | { action: "discard-scene"; generation: AirpSceneTicket; payload: { version: "airp-scene-discard-v1"; requestId: string; generationRequestId: string } }
);

/** Build only after the local completed-reading fact has committed. Persist before sending. */
export function prepareAirpConfirmationTicket(scene: AirpAcceptedScene, reading: Parameters<typeof prepareAirpReadConfirmation>[1]): AirpControlTicket {
  const payload = prepareAirpReadConfirmation(scene, reading);
  const { floorId, checkpointSnapshotId, checkpointContentHash } = scene.result.origin;
  return {
    version: 1, action: AIRP_API.confirmAction, scene: structuredClone(scene), payload,
    binding: parseAirpBinding({ ...scene.ticket.binding, head: { floorId, checkpointSnapshotId, checkpointContentHash } }),
  };
}

/** A rejected body can still leave a committed pending candidate. Use its exact native receipt, never a guessed latest head. */
export function prepareAirpDiscardTicket(generation: AirpSceneTicket, head: NonNullable<AirpRpBinding["head"]>): AirpControlTicket {
  const ticket = parseAirpSceneTicket(generation), binding = parseAirpBinding({ ...ticket.binding, head: parseAirpRpHead(head) });
  const identity = { binding, generationRequestId: ticket.request.requestId, generationRequestHash: ticket.requestHash };
  return { version: 1, action: AIRP_API.discardAction, binding, generation: ticket,
    payload: { version: AIRP_API.discard, requestId: `airp-discard:${airpHash(identity)}`, generationRequestId: ticket.request.requestId } };
}

export function parseAirpControlTicket(raw: unknown): AirpControlTicket {
  v.assertJson(raw);
  const r = v.record(raw, "control"), action = v.choice(r.action, [AIRP_API.confirmAction, AIRP_API.discardAction], "control.action");
  v.record(raw, "control", ["version", "action", "binding", "payload", action === AIRP_API.confirmAction ? "scene" : "generation"]);
  v.choice(r.version, [1], "control.version");
  const binding = parseAirpBinding(r.binding);
  if (!binding.head) v.invalid("control.binding", "A control action needs an exact previous checkpoint");
  let expected: AirpControlTicket;
  if (action === AIRP_API.confirmAction) {
    const s = v.record(r.scene, "scene", ["version", "id", "ticket", "result"]);
    const ticket = parseAirpSceneTicket(s.ticket);
    const scene: AirpAcceptedScene = { version: v.choice(s.version, [1], "scene.version"), id: v.id(s.id, "scene.id"), ticket, result: parseAirpSceneResult(s.result, ticket) };
    const payload = v.record(r.payload, "confirmation");
    expected = prepareAirpConfirmationTicket(scene, { completed: true, head: payload.source as v.AirpHead, factIds: payload.factIds as string[] });
  } else expected = prepareAirpDiscardTicket(parseAirpSceneTicket(r.generation), binding.head);
  if (v.canonicalJson(expected) !== v.canonicalJson(raw)) v.invalid("control", "Frozen control input or identity changed");
  return expected;
}

export function airpControlInteraction(raw: AirpControlTicket) {
  const ticket = parseAirpControlTicket(raw), b = ticket.binding;
  const origin = ticket.action === AIRP_API.confirmAction ? ticket.scene.result.origin : null;
  return {
    version: "submit-interaction-command-v2" as const, branchId: b.branchId,
    interactionContractArtifactVersionId: b.contractVersionId, actionKey: ticket.action,
    payload: ticket.payload, expectedBranchHead: b.head, clientRequestId: ticket.payload.requestId,
    trustedEntryInput: origin ? { bindingKey: "scene", sourceThreadId: b.threadId, sourceBranchId: b.branchId,
      sourceFloorId: origin.floorId, entryId: origin.outputEntryId, payloadHash: origin.outputPayloadHash } : null,
  };
}
