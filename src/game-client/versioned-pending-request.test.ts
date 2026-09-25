import { it, expect } from "vitest";
import { MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { directorRuntime } from "../game-application/testing/airp-director-playthrough";
import {
  versionedApp,
  demoCreation,
  demoOpened,
  demoRequest,
  demoStart,
} from "../game-application/testing/demo-store-contract";
import {
  readVersionedPending,
  writeVersionedPending,
} from "./versioned-pending-request";
it("round-trips the full Director material above the legacy 64KB pending limit without widening old records", async () => {
  const f = await directorRuntime(), record = await f.read(), data = new Map<string, string>();
  const storage = {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => {data.set(key, value);}, removeItem: (key: string) => {data.delete(key);}};
  const material = record.airpDirector!.materials[record.airpDirector!.materialHash!];
  const request = {protocolVersion: 4 as const, saveId: record.head.saveId, expectedHead: record.head, clientRequestId: "full-director-material",
    command: {type: "airp-director-configure" as const, material}};
  expect(JSON.stringify(request).length).toBeGreaterThan(64000);
  writeVersionedPending(storage, request);
  expect(readVersionedPending(storage, record)).toEqual(request);
  const old = structuredClone(record); delete old.airpDirector;
  expect(readVersionedPending(storage, old)).toBeNull();
  expect(data.size).toBe(0);
});
it("persists protocol2 retries, rejects a foreign run and keeps legacy pending keys separate", async () => {
  const app = versionedApp(new MemoryGameStore<AnyGameRecord, AnyReceipt>());
  await app.create(demoCreation());
  await app.dispatch(demoRequest(await demoOpened(app), demoStart));
  const record = await demoOpened(app),
    data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const request = demoRequest(record, {
    type: "battle-command",
    runRef: record.snapshot.campaign.activeRunRef!,
    command: { type: "roll" },
  });
  writeVersionedPending(storage, request as any);
  expect(readVersionedPending(storage, record)).toEqual(request);
  data.set("abyssa:pending:v1:demo:epoch-demo", "legacy");
  writeVersionedPending(storage, {
    ...request,
    command: {
      ...request.command,
      runRef: { kind: "expedition", id: "another-run" },
    },
  } as any);
  expect(readVersionedPending(storage, record)).toBeNull();
  expect(data.get("abyssa:pending:v1:demo:epoch-demo")).toBe("legacy");
});
