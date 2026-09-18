import { expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { GameStorageError, type AnyGameRecord, type AnyReceipt, type D5Command } from "../index";

async function fixture(startAt: "hub" | "prologue" | "first-morning" | "tutorial" = "hub") {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  let seq = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `time-${++seq}`, newSeed: () => 19, close() {} });
  const read = async (saveId = "time") => {
    const r = await runtime.application.open(saveId);
    if (!r.ok || r.record.schemaVersion !== 4) throw Error(JSON.stringify(r));
    return r.record;
  };
  await runtime.application.createNewGame({ saveId: "time", epoch: "time-epoch", clientRequestId: "create", startAt });
  const send = async (command: D5Command = {type: "advance-phase"}) => runtime.application.dispatch({
    protocolVersion: 4, saveId: "time", expectedHead: (await read()).head, clientRequestId: `time-${++seq}`, command
  });
  return { db, store, runtime, read, send };
}

it("advances exactly one phase, rolls the day, and preserves economy across restore and copy", async () => {
  const f = await fixture(), before = await f.read();
  for (let i = 0; i < 4; i++) expect(await f.send()).toMatchObject({ok: true});
  const after = await f.read();
  expect(after.snapshot.campaign.clock).toEqual({day: 2, phase: "dawn"});
  const {clock: _old, ...oldWorld} = before.snapshot.campaign;
  const {clock: _new, ...newWorld} = after.snapshot.campaign;
  expect(newWorld).toEqual(oldWorld);
  expect(after.facts.at(-1)).toMatchObject({origin: "present", runRef: null, payload: {type: "phase-advanced"}, worldTime: {day: 1, phase: "night"}});
  const exported = await f.runtime.application.exportSave("time");
  if (!exported.ok) throw Error("export");
  const fresh = await fixture();
  // A different local store, with no time save, validates the entire archive.
  fresh.db.records.delete("time");
  expect(await fresh.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect(await fresh.read()).toEqual(after);
  expect(await fresh.runtime.application.importSave({format: "application", archive: exported.archive, saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy"})).toMatchObject({ok: true});
  const copy = await fresh.read("copy");
  expect(copy.snapshot.campaign.clock).toEqual(after.snapshot.campaign.clock);
  expect(await fresh.runtime.application.dispatch({protocolVersion: 4, saveId: "copy", expectedHead: copy.head, clientRequestId: "copy-time", command: {type: "advance-phase"}})).toMatchObject({ok: true});
  expect((await fresh.read("copy")).snapshot.campaign.clock).toEqual({day: 2, phase: "day"});
});

it("deduplicates requests and rejects stale heads without a second tick", async () => {
  const f = await fixture(), before = await f.read();
  const request = {protocolVersion: 4, saveId: "time", expectedHead: before.head, clientRequestId: "one-tick", command: {type: "advance-phase"}};
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ok: true});
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ok: true, replayed: true});
  expect(await f.runtime.application.dispatch({...request, clientRequestId: "stale"})).toMatchObject({ok: false, error: {code: "conflict"}});
  expect((await f.read()).snapshot.campaign.clock).toEqual({day: 1, phase: "day"});
});

it.each(["before", "after"])("recovers a save failure %s commit with one durable tick", async when => {
  const f = await fixture(), before = await f.read(), commit = f.store.commit.bind(f.store);
  const request = {protocolVersion: 4, saveId: "time", expectedHead: before.head, clientRequestId: "recover-tick", command: {type: "advance-phase"}};
  let armed = true;
  f.store.commit = async proposal => {
    if (!armed) return commit(proposal);
    armed = false;
    if (when === "after") await commit(proposal);
    throw new GameStorageError("storage-unavailable", "injected");
  };
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ok: false});
  expect((await f.read()).snapshot.campaign.clock.phase).toBe(when === "after" ? "day" : "dawn");
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ok: true});
  expect((await f.read()).snapshot.campaign.clock).toEqual({day: 1, phase: "day"});
});

it.each(["prologue", "first-morning", "tutorial"] as const)("cannot bypass %s by waiting", async startAt => {
  const f = await fixture(startAt), before = await f.read();
  expect(f.runtime.queries.mansionTime(before)?.blocked).toBeTruthy();
  expect(await f.send()).toMatchObject({ok: false, error: {code: "command-not-available"}});
  expect(await f.read()).toEqual(before);
});

it("rejects forged time and extra target-phase fields", async () => {
  const f = await fixture(); await f.send();
  const r = await f.read();
  expect(await f.runtime.application.dispatch({protocolVersion: 4, saveId: "time", expectedHead: r.head, clientRequestId: "jump", command: {type: "advance-phase", day: 10}})).toMatchObject({ok: false});
  for (const field of ["snapshot", "fact"] as const) {
    const forged = structuredClone(r);
    if (field === "snapshot") forged.snapshot.campaign.clock.day = 10;
    else forged.facts.at(-1)!.worldTime.phase = "night";
    f.db.records.set("time", forged);
    expect(await f.runtime.application.open("time")).toMatchObject({ok: false});
  }
});
