import { describe, expect, it, vi } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../game-application";
import { createPlayerRuntime } from "./player-runtime";
import { ESTATE_CATALOG } from "./estate-context";
import { nextD5PlayCommand } from "../game-application/testing/d5-playthrough";
import { FULL_MANOR_CATALOG } from "./full-manor-context";
import type { DemoCommand, DemoGameRecord } from "../game-application";
import { codexEntryByEnemy } from "../content/presentation/codex-definitions";

async function fixture(startAt: "debug-offline" | "tutorial" = "debug-offline") {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let serial = 0;
  const environment = { newId: () => `codex:${++serial}`, newSeed: () => 19, close() {} };
  const runtime = createPlayerRuntime(store, environment);
  const created = await runtime.application.createNewGame({saveId: "codex", epoch: "epoch", clientRequestId: "create", startAt});
  if (!created.ok) throw Error(created.error.message);
  const raw = () => database.records.get("codex")! as D5GameRecord;
  const send = async (command: D5Command) => {
    const before = raw();
    const result = await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn : runtime.application.dispatch)({protocolVersion: 4, saveId: "codex", expectedHead: before.head, clientRequestId: `play:${++serial}`, command});
    if (!result.ok) throw Error(result.error.message);
    return { before, after: raw(), receipts: [result.receipt], presentable: !result.replayed };
  };
  const data = () => { const view = runtime.queries.codex(raw()); if (view.status !== "ready") throw Error(view.message); return view; };
  const entry = (id: string) => data().entries.find(e => e.id === id)!;
  const depart = async (routeId = "tide-reef.ordinary") => send({type: "start-expedition", runId: `run:${++serial}`, routeId, partyIds: ESTATE_CATALOG.data.initialParty, itemIds: [], seed: 8267});
  return {database, store, runtime, raw, send, data, entry, depart, environment};
}

describe("codex from committed save evidence", () => {
  it("restores structured encounters and kills from published v3 archives without joining shared artwork", async () => {
    const f = await fixture();
    const result = await f.runtime.application.create({protocolVersion: 3, saveId: "old-manor", epoch: "old-manor", clientRequestId: "old-manor", profileId: "profile.demo.first-run"});
    if (!result.ok) throw Error(result.error.message);
    const read = () => f.database.records.get("old-manor")! as DemoGameRecord;
    let serial = 0;
    const send = async (command: DemoCommand) => {
      const result = await (command.type === "resume-run" ? f.runtime.application.resumeEnemyTurn : f.runtime.application.dispatch)({protocolVersion: 3, saveId: "old-manor", expectedHead: read().head, clientRequestId: `legacy:${++serial}`, command});
      if (!result.ok) throw Error(result.error.message);
    };
    await send({type: "start-expedition", runId: "old-run", routeId: "old-manor.first-clear", partyIds: FULL_MANOR_CATALOG.data.initialParty, itemIds: [], seed: 8267});
    expect(f.runtime.queries.codex(read())).toMatchObject({encountered: 1, defeated: 0});
    for (let step = 0; step < 60; step++) {
      const view = f.runtime.queries.codex(read());
      if (view.status === "ready" && view.defeated) break;
      const state = read().snapshot.expedition;
      if (state?.node !== "battle") throw Error("Missing historical battle");
      const runRef = {kind: "expedition" as const, id: state.run.id};
      if (state.encounter.phase === "roll") { await send({type: "battle-command", runRef, command: {type: "roll"}}); continue; }
      if (state.encounter.phase === "enemy") { await send({type: "resume-run", runRef}); continue; }
      const die = state.encounter.dice.find(d => !d.loaded && !d.spent && !d.sealed);
      if (die) { await send({type: "battle-command", runRef, command: {type: "toggle-load", actorId: die.ownerId}}); continue; }
      const battle = f.runtime.queries.battle(read());
      const attack = battle?.version === 2 ? battle.party.flatMap(m => m.actions.options.filter(o => o.choice === "attack").map(o => ({actorId: m.id, targetId: o.targetId})))[0] : null;
      await send({type: "battle-command", runRef, command: attack ? {type: "act", actorId: attack.actorId, choice: "attack", targetId: attack.targetId} : {type: "end-turn"}});
    }
    expect(f.runtime.queries.codex(read())).toMatchObject({encountered: 1, defeated: 1});
    expect(codexEntryByEnemy.get("enemy.memory.ceremonial-puppet")).toBeUndefined();
    expect(codexEntryByEnemy.get("enemy.memory.clockwork-beast")).toBe(codexEntryByEnemy.get("enemy.old-manor.clockwork-beast"));
  });
  it("starts locked, reveals only the encountered species, and queries never write", async () => {
    const f = await fixture();
    expect(f.data().entries).toHaveLength(13); // Retired Marietta artwork is not current content.
    expect(f.data().encountered).toBe(0);
    expect(JSON.stringify(f.data())).not.toContain("浊泥史莱姆");
    await f.depart();
    expect(f.entry("enemy.slime.mire")).toMatchObject({stage: "seen", dropIds: [], dropsStatus: "locked"});
    expect(f.entry("enemy.slime.mire").facts.some(e => e.label === "行动方式")).toBe(false);
    expect(f.entry("enemy.beast.reef-crab").stage).toBe("unknown");
    const before = JSON.stringify(f.raw()), commit = vi.spyOn(f.store, "commit");
    expect(f.data()).toBe(f.data());
    expect(commit).not.toHaveBeenCalled(); expect(JSON.stringify(f.raw())).toBe(before);
  });

  it("completes on an individual defeat, retracts the only kill on undo, and suppresses repeat updates", async () => {
    const f = await fixture(); await f.depart();
    let killed = false;
    for (let step = 0; step < 80; step++) {
      await f.send(nextD5PlayCommand(ESTATE_CATALOG, f.raw()));
      if (f.entry("enemy.slime.mire").stage !== "defeated") continue;
      killed = true;
      expect(f.entry("enemy.slime.mire").dropIds).toEqual(["loot.salvage.mire-gel", "loot.salvage.shell"]);
      const run = f.raw().snapshot.run;
      expect(run?.kind === "expedition" && run.state.node === "battle" && run.state.encounter.formation.length).toBe(1);
      expect(f.raw().snapshot.campaign.settlements).toHaveLength(0);
      const firstEncounter = f.entry("enemy.slime.mire").firstEncounter;
      await f.send({type: "undo", runRef: {kind: "expedition", id: run!.id}});
      expect(f.entry("enemy.slime.mire").stage).toBe("seen");
      expect(f.entry("enemy.slime.mire").firstDefeat).toBeUndefined();
      expect(f.entry("enemy.slime.mire").firstEncounter).toEqual(firstEncounter);
      await f.send(nextD5PlayCommand(ESTATE_CATALOG, f.raw()));
      expect(f.entry("enemy.slime.mire").stage).toBe("defeated");
      break;
    }
    expect(killed).toBe(true);
    const firstDefeat = f.entry("enemy.slime.mire").firstDefeat;
    for (let step = 0; step < 80; step++) {
      const run = f.raw().snapshot.run;
      if (run?.kind === "expedition" && run.state.run.room === 1 && run.state.node === "battle") break;
      await f.send(nextD5PlayCommand(ESTATE_CATALOG, f.raw()));
    }
    expect(f.entry("enemy.beast.reef-crab").stage).toBe("seen");
    expect(f.entry("enemy.slime.mire").firstDefeat).toEqual(firstDefeat);
  });

  it("preserves manual-save time, restores on a fresh runtime, and keeps another save independent", async () => {
    const f = await fixture(); await f.depart();
    for (let step = 0; f.raw().snapshot.run && step < 200; step++) {
      const command = nextD5PlayCommand(ESTATE_CATALOG, f.raw());
      await f.send(command.type === "choose-exit" ? {...command, choice: "leave"} : command);
    }
    expect(f.raw().snapshot.run).toBeNull();
    const saved = f.data(), exported = await f.runtime.application.exportSave("codex");
    if (!exported.ok) throw Error(exported.error.message);
    const copied = await f.runtime.application.importSave({protocolVersion: 4, saveId: "manual", epoch: "manual-epoch", clientRequestId: "copy", format: "application", archive: exported.archive});
    if (!copied.ok) throw Error(copied.error.message);
    const copy = f.database.records.get("manual")!;
    expect(f.runtime.queries.codex(copy)).toEqual(saved);
    await f.depart("old-manor.first-clear");
    expect(f.entry("old-manor.waiting-guest").stage).toBe("seen");
    expect(f.runtime.queries.codex(copy)).toEqual(saved);
    const restored = createPlayerRuntime(f.store, f.environment);
    expect(restored.queries.codex(structuredClone(f.raw()))).toEqual(f.data());
    const other = await restored.application.createNewGame({saveId: "other", epoch: "other", clientRequestId: "other", startAt: "debug-offline"});
    expect(other.ok).toBe(true);
    expect(restored.queries.codex(f.database.records.get("other")!)).toMatchObject({encountered: 0, defeated: 0});
  }, 60000);

  it("does not turn skipped tutorial memories or the prebuilt arrival battle into discoveries", async () => {
    const skipped = await fixture();
    expect(skipped.runtime.queries.memoryJournal(skipped.raw()).status).toBe("ready");
    expect(skipped.data().encountered).toBe(0);
    const f = await fixture("tutorial"), spec = ESTATE_CATALOG.data.tutorial!;
    await f.send({type: "start-expedition", runId: "tutorial", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
    expect(f.entry("enemy.slime.mire").stage).toBe("unknown");
    for (let count = 0; count < 20; count++) {
      const run = f.raw().snapshot.run;
      if (run?.kind !== "expedition" || !run.state.tutorial?.story) break;
      const story = run.state.tutorial.story;
      await f.send({type: "tutorial-read", runRef: {kind: "expedition", id: run.id}, storyId: story.id, step: story.step, choice: "continue"});
    }
    expect(f.entry("enemy.slime.mire").stage).toBe("seen");
    expect(f.entry("enemy.slime.mire").dropIds).toEqual([]);
  });

  it("rejects forged progress and unsupported saves, and recovery never replays discovery notices", async () => {
    const f = await fixture(); await f.depart();
    const corrupt = structuredClone(f.raw()); corrupt.contentRef.digest = "0".repeat(64);
    expect(f.runtime.queries.codex(corrupt).status).toBe("unavailable");
    const created = await f.runtime.application.create({protocolVersion: 1, saveId: "legacy", epoch: "legacy", clientRequestId: "legacy"});
    expect(created.ok).toBe(true);
    expect(f.runtime.queries.codex(f.database.records.get("legacy")!).status).toBe("unavailable");
  });
});
