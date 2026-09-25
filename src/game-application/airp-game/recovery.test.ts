import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { mockNodeWriting } from "../testing/airp-node-fixture";
import { createNodeDriver } from "../../game-runtime/airp-expedition-play-driver";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../versions/demo-contracts";
import { emptyUsage } from "../airp-generation/contracts";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { directorView } from "../../game-runtime/airp-director-view";
import { FACILITIES_CATALOG } from "../../game-runtime/facilities-context";

const connection = { config: { baseUrl: "https://example.invalid/v1", model: "test-mock", timeoutMs: 1000 }, key: "fake-test-only-credential" };
const lock = async <T>(_name: string, _signal: AbortSignal, fn: () => Promise<T>) => fn();
async function opened() {
  const f = await formalAirpFixture(), id = await f.prepare(), ticket = await f.flow.gm.departurePermit(id);
  await f.send({ type: "start-expedition", ...ticket.departure }); await f.flow.sync();
  const nodeId = airpGameView(f.raw())!.node!.id; await f.flow.nodes.open(nodeId);
  return { ...f, nodeId };
}
it.each([false, true])("retains returned text on formal-save faults; retry saves only (lost response %s)", async after => {
  const f = await opened(); let calls = 0, armed = true;
  const commit = f.store.commit.bind(f.store);
  f.store.commit = async p => {
    const r = p.candidate;
    if (armed && r?.schemaVersion === 4 && Object.values(r.airpGame?.nodes ?? {}).some(n => n.jobs.some(j => j.attempts.some(a => a.output)))) {
      armed = false; if (after) await commit(p); throw Error("injected save fault");
    }
    return commit(p);
  };
  const driver = createNodeDriver({ lock, provider: async () => { calls++; return { text: mockNodeWriting(), usage: emptyUsage(), finishReason: "stop" }; } });
  const changes: string[] = [], unsubscribe = driver.subscribe(() => changes.push(driver.getSnapshot().phase));
  expect(driver.getSnapshot()).toBe(driver.getSnapshot());
  await driver.run(f.flow.host.nodes, f.nodeId, connection); expect(driver.getSnapshot().pendingResult).toBe(true);
  await driver.run(f.flow.host.nodes, f.nodeId, connection); expect(calls).toBe(1);
  await driver.retrySave(f.flow.host.nodes); expect(driver.getSnapshot()).toMatchObject({ pendingResult: false, phase: "formatting-needed" });
  expect(calls).toBe(1); expect(changes).toContain("writing"); unsubscribe();
  expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
  expect(JSON.stringify(f.raw())).not.toContain(connection.key);
}, 20000);

it("restores an interrupted formal archive in a clean store without sending or replacing another save", async () => {
  const f = await opened();
  await f.flow.nodes.begin(f.nodeId, { id: "interrupted", stage: "writing", model: "test-mock", connectionHash: "2".repeat(64), at: 1 });
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  const runtime = createPlayerRuntime(store, { newId: () => "unused", newSeed: () => 19, close() {} });
  expect(await runtime.application.restoreSave({ archive: exported.archive, clientRequestId: "restore-formal" })).toMatchObject({ ok: true });
  expect(database.records.get("formal-airp")).toEqual(f.raw());
  const flow = runtime.airpGame.forSave("formal-airp"); await flow.sync();
  let calls = 0;
  const driver = createNodeDriver({ lock, provider: async () => { calls++; throw Error("must not send"); } });
  await driver.run(flow.host.nodes, f.nodeId, connection); expect(calls).toBe(0);
  await driver.markInterrupted(flow.host.nodes, f.nodeId);
  expect((await flow.nodes.read()).ledger.jobs[0].attempts[0].status).toBe("interrupted");
  expect(await runtime.application.restoreSave({ archive: exported.archive, clientRequestId: "restore-formal-again" })).toMatchObject({ ok: false });
  expect(await runtime.application.importSave({ archive: exported.archive, saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy" })).toMatchObject({ ok: false });
  const forged = f.raw(); forged.airpGame!.gm.jobs[0].prepared!.proposal.focus.intent = "changed";
  expect(() => readD5Archive(JSON.stringify({ archiveVersion: 4, record: forged }), AIRP_GAME_CATALOG, D5_RUN_READERS)).toThrow();
}, 20000);

it("keeps old daily archives on content19 and ordinary new saves on the current facilities catalog", async () => {
  const f = await formalAirpFixture();
  expect(await f.runtime.application.create({ protocolVersion: 4, contentVersion: 19, saveId: "old-daily", epoch: "old-epoch", clientRequestId: "old-create", profileId: "profile.demo.first-run" })).toMatchObject({ ok: true });
  expect(await f.runtime.application.createNewGame({ saveId: "ordinary", epoch: "ordinary-epoch", clientRequestId: "ordinary-create", startAt: "hub" })).toMatchObject({ ok: true });
  expect(f.database.records.get("old-daily")!.contentRef.contentVersion).toBe(19);
  expect(f.database.records.get("ordinary")!.contentRef).toEqual(FACILITIES_CATALOG.ref);
  expect((await f.runtime.application.open("old-daily")).ok).toBe(true);
  expect(directorView(f.raw())).not.toBeNull();
});

it("invalidates an old departure after ordinary time passes, while keeping the save readable", async () => {
  const f = await formalAirpFixture(), id = await f.prepare();
  await f.send({ type: "advance-phase" });
  expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
  await expect(f.flow.gm.departurePermit(id)).rejects.toThrow(/changed/);
  await f.flow.gm.refresh(id);
  expect(f.raw().airpGame!.gm.jobs[0]).toMatchObject({ status: "pending", prepared: null });
  expect(f.raw().airpGame!.gm.jobs[0].attempts).toHaveLength(1);
  await f.flow.gm.cancel(id); expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
}, 20000);
