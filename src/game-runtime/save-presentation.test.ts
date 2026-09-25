import { describe, expect, it, vi } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { createPlayerRuntime } from "./player-runtime";

describe("save directory presentation", () => {
  it("derives named start stages during the existing validated scan without writes or extra reads", async () => {
    const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
    const runtime = createPlayerRuntime(store, { newId: () => "presentation-request", newSeed: () => 19, close() {} });
    for (const startAt of ["prologue", "first-morning", "tutorial", "hub"] as const) {
      const result = await runtime.application.createNewGame({ saveId: startAt, epoch: startAt, clientRequestId: startAt, startAt, playerName: "林恩" });
      expect(result.ok).toBe(true);
    }
    const before = JSON.stringify([...db.records]);
    const read = vi.spyOn(store, "read"), commit = vi.spyOn(store, "commit");
    const result = await runtime.application.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const actual = Object.fromEntries(result.saves.map(save => [save.saveId, save.status === "ready" && save.presentation]));
    expect(actual).toEqual(Object.fromEntries(Object.entries({prologue: "prologue", "first-morning": "morning", tutorial: "tutorial", hub: "manor"}).map(([id, scene]) => [id, {playerName: "林恩", scene}])));
    expect(read).toHaveBeenCalledTimes(4); expect(commit).not.toHaveBeenCalled();
    expect(JSON.stringify([...db.records])).toBe(before);
    expect(JSON.stringify(actual)).not.toMatch(/timestamp|savedAt|playtime/i);
  });
});
