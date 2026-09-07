import { it, expect } from "vitest";
import { MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
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
