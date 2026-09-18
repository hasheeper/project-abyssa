import { describe, expect, it } from "vitest";
import { AIRP_TEXT_EMOTIONS, airpHash, airpInteraction, parseAirpSceneRequest, parseAirpSceneText } from "./contracts";
import { acceptAirpScene, parseAirpSceneTicket, prepareAirpReadConfirmation, prepareAirpScene } from "./acceptance";
import { decodeAirpNativeResult, inspectAirpTimelinePage } from "./rp-wire";
import { airpOnlineFixture } from "../testing/airp-online-fixture";
import { validateAirpScript } from "../../game-core/contracts/airp-live-validation";
import { AIRP_POOL_CATALOG } from "../../game-runtime/airp-context";

function decoded(f = airpOnlineFixture()) {
  const output = inspectAirpTimelinePage(f.page, f.ticket, f.receipt).output!;
  return { ...f, result: decodeAirpNativeResult(f.nativeResult, f.ticket, f.receipt, output) };
}

describe("AIRP-4 application contract", () => {
  it("uses one native Interaction with a stable ID and the frozen branch head", () => {
    const f = airpOnlineFixture(), command = airpInteraction(f.binding, f.request);
    expect(command).toMatchObject({ version: "submit-interaction-command-v2", actionKey: "generate-scene", clientRequestId: f.request.requestId, expectedBranchHead: null, trustedEntryInput: null });
    expect(command.payload).toEqual(f.request);
    expect(command.payload).not.toBe(f.request);
  });
  it.each(AIRP_TEXT_EMOTIONS)("accepts the defined expression %s", emotion => {
    const f = airpOnlineFixture(); f.text.lines[1].emotion = emotion;
    expect(parseAirpSceneText(f.text, ["elora"]).lines[1].emotion).toBe(emotion);
  });
  it("leaves the old handwritten contract unchanged", () => {
    const script = structuredClone(Object.values(AIRP_POOL_CATALOG.data.airp!.scripts)[0]);
    const node = script.nodes.find(n => n.kind === "beat" && n.frames[0].kind === "dialogue");
    if (!node || node.kind !== "beat" || node.frames[0].kind !== "dialogue") throw new Error("Missing old actor frame");
    Object.assign(node.frames[0], { emotion: "wry" });
    expect(() => validateAirpScript(script)).toThrow();
  });
  it.each([
    ["unknown emotion", (f: ReturnType<typeof airpOnlineFixture>) => Object.assign(f.text.lines[1], { emotion: "happy" })],
    ["player speech", (f: ReturnType<typeof airpOnlineFixture>) => { f.text.lines[1].speaker = "kael"; }],
    ["unbound actor", (f: ReturnType<typeof airpOnlineFixture>) => { f.text.lines[1].speaker = "norma"; }],
    ["narrator expression", (f: ReturnType<typeof airpOnlineFixture>) => { f.text.lines[0].emotion = "joy"; }],
    ["executable patch", (f: ReturnType<typeof airpOnlineFixture>) => Object.assign(f.text, { patch: { reward: 100 } })],
    ["empty body", (f: ReturnType<typeof airpOnlineFixture>) => { f.text.lines = []; }],
  ])("rejects %s", (_label, mutate) => { const f = airpOnlineFixture(); mutate(f); expect(() => parseAirpSceneText(f.text, f.request.actorIds)).toThrow(); });
  it("enforces required facts, game time and shared knowledge before transport", () => {
    const f = airpOnlineFixture();
    expect(() => parseAirpSceneRequest({ ...f.request, facts: [] })).toThrow();
    f.request.facts[0].phase++;
    expect(() => parseAirpSceneRequest(f.request)).toThrow();
    f.request.facts[0].phase--; f.request.facts[0].knownBy = ["kael"];
    expect(() => parseAirpSceneRequest(f.request)).toThrow();
  });
  it("rejects changed frozen input and oversized output", () => {
    const f = airpOnlineFixture(); f.ticket.request.outcome = "extracted";
    expect(() => parseAirpSceneTicket(f.ticket)).toThrow();
    expect(() => parseAirpSceneText({ ...f.text, lines: Array.from({ length: 32 }, () => ({ speaker: "elora", emotion: "neutral", text: "长".repeat(600) })) }, ["elora"])).toThrow();
  });
});

describe("native source and admission", () => {
  it("binds native receipt/input/output and keeps creative notes outside body lines", () => {
    const f = decoded(), before = structuredClone(f);
    const accepted = acceptAirpScene(f.ticket, f.result, f.current);
    expect(accepted.result.origin.runId).toBe(f.nativeResult.runId);
    expect(accepted.result.text.lines.map(l => l.text)).not.toContain(f.text.creationRecord);
    expect(f).toEqual(before);
  });
  it.each(["pipeline.writing", "pipeline.reformatting"])("rejects valid JSON from %s when generation is bound to the formatter", key => {
    const f = airpOnlineFixture();
    const ticket = prepareAirpScene({ ...f.binding, writingPipelineVersionId: "version-pipeline.formatting" }, f.request);
    f.floor.sections[0].executions[0].pipelineArtifactVersionId = "version-pipeline.formatting";
    expect(() => inspectAirpTimelinePage(f.page, ticket, f.receipt)).not.toThrow();
    f.floor.sections[0].executions[0].pipelineArtifactVersionId = `version-${key}`;
    expect(() => inspectAirpTimelinePage(f.page, ticket, f.receipt)).toThrow();
  });
  it("returns an exact accepted replay without creating a second effect", () => {
    const f = decoded(), scene = acceptAirpScene(f.ticket, f.result, f.current);
    const current = { ...f.current, head: { ...f.current.head, revision: 30 } };
    expect(acceptAirpScene(f.ticket, f.result, current, scene)).toEqual(scene);
    const changed = structuredClone(f.result); changed.text.lines[1].text = "新稿不能覆盖已读稿。"; changed.textHash = airpHash(changed.text);
    expect(() => acceptAirpScene(f.ticket, changed, current, scene)).toThrow();
  });
  it.each(["head", "event", "content", "eligibility", "epoch"])("rejects a stale %s", field => {
    const f = decoded();
    if (field === "head") f.current.head.revision++;
    if (field === "epoch") f.current.head.epoch = "copied-game";
    if (field === "event") f.current.eventId = "other-event";
    if (field === "content") f.current.contentDigest = "d".repeat(64);
    if (field === "eligibility") f.current.eligible = false;
    expect(() => acceptAirpScene(f.ticket, f.result, f.current)).toThrow();
  });
  it.each(["branchId", "releaseId", "sessionId", "writingPipelineVersionId", "contractVersionId"] as const)("rejects wrong %s", field => {
    const f = decoded(); f.result.origin[field] = "other";
    expect(() => acceptAirpScene(f.ticket, f.result, f.current)).toThrow();
  });
  it("only confirms completed durable reading, with a stable confirmation identity", () => {
    const f = decoded(), scene = acceptAirpScene(f.ticket, f.result, f.current);
    const reading = { completed: true, head: { ...f.current.head, revision: 22 }, factIds: ["fact.reading-completed"] };
    const confirmation = prepareAirpReadConfirmation(scene, reading);
    expect(confirmation).toEqual(prepareAirpReadConfirmation(scene, reading));
    expect(confirmation.generationRequestId).toBe(f.request.requestId);
    expect(() => prepareAirpReadConfirmation(scene, { ...reading, completed: false })).toThrow();
    expect(() => prepareAirpReadConfirmation(scene, { ...reading, factIds: [] })).toThrow();
    expect(() => prepareAirpReadConfirmation(scene, { ...reading, head: f.current.head })).toThrow();
    expect(() => prepareAirpReadConfirmation({ ...scene, id: "made-up" }, reading)).toThrow();
  });
  it.each(["terminal", "restorable", "stateContinuable"] as const)("requires checkpoint %s", field => {
    const f = airpOnlineFixture(); f.floor.checkpoint.snapshot[field] = false;
    expect(() => inspectAirpTimelinePage(f.page, f.ticket, f.receipt)).toThrow();
  });
  it("rejects incomplete floors, missing checkpoint refs and mismatched source data", () => {
    for (const mutate of [
      (f: ReturnType<typeof airpOnlineFixture>) => { f.floor.lifecycle = "incomplete"; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.floor.checkpoint.snapshot.inputs = []; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.floor.checkpoint.snapshot.outputs = []; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.page.context.context.application.releaseId = "wrong-release"; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.floor.sections[0].executions[0].status = "failed"; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.floor.checkpoint.snapshot.contract.artifactVersionId = "wrong"; },
    ]) { const f = airpOnlineFixture(); mutate(f); expect(() => inspectAirpTimelinePage(f.page, f.ticket, f.receipt)).toThrow(); }
  });
  it("rejects a truncated, tampered or different final result", () => {
    for (const mutate of [
      (f: ReturnType<typeof airpOnlineFixture>) => { f.nativeResult.finishReason = "length"; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.nativeResult.outputText = "{}"; },
      (f: ReturnType<typeof airpOnlineFixture>) => { f.nativeResult.runId = "other"; },
    ]) { const f = airpOnlineFixture(), output = inspectAirpTimelinePage(f.page, f.ticket, f.receipt).output!; mutate(f); expect(() => decodeAirpNativeResult(f.nativeResult, f.ticket, f.receipt, output)).toThrow(); }
  });
});
