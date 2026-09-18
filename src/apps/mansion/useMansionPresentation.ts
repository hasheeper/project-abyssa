import { useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import type { CommittedBatch } from "../../game-client/session";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import { prepareMansionAssets, retireMansionArtwork, type MansionArtwork } from "./mansion-assets";
import { waitForMansionImages, waitForMansionPaint } from "./mansion-image-readiness";
import { initialMansionPresentation, mansionPresentationReducer, MANSION_PASSAGE_TIMING, sameMansionClock, type MansionClock } from "./mansion-presentation-state";
import type { MansionWeather } from "./mansion-weather";

type Options = {
  clock: MansionClock;
  weather?: MansionWeather;
  next: MansionClock | null;
  canAdvance: boolean;
  suspended: boolean;
  sceneRef: RefObject<HTMLElement | null>;
  advance: () => Promise<CommittedBatch | null>;
  refresh: () => Promise<void>;
};

/** One loading screen, one job, one displayed clock. The underlying scene stays
 * mounted. Timers only pace the cover/reveal; image readiness is still the
 * prerequisite for revealing. The session remains the only owner of saved time. */
export function useMansionPresentation(options: Options) {
  const [state, send] = useReducer(mansionPresentationReducer, options.clock, initialMansionPresentation);
  const latest = useRef(options); latest.current = options;
  const current = useRef(state); current.current = state;
  const artwork = useRef<MansionArtwork | null>(null);
  const advancing = useRef(false);
  const routePhase = useContext(SceneTransitionContext)?.phase ?? "idle";
  const visibleSince = useRef<{id: number; at: number}>({id: -1, at: 0});

  // An external refresh follows the same opaque handoff instead of changing
  // CSS variables on a visible scene. A pending save publishes through its job.
  useLayoutEffect(() => {
    if (state.step !== "ready" && state.step !== "paint" && state.step !== "reveal") return;
    const clockChanged=!sameMansionClock(options.clock,state.clock);
    if (clockChanged || !sameWeather(state.artwork,options.weather)) {
      send({type: "start", job: clockChanged ? "sync" : "weather", destination: options.clock});
    }
  }, [options.clock.day, options.clock.phase, options.weather, state.step, state.clock.day, state.clock.phase, state.artwork]);

  useEffect(() => {
    if (state.step !== "cover") return;
    const controller = new AbortController();
    void (async () => {
      await wait(reducedMotion() ? 0 : MANSION_PASSAGE_TIMING.cover, controller.signal);
      if (!controller.signal.aborted) send({type: "covered", id: state.id});
    })();
    return () => controller.abort();
  }, [state.id, state.step]);

  useEffect(() => {
    if (state.step !== "work") return;
    const controller = new AbortController();
    const {signal} = controller;
    const id = state.id, job = state.job;
    void (async () => {
      try {
        // Wait until the solid loading screen has actually been painted before
        // a synchronous/fast save can change any of the scene's data.
        await waitForMansionPaint(signal);
        if (signal.aborted) return;
        if (job === "advance") {
          const batch = await latest.current.advance();
          if (signal.aborted) return;
          if (!batch) throw Error("时段尚未确认，请重试读取以恢复进度。");
        } else if (job === "refresh") {
          await latest.current.refresh();
          if (signal.aborted) return;
        }
        const preparedClock = {...latest.current.clock};
        const weather=latest.current.weather??"clear";
        if (!artwork.current || artwork.current.phase !== preparedClock.phase || !sameWeather(artwork.current,weather)) {
          const result = await prepareMansionAssets(signal, preparedClock.phase,weather);
          if (signal.aborted) { result.dispose(); return; }
          artwork.current = result;
        }
        if (signal.aborted) return;
        send({type: "prepared", id, artwork: artwork.current, clock: preparedClock});
      } catch (error) {
        if (!signal.aborted) send({type: "failed", id, error: job === "advance"
          ? "时段尚未确认，请重试读取以恢复进度。"
          : error instanceof Error && error.message.startsWith("时段") ? error.message : "洋馆景致暂未准备完成，进度已保留。"});
      }
    })();
    return () => controller.abort();
  }, [state.id, state.step, state.job]);

  useEffect(() => {
    if (state.step !== "paint" || options.suspended || routePhase !== "idle") return;
    const controller = new AbortController();
    const {signal} = controller;
    const root = options.sceneRef.current?.closest<HTMLElement>(".mansion-app") ?? options.sceneRef.current;
    if (visibleSince.current.id !== state.id) visibleSince.current = {id: state.id, at: performance.now()};
    const minimum = reducedMotion() ? 0 : MANSION_PASSAGE_TIMING.settle;
    void (async () => {
      try {
        if (!root) throw Error("missing mansion scene");
        await waitForMansionImages(root, signal);
        await wait(Math.max(0, minimum - (performance.now() - visibleSince.current.at)), signal);
        await waitForMansionPaint(signal);
        if (signal.aborted) return;
        if (!sameMansionClock(latest.current.clock, state.clock) || !sameWeather(state.artwork,latest.current.weather)) {
          send({type: "start", job: "sync", destination: latest.current.clock});
        } else {
          send({type: "reveal", id: state.id});
        }
      } catch {
        if (!signal.aborted) send({type: "failed", id: state.id, error: "进度已保留，画面尚未准备完成。请重试读取。"});
      }
    })();
    return () => controller.abort();
  }, [state.id, state.step, state.clock.day, state.clock.phase, options.sceneRef, options.suspended, routePhase]);

  useEffect(() => {
    if (state.step !== "reveal" || options.suspended || routePhase !== "idle") return;
    const controller = new AbortController();
    void (async () => {
      await wait(reducedMotion() ? 0 : MANSION_PASSAGE_TIMING.reveal, controller.signal);
      if (!controller.signal.aborted && sameMansionClock(latest.current.clock, state.clock) && sameWeather(state.artwork,latest.current.weather)) {
        advancing.current = false;
        send({type: "ready", id: state.id});
      }
    })();
    return () => controller.abort();
  }, [state.id, state.step, state.clock.day, state.clock.phase, options.suspended, routePhase]);

  // Retire the outgoing image only after React has committed its replacement.
  // Preparing the next phase must not clear the visible scene.
  useEffect(() => () => { retireMansionArtwork(state.artwork); }, [state.artwork]);
  useEffect(() => () => { retireMansionArtwork(artwork.current); }, []);
  const advance = useCallback(() => {
    const input = latest.current;
    if (advancing.current || current.current.step !== "ready" || !input.canAdvance || input.suspended || !input.next || routePhase !== "idle") return;
    advancing.current = true;
    send({type: "start", job: "advance", destination: input.next});
  }, [routePhase]);
  const retry = useCallback(() => {
    if (current.current.step !== "error") return;
    advancing.current = false;
    send({type: "start", job: current.current.job==="weather" ? "weather" : "refresh", destination: latest.current.clock});
  }, []);
  return {...state, advance, retry, motionPaused: options.suspended || routePhase === "closed" || routePhase === "closing", blocked: state.step !== "ready" || options.suspended || routePhase !== "idle"};
}

function reducedMotion() { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }
function sameWeather(artwork:MansionArtwork|null,weather:MansionWeather="clear") {return (artwork?.weather??"clear")===weather;}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, {once: true});
    if (signal.aborted) finish();
  });
}
