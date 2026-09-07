import { describe, it, expect } from "vitest";
import {
  MemoryGameDatabase,
  MemoryGameStore,
} from "../../game-infrastructure/storage/memory";
import {
  GameStorageError,
  type AnyGameRecord,
  type AnyReceipt,
} from "../index";
import {
  DEMO_FIXTURE,
  demoFixture,
} from "../../game-runtime/testing/demo-fixtures";
import {
  demoCreation,
  demoOpened,
  demoRequest,
  demoStart,
  runDemoStoreContract,
  versionedApp,
} from "./demo-store-contract";
import { parseVersionedRequest } from "../../game-runtime/versioned-views";
import { requestKey } from "../transaction";
const stores = () => {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  return {
    db,
    first: new MemoryGameStore(db),
    second: new MemoryGameStore(db),
  };
};
describe("rules 2 transactional application and version routing", () => {
  it("validates durable receipts before replay and never accepts corrupted effect lists", async () => {
    const { db, first } = stores(),
      app = versionedApp(first);
    await app.create(demoCreation());
    const before = await demoOpened(app),
      input = demoRequest(before, demoStart);
    expect((await app.dispatch(input)).ok).toBe(true);
    const key = requestKey("demo", "epoch-demo", input.clientRequestId),
      receipt = structuredClone(db.receipts.get(key)!);
    (receipt as any).events = [
      { id: "bad", type: "unknown-effect", actorId: null, payload: {} },
    ];
    db.receipts.set(key, receipt);
    const saved = await demoOpened(app);
    expect((await app.dispatch(input)).ok).toBe(false);
    expect(await demoOpened(app)).toEqual(saved);
  });
  it("runs complete same-store contract, import/retraction and two connection CAS", async () => {
    const { first, second } = stores();
    expect(await runDemoStoreContract(first, second)).toMatchObject({
      saveCount: 3,
      cursor: 1,
    });
  });
  it.each(["storage-aborted", "storage-quota"] as const)(
    "%s rolls back and retries from the same head/RNG",
    async (code) => {
      const { first } = stores(),
        app = versionedApp(first);
      await app.create(demoCreation());
      const record = await demoOpened(app),
        input = demoRequest(record, demoStart),
        commit = first.commit.bind(first);
      first.commit = async () => {
        throw new GameStorageError(code, "injected");
      };
      expect(await app.dispatch(input)).toMatchObject({
        ok: false,
        error: { code },
      });
      expect(await demoOpened(app)).toEqual(record);
      expect(
        await first.receipt("demo", "epoch-demo", input.clientRequestId),
      ).toBeNull();
      first.commit = commit;
      expect((await app.dispatch(input)).ok).toBe(true);
    },
  );
  it("rejects wrong schema/protocol/digest, unknown catalog and initial overrides without replacing an old save", async () => {
    const { first, db } = stores(),
      app = versionedApp(first);
    const creation = demoCreation();
    expect(
      (
        await app.create({
          ...creation,
          contentRef: { ...creation.contentRef, digest: "bad" },
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await app.create({
          ...creation,
          contentRef: { ...creation.contentRef, catalogId: "abyssa.demo" },
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await app.create({
          ...creation,
          request: { ...creation.request, initial: { gold: 999 } },
        })
      ).ok,
    ).toBe(false);
    expect((await app.create(creation)).ok).toBe(true);
    const record = await demoOpened(app);
    expect(
      await app.dispatch({
        ...demoRequest(record, demoStart),
        protocolVersion: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: "version-mismatch" } });
    const corrupt = structuredClone(record);
    (corrupt as any).schemaVersion = 99;
    db.records.set("demo", corrupt);
    expect(await app.open("demo")).toMatchObject({
      ok: false,
      error: { code: "unsupported-schema" },
    });
    expect(await app.list()).toMatchObject({
      ok: true,
      saves: [{ status: "unavailable" }],
    });
    expect((await app.exportDiagnostic("demo")).ok).toBe(true);
    expect(() =>
      parseVersionedRequest({
        ...demoRequest(record, demoStart),
        protocolVersion: 99,
      }),
    ).toThrow();
  });
  it("validates progression, frozen faces, hand, queue, run identity and fact references in imports", async () => {
    const { first, db } = stores(),
      app = versionedApp(first);
    await app.create(demoCreation());
    await app.dispatch(demoRequest(await demoOpened(app), demoStart));
    const original = await demoOpened(app);
    const mutations: ((r: typeof original) => void)[] = [
      (r) => (r.snapshot.expedition!.run.party[0].config.faces[0].power = 99),
      (r) => r.snapshot.expedition!.encounter!.formation.push("foreign"),
      (r) => r.snapshot.expedition!.encounter!.enemyOrder.push("foreign"),
      (r) => (r.snapshot.expedition!.encounter!.id = "foreign:encounter:1"),
      (r) => (r.snapshot.campaign.progress.appliedGrowthIds = []),
      (r) => (r.facts[0].payload = { unknown: "payload" }),
      (r) => r.retractedFactIds.push("foreign"),
    ];
    for (const mutate of mutations) {
      const record = structuredClone(original);
      mutate(record);
      db.records.set("demo", record);
      expect((await app.open("demo")).ok).toBe(false);
    }
    db.records.set("demo", original);
    expect((await app.open("demo")).ok).toBe(true);
  });
  it("cannot forge unsupported covenant handlers or invalid profiles at registration", () => {
    expect(() =>
      demoFixture((c) => {
        c.characters.marietta.covenantId = "covenant.marietta";
      }),
    ).toThrow();
    expect(DEMO_FIXTURE.ref.rulesVersion).toBe(2);
  });
});
