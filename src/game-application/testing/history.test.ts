import { describe, it, expect } from "vitest";
import { MemoryGameStore, MemoryGameDatabase } from "../../game-infrastructure/storage/memory";
import { appFor, creation, opened, send, startCommand, terminal } from "./helpers";
import { projectPlayerHistory } from "../history";
describe("save index and player history", () => {
  it("isolates a corrupt save using actual storage keys", async () => {
    const db = new MemoryGameDatabase(), app = appFor(new MemoryGameStore(db));
    await app.create(creation()); db.records.set("broken", {} as never);
    const index = await app.list(); expect(index.ok).toBe(true);
    if (!index.ok) throw new Error("list");
    expect(index.saves.map(s => [s.saveId, s.status])).toEqual([["broken", "unavailable"], ["save", "ready"]]);
    expect((await app.open("save")).ok).toBe(true);
  });
  it("keeps history across commits and filters withdrawn/internal/simulation facts", async () => {
    const app = appFor(new MemoryGameStore()); await app.create(creation()); await send(app, startCommand); await terminal(app);
    const record = await opened(app); const before = projectPlayerHistory(record, "run");
    expect(before.some(f => f.kind === "expedition-started")).toBe(true);
    expect(before.some(f => f.kind === "expedition-finished")).toBe(true);
    record.retractedFactIds.push(before[0].id);
    record.facts.push({ ...before[0], id: "simulation", origin: "simulation" });
    expect(projectPlayerHistory(record, "run").some(f => f.id === before[0].id || f.id === "simulation" || f.visibility.type === "internal")).toBe(false);
  });
});
