import { describe, expect, it } from "vitest";
import { airpHash } from "./contracts";
import { airpControlInteraction, parseAirpControlTicket, prepareAirpConfirmationTicket } from "./control";
import { inspectAirpControlTimelinePage } from "./rp-wire";
import { airpControlFixture } from "../testing/airp-control-fixture";

describe("AIRP durable native control contracts", () => {
  it("freezes exact read evidence and trusted Entry without accepting caller-authored trustedScene", () => {
    const f = airpControlFixture(), command = airpControlInteraction(f.ticket);
    expect(command).toMatchObject({ actionKey: "confirm-scene", expectedBranchHead: f.ticket.binding.head, clientRequestId: f.ticket.payload.requestId,
      trustedEntryInput: { entryId: f.scene.result.origin.outputEntryId, payloadHash: f.scene.result.origin.outputPayloadHash } });
    expect(command.payload).not.toHaveProperty("trustedScene");
    expect(parseAirpControlTicket(JSON.parse(JSON.stringify(f.ticket)))).toEqual(f.ticket);
  });
  it("rejects unfinished reading and a modified confirmation", () => {
    const f = airpControlFixture();
    expect(() => prepareAirpConfirmationTicket(f.scene, { completed: false, head: { ...f.current.head, revision: 21 }, factIds: ["fact.read"] })).toThrow();
    f.ticket.payload.requestId = "changed";
    expect(() => parseAirpControlTicket(f.ticket)).toThrow();
  });
  it.each(["confirm-scene", "discard-scene"] as const)("accepts only a certified %s commit", action => {
    const f = airpControlFixture(action);
    expect(inspectAirpControlTimelinePage(f.page, f.ticket, f.receipt).committed).toBe(true);
    f.floor.checkpoint.snapshot.restorable = false;
    expect(() => inspectAirpControlTimelinePage(f.page, f.ticket, f.receipt)).toThrow();
  });
  it.each([
    (f: ReturnType<typeof airpControlFixture>) => { f.floor.checkpoint.snapshot.parent!.checkpointContentHash = "0".repeat(64); },
    f => { f.floor.checkpoint.snapshot.stateContinuable = false; },
    f => { f.floor.checkpoint.incompleteReasons.push("required-updater-rejected"); },
    f => { f.floor.checkpoint.snapshot.stateLedger.status = "carry-forward"; },
    f => { f.floor.checkpoint.snapshot.stateLedger.steps = []; },
    f => { f.floor.checkpoint.snapshot.inputs = []; },
    f => { f.floor.checkpoint.snapshot.outputs = []; },
    f => { f.page.thread.ownerSessionId = "foreign-session"; },
    f => { f.nativeOutput.source.kind = "pipeline-result"; },
    f => { f.nativeOutput.payload = JSON.stringify({ confirmedRequestId: "other-request" }); f.nativeOutput.payloadHash = airpHash(f.nativeOutput.payload); },
    f => { f.floor.sections[0].executions[0].pipelineArtifactVersionId = "wrong-pipeline"; },
    f => { f.floor.checkpoint.snapshot.stateLedger.steps[1].outcome = "rejected"; },
    f => { f.page.context.context.artifacts[0].document.actions["confirm-scene"].stateUpdater.failureMode = "best-effort"; },
  ])("rejects incomplete or mismatched native control evidence %#", mutate => {
    const f = airpControlFixture(); mutate(f);
    expect(() => inspectAirpControlTimelinePage(f.page, f.ticket, f.receipt)).toThrow();
  });
  it("checks trusted raw payload and the exact reading input even if hashes are recomputed", () => {
    const f = airpControlFixture();
    f.input.payload.trustedScene = JSON.stringify({ ...f.text, creationRecord: "different" });
    f.input.payloadHash = airpHash(f.input.payload);
    f.floor.checkpoint.snapshot.inputs[0].payloadHash = f.input.payloadHash;
    expect(() => inspectAirpControlTimelinePage(f.page, f.ticket, f.receipt)).toThrow();
  });
  it("does not claim success for an absent target floor", () => {
    const f = airpControlFixture(); f.page.timeline.floors = [];
    expect(inspectAirpControlTimelinePage(f.page, f.ticket, f.receipt)).toEqual({ committed: false, nextCursor: null });
  });
});
