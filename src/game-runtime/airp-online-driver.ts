import type { D5GameRecord } from "../game-application";
import { airpOnlineHead, type AirpOnlineCommand, type AirpOnlineState } from "../game-application/airp/gameplay";
import { createAirpRpHttpClient } from "../game-infrastructure/airp/rp-http-client";
import { withAirpBrowserLock } from "../game-infrastructure/airp/browser-lock";
export { airpOnlineBusy, airpOnlineHidden } from "../game-application/airp/gameplay";
export type { AirpOnlineCommand } from "../game-application/airp/gameplay-contracts";

export type AirpPlayerPort = { read(): Promise<D5GameRecord>; commit(command: AirpOnlineCommand, signal?: AbortSignal): Promise<D5GameRecord> };
export function nextAirpOnlineWork(state: AirpOnlineState | undefined) {
  const connection = state?.connection;
  if (!connection) return null;
  if (!connection.binding) return { kind: "session" as const, key: connection.key, sceneId: null };
  const entry = state.entries.find(e => e.ticket && !e.controlReceipt);
  if (!entry) return null;
  if (entry.control) return { kind: "control" as const, key: entry.control.payload.requestId, sceneId: entry.sceneId };
  if (entry.source === "requested") return { kind: "generate" as const, key: entry.ticket!.request.requestId, sceneId: entry.sceneId };
  if (entry.source === "handwritten") return { kind: "cleanup" as const, key: `cleanup:${entry.ticket!.request.requestId}`, sceneId: entry.sceneId };
  return null; // A frozen generated scene waits for actual completed reading, never an animation callback.
}

/** One durable transport step. No model loop, implicit source choice, campaign writes or provider credentials. */
export async function runAirpOnlineStep(port: AirpPlayerPort, signal: AbortSignal, options: {
  client?: typeof createAirpRpHttpClient;
  lock?: typeof withAirpBrowserLock;
} = {}): Promise<void> {
  const initial = await port.read(), connection = initial.airpOnline?.connection, work = nextAirpOnlineWork(initial.airpOnline);
  if (!connection || !work) return;
  await (options.lock ?? withAirpBrowserLock)(`abyssa-airp:${connection.key}`, signal, async () => {
    const record = await port.read(), current = record.airpOnline?.connection;
    // Another tab may already have committed this step while this caller was waiting for the lock.
    if (!current || current.key !== connection.key || nextAirpOnlineWork(record.airpOnline)?.key !== work.key) return;
    signal.throwIfAborted();
    const client = (options.client ?? createAirpRpHttpClient)({ baseUrl: current.baseUrl });
    const commit = async (command: AirpOnlineCommand) => { signal.throwIfAborted(); return port.commit(command, signal); };
    if (work.kind === "session") {
      const binding = await client.createSession(current.ticket, signal);
      await commit({ type: "airp-online-bound", connectionKey: current.key, binding });
      return;
    }
    const entry = record.airpOnline!.entries.find(e => e.sceneId === work.sceneId)!;
    if (work.kind === "control") {
      const receipt = await client.control(entry.control!, signal);
      await commit({ type: "airp-online-control-done", sceneId: entry.sceneId, requestId: entry.control!.payload.requestId, receipt });
      return;
    }
    const receipt = await client.submitGeneration(entry.ticket!, signal);
    const latest = (await port.read()).airpOnline?.entries.find(e => e.sceneId === entry.sceneId);
    if (latest?.source === "handwritten") {
      await commit({ type: "airp-online-discard-ready", sceneId: entry.sceneId, receipt });
      return;
    }
    const result = await client.readResult(entry.ticket!, receipt, signal);
    const after = (await port.read()).airpOnline?.entries.find(e => e.sceneId === entry.sceneId);
    if (after?.source === "handwritten") await commit({ type: "airp-online-discard-ready", sceneId: entry.sceneId, receipt: { ...receipt, ...airpOnlineHead(result.origin) } });
    else await commit({ type: "airp-online-result", sceneId: entry.sceneId, result });
  });
}

export async function readAirpRelease(baseUrl: string, releaseId: string, signal?: AbortSignal) {
  return createAirpRpHttpClient({ baseUrl }).release(releaseId, signal);
}
