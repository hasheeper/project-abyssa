import { describe, it, expect } from "vitest";
import { archiveFixture } from "./archive-fixture";
import { resolveDemoCharacter, demoFace } from "../../game-core/battle";
import { createCharacterArchiveQuery } from "../character-views";
import { createCatalogRegistry } from "../catalogs";
import { LEGACY_VALIDATED_CATALOG } from "../legacy-context";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import {
  appFor,
  creation,
  opened,
} from "../../game-application/testing/helpers";
import { interruptionArchive } from "./playable-fixtures";
import { battleState } from "../views";
import { getStateFace } from "../battle-view";

describe("record-bound character archive", () => {
  it("preserves every legacy effective face used by Battle after a validated import", async () => {
    const app = appFor(new MemoryGameStore());
    expect(
      (
        await app.importSave({
          ...creation(),
          format: "legacy",
          archive: interruptionArchive("next-round"),
        })
      ).ok,
    ).toBe(true);
    const record = await opened(app),
      state = battleState(record);
    const query = createCharacterArchiveQuery(
      createCatalogRegistry([
        { version: 1, catalog: LEGACY_VALIDATED_CATALOG },
      ]),
    );
    for (const ch of query(record).characters) {
      if (ch.version !== 1 || !ch.inRun) continue;
      const die = state.dice.find((d) => d.ownerId === ch.id)!;
      ch.faces.forEach(({ baseQuality: _base, ...face }, faceIndex) =>
        expect(face).toEqual(getStateFace(state, { ...die, faceIndex })),
      );
    }
    expect(await opened(app)).toEqual(record);
  });
  it.each([1, 2, 3] as const)(
    "projects every face from the level %s resolver without writes",
    async (level) => {
      const f = await archiveFixture({ level, equipment: true, locked: true }),
        before = await f.open();
      const view = f.runtime.queries.archive(before);
      expect(view.version).toBe(2);
      expect(view.characters).toHaveLength(6);
      for (const ch of view.characters) {
        if (ch.version !== 2) throw new Error("version");
        expect(ch.faces).toEqual(
          resolveDemoCharacter(
            f.catalog.data,
            before.snapshot.campaign.progress,
            ch.id,
          ).faces,
        );
        expect(ch.next?.level ?? null).toBe(
          ch.id === "kael" || level === 3 ? null : level + 1,
        );
        expect(ch.history).toEqual([]);
      }
      expect(view.characters.find((c) => c.id === "marietta")?.available).toBe(
        false,
      );
      expect(await f.open()).toEqual(before);
      expect(f.db.receipts.size).toBe(1);
    },
  );
  it("matches frozen effective faces and temporary rust after actual enemy commands", async () => {
    const f = await archiveFixture({ run: true });
    const runRef = { kind: "expedition" as const, id: "run" };
    for (let n = 0; n < 5; n++) {
      let r = await f.open();
      if (r.snapshot.expedition!.encounter!.phase === "complete") break;
      await f.command({
        type: "battle-command",
        runRef,
        command: { type: "roll" },
      });
      await f.command({
        type: "battle-command",
        runRef,
        command: { type: "end-turn" },
      });
      while (
        (r = await f.open()).snapshot.expedition!.encounter!.phase === "enemy"
      ) {
        const e = r.snapshot.expedition!.encounter!;
        await f.command(
          e.cursor < e.enemyOrder.length
            ? { type: "resume-run", runRef }
            : {
                type: "battle-command",
                runRef,
                command: { type: "next-round" },
              },
        );
      }
      if (r.snapshot.expedition!.run.party.some((m) => m.temporaryRust.length))
        break;
    }
    const r = await f.open(),
      battle = r.snapshot.expedition!;
    expect(battle.run.party.some((m) => m.temporaryRust.length)).toBe(true);
    const view = f.runtime.queries.archive(r);
    for (const ch of view.characters)
      if (ch.version === 2 && ch.inRun) {
        expect(ch.hp).toBe(battle.run.party.find((m) => m.id === ch.id)!.hp);
        ch.faces.forEach((face, faceIndex) =>
          expect(face).toEqual(
            demoFace(battle, {
              ownerId: ch.id,
              faceIndex,
              loaded: false,
              spent: false,
              sealed: false,
            }),
          ),
        );
      }
    expect(view.characters.find((c) => c.id === "marietta")?.inRun).toBe(false);
  });
  it("rejects an unregistered fixture instead of falling back to legacy", async () => {
    const f = await archiveFixture();
    const read = createCharacterArchiveQuery(
      createCatalogRegistry([
        { version: 1, catalog: LEGACY_VALIDATED_CATALOG },
      ]),
    );
    expect(() => read(f.db.records.get("demo")!)).toThrow();
  });
});
