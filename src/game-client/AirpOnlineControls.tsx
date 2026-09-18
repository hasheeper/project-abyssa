import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGameSession, useGameState } from "./react";
import { airpOnlineBusy, nextAirpOnlineWork, readAirpRelease, runAirpOnlineStep, type AirpOnlineCommand, type AirpPlayerPort } from "../game-runtime/airp-online-driver";
import type { GameSession } from "./session";

async function ready(session: GameSession, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (["loading", "recovering", "submitting"].includes(session.getSnapshot().status)) await new Promise<void>((resolve, reject) => {
    const cleanup = () => { unsubscribe(); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(signal?.reason); };
    const unsubscribe = session.subscribe(() => { if (!["loading", "recovering", "submitting"].includes(session.getSnapshot().status)) { cleanup(); resolve(); } });
    signal?.addEventListener("abort", abort, { once: true });
  });
  if (session.getSnapshot().status !== "ready") throw Object.assign(new Error("AIRP_LOCAL_SAVE_REQUIRED"), { code: "AIRP_LOCAL_SAVE_REQUIRED" });
}
function playerPort(session: GameSession): AirpPlayerPort {
  return {
    async read() {
      const result = await session.runtime.application.open(session.locator.saveId);
      if (!result.ok) throw result.error;
      if (result.record.schemaVersion !== 4 || !result.record.airpOnline || result.record.head.epoch !== session.locator.epoch) throw Error("AIRP_SAVE_CHANGED");
      return result.record;
    },
    async commit(command: AirpOnlineCommand, signal?: AbortSignal) {
      await ready(session, signal); await session.refresh({ background: true }); await ready(session, signal);
      const batch = await session.dispatch(command);
      if (!batch || batch.after.schemaVersion !== 4 || !batch.receipts.some(r => r.version === 4 && r.airpOnline?.command.type === command.type)) throw Object.assign(new Error("AIRP_LOCAL_COMMIT_FAILED"), { code: "AIRP_LOCAL_COMMIT_FAILED" });
      return batch.after;
    },
  };
}
function codeOf(error: unknown) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "AIRP_CONNECTION_FAILED";
}
/** The UI owns transport progress only; all durable choices and pending work are in the validated save. */
export function AirpOnlineControls({ allowConnect = false, docked = false, children }: { allowConnect?: boolean; docked?: boolean; children?: ReactNode }) {
  const session = useGameSession(), { record, status } = useGameState();
  const state = record?.schemaVersion === 4 ? record.airpOnline : undefined;
  const port = useMemo(() => playerPort(session), [session]);
  const work = nextAirpOnlineWork(state), workKey = work?.key ?? "";
  const [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8787/api/v1"), [releaseId, setReleaseId] = useState("");
  const configured = useRef<AbortController | null>(null);
  useEffect(() => () => configured.current?.abort(), [session]);
  useEffect(() => {
    if (!workKey) { setBusy(false); setError(""); return; }
    const controller = new AbortController(); let active = true;
    // Avoid starting network work in StrictMode's discarded effect setup.
    queueMicrotask(() => {
      if (!active) return;
      setBusy(true); setError("");
      void runAirpOnlineStep(port, controller.signal).catch(error => { if (active) setError(codeOf(error)); }).finally(() => { if (active) setBusy(false); });
    });
    return () => { active = false; controller.abort(); };
  }, [workKey, attempt, port]);
  if (!state) return null;
  const connection = state.connection, localBusy = status !== "ready";
  const connect = async () => {
    configured.current?.abort(); const controller = new AbortController(); configured.current = controller;
    setBusy(true); setError("");
    try {
      const release = await readAirpRelease(baseUrl.trim(), releaseId.trim(), controller.signal);
      controller.signal.throwIfAborted();
      await port.commit({ type: "airp-online-connect", baseUrl: baseUrl.trim(), release }, controller.signal);
    } catch (error) { if (!controller.signal.aborted) setError(codeOf(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const content = <section className="airp-online" aria-label="AIRP 应用连接">
    {!connection && allowConnect && <form onSubmit={event => { event.preventDefault(); void connect(); }}>
      <label>rp 应用接口<input aria-label="rp 应用接口" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} disabled={busy || localBusy}/></label>
      <label>AIRP Release ID<input aria-label="AIRP Release ID" value={releaseId} onChange={e => setReleaseId(e.target.value)} disabled={busy || localBusy}/></label>
      <button disabled={busy || localBusy || !releaseId.trim()} type="submit">绑定独立游玩实例</button>
      <p>在 rp 配好三类模型槽后填入 Release ID。这里不填写模型密钥。</p>
    </form>}
    {connection && <details><summary>{connection.binding ? "已连接 AIRP 应用" : "正在绑定游玩实例"}</summary><p>{connection.baseUrl}</p><p>Release：{connection.ticket.target.releaseId}</p><p>Session：{connection.binding?.sessionId ?? "待确认"}</p>
      {!state.entries.some(e => e.ticket) && <button disabled={localBusy || busy} onClick={() => void session.dispatch({ type: "airp-online-reset" })}>重新配置连接</button>}
    </details>}
    {work && !error && <p role="status">{busy ? ({ session: "正在创建／查回独立实例…", generate: "正在生成大纲、正文并格式化…", control: "正在确认后端状态…", cleanup: "正在查回并清理未采用的候选…" })[work.kind] : "请求已保存，等待处理。"}</p>}
    {error && <p role="alert">AIRP 操作未完成（{error}）。已保存的进度不会回滚。<button disabled={localBusy || busy} onClick={() => { if (!connection) void connect(); else { setError(""); setAttempt(n => n + 1); } }}>{connection ? "重试同一请求" : "重试连接"}</button></p>}
    {!work && connection?.binding && airpOnlineBusy(state) && <p>正文已冻结；读完后才会确认叙事记忆。</p>}
  </section>;
  return docked ? <details className="airp-story-tools" open={error ? true : undefined}>
    <summary>{error ? "AIRP · 操作未完成" : work ? "AIRP · 待同步" : "AIRP · 连接与记录"}</summary>
    <div className="airp-story-tools__panel">{content}{children}</div>
  </details> : content;
}
