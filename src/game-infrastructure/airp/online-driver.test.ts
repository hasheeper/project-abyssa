import { afterEach, describe, expect, it, vi } from "vitest";
import type { D5GameRecord } from "../../game-application";
import type { AirpOnlineState } from "../../game-application/airp/gameplay-contracts";
import { airpControlFixture } from "../../game-application/testing/airp-control-fixture";
import { airpSessionFixture } from "../../game-application/testing/airp-session-fixture";
import { nextAirpOnlineWork, runAirpOnlineStep, type AirpPlayerPort } from "../../game-runtime/airp-online-driver";
import { createAirpRpHttpClient } from "./rp-http-client";
import { withAirpBrowserLock } from "./browser-lock";

afterEach(() => vi.unstubAllGlobals());
function fixture(kind: "session" | "generate" | "control" = "generate") {
  const f = airpControlFixture(), s = airpSessionFixture();
  let state: AirpOnlineState = { version: 1, connection: { key: "connection-test", baseUrl: "http://127.0.0.1:8787/api/v1", ticket: s.ticket, binding: kind === "session" ? null : f.binding },
    entries: kind === "session" ? [] : [{ sceneId: "scene-test", instanceId: f.request.eventId, task: "return", source: kind === "control" ? "generated" : "requested", ticket: { ...f.scene.ticket }, accepted: kind === "control" ? f.scene : null, control: kind === "control" ? f.ticket : null, controlReceipt: null }] };
  // Transport-only projection. Full archive replay and native evidence have separate integration tests.
  const read = vi.fn(async () => ({ airpOnline: structuredClone(state) }) as D5GameRecord);
  const commit = vi.fn(async (command: Parameters<AirpPlayerPort["commit"]>[0]) => {
    if (command.type === "airp-online-bound") state.connection!.binding = command.binding;
    if (command.type === "airp-online-result") state.entries[0].source = "generated";
    if (command.type === "airp-online-control-done") state.entries[0].controlReceipt = command.receipt;
    return read();
  });
  const client = { createSession: vi.fn(async () => f.binding), submitGeneration: vi.fn(async () => f.receipt), readResult: vi.fn(async () => f.scene.result), control: vi.fn(async () => f.receipt) };
  const createClient = vi.fn(() => client as unknown as ReturnType<typeof createAirpRpHttpClient>);
  const lock = vi.fn(async <T>(_key: string, signal: AbortSignal, run: () => Promise<T>) => { signal.throwIfAborted(); return run(); });
  const controller = new AbortController(), port = { read, commit };
  const step = () => runAirpOnlineStep(port, controller.signal, { client: createClient, lock: (key, signal, run) => lock(key, signal, run) as ReturnType<typeof run> });
  return { f, port, read, commit, client, createClient, lock, controller, step, state, setState: (value: AirpOnlineState) => { state = value; } };
}

describe("durable online transport coordination", () => {
  it("does no work without a durable connection", async () => {
    const f = fixture(); f.state.connection = null;
    await f.step(); expect(f.lock).not.toHaveBeenCalled(); expect(f.createClient).not.toHaveBeenCalled();
  });
  it("rereads after acquiring the lock and ignores work another window completed", async () => {
    const f = fixture('session');
    f.lock.mockImplementation(async (_key, _signal, run) => { f.state.connection!.binding = f.f.binding; return run(); });
    await f.step(); expect(f.createClient).not.toHaveBeenCalled();
  });
  it("never sends a Session request until its durable identity was read under the lock", async () => {
    const f = fixture('session'); await f.step();
    expect(f.client.createSession).toHaveBeenCalledWith(f.state.connection!.ticket, f.controller.signal);
    expect(f.read.mock.invocationCallOrder[1]).toBeLessThan(f.client.createSession.mock.invocationCallOrder[0]);
    expect(f.commit).toHaveBeenCalledWith({ type: 'airp-online-bound', connectionKey: 'connection-test', binding: f.f.binding }, f.controller.signal);
    await f.step(); expect(f.client.createSession).toHaveBeenCalledTimes(1);
  });
  it("cancel after backend Session creation prevents local admission without pretending to undo the server", async () => {
    const f = fixture('session'); f.client.createSession.mockImplementation(async () => { f.controller.abort(); return f.f.binding; });
    await expect(f.step()).rejects.toThrow(); expect(f.commit).not.toHaveBeenCalled(); expect(f.state.connection!.binding).toBeNull();
  });
  it("late generation receipt after fallback goes straight to cleanup, never body parsing", async () => {
    const f = fixture(); f.client.submitGeneration.mockImplementation(async () => { f.state.entries[0].source = 'handwritten'; return f.f.receipt; });
    await f.step(); expect(f.client.readResult).not.toHaveBeenCalled();
    expect(f.commit).toHaveBeenCalledWith({ type: 'airp-online-discard-ready', sceneId: 'scene-test', receipt: f.f.receipt }, f.controller.signal);
  });
  it("fallback selected while reading the result still cannot admit generated text", async () => {
    const f = fixture(); f.client.readResult.mockImplementation(async () => { f.state.entries[0].source = 'handwritten'; return f.f.scene.result; });
    await f.step(); expect(f.commit.mock.calls[0][0].type).toBe('airp-online-discard-ready');
  });
  it("an interrupted result read retries the exact generation ticket", async () => {
    const f = fixture(); f.client.readResult.mockRejectedValueOnce(Error('offline'));
    await expect(f.step()).rejects.toThrow('offline'); expect(f.commit).not.toHaveBeenCalled();
    await f.step(); expect(f.client.submitGeneration).toHaveBeenCalledTimes(2);
    expect(f.client.submitGeneration.mock.calls[0]).toEqual(f.client.submitGeneration.mock.calls[1]);
    expect(f.commit.mock.calls[0][0].type).toBe('airp-online-result');
  });
  it("frozen text has no implicit confirmation job until real reading commits its ticket", async () => {
    const f = fixture(); f.state.entries[0].source = 'generated';
    expect(nextAirpOnlineWork(f.state)).toBeNull(); await f.step(); expect(f.client.control).not.toHaveBeenCalled();
  });
  it("control errors preserve the same intent; success closes it without another model attempt", async () => {
    const f = fixture('control'); f.client.control.mockRejectedValueOnce(Error('required updater rejected'));
    await expect(f.step()).rejects.toThrow(); expect(f.commit).not.toHaveBeenCalled();
    await f.step(); expect(f.client.control.mock.calls[0]).toEqual(f.client.control.mock.calls[1]);
    await f.step(); expect(f.client.control).toHaveBeenCalledTimes(2); expect(f.client.submitGeneration).not.toHaveBeenCalled();
  });
  it("cancel before acquiring ownership sends no request", async () => {
    const f = fixture(); f.controller.abort();
    await expect(f.step()).rejects.toThrow(); expect(f.createClient).not.toHaveBeenCalled();
  });
});

describe("same-origin browser ownership", () => {
  it("fails closed when Web Locks are unavailable", async () => {
    vi.stubGlobal('navigator', {});
    await expect(withAirpBrowserLock('x', new AbortController().signal, async () => 1)).rejects.toMatchObject({ code: 'AIRP_BROWSER_LOCK_UNAVAILABLE' });
  });
  it("requests an exclusive, abortable lock and checks cancellation again inside it", async () => {
    const controller = new AbortController(), run = vi.fn(async () => 1);
    const request = vi.fn(async (_key, _options, callback) => { controller.abort(); return callback(); });
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(withAirpBrowserLock('connection-key', controller.signal, run)).rejects.toThrow();
    expect(request).toHaveBeenCalledWith('connection-key', { mode: 'exclusive', signal: controller.signal }, expect.any(Function)); expect(run).not.toHaveBeenCalled();
  });
});
