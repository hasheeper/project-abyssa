import type { AnyGameRecord, AnyReceipt } from "../index";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts/d5";
import type { D5JourneyOperation } from "../../game-core/session/d5-expedition";
import { canonicalJson } from "../../game-core/contracts/validation";
import { sha256 } from "../../game-core/contracts/sha256";
import { g1Snapshot, type G1TraceRow } from "../../game-core/session/testing/tide-guided-g1";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { GameStorageError } from "../contracts";
import { G2_CONTENT_DIGEST, G2_STANDARD_OPERATION_DIGEST } from "../../game-core/session/testing/tide-guided-g2";

export const g2RunRef = {kind: "expedition" as const, id: "g2-run"};
export function g2Command(operation: D5JourneyOperation): D5Command {
  const runRef = g2RunRef;
  switch (operation.type) {
    case "resume": return {type: "resume-run", runRef};
    case "advance": return {type: "advance-room", runRef, roomId: operation.roomId};
    case "battle": return operation.command.type === "undo" ? {type: "undo", runRef} : {type: "battle-command", runRef, command: operation.command};
    case "item": return {type: "use-item", runRef, instanceId: operation.instanceId, target: operation.target};
    case "event": return {type: "choose-event", runRef, roomId: operation.roomId, choiceId: operation.choice, actorId: operation.actorId};
    case "exit": return {type: "choose-exit", runRef, roomId: operation.roomId, choice: operation.choice};
    default: return {...operation, runRef};
  }
}
function check(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }

/** Disposable storage only. Snapshots are observations, never shortcuts around commands. */
export class G2ApplicationHarness {
  db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  store = new MemoryGameStore(this.db);
  runtime;
  readonly saveId = "g2-original";
  index = 0;
  constructor(readonly catalog: ValidatedD5Catalog) { this.runtime = createVersionedGameRuntime(this.store, [{version: 4, catalog}]); }
  raw() { return structuredClone(this.db.records.get(this.saveId)!) as D5GameRecord; }
  state() { const run = this.raw().snapshot.run; if (run?.kind !== "expedition") throw Error("Missing G2 expedition"); return run.state; }
  async send(command: D5Command) {
    const request = {protocolVersion: 4, saveId: this.saveId, expectedHead: this.raw().head, clientRequestId: `g2:${++this.index}`, command};
    // In-memory promises resolve synchronously; give test/report observers an event-loop turn.
    if (this.index % 16 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    const result = await (command.type === "resume-run" ? this.runtime.resume(request) : this.runtime.dispatch(request));
    return {request, result};
  }
  async commit(command: D5Command) {
    const sent = await this.send(command);
    check(sent.result.ok, `G2 application rejected ${JSON.stringify(command)}: ${JSON.stringify(sent.result)}`);
    return sent;
  }
  async create(start = true) {
    const created = await this.runtime.create({contentRef: this.catalog.ref, request: {protocolVersion: 4, saveId: this.saveId, epoch: "g2", clientRequestId: "create", profileId: this.catalog.data.journey!.defaultProfileId}});
    check(created.ok, "G2 create failed");
    await this.commit({type: "complete-prologue", shotId: "A1-01", choice: "skip"});
    for (let step = 0; step <= this.catalog.data.opening!.lastStep; step++)
      await this.commit({type: "advance-opening", step, choice: this.catalog.data.opening!.choiceSteps.includes(step) ? "A" : "continue"});
    if (start) {
      const spec = this.catalog.data.tutorial!;
      await this.commit({type: "start-expedition", runId: g2RunRef.id, routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
    }
  }
  async recover() {
    const original = this.raw(), oldDb = this.db;
    const archive = await this.runtime.exportSave(this.saveId); check(archive.ok, "G2 export failed");
    this.db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(); this.store = new MemoryGameStore(this.db);
    this.runtime = createVersionedGameRuntime(this.store, [{version: 4, catalog: this.catalog}]);
    const copied = await this.runtime.importSave({contentRef: this.catalog.ref, request: {protocolVersion: 4, saveId: "g2-copy", epoch: "copy", clientRequestId: "copy", archive: archive.archive}});
    check(!copied.ok && copied.error.code === "run-active", "Active AIRP copy restriction changed");
    const restored = await this.runtime.restoreSave({archive: archive.archive, clientRequestId: `restore:${this.index}`});
    check(restored.ok, `G2 recovery failed: ${JSON.stringify(restored)}`);
    const opened = await this.runtime.open(this.saveId);
    check(opened.ok && canonicalJson(opened.record) === canonicalJson(original), "G2 recovery changed identity or state");
    return {archive: archive.archive, original, oldDb};
  }
}

export async function replayG2Application(catalog: ValidatedD5Catalog, tape: G1TraceRow[]) {
  check(catalog.ref.digest === G2_CONTENT_DIGEST && sha256(canonicalJson(tape.map(t => t.operation))) === G2_STANDARD_OPERATION_DIGEST, "Frozen G2 content/operation tape changed; explicitly re-audit the release");
  const h = new G2ApplicationHarness(catalog); await h.create();
  const checkpoints: Record<string, D5GameRecord> = {};
  const recoveries: {label: string; archive: string; original: D5GameRecord; oldDb: typeof h.db}[] = [];
  let eventRetried = false, staleTabRejected = false, prematureClaimRejected = false, storageRollback = false;
  for (const row of tape) {
    const before = h.state();
    check(canonicalJson(g1Snapshot(before)) === canonicalJson(row.before), `G2 before mismatch ${row.label}`);
    if (row.operation.type === "resume") check(h.runtime.queries.continuation(h.raw())?.command.type === "resume-run", "Guide blocked internal resume query");
    if (before.node === "finished" && !prematureClaimRejected) {
      const denied = await h.send({type: "settle-expedition", runRef: g2RunRef, terminalRef: before.result.id});
      check(!denied.result.ok, "Premature claim accepted"); prematureClaimRejected = true;
    }
    const command = g2Command(row.operation);
    let sent: Awaited<ReturnType<typeof h.commit>>;
    if (row.label === "E1.attempt") {
      const saved = h.raw(), commit = h.store.commit.bind(h.store);
      h.store.commit = async () => { throw new GameStorageError("storage-quota", "G2 injected failure"); };
      const failed = await h.send(command);
      check(!failed.result.ok && failed.result.error.code === "storage-quota" && canonicalJson(h.raw()) === canonicalJson(saved), "Event failure was not atomic");
      h.store.commit = commit;
      const result = await h.runtime.dispatch(failed.request); check(result.ok, "Failed event could not retry");
      sent = {request: failed.request, result}; storageRollback = true;
    } else sent = await h.commit(command);
    check(canonicalJson(g1Snapshot(h.state())) === canonicalJson(row.after), `G2 after mismatch ${row.label}`);
    if (row.label === "E1.attempt") {
      const repeated = await h.runtime.dispatch(sent.request);
      check(repeated.ok && repeated.replayed && h.state().run.eventRng.cursor === 1, "Duplicate event consumed another draw"); eventRetried = true;
      const secondTab = createVersionedGameRuntime(new MemoryGameStore(h.db), [{version: 4, catalog}]);
      const stale = await secondTab.dispatch({...sent.request, clientRequestId: "g2:stale-tab"});
      check(!stale.ok && stale.error.code === "conflict", "Stale event tab was accepted"); staleTabRejected = true;
    }
    if (row.label === "E1.enter" || row.label === "E1.attempt" || h.state().node === "finished" && before.node !== "finished" || h.state().tutorial!.stage === "claimable") {
      const label = row.label === "E1.enter" ? "event-before" : row.label === "E1.attempt" ? "event-after" : h.state().tutorial!.stage === "claimable" ? "claimable" : "boss-after";
      checkpoints[label] = h.raw(); recoveries.push({label, ...await h.recover()});
    }
    if (row.label === "T2.R2.guard-bow" && row.operation.type === "battle") checkpoints.guard = h.raw();
  }
  const before = h.raw(), state = h.state(), terminal = state.result!;
  check(state.tutorial!.stage === "claimable" && before.snapshot.campaign.funds.party === 0 && before.snapshot.campaign.clock.phase === "dawn", "Claim occurred automatically");
  check(h.runtime.queries.continuation(before) === null, "Claim should remain manual");
  const claim = {type: "settle-expedition" as const, runRef: g2RunRef, terminalRef: terminal.id};
  const commit = h.store.commit.bind(h.store);
  h.store.commit = async () => { throw new GameStorageError("storage-quota", "G2 claim failure"); };
  const failed = await h.send(claim);
  check(!failed.result.ok && canonicalJson(h.raw()) === canonicalJson(before), "Claim failure changed state"); h.store.commit = commit;
  check((await h.runtime.dispatch(failed.request)).ok, "Claim retry failed");
  const repeated = await h.runtime.dispatch(failed.request); check(repeated.ok && repeated.replayed, "Claim not idempotent");
  check(!(await h.send(claim)).result.ok, "Claim paid twice");
  const final = h.raw(), campaign = final.snapshot.campaign;
  check(campaign.funds.party === 44 && campaign.clock.day === 1 && campaign.clock.phase === "day" && campaign.settlements.length === 1, "G2 accounting mismatch");
  check(campaign.tutorial?.status === "completed" && canonicalJson(campaign.tutorial.cargoIds) === canonicalJson(catalog.data.tutorial!.reward.cargoIds), "Missing cargo facts");
  check(campaign.growthGrants.length === 0 && campaign.inventory.length === 0 && campaign.manor.takeover === null && campaign.chapterClaim === null, "Unrelated rewards leaked");
  for (const recovery of recoveries) check(canonicalJson(recovery.oldDb.records.get(h.saveId)) === canonicalJson(recovery.original), "Source changed after recovery");
  const stale = await h.runtime.restoreSave({archive: recoveries[0].archive, clientRequestId: "stale-restore"});
  check(!stale.ok && stale.error.code === "conflict", "Stale archive overwrote newer progress");
  return {checkpoints, final, report: {contentRef: catalog.ref, operationCount: tape.length, operationDigest: sha256(canonicalJson(tape.map(t => t.operation))),
    steps: state.tutorial!.guide!.cursor, recoveredAt: recoveries.map(r => r.label), eventRetried, staleTabRejected, storageRollback, prematureClaimRejected,
    activeCopyRejected: true, staleRestoreRejected: true, sourceUntouched: true, duplicateClaimRejected: true,
    roomCount: terminal.completion!.roomIds.length, encounterCount: terminal.completion!.encounterIds.length,
    terminalGold: terminal.totalGold, rewardGold: 8, paidGold: campaign.funds.party, clock: campaign.clock, supplies: campaign.supplies, cargoIds: campaign.tutorial!.cargoIds}};
}
