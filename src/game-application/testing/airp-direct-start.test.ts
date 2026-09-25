import { describe, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { AIRP_DIRECT_CATALOG } from "../../game-runtime/airp-direct-context";
import { COPPER_ECONOMY_CATALOG } from "../../game-runtime/copper-economy-context";
import { validateD5Catalog } from "../../game-core/contracts";
import type { AnyGameRecord, AnyReceipt, D5Command } from "../index";

export function directStartFixture() {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  let seq = 0;
  const runtime = createPlayerRuntime(store, {newId: () => `direct-${++seq}`, newSeed: () => 19, close() {}});
  const request = {saveId: "direct-save", epoch: "direct-epoch", clientRequestId: "direct-create"};
  const read = async () => {
    const opened = await runtime.application.open(request.saveId);
    if (!opened.ok || opened.record.schemaVersion !== 4) throw Error(JSON.stringify(opened));
    return opened.record;
  };
  const send = async (command: D5Command) => runtime.application.dispatch({protocolVersion: 4, saveId: request.saveId,
    expectedHead: (await read()).head, clientRequestId: `direct-command-${++seq}`, command});
  return {db, store, runtime, request, read, send};
}

describe("content18 explicit AIRP start", () => {
  it("replays access without inventing a first clear, acceptance, return or memory", async () => {
    const f = directStartFixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "airp-demo", playerName: "林恩"})).toMatchObject({ok: true});
    const r = await f.read(), c = r.snapshot.campaign;
    expect(r.contentRef).toEqual(AIRP_DIRECT_CATALOG.ref);
    expect(c.airpDemoStart).toEqual({...AIRP_DIRECT_CATALOG.data.airpDirect!.demoStart, claimId: r.facts.at(-1)!.id});
    expect(c.manor).toEqual({takeover: null, story: null});
    expect(c.settlements).toEqual([]);
    expect(c.growthGrants).toEqual([]);
    expect(c.chapterCompletion).toBeNull();
    expect(c.clock).toEqual({day: 1, phase: "dawn"});
    expect(r.snapshot.run).toBeNull();
    expect(r.airpOnline).toBeUndefined();
    expect(r.narrative?.version).toBe(2);
    if (r.narrative?.version !== 2) throw Error("pool");
    expect(r.narrative.memories).toEqual([]);
    const instance = r.narrative.instances.find(i => i.definition.id === "ripple.elora.old-medicine-case");
    expect(instance).toMatchObject({status: "pending", accepted: null, proof: null, binding: null});
    expect(f.runtime.queries.journey(r)?.defaultRouteId).toBe(AIRP_DIRECT_CATALOG.data.manor!.maintenanceRouteId);
    const archive = await f.runtime.application.exportSave(f.request.saveId);
    if (!archive.ok) throw Error("export");
    const recovery = directStartFixture();
    expect(await recovery.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
    expect(await recovery.read()).toEqual(r);
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "airp-demo", playerName: "林恩"})).toMatchObject({ok: true, replayed: true});
    expect(await f.send({type: "begin-memory", chapterId: "chapter.marietta.memory"})).toMatchObject({ok: false});
    expect(await f.send({type: "start-expedition", runId: "patrol", routeId: AIRP_DIRECT_CATALOG.data.manor!.maintenanceRouteId,
      partyIds: AIRP_DIRECT_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19})).toMatchObject({ok: true});
    expect((await f.read()).snapshot.run?.kind).toBe("expedition");
  });

  it("keeps the ordinary default separate and rejects direct capability and start on old content", async () => {
    const f = directStartFixture();
    expect(f.runtime.defaultCreation.contentVersion).toBe(23);
    expect(() => validateD5Catalog({...COPPER_ECONOMY_CATALOG.data, airpDirect: AIRP_DIRECT_CATALOG.data.airpDirect})).toThrow();
    expect(() => validateD5Catalog({...AIRP_DIRECT_CATALOG.data, airpOnline: {version: 1}})).toThrow();
    expect(await f.runtime.application.create({...f.runtime.defaultCreation, ...f.request})).toMatchObject({ok: true});
    expect(await f.send({type: "select-game-start", startAt: "airp-demo"})).toMatchObject({ok: false, error: {code: "content-unavailable"}});
    expect(await f.send({type: "select-game-start", startAt: "hub"})).toMatchObject({ok: true});
    const r = await f.read();
    expect(r.snapshot.campaign.airpDemoStart).toBeUndefined();
    expect(f.runtime.queries.journey(r)?.defaultRouteId).toBe(COPPER_ECONOMY_CATALOG.data.manor!.firstClearRouteId);
    const forged = structuredClone(r);
    forged.snapshot.campaign.airpDemoStart = {...AIRP_DIRECT_CATALOG.data.airpDirect!.demoStart, claimId: r.facts.at(-1)!.id};
    f.db.records.set(r.head.saveId, forged);
    expect(await f.runtime.application.open(r.head.saveId)).toMatchObject({ok: false});
  });
});
