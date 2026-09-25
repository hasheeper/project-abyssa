import { FACILITIES_CATALOG } from "../../game-runtime/facilities-context";
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
  it.each<GameStartPoint>(["prologue", "first-morning", "tutorial", "hub", "debug-shop"])("keeps the named %s start through replay, backup recovery and copy", async startAt => {
    const f = fixture(), request = {...f.request, startAt, playerName: "林恩"};
    expect(await f.runtime.application.createNewGame(request)).toMatchObject({ok: true});
    const record = await f.read();
    expect(record.snapshot.campaign.playerName).toBe("林恩");
    expect(record.facts.at(-1)).toMatchObject({payload: {type: "game-start-selected", startAt, playerName: "林恩"}});
    expect(await f.makeRuntime().application.open(f.request.saveId)).toEqual({ok: true, record});
    expect(await f.runtime.application.createNewGame(request)).toMatchObject({ok: true, replayed: true});
    expect(await f.runtime.application.createNewGame({...request, playerName: "另一个名字"})).toMatchObject({ok: false, error: {code: "request-id-reused"}});
    expect(await f.read()).toEqual(record);
    const archive = await f.runtime.application.exportSave(f.request.saveId);
    if (!archive.ok) throw Error("export");
    const recovery = fixture();
    expect(await recovery.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
    expect(await recovery.read()).toEqual(record);
    const copied = await f.runtime.application.importSave({saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", archive: archive.archive});
    if (startAt === "prologue" || startAt === "first-morning") {
      // Existing active-story copy protection remains; exact backup recovery above is permitted.
      expect(copied).toMatchObject({ok: false, error: {code: "run-active"}});
    } else {
      expect(copied).toMatchObject({ok: true});
      expect((await f.read("copy")).snapshot.campaign.playerName).toBe("林恩");
    }
  });

  it("rejects invalid names before creating any save", async () => {
    const f = fixture();
    for (const playerName of ["", " 林恩 ", "{{user}}", "一二三四五六七八九十一二三"]) {
      expect(await f.runtime.application.createNewGame({...f.request, startAt: "hub", playerName})).toMatchObject({ok: false});
      expect(f.db.records.size).toBe(0);
    }
  });

  it("creates a rewarded debug save with the normal once-only SHOP scene and no fabricated tutorial clear", async () => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "debug-shop"})).toMatchObject({ok: true});
    const before = await f.read(), c = before.snapshot.campaign;
    expect(c.prologue?.status).toBe("skipped");
    expect(c.opening?.status).toBe("skipped");
    expect(c.tutorial).toEqual({status: "exempt", reason: "player-skipped"});
    expect(c.settlements).toEqual([]);
    expect(before.snapshot.run).toBeNull();
    expect(c.funds.party).toBe(4400);
    expect(c.supplies.map(s => [s.definitionId, s.charges])).toEqual([["item.food", 3], ["item.potion", 2]]);
    expect(c.loot).toHaveLength(4);
    expect(f.runtime.queries.startReward(before)).toMatchObject({gold: 4400});
    expect(f.runtime.queries.shop(before)?.introduction).toMatchObject({step: 0, lastStep: 3});
    for (let step = 0; step <= 3; step++) {
      expect(await f.send({type: "advance-shop-introduction", shopId: "shop.mansion", step, choice: "continue"})).toMatchObject({ok: true});
    }
    const after = await f.read();
    expect(after.snapshot.campaign.shopIntroduction).toEqual({step: 3, status: "viewed"});
    expect(f.runtime.queries.shop(after)?.introduction).toBeNull();
    expect(after.snapshot.campaign.funds).toEqual(c.funds);
    expect(after.snapshot.campaign.loot).toEqual(c.loot);
    expect(await f.makeRuntime().application.open(f.request.saveId)).toEqual({ok: true, record: after});
    expect(await f.send({type: "select-game-start", startAt: "debug-shop"})).toMatchObject({ok: false, error: {code: "command-not-available"}});
  });

  it("rejects the debug start on content without a first SHOP scene", async () => {
    const f = fixture();
    await f.runtime.application.create({...f.runtime.defaultCreation, ...f.request, contentVersion: 15});
    const before = await f.read();
    expect(await f.send({type: "select-game-start", startAt: "debug-shop"})).toMatchObject({ok: false, error: {code: "content-unavailable"}});
    expect(await f.read()).toEqual(before);
  });

  it.each<GameStartPoint>(["prologue", "first-morning", "tutorial", "hub"])("durably starts at %s with only the authorized skip reward", async startAt => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt})).toMatchObject({ok: true});
    const record = await f.read(), c = record.snapshot.campaign;
    expect(record.head.revision).toBe(1);
    expect(record.contentRef.contentVersion).toBe(25);
    expect(c.loot).toHaveLength(startAt === "hub" ? 4 : 0);
    expect(c.funds.party).toBe(startAt === "hub" ? 4400 : 0);
    expect(c.supplies.map(s => [s.definitionId, s.charges])).toEqual(startAt === "hub" ? [["item.food", 3], ["item.potion", 2]] : []);
    if (startAt === "hub") {
      expect(c.loot![0]).toMatchObject({source: "tutorial-skip", definitionId: "loot.tutorial.cross-coins", resultId: "known.cross-coins"});
      expect(c.loot![0].runId).toBeUndefined();
      expect(c.startReward).toMatchObject({id: record.facts.at(-1)!.id, gold: 4400, supplies: c.supplies, loot: c.loot});
    } else expect(c.startReward).toBeUndefined();
    expect(c.lootTrades).toEqual([]);
    expect(record.facts.at(-1)).toMatchObject({kind: "progression", origin: "present", payload: {type: "game-start-selected", startAt}});
    expect(c.prologue?.status).toBe(startAt === "prologue" ? "playing" : "skipped");
    expect(c.opening?.status).toBe(["prologue", "first-morning"].includes(startAt) ? "playing" : "skipped");
    expect(c.opening?.choices).toEqual([]);
    expect(c.shopIntroduction).toEqual({step: 0, status: startAt === "hub" ? "exempt" : "pending"});
    expect(f.runtime.queries.shop(record)?.introduction).toBeNull();
    expect(c.tutorial).toEqual(startAt === "hub" ? {status: "exempt", reason: "player-skipped"} : {status: "pending"});
    const {prologue: _p, opening: _o, tutorial: _t, funds: _f, supplies: _s, loot: _l, startReward: _r, shopIntroduction: _si, shop: _shop, facilities: _facilities, ...world} = c;
    const {prologue: _ip, opening: _io, tutorial: _it, funds: _if, supplies: _is, loot: _il, shopIntroduction: _isi, shop: _initialShop, facilities: _initialFacilities, ...initial} = initialD5Projection(FACILITIES_CATALOG);
    expect(c.shop).toMatchObject({day: 1, offers: [], purchases: {}});
    expect(world).toEqual(initial);
    expect(!!c.facilities).toBe(startAt === "hub");
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

  it("starts the fixed tutorial normally and permits a hub departure from real stock", async () => {
    for (const startAt of ["tutorial", "hub"] as const) {
      const f = fixture(), spec = GUIDED_TIDE_CATALOG.data.tutorial!;
      await f.runtime.application.createNewGame({...f.request, startAt});
      expect(await f.send({type: "start-expedition", runId: "first-run", routeId: startAt === "tutorial" ? spec.routeId : "old-manor.first-clear",
        partyIds: spec.partyIds, itemIds: spec.itemIds, ...(startAt === "hub" ? {supplyQuantities: {"item.food": 3, "item.potion": 2}} : {}), seed: 19})).toMatchObject({ok: true});
      const r = await f.read();
      expect(r.snapshot.campaign.settlements).toEqual([]);
      expect(r.snapshot.campaign.funds.party).toBe(startAt === "hub" ? 4400 : 0);
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
    expect(copy.snapshot.campaign.funds.party).toBe(4400);
    expect(copy.snapshot.campaign.loot).toHaveLength(4);
    expect(fresh.runtime.queries.startReward(copy)).toBeNull();
  });

  it.each([11, 12, 13, 14])("preserves the reward-free skip in published content %s", async contentVersion => {
    const f = fixture();
    await f.runtime.application.create({...f.runtime.defaultCreation, ...f.request, contentVersion});
    expect(await f.send({type: "select-game-start", startAt: "hub"})).toMatchObject({ok: true});
    const record = await f.read();
    expect(record.snapshot.campaign.funds.party).toBe(0);
    expect(record.snapshot.campaign.supplies).toEqual([]);
    expect(record.snapshot.campaign.startReward).toBeUndefined();
    expect(await f.makeRuntime().application.open(f.request.saveId)).toEqual({ok: true, record});
  });

  it("appraises and sells the starter curio while preserving the original receipt across replay", async () => {
    const f = fixture(), request = {...f.request, startAt: "hub" as const};
    await f.runtime.application.createNewGame(request);
    const before = await f.read(), c = before.snapshot.campaign;
    expect(f.runtime.queries.startReward(before)).toMatchObject({gold: 4400});
    const quote = {shopId: "shop.mansion", instanceId: c.loot!.find(item => item.definitionId === "loot.tutorial.barrier-nail")!.instanceId, quoteVersion: 2};
    expect(await f.send({type: "appraise-loot", ...quote})).toMatchObject({ok: true});
    expect((await f.read()).snapshot.campaign.funds.party).toBe(4400);
    expect((await f.read()).snapshot.campaign.startReward).toEqual(c.startReward);
    expect(await f.send({type: "sell-loot", ...quote})).toMatchObject({ok: true});
    expect(await f.runtime.application.createNewGame(request)).toMatchObject({ok: true, replayed: true});
    const after = await f.read();
    expect(after.snapshot.campaign.funds.party).toBe(4900);
    expect(after.snapshot.campaign.loot).toHaveLength(3);
    expect(after.snapshot.campaign.startReward).toEqual(c.startReward);
    expect(f.runtime.queries.startReward(after)).toBeNull();
    expect(after.snapshot.campaign.settlements).toEqual([]);
    expect(await f.makeRuntime().application.open(f.request.saveId)).toEqual({ok: true, record: after});
    const forged = structuredClone(after);
    forged.snapshot.campaign.startReward!.gold += 100;
    f.db.records.set(f.request.saveId, forged);
    expect(await f.runtime.application.open(f.request.saveId)).toMatchObject({ok: false});
  });

  it.each([["hub", "before"], ["hub", "after"], ["debug-shop", "before"], ["debug-shop", "after"]] as const)("recovers the same %s save when selection write fails %s commit", async (startAt, when) => {
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
    expect(await f.runtime.application.createNewGame({...f.request, startAt, playerName: "林恩"})).toMatchObject({ok: false});
    expect((await f.read()).head.revision).toBe(when === "after" ? 1 : 0);
    expect(await f.makeRuntime().application.createNewGame({...f.request, startAt, playerName: "林恩"})).toMatchObject({ok: true});
    expect((await f.read()).head.revision).toBe(1);
    expect((await f.read()).snapshot.campaign.playerName).toBe("林恩");
    expect(f.db.records.size).toBe(1);
    expect((await f.read()).snapshot.campaign.funds.party).toBe(4400);
    expect((await f.read()).snapshot.campaign.loot).toHaveLength(4);
    expect((await f.read()).snapshot.campaign.supplies).toHaveLength(2);
    expect((await f.read()).snapshot.campaign.shopIntroduction?.status).toBe(startAt === "debug-shop" ? "pending" : "exempt");
  });
});
