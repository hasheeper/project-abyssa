import type { AnyGameRecord, AnyReceipt } from "../index";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts/d5";
import type { D5JourneyOperation } from "../../game-core/session/d5-expedition";
import { canonicalJson } from "../../game-core/contracts/validation";
import { sha256 } from "../../game-core/contracts/sha256";
import { G1_CONTINUATION_SEED, G1_STANDARD_OPERATION_DIGEST, g1Snapshot, type G1TraceRow } from "../../game-core/session/testing/tide-guided-g1";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";

const runRef = {kind: "expedition" as const, id: "g1-run"};
function commandFor(operation: D5JourneyOperation): D5Command {
  switch (operation.type) {
    case "resume": return {type: "resume-run", runRef};
    case "advance": return {type: "advance-room", runRef, roomId: operation.roomId};
    case "battle": return operation.command.type === "undo" ? {type: "undo", runRef} : {type: "battle-command", runRef, command: operation.command};
    case "item": return {type: "use-item", runRef, instanceId: operation.instanceId, target: operation.target};
    case "tutorial-read": case "tutorial-hints": case "tutorial-retry": return {...operation, runRef};
    default: throw Error("G1 application replay is the existing four-battle route, not G2");
  }
}
function check(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }

/** Real transactions against disposable stores, including identity-preserving archive recovery. */
export async function replayG1Application(catalog: ValidatedD5Catalog, tape: G1TraceRow[], seed = G1_CONTINUATION_SEED) {
  const operationDigest = sha256(canonicalJson(tape.map(t => t.operation)));
  if (seed === G1_CONTINUATION_SEED) check(operationDigest === G1_STANDARD_OPERATION_DIGEST, "Frozen G1 operation tape changed; explicitly re-audit the plan");
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  let store = new MemoryGameStore(db), runtime = createVersionedGameRuntime(store, [{version: 4, catalog}]);
  const saveId = "g1-original";
  let requestIndex = 0;
  const opened = async () => {
    const result = await runtime.open(saveId);
    check(result.ok && result.record.schemaVersion === 4, "G1 could not reopen the D5 archive");
    return result.record;
  };
  const send = async (command: D5Command) => {
    const record = await opened();
    const request = {protocolVersion: 4, saveId, expectedHead: record.head, clientRequestId: `g1:${++requestIndex}`, command};
    const result = await (command.type === "resume-run" ? runtime.resume(request) : runtime.dispatch(request));
    return {request, result};
  };
  const commit = async (command: D5Command) => {
    const sent = await send(command);
    check(sent.result.ok, `Application rejected ${JSON.stringify(command)}: ${JSON.stringify(sent.result)}`);
    return sent;
  };
  const created = await runtime.create({contentRef: catalog.ref, request: {protocolVersion: 4, saveId, epoch: "g1", clientRequestId: "create", profileId: catalog.data.journey!.defaultProfileId}});
  check(created.ok, "Create failed");
  await commit({type: "complete-prologue", shotId: "A1-01", choice: "skip"});
  for (let step = 0; step <= catalog.data.opening!.lastStep; step++)
    await commit({type: "advance-opening", step, choice: catalog.data.opening!.choiceSteps.includes(step) ? "A" : "continue"});
  const spec = catalog.data.tutorial!;
  await commit({type: "start-expedition", runId: runRef.id, routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed});
  let sourceAtRestore: D5GameRecord | null = null, restoredAt = "", rejectedPremature = false, replayedReroll = false;
  let recoveryArchive = "";
  for (const row of tape) {
    const before = await opened(), run = before.snapshot.run;
    check(run?.kind === "expedition", "Run disappeared");
    check(canonicalJson(g1Snapshot(run.state)) === canonicalJson(row.before), `Before-state mismatch at ${row.label}`);
    if (run.state.node === "finished" && !rejectedPremature) {
      const claim = await send({type: "settle-expedition", runRef, terminalRef: run.state.result!.id});
      check(!claim.result.ok, "Claim accepted before the return story was read");
      rejectedPremature = true;
    }
    const sent = await commit(commandFor(row.operation));
    if (row.label === "T2.R1.reroll") {
      const retry = await runtime.dispatch(sent.request);
      check(retry.ok && retry.replayed, "Same reroll request was not replayed");
      replayedReroll = true;
    }
    const after = await opened();
    check(after.snapshot.run?.kind === "expedition" && canonicalJson(g1Snapshot(after.snapshot.run.state)) === canonicalJson(row.after), `After-state mismatch at ${row.label}`);
    if (row.label === "T2.R2.guard-bow") {
      sourceAtRestore = after;
      const archive = await runtime.exportSave(saveId);
      check(archive.ok, "Export failed");
      store = new MemoryGameStore(new MemoryGameDatabase<AnyGameRecord, AnyReceipt>());
      runtime = createVersionedGameRuntime(store, [{version: 4, catalog}]);
      const copied = await runtime.importSave({contentRef: catalog.ref, request: {protocolVersion: 4, saveId: "g1-copy", epoch: "g1-copy", clientRequestId: "copy", archive: archive.archive}});
      check(!copied.ok && copied.error.code === "run-active", "Active content-9 copying should remain blocked");
      recoveryArchive = archive.archive;
      const restored = await runtime.restoreSave({archive: recoveryArchive, clientRequestId: "g1-restore"});
      check(restored.ok, `Restore failed: ${JSON.stringify(restored)}`);
      check(canonicalJson(await opened()) === canonicalJson(after), "Restore changed archive identity or state");
      restoredAt = row.label;
    }
  }
  const beforeClaim = await opened(), run = beforeClaim.snapshot.run;
  check(run?.kind === "expedition" && run.state.tutorial?.stage === "claimable", "Tape did not reach claimable");
  check(beforeClaim.snapshot.campaign.funds.party === 0 && beforeClaim.snapshot.campaign.clock.phase === "dawn", "Paid or advanced time before claim");
  const terminal = run.state.result!, paid = await commit({type: "settle-expedition", runRef, terminalRef: terminal.id});
  const retry = await runtime.dispatch(paid.request);
  check(retry.ok && retry.replayed, "Claim retry was not idempotent");
  const second = await send({type: "settle-expedition", runRef, terminalRef: terminal.id});
  check(!second.result.ok, "Second claim was accepted");
  const final = await opened(), campaign = final.snapshot.campaign;
  check(campaign.funds.party === terminal.totalGold + 8 && campaign.clock.phase === "day" && campaign.clock.day === 1, "Wrong claim accounting");
  check(campaign.settlements.length === 1 && campaign.tutorial?.status === "completed", "Wrong completion count");
  check(canonicalJson(campaign.tutorial.cargoIds) === canonicalJson(spec.reward.cargoIds), "Missing cargo facts");
  check(campaign.inventory.length === 0 && campaign.growthGrants.length === 0 && campaign.chapterClaim === null, "Unexpected item/growth grant");
  check(canonicalJson(db.records.get("g1-original")) === canonicalJson(sourceAtRestore), "Recovery or continued play changed the source store");
  const staleRestore = await runtime.restoreSave({archive: recoveryArchive, clientRequestId: "g1-stale-restore"});
  check(!staleRestore.ok && staleRestore.error.code === "conflict", "Old backup overwrote a newer archive");
  check(canonicalJson(await opened()) === canonicalJson(final), "Rejected restore changed the archive");
  check(replayedReroll && rejectedPremature && restoredAt, "Missing replay assertions");
  return {contentRef: catalog.ref, seed, operationCount: tape.length, operationDigest,
    restoredAt, archiveMode: "identity-preserving-restore", activeCopyRejected: true, staleRestoreRejected: true,
    sameRequestReroll: true, prematureClaimRejected: true, duplicateClaimRejected: true, originalUntouched: true,
    terminalGold: terminal.totalGold, rewardGold: 8, paidGold: campaign.funds.party, clock: campaign.clock,
    cargoIds: campaign.tutorial.cargoIds, supplies: campaign.supplies, settlements: campaign.settlements.length};
}
