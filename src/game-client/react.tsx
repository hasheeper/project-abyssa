import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createBrowserGameRuntime } from "../game-runtime/browser";
import { GameSession, type ClientRuntime } from "./session";
import { gameHref, parseLocator } from "./navigation";
import "./game-client.css";
import { observeCommits } from "./observe-commits";
import { GameLoading } from "./GameLoading";

import { downloadJson, gameErrorText } from "./game-errors";
export { downloadJson, gameErrorText } from "./game-errors";

const Context = createContext<GameSession | null>(null);
export function GameSessionScope({ session, children }: { session: GameSession; children: ReactNode }) { return <Context.Provider value={session}>{children}</Context.Provider>; }
export function useGameSession() { const session = useContext(Context); if (!session) throw new Error("Game session required"); return session; }
export function useGameState() { const session = useGameSession(); return useSyncExternalStore(session.subscribe, session.getSnapshot); }
export function GameProvider({ children, factory = createBrowserGameRuntime }: { children: ReactNode; factory?: () => ClientRuntime }) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const locator = parseLocator(window.location.search);
    if (!locator) { setError("请先选择档案，再进入游戏。"); return; }
    let active: GameSession | undefined, observer: ReturnType<typeof observeCommits> | undefined;
    let cancelled = false;
    // StrictMode's discarded setup must not open and validate the entire save a second time.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        active = new GameSession(factory(), locator, window.sessionStorage, record => observer?.notify(record.head));
        const instance = active;
        observer = observeCommits(locator, () => instance.refresh({background:true}));
        setSession(instance); void instance.refresh();
      } catch { active?.dispose(); observer?.close(); setError("本机存档暂不可用，请重试。"); }
    });
    return () => { cancelled = true; observer?.close(); active?.dispose(); };
  }, [factory]);
  if (error) return <div className="game-client-gate" role="alert"><p>{error}</p><a href={gameHref("title")}>选择档案</a></div>;
  if (!session) return <GameLoading/>;
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function GameGate({ children }: { children: ReactNode }) {
  const session = useGameSession(), state = useGameState();
  const entered = useRef(false);
  if (state.record && state.status === "ready") entered.current = true;
  if (!state.record && !state.error || !entered.current && ["loading", "recovering"].includes(state.status)) return <GameLoading/>;
  if (!state.record) return <div className="game-client-gate" role="alert">
    <p>{state.error && gameErrorText(state.error.code)}</p>
    {state.error && <><button onClick={() => void session.refresh()}>重试读取</button><button onClick={() => void downloadDiagnostic(session)}>导出诊断</button><a href={gameHref("title")}>选择档案</a></>}
  </div>;
  return <><div className="game-client-status" data-save-id={state.record.head.saveId} data-revision={state.record.head.revision} data-status={state.status}>
    {state.status === "recovering" ? <span role="status">正在恢复进度…</span> : null}
    {state.error && <span role="alert">{gameErrorText(state.error.code)} <button onClick={() => void session.refresh()}>重新读取 / 重试</button><button onClick={() => void downloadDiagnostic(session)}>导出诊断</button></span>}
  </div>{children}</>;
}
async function downloadDiagnostic(session: GameSession) {
  const result = await session.runtime.application.exportDiagnostic(session.locator.saveId);
  if (result.ok) downloadJson(result.archive, `abyssa-diagnostic-${session.locator.saveId}.json`);
}
