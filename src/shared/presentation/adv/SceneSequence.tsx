import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SceneArrivalTitle } from "../../transition/SceneArrivalTitle";
import "../../transition/transition.css";
import "./scene-sequence.css";
import { prepareImages } from "../../loading/images";

export type SceneFrame = {id: string; kind: "battle" | "adv"; content: ReactNode; assets?: readonly string[];
  arrival?: {background: string; eyebrow: string; title: string}};
type Phase = "idle" | "out" | "in" | "prepare" | "arrival";
const Context = createContext(false);
const EntranceContext = createContext(false);
export const useSceneSequenceBusy = () => useContext(Context);
/** Initial actors are revealed by the scene, and must not start another seat entrance afterwards. */
export const useSceneSequenceEntrance = () => useContext(EntranceContext);
export const SCENE_SEQUENCE_MS = {battleOut: 520, battleIn: 760, advOut: 460, advIn: 800, arrival: 2200} as const;

/** Only one scene is mounted. Outgoing props stay frozen until its exit finishes. */
export function SceneSequence({frame, blocked = false, openingBlocked = false}: {frame: SceneFrame; blocked?: boolean; openingBlocked?: boolean}) {
  const [shown, setShown] = useState(frame);
  const [phase, setPhase] = useState<Phase>(frame.kind === "adv" ? "prepare" : "idle");
  const last = useRef(frame), incoming = useRef(frame);
  incoming.current = frame;
  const current = phase !== "out" && frame.id === shown.id ? frame : last.current;
  const locked = phase !== "idle" || frame.id !== shown.id;
  useLayoutEffect(() => {
    if (phase !== "out" && frame.id === shown.id) last.current = frame;
    if (phase === "idle" && frame.id !== shown.id && !blocked) setPhase("out");
  }, [frame, shown.id, phase, blocked]);
  useLayoutEffect(() => {
    if (phase === "idle" || phase === "prepare" && openingBlocked) return;
    let active = true;
    const finish = async () => {
      if (phase === "prepare" || phase === "out") await preloadSceneAssets([
        ...(incoming.current.assets ?? []), ...(incoming.current.arrival ? [incoming.current.arrival.background] : [])
      ]);
      if (!active) return;
      if (phase === "prepare") {setPhase(incoming.current.arrival ? "arrival" : "in"); return;}
      if (phase === "arrival") {setPhase("in"); return;}
      if (phase === "out") {
        const next = incoming.current;
        last.current = next;
        setShown(next);
        setPhase(next.arrival ? "arrival" : "in");
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
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = shown.kind === "battle" ? phase === "out" ? SCENE_SEQUENCE_MS.battleOut : SCENE_SEQUENCE_MS.battleIn : phase === "out" ? SCENE_SEQUENCE_MS.advOut : SCENE_SEQUENCE_MS.advIn;
    const timer = window.setTimeout(() => void finish(), phase === "prepare" || reduced || document.hidden ? 0 : ms);
    const hide = () => { if (document.hidden) { window.clearTimeout(timer); finish(); } };
    document.addEventListener("visibilitychange", hide);
    return () => {active = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", hide);};
  }, [phase, shown.id, shown.kind, openingBlocked]);
  useLayoutEffect(() => {void preloadSceneAssets(frame.assets);}, [frame.id]);
  const arrival = current.arrival;
  const introducing = !!arrival && (phase === "prepare" || phase === "arrival");
  return <Context.Provider value={locked}><EntranceContext.Provider value={current.kind === "adv"}>
    <div className="scene-sequence" data-scene={current.kind} data-scene-id={current.id} data-phase={phase} aria-busy={locked}>
      {arrival && (introducing || phase === "in") && <div className="scene-sequence__arrival" role="region" aria-label={arrival.title}>
        <div className="scene-sequence__arrival-bg" style={{backgroundImage:`url("${arrival.background}")`}}/>
        <SceneArrivalTitle eyebrow={arrival.eyebrow} title={arrival.title} staticDisplay/>
      </div>}
      <div className="scene-sequence__frame" key={shown.id} inert={locked || undefined}>{!introducing && current.content}</div>
    </div>
  </EntranceContext.Provider></Context.Provider>;
}

function preloadSceneAssets(urls: readonly string[] = []) {
  // Global download preparation owns the bytes; local preparation shares one bounded decode cache.
  return Promise.race([prepareImages(urls).catch(() => undefined), new Promise<void>(resolve => setTimeout(resolve, 3000))]);
}
