import { describe, expect, it, vi } from "vitest";
import { createManualSaveAttempt } from "./manual-save";
import { newGameFixture } from "./testing/new-game";
import { formalAirpFixture, formalNodeText } from "../game-application/testing/airp-game-fixture";
import { emptySettlementProposal } from "../game-application/airp-settlement/context";
import { emptyUsage } from "../game-application/airp-generation/contracts";

async function fixture(startAt: "hub" | "debug-offline" = "debug-offline") {
  const f = newGameFixture();
  const created = await f.runtime.application.createNewGame({ saveId: "source", epoch: "epoch", clientRequestId: "create", startAt, playerName: "测试旅人" });
  if (!created.ok) throw new Error(created.error.message);
  const loaded = await f.runtime.application.open("source");
  if (!loaded.ok) throw new Error(loaded.error.message);
  return { ...f, source: loaded.record };
}

describe("manual local save", () => {
  it("prepares and saves a validated formal AIRP snapshot that can continue independently", async () => {
    const { runtime, store } = await fixture("hub");
    await runtime.airpGame.forSave("source", 28).sync();
    const opened = await runtime.application.open("source");
    if (!opened.ok) throw new Error(opened.error.message);
    const source = opened.record;
    expect(source).toMatchObject({contentRef: {contentVersion: 28}, airpGame: expect.any(Object)});
    const attempt = createManualSaveAttempt(runtime, source);
    const prepared = await attempt.prepare();
    expect(prepared.record).toMatchObject({schemaVersion: 4, airpDirector: source.schemaVersion === 4 ? source.airpDirector : undefined});
    expect(await store.listSaveIds()).toEqual(["source"]);
    const locator = await attempt.save();
    const copied = await runtime.application.open(locator.saveId);
    if (!copied.ok || copied.record.schemaVersion !== 4 || source.schemaVersion !== 4) throw new Error("Missing formal copy");
    expect(copied.record).toEqual(prepared.record);
    expect(copied.record.snapshot).toEqual(source.snapshot);
    expect(copied.record.originRef).toEqual({kind: "copy", source});
    expect(copied.record.airpGame?.worldHead).toEqual(copied.record.head);
    expect(copied.record.airpGame?.settlement.state.head).toEqual(copied.record.head);
    expect(await runtime.application.dispatch({protocolVersion: 4, saveId: locator.saveId, expectedHead: copied.record.head,
      clientRequestId: "pause-copy", command: {type: "airp-director-pause"}})).toMatchObject({ok: true});
    expect((await runtime.application.open(locator.saveId)).ok).toBe(true);
    expect(attempt.completed).toBe(true);
    expect(await store.listSaveIds()).toHaveLength(2);
    expect(await runtime.application.open("source")).toEqual({ok: true, record: source});
  }, 20000);
  it("preserves a prepared formal expedition and lets the saved copy resume its GM controls", async () => {
    const f = await formalAirpFixture(undefined, 28);
    await f.prepare();
    const source = await f.flow.host.read();
    const locator = await createManualSaveAttempt(f.runtime, source).save();
    const copied = await f.runtime.application.open(locator.saveId);
    if (!copied.ok || copied.record.schemaVersion !== 4) throw new Error("Missing expedition copy");
    expect(copied.record.airpGame?.gm).toEqual(source.airpGame?.gm);
    const resumed = f.runtime.airpGame.forSave(locator.saveId, 28);
    const snapshot = await resumed.gm.read();
    expect(snapshot.ledger.jobs).toEqual(source.airpGame!.gm.jobs);
    const ticket = await resumed.gm.departurePermit(snapshot.ledger.jobs[0].id);
    const current = await resumed.host.read();
    expect(await f.runtime.application.dispatch({protocolVersion: 4, saveId: locator.saveId, expectedHead: current.head,
      clientRequestId: "start-copy", command: {type: "start-expedition", ...ticket.departure}})).toMatchObject({ok: true});
    await resumed.sync();
    expect((await resumed.nodes.read()).program.runId).toBe(ticket.departure.runId);
    expect(await f.runtime.application.open(source.head.saveId)).toEqual({ok: true, record: source});
  }, 30000);
  it("continues a partially read formal scene and prepared settlement across repeated snapshot saves", async () => {
    const f = await formalAirpFixture(undefined, 28);
    const planId = await f.prepare(), ticket = await f.flow.gm.departurePermit(planId);
    await f.send({type: "start-expedition", ...ticket.departure});
    await f.flow.sync();
    const nodeId = (await f.flow.nodes.read()).ledger.jobs[0].id;
    await formalNodeText(f, nodeId);
    await f.flow.nodes.readLine(nodeId, 0);
    const source = await f.flow.host.read();
    const locator = await createManualSaveAttempt(f.runtime, source).save();
    const resumed = f.runtime.airpGame.forSave(locator.saveId, 28);
    await resumed.sync();
    let node = (await resumed.nodes.read()).ledger.jobs.find(job => job.id === nodeId)!;
    expect(node.reads).toHaveLength(1);
    for (let cursor = node.reads.length; cursor < node.text!.lines.length; cursor++) await resumed.nodes.readLine(nodeId, cursor);
    node = (await resumed.nodes.read()).ledger.jobs.find(job => job.id === nodeId)!;
    expect(node.reads).toHaveLength(node.text!.lines.length);
    expect(node.reads[0].saveId).toBe(source.head.saveId);
    expect(node.reads.at(-1)!.saveId).toBe(locator.saveId);
    await resumed.nodes.choose(nodeId, 0);
    const packet = await resumed.nodes.settlementInput(nodeId), taskId = await resumed.settle(nodeId);
    await resumed.settlement.begin(taskId, {id: "settle-copy", model: "test-mock", connectionHash: "3".repeat(64), at: 5});
    await resumed.settlement.result({jobId: taskId, attemptId: "settle-copy", output: JSON.stringify(emptySettlementProposal(packet.input)), usage: emptyUsage(), at: 6});
    expect((await resumed.settlement.read()).ledger.jobs.find(job => job.id === taskId)!.status).toBe("ready");
    const secondSource = await resumed.host.read();
    const secondLocator = await createManualSaveAttempt(f.runtime, secondSource).save();
    const secondResumed = f.runtime.airpGame.forSave(secondLocator.saveId, 28);
    await secondResumed.sync();
    await secondResumed.settlement.apply(taskId);
    await secondResumed.nodes.complete(nodeId);
    expect((await secondResumed.nodes.read()).ledger.jobs.find(job => job.id === nodeId)!.status).toBe("completed");
    expect((await secondResumed.settlement.read()).ledger.receipts).toHaveLength(1);
    expect(await f.runtime.application.open(locator.saveId)).toEqual({ok: true, record: secondSource});
    expect((await f.runtime.application.open(secondLocator.saveId)).ok).toBe(true);
    expect(await f.runtime.application.open(source.head.saveId)).toEqual({ok: true, record: source});
    expect((await f.runtime.application.open(locator.saveId)).ok).toBe(true);
  }, 30000);

  it("creates a validated copy of current chapter-one progress without changing or selecting the original", async () => {
    const { runtime, store, source } = await fixture();
    const exported = await runtime.application.exportSave(source.head.saveId);
    if (!exported.ok) throw new Error(exported.error.message);
    expect(JSON.parse(exported.archive).record).toMatchObject({format: "abyssa-save-pool", version: 1});
    const attempt = createManualSaveAttempt(runtime, source);
    expect(await store.listSaveIds()).toEqual(["source"]);
    const a = attempt.save(), b = attempt.save();
    expect(a).toBe(b);
    const locator = await a;
    expect(attempt.completed).toBe(true);
    expect(await attempt.save()).toEqual(locator);
    expect(await store.listSaveIds()).toHaveLength(2);
    const copied = await runtime.application.open(locator.saveId);
    if (!copied.ok) throw new Error(copied.error.message);
    expect(copied.record.head.epoch).toBe(locator.epoch);
    expect(copied.record.snapshot.campaign).toEqual(source.snapshot.campaign);
    expect(copied.record.contentRef).toEqual(source.contentRef);
    expect(await runtime.application.open("source")).toEqual({ ok: true, record: source });
  });

  it("reuses the request after an ambiguous commit failure, creating only one copy", async () => {
    const { runtime, store, source } = await fixture();
    const original = runtime.application.importSave.bind(runtime.application);
    const importSave = vi.spyOn(runtime.application, "importSave").mockImplementationOnce(async request => {
      await original(request); throw new Error("transport interrupted after commit");
    });
    const attempt = createManualSaveAttempt(runtime, source);
    await expect(attempt.save()).rejects.toThrow("interrupted");
    const first = importSave.mock.calls[0][0];
    const locator = await attempt.save();
    expect(importSave.mock.calls[1][0]).toEqual(first);
    expect(await store.listSaveIds()).toHaveLength(2);
    expect((await runtime.application.open(locator.saveId)).ok).toBe(true);
  });

  it("refuses to save a different head than the progress the player previewed", async () => {
    const { runtime, store, source } = await fixture();
    const attempt = createManualSaveAttempt(runtime, { ...source, head: { ...source.head, revision: source.head.revision + 1 } });
    await expect(attempt.save()).rejects.toThrow("另一页面改变");
    expect(await store.listSaveIds()).toEqual(["source"]);
  });

  it("reports storage errors without claiming that a manual save exists", async () => {
    const { runtime, store, source } = await fixture();
    vi.spyOn(runtime.application, "importSave").mockResolvedValueOnce({ ok: false, error: { code: "storage-quota", path: "store", message: "full" } });
    const attempt = createManualSaveAttempt(runtime, source);
    await expect(attempt.save()).rejects.toThrow("存储空间不足");
    expect(attempt.completed).toBe(false);
    expect(await store.listSaveIds()).toEqual(["source"]);
    await expect(attempt.save()).resolves.toHaveProperty("saveId");
  });
});
