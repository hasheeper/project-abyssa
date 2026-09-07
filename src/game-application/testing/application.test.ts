import { describe, it, expect } from "vitest";
import {
  MemoryGameDatabase,
  MemoryGameStore,
} from "../../game-infrastructure/storage/memory";
import { GameStorageError } from "../contracts";
import { validateRecord } from "../validate";
import { projectFacts } from "../facts";
import {
  appFor,
  catalog,
  creation,
  opened,
  request,
  send,
  startCommand,
  terminal,
} from "./helpers";
import { runStoreContract } from "./store-contract";
import { createBattleEngine } from "../../game-core/battle";
import {
  activeExecution,
  fromExecutionState,
  toExecutionState,
} from "../../game-core/session";
import frozen from "../../game-core/battle/testing/fixtures/s1-extraction.json";

const setup = async () => {
  const db = new MemoryGameDatabase(),
    store = new MemoryGameStore(db),
    app = appFor(store);
  expect((await app.create(creation())).ok).toBe(true);
  return { db, store, app };
};
describe("Application transactions and migration", () => {
  it("passes the shared store contract with independent connections", async () => {
    const db = new MemoryGameDatabase();
    expect(
      (await runStoreContract(new MemoryGameStore(db), new MemoryGameStore(db)))
        .settlements,
    ).toBe(1);
  });
  it("does not publish failed candidates and allows the same request after storage recovery", async () => {
    const { store, app } = await setup();
    const input = request(await opened(app), startCommand);
    const original = store.commit.bind(store);
    store.commit = async () => {
      throw new GameStorageError("storage-quota", "full");
    };
    const failed = await app.dispatch(input);
    expect(failed).toMatchObject({
      ok: false,
      error: { code: "storage-quota" },
    });
    expect((await opened(app)).snapshot.expedition).toBeNull();
    store.commit = original;
    expect((await app.dispatch(input)).ok).toBe(true);
  });
  it("rejects early settlement, unsupported commands and a second active run", async () => {
    const { app } = await setup();
    await send(app, startCommand);
    let r = await opened(app);
    expect(
      await app.dispatch(
        request(
          r,
          {
            type: "settle-expedition",
            expeditionId: "run",
            terminalRef: r.head,
          },
          "early",
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: "not-finished" } });
    expect(
      await app.dispatch(
        request(
          r,
          {
            type: "battle-command",
            expeditionId: "run",
            command: { type: "begin-enemy-turn" },
          },
          "raw",
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: "malformed" } });
    expect(
      await app.dispatch(
        request(r, { ...startCommand, expeditionId: "run2" }, "second"),
      ),
    ).toMatchObject({ ok: false, error: { code: "expedition-active" } });
  });
  it("recovers both terminal and settled historical backups with new identities and unchanged assets", async () => {
    const { app, store } = await setup();
    await send(app, startCommand);
    const ended = await terminal(app);
    const export1 = await app.exportSave("save");
    expect(export1.ok).toBe(true);
    if (!export1.ok) return;
    expect(
      (
        await app.importSave({
          ...creation("branch", "branch-epoch"),
          format: "application",
          archive: export1.archive,
        })
      ).ok,
    ).toBe(true);
    const branch = await opened(app, "branch");
    expect(branch.originRef).toEqual(ended.head);
    expect(branch.head.revision).toBe(ended.head.revision + 1);
    expect(branch.snapshot.expedition?.id).not.toBe("run");
    await send(
      app,
      {
        type: "settle-expedition",
        expeditionId: branch.pendingSettlement!.expeditionId,
        terminalRef: branch.pendingSettlement!.terminalRef,
      },
      "branch",
    );
    const restarted = appFor(store);
    expect((await opened(restarted)).pendingSettlement).toEqual(
      ended.pendingSettlement,
    );
    await send(restarted, {
      type: "settle-expedition",
      expeditionId: "run",
      terminalRef: ended.head,
    });
    const settled = await opened(app);
    expect((await opened(app, "branch")).snapshot.campaign.funds).toEqual(
      settled.snapshot.campaign.funds,
    );
    const export2 = await app.exportSave("save");
    if (!export2.ok) throw new Error("export");
    expect(
      (
        await app.importSave({
          ...creation("settled-copy", "copy-epoch"),
          format: "application",
          archive: export2.archive,
        })
      ).ok,
    ).toBe(true);
    const copied = await opened(app, "settled-copy");
    expect(copied.snapshot.campaign.funds).toEqual(
      settled.snapshot.campaign.funds,
    );
    expect(copied.snapshot.expedition).toBeNull();
    expect(copied.snapshot.campaign.appliedSettlements).toHaveLength(1);
  });
  it.each(
    frozen.migrations.map((m) => [m.input.schemaVersion, m.input] as const),
  )(
    "imports legacy schema %s into an independent empty campaign",
    async (_version, input) => {
      const { app } = await setup();
      const r = await app.importSave({
        ...creation("legacy", "legacy-epoch"),
        format: "legacy",
        archive: JSON.stringify(input),
      });
      expect(r).toMatchObject({ ok: true });
      const old = await opened(app, "legacy");
      expect(old.snapshot.campaign.funds.party).toBe(0);
      expect((await opened(app)).snapshot.expedition).toBeNull();
    },
  );
  it("resumes only the unfinished enemies from the saved cursor", async () => {
    const { app } = await setup();
    expect(
      await app.importSave({
        ...creation("legacy", "legacy-epoch"),
        format: "legacy",
        archive: frozen.interruptedSave,
      }),
    ).toMatchObject({ ok: true });
    const before = await opened(app, "legacy"),
      engine = createBattleEngine(catalog, catalog.data.defaultRouteId);
    let state = activeExecution(before.snapshot);
    expect(state.mode.type).toBe("enemy-turn");
    while (
      state.mode.type === "enemy-turn" &&
      state.mode.cursor < state.mode.enemyOrder.length
    )
      state = engine.dispatch(state, { type: "resolve-next-enemy" }).state;
    state = engine.dispatch(state, { type: "finish-enemy-turn" }).state;
    const skippedEnemies = request(
      before,
      {
        type: "battle-command",
        expeditionId: before.snapshot.expedition!.id,
        command: { type: "next-round" },
      },
      "skip-enemies",
    );
    expect(await app.dispatch(skippedEnemies)).toMatchObject({
      ok: false,
      error: { code: "resume-required" },
    });
    expect(await opened(app, "legacy")).toEqual(before);
    const resume = request(before, {
      type: "resume-enemy-turn",
      expeditionId: before.snapshot.expedition!.id,
    });
    expect(await app.resumeEnemyTurn(resume)).toMatchObject({ ok: true });
    expect(activeExecution((await opened(app, "legacy")).snapshot)).toEqual(
      state,
    );
    expect(await app.resumeEnemyTurn(resume)).toMatchObject({
      ok: true,
      replayed: true,
    });
  });
  it("advances global identities and retracts facts when undo restores mechanics", async () => {
    const { app } = await setup();
    await send(app, startCommand);
    await send(app, {
      type: "battle-command",
      expeditionId: "run",
      command: { type: "roll-dice" },
    });
    for (let dieIndex = 0; dieIndex < 5; dieIndex++)
      await send(app, {
        type: "battle-command",
        expeditionId: "run",
        command: { type: "toggle-load", dieIndex },
      });
    // Adopt the first legal action found from actual rolled faces.
    const before = await opened(app);
    const engine = createBattleEngine(catalog, catalog.data.defaultRouteId),
      execution = activeExecution(before.snapshot);
    let selected: any;
    for (const member of execution.party)
      for (const enemy of execution.enemies) {
        for (const type of ["attack-enemy"] as const) {
          const c = { type, actorId: member.id, enemyId: enemy.id };
          if (!engine.dispatch(execution, c).error) {
            selected = c;
            break;
          }
        }
        if (selected) break;
      }
    expect(selected).toBeDefined();
    await send(app, {
      type: "battle-command",
      expeditionId: "run",
      command: selected,
    });
    const acted = await opened(app);
    const actionArchive = await app.exportSave("save");
    if (!actionArchive.ok) throw new Error("export");
    expect(
      await app.importSave({
        ...creation("action-copy", "action-epoch"),
        format: "application",
        archive: actionArchive.archive,
      }),
    ).toMatchObject({ ok: true });
    const importedAction = await opened(app, "action-copy");
    await send(
      app,
      { type: "undo", expeditionId: importedAction.snapshot.expedition!.id },
      "action-copy",
    );
    const revertedCopy = await opened(app, "action-copy");
    expect(revertedCopy.snapshot.expedition!.rng).toEqual(
      before.snapshot.expedition!.rng,
    );
    expect(revertedCopy.retractedFactIds).not.toContain(
      importedAction.facts.at(-1)!.id,
    );
    expect(revertedCopy.retractedFactIds.length).toBeGreaterThan(0);

    expect(acted.undoAnchors.length).toBe(before.undoAnchors.length + 1);
    await send(app, { type: "undo", expeditionId: "run" });
    const undone = await opened(app);
    expect(undone.head.revision).toBe(acted.head.revision + 1);
    expect(undone.snapshot.expedition?.rng).toEqual(
      before.snapshot.expedition?.rng,
    );
    expect(undone.retractedFactIds.length).toBeGreaterThan(0);
    expect(projectFacts(undone, ["kael"], acted.head)).toEqual([]);
    const exported = await app.exportSave("save");
    if (!exported.ok) throw new Error("export");
    expect(
      await app.importSave({
        ...creation("undo-copy", "ue"),
        format: "application",
        archive: exported.archive,
      }),
    ).toMatchObject({ ok: true });
    const copy = await opened(app, "undo-copy");
    expect(copy.retractedFactIds.length).toBe(undone.retractedFactIds.length);
    expect(new Set(copy.facts.map((f) => f.id)).size).toBe(copy.facts.length);
  });
  it.each([
    [
      "schema",
      (r: any) => {
        r.schemaVersion = 9;
      },
    ],
    [
      "rules",
      (r: any) => {
        r.contentRef.rulesVersion = 9;
      },
    ],
    [
      "digest",
      (r: any) => {
        r.contentRef.digest = "bad";
      },
    ],
    [
      "gold",
      (r: any) => {
        r.snapshot.expedition.gold = "100";
      },
    ],
    [
      "head",
      (r: any) => {
        r.head.revision++;
      },
    ],
    [
      "facts",
      (r: any) => {
        r.facts[0].payload.extra = "secret";
      },
    ],
    [
      "anchors",
      (r: any) => {
        r.undoAnchors.push(r.head);
      },
    ],
    [
      "candidate",
      (r: any) => {
        r.pendingSettlement = {
          expeditionId: "run",
          terminalRef: r.head,
          settlementId: "x",
        };
      },
    ],
  ])(
    "rejects corrupted %s without changing stored bytes",
    async (_name, mutate) => {
      const { app, db } = await setup();
      await send(app, startCommand);
      const original = await opened(app);
      const corrupted = structuredClone(original);
      mutate(corrupted);
      db.records.set("save", corrupted);
      expect((await app.open("save")).ok).toBe(false);
      expect(db.records.get("save")).toEqual(corrupted);
      expect(() => validateRecord(corrupted, catalog)).toThrow();
    },
  );
  it("round-trips all old snapshots and checkpoints through the three owners", () => {
    const engine = createBattleEngine(catalog, catalog.data.defaultRouteId);
    for (const serialized of [
      frozen.interruptedSave,
      ...frozen.migrations.map((m) => JSON.stringify(m.input)),
    ]) {
      const state = engine.importLegacy(serialized);
      const split = fromExecutionState(
        catalog,
        "roundtrip",
        catalog.data.defaultRouteId,
        state,
      );
      expect(toExecutionState(split.expedition, split.encounter)).toEqual(
        state,
      );
      expect(Object.hasOwn(split.encounter, "rng")).toBe(false);
    }
  });
});
