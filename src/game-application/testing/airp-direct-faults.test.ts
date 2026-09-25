import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { poolTestRuntime, readPoolConversation, type PoolRecord } from "./airp-pool-playthrough";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { IndexedDbGameStore } from "../../game-infrastructure/storage/indexeddb";
import { IndexedDbArchiveStore } from "../../game-infrastructure/storage/archive-maintenance";
import type { AnyGameRecord, AnyReceipt, D5Command } from "../index";
import { hash, emptyUsage } from "../airp-generation/contracts";

let pending: PoolRecord;
beforeAll(async () => {
  const f = await directReturnGate("extracted"); await prepareDirect(f);
  await simulateDirectStage(f, "planning", "模拟三段规划");
  await simulateDirectStage(f, "writing", "艾洛拉等候回应。");
  await simulateDirectStage(f, "formatting", JSON.stringify({creationRecord: "原文封装", lines: [{speaker: "narrator", emotion: "neutral", text: "艾洛拉等候回应。"}]}));
  await readPoolConversation(f);
  const task = (await f.read()).airpDirect!.tasks[0];
  await f.send({type: "airp-turn-in", instanceId: task.instanceId});
  pending = await f.send({type: "airp-direct-begin", sceneId: task.sceneId, stage: "updater", attemptId: "fault-updater", at: 100000});
}, 120000);
afterEach(() => vi.restoreAllMocks());
function command(): D5Command {
  return {type: "airp-direct-result", sceneId: pending.airpDirect!.tasks[0].sceneId, attemptId: "fault-updater", at: 100001,
    output: JSON.stringify({summary: "艾洛拉等候回应。", supports: [pending.narrative.scenes.find(s => s.id === pending.airpDirect!.tasks[0].sceneId)!.body.nodes[0].id], flags: []}), usage: emptyUsage()};
}
const request = (clientRequestId: string) => ({protocolVersion: 4, saveId: "pool", expectedHead: pending.head, clientRequestId, command: command()});
async function indexedFixture() {
  const factory = new IDBFactory(), store = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>("direct-faults", factory);
  const runtime = createPlayerRuntime(store, {newId: () => crypto.randomUUID(), newSeed: () => 19, close() {store.close();}});
  expect(await runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record: pending}), clientRequestId: "fixture-restore"})).toMatchObject({ok: true});
  return {factory, store, runtime};
}
it("IndexedDB adapter CAS admits only one updater and strips direct effects from the loser", async () => {
  const f = await indexedFixture(), otherStore = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>("direct-faults", f.factory);
  const other = createPlayerRuntime(otherStore, {newId: () => "other", newSeed: () => 19, close() {otherStore.close();}});
  const results = await Promise.all([f.runtime.application.dispatch(request("race-a")), other.application.dispatch(request("race-b"))]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  const records = await f.store.read("pool");
  expect(records?.schemaVersion === 4 && records.airpDirect!.memories).toHaveLength(1);
  for (const id of ["race-a", "race-b"]) {
    const receipt = await f.store.receipt("pool", pending.head.epoch, id);
    if (receipt?.status === "rejected") {expect(receipt).not.toHaveProperty("airpDirect"); expect(receipt.factIds).toEqual([]);}
  }
  f.store.close(); otherStore.close();
}, 60000);
it("quota failure rolls back both state and receipt; the exact pending command can be retried", async () => {
  const f = await indexedFixture(), original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === "receipts") throw new DOMException("test-full", "QuotaExceededError");
    return original.apply(this, args);
  });
  expect(await f.runtime.application.dispatch(request("quota"))).toMatchObject({ok: false});
  expect(await f.store.read("pool")).toEqual(pending);
  expect(await f.store.receipt("pool", pending.head.epoch, "quota")).toBeNull();
  vi.restoreAllMocks();
  expect(await f.runtime.application.dispatch(request("quota"))).toMatchObject({ok: true});
  expect(await f.runtime.application.dispatch(request("quota"))).toMatchObject({ok: true, replayed: true});
  f.store.close();
}, 60000);
it("deleting an archive before its delayed result cannot recreate it or its receipts", async () => {
  const f = await indexedFixture(), archives = new IndexedDbArchiveStore(f.factory, "direct-faults");
  const target = await archives.inspect("pool", pending.head);
  await archives.change({target, index: {version: 1, revision: 0, slots: Array.from({length: 30}, () => null)}});
  expect(await f.runtime.application.dispatch(request("late"))).toMatchObject({ok: false});
  expect(await f.store.read("pool")).toBeNull();
  expect(await f.store.receipt("pool", pending.head.epoch, "late")).toBeNull(); f.store.close();
}, 60000);
it("rejects forged gameplay sources, retracted proof, foreign epoch and same-identity changed output", async () => {
  for (const mutation of ["sample", "run", "epoch", "retracted", "read", "material"] as const) {
    const r = structuredClone(pending), task = r.airpDirect!.tasks[0];
    if (mutation === "sample") Object.assign(task.context!, {sourceKind: "sample"});
    if (mutation === "run") task.context!.proof.runId = "different-run";
    if (mutation === "epoch") task.context!.head.epoch = "different-epoch";
    if (mutation === "retracted") r.retractedFactIds.push(task.context!.proof.sourceFactIds[0]);
    if (mutation === "read") task.read!.factIds = ["foreign-read"];
    if (mutation === "material") r.airpDirect!.materials[task.materialHash!].resources.sources[0].text += "forged";
    expect(await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record: r}), clientRequestId: mutation})).toMatchObject({ok: false});
  }
  const f = poolTestRuntime(pending);
  expect(await f.runtime.application.dispatch(request("accepted"))).toMatchObject({ok: true});
  const changed = command(); if (changed.type !== "airp-direct-result") throw Error();
  changed.output += " ";
  const before = hash(await f.read());
  expect(await f.runtime.application.dispatch({...request("accepted"), command: changed})).toMatchObject({ok: false});
  expect(hash(await f.read())).toBe(before);
}, 90000);
it("watch-note's missed aftermath and cooldown remain unique through advance, reopen and replay", async () => {
  const f = poolTestRuntime();
  expect(await f.runtime.application.createNewGame({saveId: "pool", epoch: "missed", clientRequestId: "create", startAt: "airp-demo"})).toMatchObject({ok: true});
  const note = (await f.read()).narrative.instances.find(i => i.definition.id === "ripple.elora.watch-note")!;
  expect(note).toBeTruthy();
  for (let i = 0; i < 4; i++) await f.send({type: "advance-phase"});
  const missed = await f.read();
  expect(missed.narrative.instances.find(i => i.id === note.id)).toMatchObject({reason: "missed"});
  const memories = missed.narrative.memories, cooldowns = missed.narrative.cooldowns;
  await f.send({type: "airp-open", instanceId: note.id}); await readPoolConversation(f);
  await f.send({type: "airp-open", instanceId: note.id});
  expect((await f.read()).narrative.memories).toEqual(memories);
  expect((await f.read()).narrative.cooldowns).toEqual(cooldowns);
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
}, 60000);
