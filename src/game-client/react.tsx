import { navigateTo, routeSearch } from "../shared/routing/location";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createBrowserGameRuntime } from "../game-runtime/browser";
import { GameSession, type ClientRuntime } from "./session";
import { gameHref, parseLocator, recordLocator, locatorMatchesRun } from "./navigation";
import "./game-client.css";
import { observeCommits } from "./observe-commits";
import { GameLoading } from "./GameLoading";
import { PlayerIdentityScope } from "./PlayerIdentityScope";
import { AirpGameGate } from "./airp-game/AirpGameGate";
import { GameFeedbackScope, GameOperationFeedback } from "./GameOperationFeedback";
import { InlineFeedback } from "../shared/ui/patterns/SceneFeedback";
import { GenerationFeedbackScope } from "./airp-generation/GenerationFeedbackScope";
import { activateBackgroundIdentity, registerBackgroundFactory } from "./airp-generation/background-tasks";
import { EstateFeedback } from "./EstateFeedback";

import { downloadJson, gameErrorText } from "./game-errors";
export { downloadJson, gameErrorText } from "./game-errors";

const Context = createContext<GameSession | null>(null);
export function GameSessionScope({ session, children }: { session: GameSession; children: ReactNode }) { return <Context.Provider value={session}><PlayerIdentityScope session={session}><GameFeedbackScope><GenerationFeedbackScope session={session}>{children}<EstateFeedback session={session}/></GenerationFeedbackScope></GameFeedbackScope></PlayerIdentityScope></Context.Provider>; }
export function useGameSession() { const session = useContext(Context); if (!session) throw new Error("Game session required"); return session; }
export function useGameState() { const session = useGameSession(); return useSyncExternalStore(session.subscribe, session.getSnapshot); }
export function GameProvider({ children, factory = createBrowserGameRuntime }: { children: ReactNode; factory?: () => ClientRuntime }) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const locator = parseLocator(routeSearch());
    if (!locator) { setError("请先选择档案，再进入游戏。"); return; }
    let active: GameSession | undefined, observer: ReturnType<typeof observeCommits> | undefined;
    let cancelled = false;
    // StrictMode's discarded setup must not open and validate the entire save a second time.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        active = new GameSession(factory(), locator, window.sessionStorage, record => observer?.notify(record.head));
        activateBackgroundIdentity(locator); registerBackgroundFactory(active, factory);
        const instance = active;
        observer = observeCommits(locator, () => instance.refresh({background:true}));
        setSession(instance); void instance.refresh();
      } catch { active?.dispose(); observer?.close(); setError("本机存档暂不可用，请重试。"); }
    });
    return () => { cancelled = true; observer?.close(); active?.dispose(); };
  }, [factory]);
  if (error) return <div className="game-client-gate" role="alert"><p>{error}</p><a href={gameHref("title")}>选择档案</a></div>;
  if (!session) return <GameLoading/>;
  return <GameSessionScope session={session}>{children}</GameSessionScope>;
}
export function GameGate({ children, allowPrologue = false, allowOpening = false, allowTutorial = false, allowAirp = false }: { children: ReactNode; allowPrologue?: boolean; allowOpening?: boolean; allowTutorial?: boolean; allowAirp?: boolean }) {
  const session = useGameSession(), state = useGameState();
  const entered = useRef(false), openingEntered = useRef(false);
  if (allowOpening && state.record?.schemaVersion === 4 && state.record.snapshot.campaign.opening?.status === "playing") openingEntered.current = true;
  const needsPrologue = !allowPrologue && state.record?.schemaVersion === 4 && state.record.snapshot.campaign.prologue?.status === "playing";
  const needsOpening = !allowOpening && !allowPrologue && !needsPrologue && state.record?.schemaVersion === 4 && state.record.snapshot.campaign.opening?.status === "playing";
  const tutorial = state.record && session.runtime.queries.tutorial(state.record);
  const directorReading = state.record?.schemaVersion === 4 ? state.record.airpDirector?.reading : null;
  const needsAirp = !allowAirp && !!state.record && (!!session.runtime.queries.narrative(state.record)?.locked || !!directorReading && !directorReading.paused);
  const needsTutorial = !!tutorial && ["pending", "active"].includes(tutorial.progress.status) && !needsPrologue && !needsOpening && !allowPrologue && !openingEntered.current &&
    (!allowTutorial || tutorial.progress.status === "active" && !locatorMatchesRun(state.record!, session.locator));
  useEffect(() => {
    if (needsPrologue) navigateTo(gameHref("prologue", session.locator), {replace:true,cinematic:true});
    else if (needsOpening) navigateTo(gameHref("mansion", session.locator), {replace:true,cinematic:true});
    else if (needsTutorial) navigateTo(gameHref("battle", recordLocator(state.record!)), {replace:true,cinematic:true});
    else if (needsAirp) navigateTo(gameHref("mansion", recordLocator(state.record!)), {replace:true});
  }, [needsPrologue, needsOpening, needsTutorial, needsAirp, session, state.record]);
  if (needsPrologue || needsOpening || needsTutorial || needsAirp) return <GameLoading/>;
  if (state.record && state.status === "ready") entered.current = true;
  if (!state.record && !state.error || !entered.current && ["loading", "recovering"].includes(state.status)) return <GameLoading/>;
  if (!state.record) return <div className="game-client-gate" role="alert">
    <p>{state.error && gameErrorText(state.error.code)}</p>
    {state.error && <><button onClick={() => void session.refresh()}>重试读取</button><button onClick={() => void downloadDiagnostic(session)}>导出诊断</button><a href={gameHref("title")}>选择档案</a></>}
  </div>;
  return <><div className="game-client-status" data-save-id={state.record.head.saveId} data-revision={state.record.head.revision} data-status={state.status}>
    {state.status === "recovering" ? <InlineFeedback tone="info" message="正在恢复进度…"/> : null}
    <GameOperationFeedback session={session} state={state}/>
  </div><AirpGameGate>{children}</AirpGameGate></>;
}
async function downloadDiagnostic(session: GameSession) {
  const result = await session.runtime.application.exportDiagnostic(session.locator.saveId);
  if (result.ok) downloadJson(result.archive, `abyssa-diagnostic-${session.locator.saveId}.json`);
}
