import { describe, expect, it, vi } from "vitest";
import { canonicalJson, sha256 } from "../../game-core/contracts";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { ESTATE_AIRP_CATALOG } from "../../game-runtime/estate-context";
import { directorView } from "../../game-runtime/airp-director-view";
import { FIRST_MORNING_ENTRIES } from "../../content/presentation/first-morning";
import { OPENING_MEMORY_SUMMARIES, OPENING_MEMORY_TITLES } from "../../content/presentation/opening-memory";
import { g2Next } from "../../game-core/session/testing/tide-guided-g2";
import type { D5JourneyOperation } from "../../game-core/session";
import { directorTestMaterial } from "./airp-director-fixture";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../index";

function tutorialCommand(op: D5JourneyOperation): D5Command {
  const runRef = {kind: "expedition" as const, id: "tide-run"};
  switch (op.type) {
    case "resume": return {type: "resume-run", runRef};
    case "battle": return op.command.type === "undo" ? {type: "undo", runRef} : {type: "battle-command", runRef, command: op.command};
    case "item": return {type: "use-item", runRef, instanceId: op.instanceId, target: op.target};
    case "advance": return {type: "advance-room", runRef, roomId: op.roomId};
    case "event": return {type: "choose-event", runRef, roomId: op.roomId, choiceId: op.choice, actorId: op.actorId};
    case "exit": return {type: "choose-exit", runRef, roomId: op.roomId, choice: op.choice};
    default: return {...op, runRef};
  }
}

function fixture() {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  let serial = 0;
  const environment = {newId: () => `opening:${++serial}`, newSeed: () => 19, close() {}};
  const runtime = createPlayerRuntime(store, environment);
  const request = {saveId: "opening", epoch: "epoch", clientRequestId: "create", playerName: "林恩"};
  const read = () => db.records.get(request.saveId)! as D5GameRecord;
  const send = async (command: D5Command) => {
    const result = await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn : runtime.application.dispatch)({protocolVersion: 4,
      saveId: request.saveId, expectedHead: read().head, clientRequestId: `send:${++serial}`, command});
    if (!result.ok) throw Error(`${command.type}: ${result.error.message}`);
    return result;
  };
  const journal = () => {
    const result = runtime.queries.memoryJournal(read());
    if (result.status !== "ready") throw Error("Journal unavailable");
    return result;
  };
  return {db, store, runtime, request, read, send, journal, reopen: () => createPlayerRuntime(store, environment).application.open(request.saveId)};
}

describe("one opening and AIRP flow", () => {
  it("finishes the real opening and tutorial in the same AIRP save before enabling the day planner", async () => {
    const f = fixture(), catalog = ESTATE_AIRP_CATALOG;
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "first-morning"})).toMatchObject({ok: true});
    expect(f.read().snapshot.campaign.openingFlowVersion).toBe(1);
    expect(directorView(f.read())?.context.world.eligible).toBe(false);
    await f.send({type: "airp-director-configure", material: directorTestMaterial()});
    expect(await f.runtime.application.dispatch({protocolVersion: 4, saveId: f.request.saveId, expectedHead: f.read().head,
      clientRequestId: "premature-day", command: {type: "airp-director-prepare-day"}})).toMatchObject({ok: false, error: {code: "command-not-available"}});
    for (let step = 0; step <= catalog.data.opening!.lastStep; step++) {
      await f.send({type: "advance-opening", step, choice: FIRST_MORNING_ENTRIES[step].kind === "decision" ? "B" : "continue"});
    }
    const spec = catalog.data.tutorial!;
    await f.send({type: "start-expedition", runId: "tide-run", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
    const flow = f.runtime.airpGame.forSave(f.request.saveId, 28, f.request.epoch);
    const beforeSync = JSON.stringify(f.read());
    await flow.sync();
    expect(JSON.stringify(f.read())).toBe(beforeSync);
    for (let step = 0; step < 600; step++) {
      const run = f.read().snapshot.run;
      if (run?.kind !== "expedition") throw Error("Missing tutorial run");
      const op = g2Next(catalog, run.state, "B");
      if (!op) break;
      await f.send(tutorialCommand(op));
      // Let the runner process timers while this full journey replays growing history.
      if (step % 25 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const run = f.read().snapshot.run;
    if (run?.kind !== "expedition") throw Error("Missing terminal");
    expect(run.state.tutorial?.stage).toBe("claimable");
    expect(directorView(f.read())?.context.world.eligible).toBe(false);
    await f.send({type: "settle-expedition", runRef: {kind: "expedition", id: run.id}, terminalRef: run.state.result!.id});
    const campaign = f.read().snapshot.campaign;
    expect(campaign.tutorial?.status).toBe("completed");
    expect(campaign.startReward).toBeUndefined();
    expect(campaign.manor.takeover).toBeNull();
    expect(campaign.growthGrants).toEqual([]);
    expect(directorView(f.read())?.context.world.eligible).toBe(true);
    expect(f.runtime.queries.journey(f.read())?.defaultRouteId).toBe(catalog.data.manor!.maintenanceRouteId);
    expect(f.journal().entries.map(e => e.title)).toEqual(Object.values(OPENING_MEMORY_TITLES));
    expect(f.journal().entries.map(e => e.summary)).toEqual([OPENING_MEMORY_SUMMARIES.departure.complete, OPENING_MEMORY_SUMMARIES.return.complete]);
    expect(f.journal().entries.flatMap(e => e.blocks).some(b => b.kind === "choice")).toBe(true);
    expect(f.journal().entries.flatMap(e => e.blocks).every(b => !b.source?.acquisition)).toBe(true);
    expect(directorView(f.read())?.context.memories.map(m => m.id)).toEqual(["opening:departure", "opening:return"]);
    await flow.sync();
    expect(f.read().airpGame).not.toBeNull();
    expect(directorView(f.read())!.context.capabilities.actorIds).toEqual(expect.arrayContaining(["abyssa", "marietta"]));
    expect(f.read().airpGame!.settlement.policy.actorIds).toEqual(expect.arrayContaining(["abyssa", "marietta"]));
    await f.send({type: "airp-director-prepare-day"});
    expect(f.read().airpDirector?.jobs.at(-1)?.planning?.world.eligible).toBe(true);
    expect(f.read().airpDirector?.jobs.at(-1)?.planning?.memories.map(m => m.id)).toContain("opening:return");
    expect(await f.reopen()).toMatchObject({ok: true, record: f.read()});
  }, 120000);

  it("skips into the same flow with both tutorial memories, no invented choices and one reward", async () => {
    const f = fixture(), request = {...f.request, startAt: "hub" as const};
    expect(await f.runtime.application.createNewGame(request)).toMatchObject({ok: true});
    const before = JSON.stringify(f.read()), commit = vi.spyOn(f.store, "commit");
    const journal = f.journal();
    expect(journal.entries.map(e => e.title)).toEqual(Object.values(OPENING_MEMORY_TITLES));
    expect(journal.entries.map(e => e.summary)).toEqual([OPENING_MEMORY_SUMMARIES.departure.complete, OPENING_MEMORY_SUMMARIES.return.complete]);
    expect(journal.entries.every(e => e.replay === "scene")).toBe(true);
    expect(journal.entries[1].sequence).toBeGreaterThan(journal.entries[0].sequence);
    expect(journal.entries.flatMap(e => e.blocks).every(b => b.source?.factId === f.read().facts.at(-1)!.id && b.source.acquisition === "tutorial-skip" && b.kind !== "choice")).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    expect(JSON.stringify(f.read())).toBe(before);
    expect(f.read().snapshot.campaign.tutorial).toEqual({status: "exempt", reason: "player-skipped"});
    expect(f.read().snapshot.campaign.settlements).toEqual([]);
    expect(f.read().snapshot.campaign.opening?.choices).toEqual([]);
    expect(f.read().snapshot.campaign.loot).toHaveLength(4);
    expect(f.read().snapshot.campaign.funds.party).toBe(4400);
    expect(directorView(f.read())?.context.world.eligible).toBe(true);
    expect(directorView(f.read())?.context.memories.every(m => m.text.includes("跳过教学"))).toBe(true);
    expect(await f.runtime.application.createNewGame(request)).toMatchObject({ok: true, replayed: true});
    expect(JSON.stringify(f.read())).toBe(before);
    const archive = await f.runtime.application.exportSave(f.request.saveId);
    if (!archive.ok) throw Error("Export failed");
    const recovery = fixture();
    expect(await recovery.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "recover"})).toMatchObject({ok: true});
    expect(recovery.journal()).toEqual(journal);
    expect(await f.runtime.application.importSave({saveId: "copy", epoch: "copy", clientRequestId: "copy", archive: archive.archive})).toMatchObject({ok: true});
    await f.send({type: "airp-director-configure", material: directorTestMaterial()});
    await f.send({type: "airp-director-prepare-day"});
    const gm = f.read().airpDirector!.jobs.at(-1)!.planning!;
    expect(gm.world.eligible).toBe(true);
    expect(gm.memories.map(m => m.id)).toEqual(["opening:departure", "opening:return"]);
    expect(await f.reopen()).toMatchObject({ok: true});
  }, 30000);

  it("skips only the morning when starting at teaching, without revealing the return", async () => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "tutorial"})).toMatchObject({ok: true});
    expect(f.journal().entries.map(e => e.title)).toEqual([OPENING_MEMORY_TITLES.departure]);
    expect(directorView(f.read())?.context.world.eligible).toBe(false);
    expect(directorView(f.read())?.context.memories.map(m => m.id)).toEqual(["opening:departure"]);
    expect(f.read().snapshot.campaign.startReward).toBeUndefined();
  });

  it("prepares the next regular departure with both opening memories and no duplicate skip reward", async () => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "hub"})).toMatchObject({ok: true});
    const campaign = f.read().snapshot.campaign;
    const flow = f.runtime.airpGame.forSave(f.request.saveId, 28, f.request.epoch);
    const departure = {runId: "next-patrol", routeId: ESTATE_AIRP_CATALOG.data.manor!.maintenanceRouteId,
      partyIds: ESTATE_AIRP_CATALOG.data.tutorial!.partyIds, itemIds: ["item.food", "item.potion"],
      supplyQuantities: {"item.food": 1, "item.potion": 1}, seed: 19};
    const id = await flow.prepare(departure);
    const job = (await flow.gm.read()).ledger.jobs.find(j => j.id === id)!;
    expect(job).toMatchObject({status: "pending", attempts: []});
    expect(job.frames[0].context.sources.filter(s => s.id.startsWith("opening:")).map(s => s.id)).toEqual(["opening:departure", "opening:return"]);
    expect(f.read().snapshot.run).toBeNull();
    expect(f.read().snapshot.campaign.funds).toEqual(campaign.funds);
    expect(f.read().snapshot.campaign.loot).toEqual(campaign.loot);
    const beforeRetry = JSON.stringify(f.read());
    expect(await flow.prepare(departure)).toBe(id);
    expect(JSON.stringify(f.read())).toBe(beforeRetry);
    expect(await f.reopen()).toMatchObject({ok: true});
  });

  it("keeps no-LLM play in the explicit debugging start with the same tutorial memories", async () => {
    const f = fixture();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: "debug-offline"})).toMatchObject({ok: true});
    expect(f.read().contentRef.contentVersion).toBe(27);
    expect(f.read().airpDirector).toBeUndefined();
    expect(f.read().airpGame).toBeUndefined();
    expect(directorView(f.read())).toBeNull();
    expect(f.journal().entries.map(e => e.title)).toEqual(Object.values(OPENING_MEMORY_TITLES));
    expect(f.journal().entries.flatMap(e => e.blocks).every(b => b.source?.acquisition === "tutorial-skip")).toBe(true);
    const spec = ESTATE_AIRP_CATALOG.data.tutorial!;
    await f.send({type: "start-expedition", runId: "offline-patrol", routeId: "old-manor.first-clear", partyIds: spec.partyIds,
      itemIds: spec.itemIds, supplyQuantities: {"item.food": 1, "item.potion": 1}, seed: 19});
    expect(f.read().snapshot.run?.kind).toBe("expedition");
    expect(await f.reopen()).toMatchObject({ok: true});
  });

  it.each([27, 28])("recovers historical content%s selections with their original command and history", async contentVersion => {
    const f = fixture();
    expect(await f.runtime.application.create({protocolVersion: 4, contentVersion, profileId: "profile.demo.first-run", saveId: f.request.saveId, epoch: f.request.epoch, clientRequestId: f.request.clientRequestId})).toMatchObject({ok: true});
    const created = f.read();
    const selected = await f.runtime.application.dispatch({protocolVersion: 4, saveId: f.request.saveId, expectedHead: created.head,
      clientRequestId: `start:${sha256(canonicalJson({protocolVersion: 4, profileId: "profile.demo.first-run", saveId: f.request.saveId, epoch: f.request.epoch, clientRequestId: f.request.clientRequestId})).slice(0, 32)}`,
      command: {type: "select-game-start", startAt: contentVersion === 28 ? "airp-director" : "hub", playerName: f.request.playerName}});
    expect(selected).toMatchObject({ok: true});
    const before = JSON.stringify(f.read());
    expect(f.read().snapshot.campaign.openingFlowVersion).toBeUndefined();
    expect(await f.runtime.application.createNewGame({...f.request, startAt: contentVersion === 28 ? "airp-director" : "hub"})).toMatchObject({ok: true, replayed: true});
    expect(await f.reopen()).toMatchObject({ok: true});
    expect(JSON.stringify(f.read())).toBe(before);
    expect(f.journal().entries).toEqual([]);
    if (contentVersion === 28) expect(directorView(f.read())?.context.memories).toEqual([]);
  });
});
