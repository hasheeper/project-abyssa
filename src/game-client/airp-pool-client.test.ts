import { expect, it } from "vitest";
import { parseVersionedRequest } from "../game-runtime/versioned-views";
import { parseD5Request } from "../game-application";
import { readVersionedPending, writeVersionedPending } from "./versioned-pending-request";
import type { D5GameRecord, D5Request } from "../game-application";

it.each([
  { type: "airp-finish", instanceId: "ripple:test" },
  { type: "airp-visit", instanceId: "ripple:test", actorId: "eustice", locationId: "mansion.common-room" },
] as const)("client/pending syntax preserves $type while old application content rejects it", command => {
  const head = { saveId: "test", epoch: "epoch", revision: 4 };
  const request: D5Request = { protocolVersion: 4, saveId: "test", expectedHead: head, clientRequestId: "client", command };
  expect(parseVersionedRequest(request)).toEqual(request);
  expect(() => parseD5Request(request, false, 1)).toThrow();
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  writeVersionedPending(storage, request);
  // Pending-reader identity fixture only; does not claim to be a valid game archive.
  expect(readVersionedPending(storage, { schemaVersion: 4, head } as D5GameRecord)).toEqual(request);
});
