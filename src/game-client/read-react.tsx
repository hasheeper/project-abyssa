import { routeSearch } from "../shared/routing/location";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createBrowserGameReader } from "../game-runtime/browser-reader";
import { ReadGameSession, type GameReader } from "./read-session";
import { observeCommits } from "./observe-commits";
import { gameHref, parseLocator } from "./navigation";
import { downloadJson, gameErrorText } from "./game-errors";
import "./game-client.css";
import { GameLoading } from "./GameLoading";

const Context = createContext<ReadGameSession | null>(null);
export function ReadSessionScope({
  session,
  children,
}: {
  session: ReadGameSession;
  children: ReactNode;
}) {
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useReadSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Read session required");
  return session;
}
export function useReadState() {
  const session = useReadSession();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}
export function ReadGameProvider({
  children,
  factory = createBrowserGameReader,
}: {
  children: ReactNode;
  factory?: () => GameReader;
}) {
  const [search, setSearch] = useState(() => routeSearch());
  const [session, setSession] = useState<ReadGameSession | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const locator = parseLocator(search);
  const identity = locator
    ? JSON.stringify([locator.saveId, locator.epoch])
    : "";
  useEffect(() => {
    const update = () => setSearch(routeSearch());
    window.addEventListener("popstate", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);
  useEffect(() => {
    setSession(null);
    setError("");
    const current = parseLocator(routeSearch());
    if (!current) return;
    let active: ReadGameSession | undefined;
    let observer: ReturnType<typeof observeCommits> | undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        active = new ReadGameSession(factory(), current);
        const instance = active;
        observer = observeCommits(current, () => instance.refresh());
        setSession(instance);
        void instance.refresh();
      } catch {
        observer?.close();
        active?.dispose();
        setError("本机存档暂不可用，请重试。");
      }
    });
    return () => {
      cancelled = true;
      observer?.close();
      active?.dispose();
    };
  }, [identity, factory, attempt]);
  if (!locator || error)
    return (
      <div className="game-client-gate" role="alert">
        <p>{error || "请先选择档案，再查看角色。"}</p>
        {error && (
          <button onClick={() => setAttempt((n) => n + 1)}>重试读取</button>
        )}
        <a href={gameHref("title")}>选择档案</a>
      </div>
    );
  if (
    !session ||
    session.locator.saveId !== locator.saveId ||
    session.locator.epoch !== locator.epoch
  )
    return <GameLoading/>;
  return <ReadSessionScope session={session}>{children}</ReadSessionScope>;
}
export function ReadGameGate({ children }: { children: ReactNode }) {
  const session = useReadSession(),
    state = useReadState();
  const diagnostic = async () => {
    const result = await session.runtime.exportDiagnostic(
      session.locator.saveId,
    );
    if (result.ok)
      downloadJson(
        result.archive,
        `abyssa-diagnostic-${session.locator.saveId}.json`,
      );
  };
  const recovery = (
    <>
      <button onClick={() => void session.refresh()}>重试读取</button>
      <button onClick={() => void diagnostic()}>导出诊断</button>
      <a href={gameHref("title")}>选择档案</a>
    </>
  );
  if (!state.record && !state.error) return <GameLoading/>;
  if (!state.record)
    return (
      <div className="game-client-gate" role={state.error ? "alert" : "status"}>
        <p>{state.error && gameErrorText(state.error.code)}</p>
        {state.error && recovery}
      </div>
    );
  return (
    <>
      <div
        className="game-client-status"
        data-save-id={state.record.head.saveId}
        data-revision={state.record.head.revision}
        data-status={state.status}
      >
        {state.error && (
          <span role="alert">
            显示上次读取的资料。{gameErrorText(state.error.code)} {recovery}
          </span>
        )}
      </div>
      {children}
    </>
  );
}
