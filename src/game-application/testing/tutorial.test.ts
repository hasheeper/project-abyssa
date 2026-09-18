import { beforeAll, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { GameStorageError } from "../contracts";
import { createD5Application } from "../versions/d5-service";
import { validateD5Record } from "../versions/d5-validate";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import { validateD5Catalog } from "../../game-core/contracts";
import { D5_RUN_READERS, d5EventEligibility, type D5JourneyOperation } from "../../game-core/session";
import { tutorialNextOperation } from "../../game-core/session/testing/tutorial-driver";
import { TIDE_CAVE_CATALOG_DATA } from "../../content/gameplay/demo-v7/content";
import { createCatalogRegistry } from "../../game-runtime/catalogs";
import { createVersionedQueries } from "../../game-runtime/versioned-views";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import type { AnyGameRecord, AnyReceipt } from "../index";

const catalog = validateD5Catalog(TIDE_CAVE_CATALOG_DATA), spec = catalog.data.tutorial!;
const runRef = {kind: "expedition" as const, id: "tutorial-run"};
const queries = createVersionedQueries(createCatalogRegistry([{version: 4, catalog}]));
let afterMorning: D5GameRecord;
beforeAll(async () => {
  const db = new MemoryGameDatabase<D5GameRecord, D5Receipt>();
  const app = createD5Application(catalog, new MemoryGameStore(db), D5_RUN_READERS);
  expect(await app.create({protocolVersion: 4, saveId: "tutorial-save", epoch: "epoch", clientRequestId: "create", profileId: catalog.data.journey!.defaultProfileId})).toMatchObject({ok: true});
  let head = db.records.get("tutorial-save")!.head;
  const send = async (command: D5Command, id: string) => {
    const result = await app.dispatch({protocolVersion: 4, saveId: head.saveId, expectedHead: head, clientRequestId: id, command});
    if (!result.ok) throw Error(JSON.stringify(result.error));
    head = result.receipt.after!;
  };
  await send({type: "complete-prologue", shotId: "A1-01", choice: "skip"}, "prologue");
  for (let step = 0; step <= catalog.data.opening!.lastStep; step++) await send({type: "advance-opening", step, choice: catalog.data.opening!.choiceSteps.includes(step) ? "A" : "continue"}, `morning:${step}`);
  afterMorning = structuredClone(db.records.get(head.saveId)!);
}, 30_000);

function fixture() {
  const db = new MemoryGameDatabase<D5GameRecord, D5Receipt>();
  db.records.set(afterMorning.head.saveId, structuredClone(afterMorning));
  const store = new MemoryGameStore(db), app = createD5Application(catalog, store, D5_RUN_READERS);
  let index = 0;
  const raw = () => db.records.get(afterMorning.head.saveId)!;
  const send = async (command: D5Command) => {
    const request = {protocolVersion: 4, saveId: raw().head.saveId, expectedHead: raw().head, clientRequestId: `test:${++index}`, command};
    const result = command.type === "resume-run" ? await app.resumeRun(request) : await app.dispatch(request);
    return {result, request};
  };
  const start = () => send({type: "start-expedition", runId: runRef.id, routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
  const state = () => { const run = raw().snapshot.run; if (run?.kind !== "expedition") throw Error("No run"); return run.state; };
  const step = async (operation: D5JourneyOperation) => {
    const command: D5Command = operation.type === "resume" ? {type: "resume-run", runRef}
      : operation.type === "advance" ? {type: "advance-room", runRef, roomId: operation.roomId}
      : operation.type === "battle" ? operation.command.type === "undo" ? {type: "undo", runRef} : {type: "battle-command", runRef, command: operation.command}
      : operation.type === "item" ? {type: "use-item", runRef, instanceId: operation.instanceId, target: operation.target}
      : operation.type === "tutorial-read" || operation.type === "tutorial-retry" || operation.type === "tutorial-hints" ? {...operation, runRef}
      : (() => {throw Error("Unexpected test operation");})();
    const sent = await send(command);
    if (!sent.result.ok) throw Error(`${JSON.stringify(command)}: ${JSON.stringify(sent.result.error)}`);
    return sent;
  };
  return {db, store, app, raw, send, start, state, step};
}

it("replays all four encounters and atomically claims the return once, without manor/growth grants", async () => {
  const f = fixture();
  expect((await f.start()).result).toMatchObject({ok: true});
  let checkedPrematureClaim = false;
  for (let i = 0; i < 600; i++) {
    const state = f.state();
    if (state.node === "finished" && !checkedPrematureClaim) {
      expect((await f.send({type: "settle-expedition", runRef, terminalRef: state.result.id})).result.ok).toBe(false);
      expect(queries.continuation(f.raw())).toBeNull();
      checkedPrematureClaim = true;
    }
    const operation = tutorialNextOperation(catalog, state, "tactical");
    if (!operation) break;
    await f.step(operation);
  }
  const final = f.state();
  expect(final.tutorial!.stage).toBe("claimable");
  expect(queries.tutorial(f.raw())).toMatchObject({canClaim: true, encounter: 4});
  expect(queries.continuation(f.raw())).toBeNull();
  expect(f.raw().snapshot.campaign.clock).toEqual({day: 1, phase: "dawn"});
  expect(f.raw().snapshot.campaign.funds.party).toBe(0);
  expect(final.result?.completion?.encounterIds).toHaveLength(4);
  const before = structuredClone(f.raw()), commit = f.store.commit.bind(f.store);
  f.store.commit = async () => {throw new GameStorageError("storage-quota", "injected");};
  const failed = await f.send({type: "settle-expedition", runRef, terminalRef: final.result!.id});
  expect(failed.result).toMatchObject({ok: false, error: {code: "storage-quota"}});
  expect(f.raw()).toEqual(before);
  f.store.commit = commit;
  expect(await f.app.dispatch(failed.request)).toMatchObject({ok: true, replayed: false});
  expect(await f.app.dispatch(failed.request)).toMatchObject({ok: true, replayed: true});
  const campaign = f.raw().snapshot.campaign;
  expect(campaign.funds.party).toBe(final.result!.totalGold + 8);
  expect(campaign.clock).toEqual({day: 1, phase: "day"});
  expect(campaign.tutorial).toMatchObject({status: "completed", cargoIds: spec.reward.cargoIds, rewardId: spec.reward.id});
  expect(campaign.settlements).toHaveLength(1);
  expect(campaign.manor).toEqual({takeover: null, story: null});
  expect(campaign.chapterClaim).toBeNull(); expect(campaign.growthGrants).toEqual([]); expect(campaign.inventory).toEqual([]);
  expect(() => d5EventEligibility(catalog, campaign, new Map([[runRef.id, 122]]), catalog.data.progression.gift.eventId, final.result!.id, 1000)).toThrow();
  expect((await f.send({type: "settle-expedition", runRef, terminalRef: final.result!.id})).result.ok).toBe(false);
  expect(validateD5Record(JSON.parse(JSON.stringify(f.raw())), catalog, D5_RUN_READERS)).toEqual(f.raw());
}, 90_000);

it("keeps story/RNG on reopen, rolls back valid lesson proofs, and rejects forged checkpoints", async () => {
  const f = fixture();
  expect((await f.send({type: "start-expedition", runId: "wrong", routeId: catalog.data.manor!.firstClearRouteId, partyIds: spec.partyIds, itemIds: [], seed: 1})).result.ok).toBe(false);
  expect((await f.send({type: "start-expedition", runId: "wrong", routeId: spec.routeId, partyIds: spec.partyIds.slice(0, 3), itemIds: spec.itemIds, seed: 1})).result.ok).toBe(false);
  await f.start();
  expect(queries.continuation(f.raw())).toBeNull();
  const before = structuredClone(f.raw());
  const fresh = createD5Application(catalog, f.store, D5_RUN_READERS);
  expect(await fresh.open(before.head.saveId)).toEqual({ok: true, record: before});
  await f.step({type: "tutorial-read", storyId: "S3-1", step: 0, choice: "continue"});
  const roll = await f.step({type: "battle", command: {type: "roll"}});
  expect(await f.app.dispatch(roll.request)).toMatchObject({ok: true, replayed: true});
  expect(f.state().encounter!.dice.map(d => d.faceIndex! + 1)).toEqual([2, 2, 1, 1, 3]);
  await f.step({type: "battle", command: {type: "toggle-load", actorId: "kael"}});
  await f.step({type: "battle", command: {type: "act", actorId: "kael", choice: "attack", targetId: f.state().encounter!.enemies[0].id}});
  expect(f.state().tutorial!.lessons.map(l => l.kind)).toContain("action");
  await f.step({type: "battle", command: {type: "undo"}});
  expect(f.state().tutorial!.lessons.map(l => l.kind)).not.toContain("action");
  const forged = structuredClone(f.raw());
  if (forged.snapshot.run?.kind !== "expedition") throw Error("No run");
  forged.snapshot.run.state.tutorial!.checkpoint.state.run.party[0].hp = 1;
  expect(() => validateD5Record(forged, catalog, D5_RUN_READERS)).toThrow();
  expect(await fresh.open(before.head.saveId)).toEqual({ok: true, record: f.raw()});

  const original = structuredClone(f.raw());
  const copyDb = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  const runtime = createVersionedGameRuntime(new MemoryGameStore(copyDb), [{version: 4, catalog}]);
  expect(await runtime.importSave({contentRef: catalog.ref, request: {protocolVersion: 4, saveId: "imported", epoch: "imported", clientRequestId: "import", archive: JSON.stringify({archiveVersion: 4, record: original})}})).toMatchObject({ok: true});
  const copy = await runtime.open("imported");
  if (!copy.ok || copy.record.schemaVersion !== 4) throw Error("Import failed");
  expect(copy.record.snapshot).toEqual(original.snapshot);
  expect(await runtime.dispatch({protocolVersion: 4, saveId: "imported", expectedHead: copy.record.head, clientRequestId: "undo-after-import", command: {type: "undo", runRef}})).toMatchObject({ok: true});
  const reopened = await runtime.open("imported");
  if (!reopened.ok || reopened.record.schemaVersion !== 4 || reopened.record.snapshot.run?.kind !== "expedition") throw Error("No copied run");
  expect(reopened.record.snapshot.run.state.tutorial!.lessons.map(l => l.kind)).toEqual(["roll"]);
  expect(reopened.record.snapshot.run.state.run.rng).toEqual(f.state().run.rng);
  expect(f.raw()).toEqual(original);
});

it("holds a failed attempt without settling and restores resources/RNG with a new attempt identity", async () => {
  const f = fixture(); await f.start();
  const entry = structuredClone(f.state().tutorial!.entry);
  for (let i = 0; i < 180 && f.state().tutorial!.stage !== "failed"; i++) {
    const state = f.state();
    const next = state.tutorial!.story ? tutorialNextOperation(catalog, state, "basic")!
      : state.encounter!.phase === "roll" ? {type: "battle" as const, command: {type: "roll" as const}}
      : state.encounter!.phase === "act" ? {type: "battle" as const, command: {type: "end-turn" as const}} : {type: "resume" as const};
    await f.step(next);
  }
  expect(f.state().tutorial!.stage).toBe("failed");
  expect(queries.continuation(f.raw())).toBeNull();
  expect(f.raw().snapshot.campaign.settlements).toEqual([]);
  expect(f.raw().snapshot.campaign.clock).toEqual({day: 1, phase: "dawn"});
  const retry = await f.step({type: "tutorial-retry", attempt: 1, scope: "encounter"});
  expect(await f.app.dispatch(retry.request)).toMatchObject({ok: true, replayed: true});
  expect(f.state().tutorial!.attempt).toBe(2);
  expect({...f.state().run, sequence: entry.run.sequence}).toEqual(entry.run);
  expect(f.state().encounter).toEqual(entry.encounter);
  expect(f.state().tutorial!.lessons).toEqual([]);
  expect((await f.send({type: "tutorial-retry", runRef, attempt: 1, scope: "chapter"})).result.ok).toBe(false);
  expect(validateD5Record(f.raw(), catalog, D5_RUN_READERS)).toEqual(f.raw());
}, 45_000);
