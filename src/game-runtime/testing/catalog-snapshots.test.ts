import { expect, it } from "vitest";
import { createCatalogRegistry } from "../catalogs";
import { createVersionedQueries } from "../versioned-views";
import { createPlayerRuntime, PLAYER_CATALOGS } from "../player-runtime";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../../game-application";

it.each([2, 3] as const)("reuses only owned immutable v%s snapshots and rejects changes after a query", async version => {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  const runtime = createPlayerRuntime(new MemoryGameStore(database), {newId: () => "request", newSeed: () => 19, close() {}});
  try {
    const created = await runtime.application.create({profileId: runtime.defaultCreation.profileId, protocolVersion: version,
      saveId: "snapshot-save", epoch: "epoch", clientRequestId: "create"});
    expect(created.ok).toBe(true);
    const opened = await runtime.application.open("snapshot-save");
    if (!opened.ok) throw new Error(opened.error.message);
    const registry = createCatalogRegistry(PLAYER_CATALOGS);
    const queries = createVersionedQueries(registry);
    const raw = structuredClone(opened.record);
    const snapshot = registry.read(raw);
    expect(snapshot).not.toBe(raw);
    expect(registry.read(snapshot)).toBe(snapshot);
    expect(Object.isFrozen(snapshot.snapshot.campaign)).toBe(true);
    expect(Object.isFrozen(snapshot.commits[0].factIds)).toBe(true);
    expect(() => { snapshot.snapshot.campaign.funds.party++; }).toThrow();
    expect(queries.journey(snapshot)).toBe(queries.journey(snapshot));

    queries.journey(raw);
    raw.commits.pop();
    expect(() => queries.journey(raw)).toThrow();
    expect(() => registry.read(Object.freeze(raw))).toThrow();
    expect(registry.read(snapshot).commits.length).toBeGreaterThan(raw.commits.length);

    // A separate storage read is still untrusted, even if its head is unchanged.
    database.records.set(raw.head.saveId, raw);
    const result = await runtime.application.dispatch({
      protocolVersion: version, saveId: raw.head.saveId, expectedHead: raw.head,
      clientRequestId: "corrupted-record", command: {type: "battle-command",
        runRef: {kind: "expedition", id: "manor-run"}, command: {type: "roll"}},
    });
    expect(result.ok).toBe(false);
  } finally { runtime.close(); }
});
