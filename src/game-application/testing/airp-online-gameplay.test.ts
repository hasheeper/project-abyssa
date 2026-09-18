import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { firstOnlineOffer, onlineResultFor, onlineReturnGate } from "./airp-online-playthrough";
import { poolTestRuntime, readPoolConversation, type PoolRecord } from "./airp-pool-playthrough";
import { airpSessionFixture } from "./airp-session-fixture";
import { airpOnlineHead } from "../airp/gameplay";
import { airpHash, type AirpInteractionReceipt } from "../airp/contracts";
import { parseD5Request } from "../versions/d5-parse";
import { validateAirpScript } from "../../game-core/contracts/airp-live-validation";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";

let gate: PoolRecord;
const checkpoints: Record<string, PoolRecord> = {};
beforeAll(async () => {
  if (process.env.ABYSSA_AIRP_ONLINE_FIXTURE) {
    gate = JSON.parse(readFileSync(process.env.ABYSSA_AIRP_ONLINE_FIXTURE, "utf8")).gate;
    expect((await poolTestRuntime(gate).runtime.application.open("pool")).ok).toBe(true);
  } else {
    const source = process.env.ABYSSA_AIRP_FIXTURE ? JSON.parse(readFileSync(process.env.ABYSSA_AIRP_FIXTURE, "utf8")).pending.originRef.source : undefined;
    gate = await onlineReturnGate(await firstOnlineOffer(source));
  }
  checkpoints.gate = gate;
}, 240000);
afterAll(() => { mkdirSync("dist/reports/airp-4", { recursive: true }); writeFileSync("dist/reports/airp-4/checkpoints.json", JSON.stringify(checkpoints)); });
const entry = (r: PoolRecord) => r.airpOnline!.entries.at(-1)!;
async function request(f: ReturnType<typeof poolTestRuntime>) {
  const s = airpSessionFixture();
  await f.send({ type: "airp-online-connect", baseUrl: "http://127.0.0.1:8787/api/v1", release: s.target });
  let r = await f.read();
  await f.send({ type: "airp-online-bound", connectionKey: r.airpOnline!.connection!.key,
    binding: { ...s.binding, contractVersionId: s.target.contractVersionId, writingPipelineVersionId: s.target.writingPipelineVersionId } });
  r = await f.send({ type: "airp-online-request", sceneId: entry(r).sceneId });
  return r;
}
function receipt(tag: string): AirpInteractionReceipt {
  return { version: "interaction-command-accepted-v1", replayed: false, floorRevision: 4, floorId: `floor-${tag}`, checkpointSnapshotId: `checkpoint-${tag}`, checkpointContentHash: "d".repeat(64) };
}
async function rejected(f: ReturnType<typeof poolTestRuntime>, command: unknown) {
  const before = await f.read();
  const result = await f.runtime.application.dispatch({ protocolVersion: 4, saveId: "pool", expectedHead: before.head, clientRequestId: `reject:${airpHash([command, before.head]).slice(0, 32)}`, command });
  expect(result.ok).toBe(false); expect(await f.read()).toEqual(before);
  return result;
}

describe("content10 actual command and archive integration", () => {
  it("gates both first-frame display and transcript; old command grammars stay closed", async () => {
    const f = poolTestRuntime(gate), e = entry(gate), view = f.runtime.queries.narrative(gate);
    expect(view?.version).toBe(2);
    if (view?.version !== 2) throw Error();
    expect(view.onlineEntry?.source).toBe("undecided");
    expect(view.entries.flatMap(e => e.history).some(s => s.id === e.sceneId)).toBe(false);
    const node = view.scene!.body.nodes[0];
    await rejected(f, { type: "airp-read", instanceId: e.instanceId, sceneId: e.sceneId, nodeId: node.id });
    expect(() => parseD5Request({ protocolVersion: 4, saveId: "pool", expectedHead: gate.head, clientRequestId: "old", command: { type: "airp-online-request", sceneId: e.sceneId } }, false, 2)).toThrow();
    expect(f.runtime.defaultCreation.contentVersion).toBe(12); // offline chapter; online10 remains explicit
  }, 60000);
  it("persists the exact request at its resulting gameplay head, without model-owned quest effects", async () => {
    const f = poolTestRuntime(gate), r = await request(f), e = entry(r);
    checkpoints.requested = r;
    expect(e.ticket!.request.source.head).toEqual(r.head);
    expect(e.ticket!.request.requiredFactIds).toEqual(gate.narrative.instances.find(i => i.id === e.instanceId)!.proof!.sourceFactIds);
    expect(r.snapshot).toEqual(gate.snapshot); expect(r.narrative).toEqual(gate.narrative);
    expect(r.facts.at(-1)?.kind).toBe("airp-online");
    const restored = poolTestRuntime();
    expect(await restored.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: r }), clientRequestId: "recover-request" })).toMatchObject({ ok: true });
    expect(entry(await restored.read()).ticket).toEqual(e.ticket);
    const commit = r.commits.at(-1)!, fact = r.facts.at(-1)!;
    if (fact.kind !== "airp-online") throw Error();
    expect(await restored.runtime.application.dispatch({ protocolVersion: 4, saveId: "pool", expectedHead: commit.previous, clientRequestId: commit.requestId, command: fact.payload.command })).toMatchObject({ ok: true, replayed: true });
  }, 60000);
  it("freezes 14-emotion text in the original scene and confirms only a real completed reading", async () => {
    const f = poolTestRuntime(gate); let r = await request(f), e = entry(r);
    const result = onlineResultFor(e.ticket!);
    r = await f.send({ type: "airp-online-result", sceneId: e.sceneId, result });
    checkpoints.admitted = r; e = entry(r);
    const scene = r.narrative.scenes.find(s => s.id === e.sceneId)!;
    expect(scene.source).toBe("rp"); expect(scene.body.nodes.length).toBe(result.text.lines.length);
    expect(JSON.stringify(scene.body)).not.toContain(result.text.creationRecord);
    expect(() => validateAirpScript(scene.body)).toThrow(); // old three-emotion reader has not been widened
    expect(e.control).toBeNull(); expect(r.narrative.memories).toHaveLength(0);
    await readPoolConversation(f); r = await f.read(); checkpoints.read = r; e = entry(r);
    expect(e.control?.action).toBe("confirm-scene");
    if (e.control?.action !== "confirm-scene") throw Error();
    expect(e.control.payload.source).toEqual(r.head);
    expect(e.control.payload.factIds).toEqual([r.facts.at(-1)!.id]);
    await f.send({ type: "airp-turn-in", instanceId: e.instanceId });
    await rejected(f, { type: "airp-online-followup", instanceId: e.instanceId });
    r = await f.send({ type: "airp-online-control-done", sceneId: e.sceneId, requestId: e.control.payload.requestId, receipt: receipt("confirmed") });
    checkpoints.confirmed = r;
    expect(r.narrative.memories).toHaveLength(1);
    r = await f.send({ type: "airp-online-followup", instanceId: e.instanceId });
    r = await f.send({ type: "airp-online-request", sceneId: entry(r).sceneId });
    expect(entry(r).ticket!.request.task).toBe("followup");
    expect(entry(r).ticket!.binding.head).toEqual(airpOnlineHead(receipt("confirmed")));
    checkpoints.followupRequested = r;
    expect((await f.runtime.application.open("pool")).ok).toBe(true);
  }, 60000);
  it("freezes explicit handwritten fallback and cleans a late candidate without changing seen text", async () => {
    const f = poolTestRuntime(gate); let r = await request(f); const e = entry(r), result = onlineResultFor(e.ticket!);
    r = await f.send({ type: "airp-online-handwritten", sceneId: e.sceneId });
    await rejected(f, { type: "airp-online-result", sceneId: e.sceneId, result });
    const body = r.narrative.scenes.find(s => s.id === e.sceneId)!.body;
    await readPoolConversation(f);
    r = await f.send({ type: "airp-online-discard-ready", sceneId: e.sceneId, receipt: { ...receipt("candidate"), ...airpOnlineHead(result.origin) } });
    expect(entry(r).control?.action).toBe("discard-scene");
    r = await f.send({ type: "airp-online-control-done", sceneId: e.sceneId, requestId: entry(r).control!.payload.requestId, receipt: receipt("discarded") });
    expect(r.narrative.scenes.find(s => s.id === e.sceneId)!.body).toEqual(body);
    expect(entry(r).accepted).toBeNull(); expect(entry(r).controlReceipt).not.toBeNull();
    checkpoints.fallback = r;
  }, 60000);
  it("rejects an edited outbox and prevents copied saves from silently sharing a writable Session", async () => {
    const f = poolTestRuntime(gate), r = await request(f), corrupted = structuredClone(r);
    corrupted.airpOnline!.entries[0].ticket!.request.source.head.revision++;
    expect(await poolTestRuntime().runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: corrupted }), clientRequestId: "corrupt" })).toMatchObject({ ok: false });
    expect(await f.runtime.application.importSave({ format: "application", archive: JSON.stringify({ archiveVersion: 4, record: r }), saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy" })).toMatchObject({ ok: false });
  }, 60000);
  it("CAS admits one result and strips the losing online receipt effect", async () => {
    const f = poolTestRuntime(gate), r = await request(f), e = entry(r);
    const other = createPlayerRuntime(new MemoryGameStore(f.database), { newId: () => "other", newSeed: () => 19, close() {} });
    const raw = { protocolVersion: 4, saveId: "pool", expectedHead: r.head, clientRequestId: "admit-one", command: { type: "airp-online-result", sceneId: e.sceneId, result: onlineResultFor(e.ticket!) } };
    const results = await Promise.all([f.runtime.application.dispatch(raw), other.application.dispatch({ ...raw, clientRequestId: "admit-two" })]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    const loser = await f.store.receipt("pool", r.head.epoch, results[0].ok ? "admit-two" : "admit-one");
    expect(loser?.status).toBe("rejected"); expect(loser).not.toHaveProperty("airpOnline");
    expect((await f.read()).narrative.scenes.filter(s => s.source === "rp")).toHaveLength(1);
  }, 60000);
  it("accepts the full online text budget without changing old authored-scene limits", async () => {
    const f = poolTestRuntime(gate), r = await request(f), e = entry(r), result = onlineResultFor(e.ticket!);
    result.text.lines = Array.from({ length: 32 }, () => ({ speaker: "elora", emotion: "confident", text: "x".repeat(600) }));
    result.textHash = airpHash(result.text); result.origin.outputPayloadHash = airpHash(JSON.stringify(result.text));
    const admitted = await f.send({ type: "airp-online-result", sceneId: e.sceneId, result });
    expect(admitted.narrative.scenes.find(s => s.id === e.sceneId)!.body.nodes).toHaveLength(32);
    expect((await f.runtime.application.open("pool")).ok).toBe(true);
  }, 60000);
});
