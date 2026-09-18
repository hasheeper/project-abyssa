import { describe, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime, type GameStartPoint } from "../../game-runtime/player-runtime";
import { GUIDED_TIDE_CATALOG } from "../../game-runtime/guided-tide-context";
import { initialD5Projection } from "../../game-core/session";
import { GameStorageError, type AnyGameRecord, type AnyReceipt, type D5Command } from "../index";

function fixture() {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  let seq = 0;
  const makeRuntime = () => createPlayerRuntime(store, {newId: () => `id-${++seq}`, newSeed: () => 19, close() {}});
  const runtime = makeRuntime();
  const request = {saveId: "start-save", epoch: "start-epoch", clientRequestId: "create-start"};
  const read = async (saveId = request.saveId) => {
    const opened = await runtime.application.open(saveId);
    if (!opened.ok || opened.record.schemaVersion !== 4) throw Error(JSON.stringify(opened));
    return opened.record;
  };
  const send = async (command: D5Command) => runtime.application.dispatch({protocolVersion: 4, saveId: request.saveId,
    expectedHead: (await read()).head, clientRequestId: `command-${++seq}`, command});
  return {db, store, runtime, makeRuntime, request, read, send};
}

describe("new-game starting points", () => {
  it.each<GameStartPoint>(["prologue", "first-morning", "tutorial", "hub"])("durably starts at %s without inventing rewards or choices", async startAt => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt})).toMatchObject({ok: true});
    const record = await f.read(), c = record.snapshot.campaign;
    expect(record.head.revision).toBe(1);
    expect(record.facts.at(-1)).toMatchObject({kind: "progression", origin: "present", payload: {type: "game-start-selected", startAt}});
    expect(c.prologue?.status).toBe(startAt === "prologue" ? "playing" : "skipped");
    expect(c.opening?.status).toBe(["prologue", "first-morning"].includes(startAt) ? "playing" : "skipped");
    expect(c.opening?.choices).toEqual([]);
    expect(c.tutorial).toEqual(startAt === "hub" ? {status: "exempt", reason: "player-skipped"} : {status: "pending"});
    const {prologue: _p, opening: _o, tutorial: _t, ...world} = c;
    const {prologue: _ip, opening: _io, tutorial: _it, ...initial} = initialD5Projection(GUIDED_TIDE_CATALOG);
    expect(world).toEqual(initial);
    expect(record.snapshot.run).toBeNull();
    expect(f.runtime.queries.tutorial(record)?.canBegin).toBe(startAt === "tutorial");
    expect(await f.makeRuntime().application.open(f.request.saveId)).toEqual({ok: true, record});
    expect(await f.runtime.application.createNewGame({...f.request, startAt})).toMatchObject({ok: true, replayed: true});
    expect(await f.read()).toEqual(record);
    const archive = await f.runtime.application.exportSave(f.request.saveId);
    if (!archive.ok) throw Error("export");
    const recovery = fixture();
    expect(await recovery.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
    expect(await recovery.read()).toEqual(record);
  });

  it("starts the fixed tutorial normally and permits a hub departure with real allowance", async () => {
    for (const startAt of ["tutorial", "hub"] as const) {
      const f = fixture(), spec = GUIDED_TIDE_CATALOG.data.tutorial!;
      await f.runtime.application.createNewGame({...f.request, startAt});
      expect(await f.send({type: "start-expedition", runId: "first-run", routeId: startAt === "tutorial" ? spec.routeId : "old-manor.first-clear",
        partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19})).toMatchObject({ok: true});
      const r = await f.read();
      expect(r.snapshot.campaign.settlements).toEqual([]);
      expect(r.snapshot.campaign.funds.party).toBe(0);
      expect(r.snapshot.run?.kind).toBe("expedition");
      if (r.snapshot.run?.kind !== "expedition") throw Error("run");
      expect(r.snapshot.run.state.run.supplies).toHaveLength(spec.itemIds.length);
      if (startAt === "tutorial") {
        expect(r.snapshot.run.state.tutorial).toMatchObject({stage: "story", story: {id: "S3-1", step: 0}, guide: {mode: "guided", cursor: 0}});
      } else expect(r.snapshot.run.state.tutorial).toBeUndefined();
    }
  });

  it("rejects retargeting a committed identity and cannot skip later gameplay", async () => {
    const f = fixture();
    await f.runtime.application.createNewGame({...f.request, startAt: "prologue"});
    const before = await f.read();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "hub"})).toMatchObject({ok: false, error: {code: "request-id-reused"}});
    expect(await f.send({type: "select-game-start", startAt: "hub"})).toMatchObject({ok: false, error: {code: "command-not-available"}});
    expect(await f.read()).toEqual(before);
    const forged = structuredClone(before);
    forged.snapshot.campaign.tutorial = {status: "exempt", reason: "player-skipped"};
    f.db.records.set(f.request.saveId, forged);
    expect(await f.runtime.application.open(f.request.saveId)).toMatchObject({ok: false});
  });

  it("keeps older releases unchanged and rejects start selection on copies", async () => {
    const f = fixture();
    await f.runtime.application.create({...f.runtime.defaultCreation, ...f.request, contentVersion: 10});
    const before = await f.read();
    expect(await f.send({type: "select-game-start", startAt: "hub"})).toMatchObject({ok: false, error: {code: "content-unavailable"}});
    expect(await f.read()).toEqual(before);
    const fresh = fixture();
    await fresh.runtime.application.createNewGame({...fresh.request, startAt: "hub"});
    const archive = await fresh.runtime.application.exportSave(fresh.request.saveId);
    if (!archive.ok) throw Error("export");
    expect(await fresh.runtime.application.importSave({saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", archive: archive.archive})).toMatchObject({ok: true});
    const copy = await fresh.read("copy");
    expect(await fresh.runtime.application.dispatch({protocolVersion: 4, saveId: "copy", expectedHead: copy.head,
      clientRequestId: "reskip", command: {type: "select-game-start", startAt: "hub"}})).toMatchObject({ok: false, error: {code: "command-not-available"}});
    expect(await fresh.read("copy")).toEqual(copy);
  });

  it.each(["before", "after"])("recovers the same new save when selection write fails %s commit", async when => {
    const f = fixture(), commit = f.store.commit.bind(f.store);
    let failed = false;
    f.store.commit = async proposal => {
      if (!failed && proposal.candidate?.head.revision === 1) {
        failed = true;
        if (when === "after") await commit(proposal);
        throw new GameStorageError("storage-quota", "injected failure");
      }
      return commit(proposal);
    };
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "hub"})).toMatchObject({ok: false});
    expect((await f.read()).head.revision).toBe(when === "after" ? 1 : 0);
    expect(await f.makeRuntime().application.createNewGame({...f.request, startAt: "hub"})).toMatchObject({ok: true});
    expect((await f.read()).head.revision).toBe(1);
    expect(f.db.records.size).toBe(1);
  });
});
