import { describe, it, expect } from "vitest";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import {
  appFor,
  creation,
  opened,
  send,
  startCommand,
  terminal,
} from "./helpers";
import { projectCharacterHistory } from "../character-history";
import { archiveFixture } from "../../game-runtime/testing/archive-fixture";

describe("character lifetime history", () => {
  it("preserves simulation provenance when importing a validated legacy archive", async () => {
    const app = appFor(new MemoryGameStore());
    await app.create(creation());
    await send(app, startCommand);
    const exported = await app.exportSave("save");
    if (!exported.ok) throw new Error("export");
    const archive = JSON.parse(exported.archive);
    archive.record.facts.forEach((f: { origin: string }) => {
      f.origin = "simulation";
    });
    const result = await app.importSave({
      ...creation("copy", "copy-epoch"),
      format: "application",
      archive: JSON.stringify(archive),
    });
    expect(result.ok).toBe(true);
    const imported = await opened(app, "copy");
    expect(
      imported.facts
        .filter((f) => f.kind === "expedition-started")
        .every((f) => f.origin === "simulation"),
    ).toBe(true);
    expect(projectCharacterHistory(imported, "kael")).toEqual([]);
  });
  it("keeps previous expeditions, merges finish/settle and attributes actual participants", async () => {
    const app = appFor(new MemoryGameStore());
    await app.create(creation());
    await send(app, startCommand);
    await terminal(app);
    let r = await opened(app);
    await send(app, {
      type: "settle-expedition",
      expeditionId: "run",
      terminalRef: r.pendingSettlement!.terminalRef,
    });
    await send(app, {
      ...startCommand,
      expeditionId: "run-2",
      partyIds: ["kael", "norma"],
    });
    r = await opened(app);
    const kael = projectCharacterHistory(r, "kael"),
      eustice = projectCharacterHistory(r, "eustice");
    expect(kael.filter((e) => e.kind === "expedition-started")).toHaveLength(2);
    expect(eustice.filter((e) => e.kind === "expedition-started")).toHaveLength(
      1,
    );
    expect(kael.filter((e) => e.kind === "expedition-result")).toHaveLength(1);
    expect(
      kael.find((e) => e.kind === "expedition-result")!.sourceFactIds,
    ).toHaveLength(2);
    const exported = await app.exportSave("save");
    if (!exported.ok) throw new Error("export");
    expect(
      (
        await app.importSave({
          ...creation("copy", "copy-epoch"),
          format: "application",
          archive: exported.archive,
        })
      ).ok,
    ).toBe(true);
    const imported = projectCharacterHistory(await opened(app, "copy"), "kael");
    expect(imported.map((e) => [e.kind, e.worldTime, e.count])).toEqual(
      kael.map((e) => [e.kind, e.worldTime, e.count]),
    );
    expect(new Set(imported.map((e) => e.id)).size).toBe(imported.length);
  });
  it("filters visibility, source and withdrawal before aggregation, never treats witnesses as attackers", async () => {
    const app = appFor(new MemoryGameStore());
    await app.create(creation());
    await send(app, startCommand);
    const r = await opened(app);
    const start = r.facts.find((f) => f.kind === "expedition-started")!;
    r.facts.push(
      { ...start, id: "internal", visibility: { type: "internal" } },
      { ...start, id: "simulation", origin: "simulation" },
      { ...start, id: "other", source: { ...start.source, epoch: "other" } },
      {
        ...start,
        id: "enemy-damage",
        kind: "damage-applied",
        payload: {
          targetKind: "enemy",
          targetId: "enemy",
          applied: 9,
          hpAfter: 0,
        },
      },
    );
    expect(projectCharacterHistory(r, "kael").map((e) => e.id)).toEqual([
      start.id,
    ]);
    r.retractedFactIds.push(start.id);
    expect(projectCharacterHistory(r, "kael")).toEqual([]);
  });
  it("keeps fixture history empty and does not attribute global rules2 events to every character", async () => {
    const simulation = await archiveFixture({ run: true });
    expect(projectCharacterHistory(await simulation.open(), "kael")).toEqual(
      [],
    );
    const live = await archiveFixture({ run: true, adventure: true });
    // This projector fixture edits synthetic history; runtime snapshots are read-only.
    let r = structuredClone(await live.open());
    expect(r.facts.some((f) => f.origin === "adventure")).toBe(true);
    expect(projectCharacterHistory(r, "kael").map(e => e.kind)).toEqual(["expedition-started"]);
    const source = r.facts.at(-1)!;
    // Semantic projector unit case; production callers first validate full records.
    r = {
      ...r,
      facts: [
        ...r.facts,
        {
          ...source,
          id: "kill-1",
          kind: "enemy-defeated",
          actorId: "eustice",
          payload: { targetId: "enemy-a", bounty: 7 },
        },
        {
          ...source,
          id: "kill-2",
          kind: "enemy-defeated",
          actorId: "eustice",
          payload: { targetId: "enemy-b", bounty: 7 },
        },
      ],
    };
    expect(projectCharacterHistory(r, "kael").map(e => e.kind)).toEqual(["expedition-started"]);
    expect(projectCharacterHistory(r, "eustice").filter(e => e.kind === "enemy-defeated")).toMatchObject([
      { count: 2, sourceFactIds: ["kill-1", "kill-2"] },
    ]);
    r.retractedFactIds.push("kill-1");
    expect(projectCharacterHistory(r, "eustice").filter(e => e.kind === "enemy-defeated")).toMatchObject([
      { id: "kill-2", count: 1 },
    ]);
  });
});
