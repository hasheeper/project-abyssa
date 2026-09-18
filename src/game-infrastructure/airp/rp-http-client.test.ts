import { describe, expect, it, vi } from "vitest";
import { airpOnlineFixture } from "../../game-application/testing/airp-online-fixture";
import { createAirpRpHttpClient } from "./rp-http-client";
import { airpControlFixture } from "../../game-application/testing/airp-control-fixture";
import { airpSessionFixture } from "../../game-application/testing/airp-session-fixture";

const baseUrl = "http://127.0.0.1:8787/api/v1";
function queue(...responses: unknown[]) {
  return vi.fn<typeof fetch>(async () => {
    const item = responses.shift();
    if (item === undefined) throw new Error("Unexpected request");
    return item instanceof Response ? item : new Response(JSON.stringify({ data: item }), { headers: { "Content-Type": "application/json" } });
  });
}

describe("rp external AIRP HTTP client", () => {
  it("calls the native Interaction, exact Timeline and final Run Result", async () => {
    const f = airpOnlineFixture(), fetch = queue(f.receipt, f.page, f.nativeResult);
    const result = await createAirpRpHttpClient({ baseUrl, fetch }).generate(f.ticket);
    expect(result.text).toEqual(f.text);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      `${baseUrl}/conversation-threads/session-airp/interactions`,
      `${baseUrl}/conversation-threads/session-airp/timeline?branchId=branch-airp&limit=50`,
      `${baseUrl}/runs/run-final/result`,
    ]);
    const options = fetch.mock.calls[0][1]!;
    expect(options).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" });
    expect(JSON.parse(String(options.body))).toMatchObject({ version: "submit-interaction-command-v2", clientRequestId: f.request.requestId, payload: f.request });
    expect(options.headers).not.toHaveProperty("Authorization");
  });
  it("paginates until the exact floor; a later floor is not selected", async () => {
    const f = airpOnlineFixture(), first = structuredClone(f.page), last = structuredClone(f.page);
    first.timeline.floors = []; first.timeline.nextCursor = 4;
    last.timeline.floors.push({ ...structuredClone(f.floor), id: "later-floor", lifecycle: "incomplete" });
    const fetch = queue(f.receipt, first, last, f.nativeResult);
    const result = await createAirpRpHttpClient({ baseUrl, fetch }).generate(f.ticket);
    expect(result.origin.floorId).toBe(f.receipt.floorId);
    expect(String(fetch.mock.calls[2][0])).toContain("cursor=4");
  });
  it("does not retry a conflict or invent a new request ID", async () => {
    const f = airpOnlineFixture();
    const fetch = queue(new Response(JSON.stringify({ error: { code: "FLOOR_CHECKPOINT_CONFLICT", retryable: false, message: "private diagnostic" } }), { status: 409 }));
    const client = createAirpRpHttpClient({ baseUrl, fetch });
    await expect(client.generate(f.ticket)).rejects.toMatchObject({ code: "FLOOR_CHECKPOINT_CONFLICT", retryable: false, message: "FLOOR_CHECKPOINT_CONFLICT" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("marks ambiguous POST failures and lets the caller replay the same ticket", async () => {
    const f = airpOnlineFixture(), fetch = queue(f.receipt, f.page, f.nativeResult);
    fetch.mockRejectedValueOnce(new Error("connection lost"));
    const client = createAirpRpHttpClient({ baseUrl, fetch });
    await expect(client.generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_NETWORK_ERROR", outcomeUnknown: true });
    await client.generate(f.ticket);
    expect(fetch.mock.calls[0][1]?.body).toBe(fetch.mock.calls[1][1]?.body);
  });
  it("can recover a known receipt without submitting again", async () => {
    const f = airpOnlineFixture(), fetch = queue(f.page, f.nativeResult);
    await createAirpRpHttpClient({ baseUrl, fetch }).readResult(f.ticket, f.receipt);
    expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });
  it("returns the generation receipt separately so it can survive invalid text", async () => {
    const f = airpOnlineFixture(), fetch = queue(f.receipt);
    expect(await createAirpRpHttpClient({ baseUrl, fetch }).submitGeneration(f.ticket)).toEqual(f.receipt);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["confirm-scene", "discard-scene"] as const)("submits and verifies native %s, with read-only recovery", async action => {
    const f = airpControlFixture(action), fetch = queue(f.receipt, f.page, f.page);
    const client = createAirpRpHttpClient({ baseUrl, fetch });
    expect(await client.control(f.ticket)).toEqual(f.receipt);
    expect(await client.readControlResult(f.ticket, f.receipt)).toEqual(f.receipt);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).actionKey).toBe(action);
    expect(fetch.mock.calls.slice(1).every(([, init]) => init?.method === "GET")).toBe(true);
  });
  it("keeps the POST outcome uncertain if the subsequent checkpoint read loses connection", async () => {
    const f = airpControlFixture(), fetch = queue(f.receipt);
    await expect(createAirpRpHttpClient({ baseUrl, fetch }).control(f.ticket)).rejects.toMatchObject({ code: "AIRP_NETWORK_ERROR", outcomeUnknown: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never accepts a required Updater rejection just because POST was 200", async () => {
    const f = airpControlFixture(); f.floor.checkpoint.snapshot.restorable = false;
    const fetch = queue(f.receipt, f.page);
    await expect(createAirpRpHttpClient({ baseUrl, fetch }).control(f.ticket)).rejects.toMatchObject({ code: "airp-incomplete" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["0.1.0", "0.2.1", "0.3.0", "0.3.1", "0.3.2"])("creates an isolated %s Session through native endpoints and checks its exact empty branch", async version => {
    const f = airpSessionFixture(version), fetch = queue(f.release, { sessions: [] }, f.detail, f.branches, f.context);
    const client = createAirpRpHttpClient({ baseUrl, fetch });
    expect(await client.release(f.target.releaseId)).toEqual(f.target);
    expect(await client.createSession(f.ticket)).toMatchObject({ sessionId: f.detail.session.id, head: null });
    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "GET", "POST", "GET", "GET"]);
  });
  it("recovers a lost Session response by exact metadata without a second POST", async () => {
    const f = airpSessionFixture(), fetch = queue({ sessions: [f.detail.session] }, f.detail, f.branches, f.context);
    expect(await createAirpRpHttpClient({ baseUrl, fetch }).createSession(f.ticket)).toMatchObject({ sessionId: f.detail.session.id });
    expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });
  it("fails closed for duplicate Session candidates instead of choosing the newest", async () => {
    const f = airpSessionFixture(), fetch = queue({ sessions: [f.detail.session, { ...f.detail.session, id: "duplicate" }] });
    await expect(createAirpRpHttpClient({ baseUrl, fetch }).createSession(f.ticket)).rejects.toMatchObject({ code: "AIRP_SESSION_AMBIGUOUS" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects missing floors and repeated cursors without an unbounded poll", async () => {
    const f = airpOnlineFixture(); f.page.timeline.floors = [];
    const missing = queue(f.receipt, f.page);
    await expect(createAirpRpHttpClient({ baseUrl, fetch: missing }).generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_FLOOR_NOT_FOUND" });
    f.page.timeline.nextCursor = 3;
    const looping = queue(f.receipt, f.page, f.page);
    await expect(createAirpRpHttpClient({ baseUrl, fetch: looping }).generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_INVALID_CURSOR" });
    expect(looping).toHaveBeenCalledTimes(3);
  });
  it("limits response bytes, not just Content-Length", async () => {
    const f = airpOnlineFixture(), fetch = queue(new Response("x".repeat(600)));
    await expect(createAirpRpHttpClient({ baseUrl, fetch, maxResponseBytes: 512 }).generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_RESPONSE_TOO_LARGE" });
  });
  it("rejects invalid JSON and never treats an HTML error page as a result", async () => {
    const f = airpOnlineFixture();
    await expect(createAirpRpHttpClient({ baseUrl, fetch: queue(new Response("<html>error</html>")) }).generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_INVALID_RESPONSE" });
  });
  it("uses one deadline for POST and all subsequent reads", async () => {
    const f = airpOnlineFixture();
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => new Promise((_resolve, reject) => {
      const fail = () => reject(new Error("aborted"));
      if (init?.signal?.aborted) fail(); else init?.signal?.addEventListener("abort", fail, { once: true });
    }));
    await expect(createAirpRpHttpClient({ baseUrl, fetch, timeoutMs: 5 }).generate(f.ticket)).rejects.toMatchObject({ code: "AIRP_REQUEST_ABORTED", outcomeUnknown: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves external cancellation and does not swallow it as a successful empty scene", async () => {
    const f = airpOnlineFixture(), controller = new AbortController(); controller.abort();
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => { if (init?.signal?.aborted) throw new Error("aborted"); return new Response(); });
    await expect(createAirpRpHttpClient({ baseUrl, fetch }).generate(f.ticket, controller.signal)).rejects.toMatchObject({ code: "AIRP_REQUEST_ABORTED" });
  });
  it.each(["http://user:secret@localhost/api/v1", "file:///api/v1", "http://localhost/api/v1?key=secret", "http://localhost/wrong"])("rejects unsafe or incorrect base URL %s", url => {
    expect(() => createAirpRpHttpClient({ baseUrl: url })).toThrow();
  });
});
