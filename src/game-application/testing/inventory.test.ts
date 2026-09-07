import { it, expect } from "vitest";
import { validateCatalog, type BattleCatalog } from "../../game-core/contracts";
import { validateSnapshot } from "../../game-core/session";
import { LEGACY_CATALOG } from "../../content/gameplay/legacy-v1/catalog";
import {
  MemoryGameDatabase,
  MemoryGameStore,
} from "../../game-infrastructure/storage/memory";
import { createGameApplication } from "../service";
import {
  creation,
  opened,
  request,
  send,
  startCommand,
  terminal,
} from "./helpers";
const data: BattleCatalog = structuredClone(LEGACY_CATALOG);
data.catalogId = "test.inventory";
for (const kind of ["item", "equipment", "trait"] as const) {
  data.effects = {
    ...data.effects,
    [kind]: { definitionId: kind, modifiers: [], reactions: [] },
  };
  data.contentKinds[kind] = kind;
}
const catalog = validateCatalog(data);
const base = { sourceId: "initial", ownerId: "kael", tags: [], data: null };
const item = {
  ...base,
  kind: "item",
  instanceId: "potion1",
  definitionId: "item",
  charges: 2,
  maxCharges: 2,
};
const equipment = {
  ...base,
  kind: "equipment",
  instanceId: "sword1",
  definitionId: "equipment",
  slot: "hand",
  durability: 3,
  maxDurability: 3,
};
const trait = {
  ...base,
  kind: "trait",
  instanceId: "trait1",
  definitionId: "trait",
};
it("transfers unique custody and returns the same instances exactly once", async () => {
  const db = new MemoryGameDatabase(),
    app = createGameApplication({ catalog, store: new MemoryGameStore(db) });
  expect(
    await app.create({
      ...creation(),
      initial: {
        inventory: { capacity: 2, items: [item], equipment: [equipment] },
        traits: [trait],
      },
    }),
  ).toMatchObject({ ok: true });
  const before = await opened(app);
  expect(
    await app.dispatch(
      request(before, { ...startCommand, itemIds: ["missing"] }, "bad"),
    ),
  ).toMatchObject({ ok: false, error: { code: "missing-item" } });
  expect(await opened(app)).toEqual(before);
  await send(app, {
    ...startCommand,
    itemIds: ["potion1"],
    equipmentIds: ["sword1"],
  });
  const active = await opened(app);
  expect(active.snapshot.campaign.inventory.items).toEqual([]);
  expect(active.snapshot.campaign.inventory.equipment).toEqual([]);
  expect(active.snapshot.expedition?.loadout.items).toEqual([item]);
  expect(active.snapshot.campaign.traits).toEqual([trait]);
  const bad = structuredClone(active.snapshot);
  bad.campaign.inventory.items.push(item as any);
  expect(() => validateSnapshot(bad, catalog)).toThrow();
  const ended = await terminal(app, "save", catalog);
  await send(app, {
    type: "settle-expedition",
    expeditionId: "run",
    terminalRef: ended.head,
  });
  const final = await opened(app);
  expect(final.snapshot.campaign.inventory).toEqual(
    before.snapshot.campaign.inventory,
  );
  expect(final.snapshot.campaign.traits).toEqual(
    before.snapshot.campaign.traits,
  );
});
it("rejects a checkpoint that replaces the entrusted baseline", async () => {
  const app = createGameApplication({ catalog, store: new MemoryGameStore() });
  await app.create({
    ...creation(),
    initial: { inventory: { capacity: 2, items: [item], equipment: [] } },
  });
  await send(app, { ...startCommand, itemIds: ["potion1"] });
  await send(app, {
    type: "battle-command",
    expeditionId: "run",
    command: { type: "roll-dice" },
  });
  await send(app, {
    type: "battle-command",
    expeditionId: "run",
    command: { type: "toggle-load", dieIndex: 0 },
  });
  const snapshot = (await opened(app)).snapshot;
  const checkpoint = snapshot.expedition!.undoStack[0];
  expect(checkpoint).toBeDefined();
  checkpoint.expedition.loadoutAtStart.items[0].maxCharges = 99;
  checkpoint.expedition.loadout.items[0].maxCharges = 99;
  expect(() => validateSnapshot(snapshot, catalog)).toThrow(
    "Checkpoint changed entrusted baseline",
  );
});
