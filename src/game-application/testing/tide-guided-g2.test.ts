import { beforeAll, expect, it } from "vitest";
import { validateD5Catalog } from "../../game-core/contracts/d5-validation";
import { GUIDED_TIDE_CATALOG_DATA } from "../../content/gameplay/demo-v11/content";
import { AIRP_POOL_CATALOG_DATA } from "../../content/gameplay/demo-v9/content";
import { G2Recorder, g2Next } from "../../game-core/session/testing/tide-guided-g2";
import { D5_RUN_READERS } from "../../game-core/session";
import { validateD5Record } from "../versions/d5-validate";
import { deriveD5Baseline } from "../versions/d5-lineage";
import { g2Command, g2RunRef, G2ApplicationHarness, replayG2Application } from "./tide-guided-g2-playthrough";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import type { D5GameRecord } from "../versions/d5-contracts";

const catalog = validateD5Catalog(GUIDED_TIDE_CATALOG_DATA);
let result: Awaited<ReturnType<typeof replayG2Application>>;
beforeAll(async () => {
  const core = new G2Recorder(catalog).until(s => s.tutorial!.stage === "claimable");
  result = await replayG2Application(catalog, core.trace);
}, 90_000);
function restored(record: D5GameRecord) {
  const h = new G2ApplicationHarness(catalog); h.index = 5000;
  h.db.records.set(h.saveId, structuredClone(record));
  return h;
}

it("commits and recovers the five-room journey with atomic event/claim retries and stale-tab rejection", () => {
  expect(result.report).toMatchObject({recoveredAt: ["event-before", "event-after", "boss-after", "claimable"],
    roomCount: 5, encounterCount: 4, eventRetried: true, staleTabRejected: true, storageRollback: true,
    activeCopyRejected: true, staleRestoreRejected: true, sourceUntouched: true, duplicateClaimRejected: true,
    prematureClaimRejected: true, terminalGold: 36, rewardGold: 8, paidGold: 44, clock: {day: 1, phase: "day"}});
  expect(result.report.supplies.map(s => [s.definitionId, s.charges])).toEqual([["item.food",3],["item.potion",2]]);
  expect(validateD5Record(result.final, catalog, D5_RUN_READERS)).toEqual(result.final);
}, 20_000);

it("replays real facts to reject otherwise well-shaped forged guide and event snapshots", () => {
  const original = result.checkpoints["event-after"];
  for (const change of [
    (r: D5GameRecord) => { if (r.snapshot.run?.kind === "expedition") r.snapshot.run.state.tutorial!.guide!.proofs[0].eventIds = ["g2-run:event:1"]; },
    (r: D5GameRecord) => { if (r.snapshot.run?.kind === "expedition") r.snapshot.run.state.tutorial!.checkpoint.state.run.party[0].hp = 1; },
    (r: D5GameRecord) => { const f = r.facts.find(f => f.kind === "journey" && f.payload.operation.type === "event")!; if (f.kind === "journey") f.payload.events[0].actorId = "kael"; },
    (r: D5GameRecord) => { if (r.snapshot.run?.kind === "expedition") { const g = r.snapshot.run.state.tutorial!.guide!; g.mode = "free"; g.reason = "exited"; g.exitEventId = "g2-run:event:1"; } },
  ]) { const forged = structuredClone(original); change(forged); expect(() => validateD5Record(forged, catalog, D5_RUN_READERS)).toThrow(); }
}, 20_000);

it("retracts the real guard and guide proof together, and preserves exit through application UNDO", async () => {
  const h = restored(result.checkpoints.guard), before = h.state();
  await h.commit({type: "undo", runRef: g2RunRef});
  expect(h.state().tutorial!.guide!.cursor).toBe(before.tutorial!.guide!.cursor - 1);
  expect(h.state().encounter!.enemies[1].intent!.blocked).toBe(0);
  await h.commit(g2Command(g2Next(catalog, h.state())!));
  await h.commit({type: "tutorial-guide", planId: "tide.guide.v1", attempt: 1, mode: "free", runRef: g2RunRef});
  await h.commit({type: "undo", runRef: g2RunRef});
  expect(h.state().tutorial!.guide).toMatchObject({mode: "free", reason: "exited"});
  expect(h.raw().retractedFactIds.length).toBeGreaterThan(0);
  expect(validateD5Record(h.raw(), catalog, D5_RUN_READERS)).toEqual(h.raw());
}, 20_000);

it("lets an explicitly free run skip E1 and legitimately claim without completing the guide", async () => {
  const h = restored(result.checkpoints["event-before"]);
  await h.commit({type: "tutorial-guide", planId: "tide.guide.v1", attempt: 1, mode: "free", runRef: g2RunRef});
  for (let i = 0; i < 500 && h.state().tutorial!.stage !== "claimable"; i++) await h.commit(g2Command(g2Next(catalog, h.state())!));
  expect(h.state().tutorial!.guide!.reason).toBe("exited");
  expect(h.state().run.eventResults[0].method).toBe("skip");
  expect(h.state().run.eventRng.cursor).toBe(0);
  await h.commit({type: "settle-expedition", runRef: g2RunRef, terminalRef: h.state().result!.id});
  expect(h.raw().snapshot.campaign.tutorial!.status).toBe("completed");
}, 60_000);

it("projects E1 as a readable event, counts battles independently, and supports the G3 new-game default", async () => {
  const h = restored(result.checkpoints["event-before"]), q = h.runtime.queries;
  expect(q.tutorial(h.raw())).toMatchObject({encounter: null, node: {roomId: "room.tide-cave.event.intro", battle: null}, guide: {operation: {type: "event", actorId: "elora"}}});
  expect(q.journey(h.raw())).toMatchObject({eventRevealed: true, fullManor: false, event: {id: "event.tide-cave.cache", cost: 0, reward: 0}});
  expect(q.tutorial(result.checkpoints["boss-after"])).toMatchObject({encounter: 4, guide: {mode: "free", operation: null}});
  expect(q.tutorial(result.checkpoints.claimable)?.canClaim).toBe(true);
  const player = createPlayerRuntime(h.store, {newId: () => "id", newSeed: () => 1, close: () => {}});
  expect(player.defaultCreation.contentVersion).toBe(21);
  expect(await player.application.create({protocolVersion: 4, contentVersion: 11, saveId: "explicit-v11", epoch: "new", clientRequestId: "create", profileId: catalog.data.journey!.defaultProfileId})).toMatchObject({ok: true});
  const opened = await player.application.open("explicit-v11");
  expect(opened).toMatchObject({ok: true, record: {contentRef: {contentVersion: 11}}});
}, 30_000);

it("replays a real T3 wipe and retry while retaining E1, resource checkpoint and exit preference", async () => {
  const h = restored(result.checkpoints["event-after"]);
  await h.commit(g2Command(g2Next(catalog, h.state())!)); // Observe the real result.
  await h.commit(g2Command(g2Next(catalog, h.state())!)); // Enter T3.
  const checkpoint = h.state().tutorial!.checkpoint.state;
  await h.commit({type: "tutorial-guide", planId: "tide.guide.v1", attempt: 1, mode: "free", runRef: g2RunRef});
  for (let i = 0; i < 250 && h.state().tutorial!.stage !== "failed"; i++) {
    const e = h.state().encounter!;
    await h.commit(g2Command(e.phase === "roll" ? {type: "battle", command: {type: "roll"}} : e.phase === "act" && e.formation.length ? {type: "battle", command: {type: "end-turn"}} : {type: "resume"}));
  }
  expect(h.state().tutorial!.stage).toBe("failed");
  expect(h.raw().snapshot.campaign.settlements).toEqual([]);
  const retried = await h.commit({type: "tutorial-retry", runRef: g2RunRef, scope: "encounter", attempt: 1});
  expect(await h.runtime.dispatch(retried.request)).toMatchObject({ok: true, replayed: true});
  expect(h.state().tutorial).toMatchObject({attempt: 2, guide: {reason: "exited", mode: "free"}});
  expect(h.state().run.rng).toEqual(checkpoint.run.rng);
  expect(h.state().run.eventResults).toEqual(checkpoint.run.eventResults);
  expect(h.state().run.eventRng.cursor).toBe(1);
  expect(h.state().run.supplies).toEqual(checkpoint.run.supplies);
  expect(validateD5Record(h.raw(), catalog, D5_RUN_READERS)).toEqual(h.raw());
}, 60_000);

it("does not advertise or allow upgrading old saves into the new-game-only guided release", async () => {
  const old = validateD5Catalog(AIRP_POOL_CATALOG_DATA), h = new G2ApplicationHarness(old); await h.create(false);
  const runtime = createVersionedGameRuntime(h.store, [{version: 4, catalog: old}, {version: 4, catalog}]);
  const listed = await runtime.list();
  expect(listed).toMatchObject({ok: true, saves: [{continuation: {upgrade: false}}]});
  for (const kind of ["upgrade", "cycle"] as const) expect(() => deriveD5Baseline(catalog, h.raw(), kind)).toThrow(/supports new saves/);
}, 30_000);
