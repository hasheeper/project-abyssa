import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SceneArrivalTitle } from "../../transition/SceneArrivalTitle";
import "../../transition/transition.css";
import "./scene-sequence.css";
import { prepareImages } from "../../loading/images";
import { useTutorialSuspension } from "../../tutorial";
import { useUiMotion } from "../../ui/motion/UiMotionProvider";

export type SceneFrame = {id: string; kind: "battle" | "adv"; content: ReactNode; assets?: readonly string[];
  /** ADV location changes fade through black without replaying the cast entrance. */
  backdrop?: string;
  /** The page styles its physical board; the scene background stays stationary. */
  battleMotion?: "board";
  arrival?: {background: string; eyebrow: string; title: string}};
type Phase = "idle" | "out" | "in" | "prepare" | "arrival" | "cover" | "covered" | "uncover";
const Context = createContext(false);
const EntranceContext = createContext(false);
export const useSceneSequenceBusy = () => useContext(Context);
/** Initial actors are revealed by the scene, and must not start another seat entrance afterwards. */
export const useSceneSequenceEntrance = () => useContext(EntranceContext);
export const SCENE_SEQUENCE_MS = {battleOut: 520, battleIn: 760, boardIn: 960, advOut: 460, advIn: 800, arrival: 2200, cover: 360, covered: 140, uncover: 420} as const;

/** Only one scene is mounted. Outgoing props stay frozen until its exit finishes. */
export function SceneSequence({frame, blocked = false, openingBlocked = false}: {frame: SceneFrame; blocked?: boolean; openingBlocked?: boolean}) {
  const {reduced} = useUiMotion();
  const [shown, setShown] = useState(frame);
  const [phase, setPhase] = useState<Phase>(frame.kind === "adv" || frame.battleMotion === "board" ? "prepare" : "idle");
  const last = useRef(frame), incoming = useRef(frame);
  const root = useRef<HTMLDivElement>(null);
  const settled = useRef(new Set<EventTarget>());
  incoming.current = frame;
  const matchesShown = frame.id === shown.id && frame.backdrop === shown.backdrop;
  const current = phase !== "out" && phase !== "cover" && matchesShown ? frame : last.current;
  const locked = phase !== "idle" || !matchesShown;
  const curtained = phase === "cover" || phase === "covered" || phase === "uncover";
  useTutorialSuspension(locked || current.kind === "adv");
  useLayoutEffect(() => { if (phase === "in") settled.current.clear(); }, [phase]);
  useLayoutEffect(() => {
    if (phase !== "out" && phase !== "cover" && matchesShown) last.current = frame;
    if (phase === "idle" && !matchesShown && !blocked) {
      setPhase(frame.kind === "adv" && shown.kind === "adv" && frame.backdrop !== shown.backdrop ? "cover" : "out");
    }
  }, [frame, shown.id, shown.kind, shown.backdrop, matchesShown, phase, blocked]);
  useLayoutEffect(() => {
    if (phase === "idle" || phase === "prepare" && openingBlocked) return;
    let active = true;
    let paintFrame = 0;
    const finish = async () => {
      if (phase === "prepare" || phase === "out" || phase === "cover") await preloadSceneAssets([
        ...(incoming.current.assets ?? []), ...(incoming.current.arrival ? [incoming.current.arrival.background] : [])
      ]);
      if (!active) return;
      if (phase === "cover") {
        // Keep the old background, cast and line until the curtain is opaque.
        const next = incoming.current;
        last.current = next;
        setShown(next);
        setPhase(reduced || document.hidden ? "idle" : "covered");
        return;
      }
      if (phase === "covered") {setPhase(reduced || document.hidden ? "idle" : "uncover"); return;}
      if (phase === "prepare") {
        const enter = () => {
          if (!active) return;
          const next = incoming.current;
          setPhase(next.arrival ? "arrival" : next.battleMotion === "board" && (reduced || document.hidden) ? "idle" : "in");
        };
        // Give the mounted board a paint opportunity before starting its clock.
        // Decoded images alone do not mean its SVGs, filters and layers are painted.
        if (incoming.current.battleMotion === "board" && !reduced && !document.hidden) {
          paintFrame = requestAnimationFrame(() => {paintFrame = requestAnimationFrame(enter);});
        } else enter();
        return;
      }
      if (phase === "arrival") {setPhase("in"); return;}
      if (phase === "out") {
        const next = incoming.current;
        last.current = next;
        setShown(next);
        setPhase(next.battleMotion === "board" ? "prepare" : next.arrival ? "arrival" : "in");
      } else setPhase("idle");
    };
    if (phase === "arrival") {
      let remaining = SCENE_SEQUENCE_MS.arrival as number, started = 0, timer: number | undefined;
      const resume = () => { started = performance.now(); timer = window.setTimeout(() => void finish(), remaining); };
      const visibility = () => {
        if (document.hidden) { if (timer !== undefined) remaining -= performance.now() - started; window.clearTimeout(timer); timer = undefined; }
        else resume();
      };
      if (!document.hidden) resume();
      document.addEventListener("visibilitychange", visibility);
      return () => {active = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", visibility);};
    }
    const ms = phase === "cover" || phase === "covered" || phase === "uncover" ? SCENE_SEQUENCE_MS[phase]
      : shown.kind === "battle" ? phase === "out" ? SCENE_SEQUENCE_MS.battleOut : shown.battleMotion === "board" ? SCENE_SEQUENCE_MS.boardIn : SCENE_SEQUENCE_MS.battleIn : phase === "out" ? SCENE_SEQUENCE_MS.advOut : SCENE_SEQUENCE_MS.advIn;
    // Participating animationend events are authoritative. A delayed first paint must
    // not be cut short by a mount-time timer; retain only a missing-CSS failsafe.
    const duration = phase === "in" && shown.battleMotion === "board" ? ms * 3 : ms;
    const timer = window.setTimeout(() => void finish(), phase === "prepare" || reduced || document.hidden ? 0 : duration);
    const hide = () => { if (document.hidden) { window.clearTimeout(timer); cancelAnimationFrame(paintFrame); void finish(); } };
    document.addEventListener("visibilitychange", hide);
    return () => {active = false; window.clearTimeout(timer); cancelAnimationFrame(paintFrame); document.removeEventListener("visibilitychange", hide);};
  }, [phase, shown.id, shown.kind, shown.battleMotion, openingBlocked, reduced]);
  useLayoutEffect(() => {void preloadSceneAssets(frame.assets);}, [frame.id, frame.backdrop]);
  const arrival = current.arrival;
  const introducing = !!arrival && (phase === "prepare" || phase === "arrival");
  return <Context.Provider value={locked}><EntranceContext.Provider value={current.kind === "adv"}>
    <div ref={root} className="scene-sequence" data-scene={current.kind} data-scene-id={current.id} data-phase={phase} data-battle-motion={current.battleMotion} data-reduced={reduced || undefined} aria-busy={locked}
      style={{"--scene-cover-ms":`${SCENE_SEQUENCE_MS.cover}ms`,"--scene-uncover-ms":`${SCENE_SEQUENCE_MS.uncover}ms`} as CSSProperties}
      onAnimationEnd={event => {
        // Join the real entrance tracks: a settled board must not cut off the
        // last die or dialogue. Ignore shorter opacity and combat animations.
        if (phase === "in" && current.battleMotion === "board" && event.target instanceof HTMLElement &&
          event.target.dataset.sceneSettle === event.animationName) {
          settled.current.add(event.target);
          const participants = root.current?.querySelectorAll("[data-scene-settle]");
          if (participants && [...participants].every(node => settled.current.has(node))) setPhase("idle");
        }
      }}>
      {arrival && (introducing || phase === "in") && <div className="scene-sequence__arrival" role="region" aria-label={arrival.title}>
        <div className="scene-sequence__arrival-bg" style={{backgroundImage:`url("${arrival.background}")`}}/>
        <SceneArrivalTitle eyebrow={arrival.eyebrow} title={arrival.title} staticDisplay/>
      </div>}
      <div className="scene-sequence__frame" key={shown.id} inert={locked || undefined}>{!introducing && current.content}</div>
      {curtained && <div className="scene-sequence__curtain" aria-hidden="true"/>}
    </div>
  </EntranceContext.Provider></Context.Provider>;
}

function preloadSceneAssets(urls: readonly string[] = []) {
  // Global download preparation owns the bytes; local preparation shares one bounded decode cache.
  return Promise.race([prepareImages(urls).catch(() => undefined), new Promise<void>(resolve => setTimeout(resolve, 3000))]);
}
