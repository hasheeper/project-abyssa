import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./scene-sequence.css";

export type SceneFrame = {id: string; kind: "battle" | "adv"; content: ReactNode; assets?: readonly string[]};
type Phase = "idle" | "out" | "in" | "prepare";
const Context = createContext(false);
export const useSceneSequenceBusy = () => useContext(Context);
export const SCENE_SEQUENCE_MS = {battleOut: 520, battleIn: 760, advOut: 460, advIn: 800} as const;

/** Only one scene is mounted. Outgoing props stay frozen until its exit finishes. */
export function SceneSequence({frame, blocked = false}: {frame: SceneFrame; blocked?: boolean}) {
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
    if (phase === "idle") return;
    let active = true;
    const finish = async () => {
      if (phase === "prepare" || phase === "out") await preloadSceneAssets(incoming.current.assets);
      if (!active) return;
      if (phase === "prepare") {setPhase("in"); return;}
      if (phase === "out") {
        const next = incoming.current;
        last.current = next;
        setShown(next);
        setPhase("in");
      } else setPhase("idle");
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = shown.kind === "battle" ? phase === "out" ? SCENE_SEQUENCE_MS.battleOut : SCENE_SEQUENCE_MS.battleIn : phase === "out" ? SCENE_SEQUENCE_MS.advOut : SCENE_SEQUENCE_MS.advIn;
    const timer = window.setTimeout(() => void finish(), phase === "prepare" || reduced || document.hidden ? 0 : ms);
    const hide = () => { if (document.hidden) { window.clearTimeout(timer); finish(); } };
    document.addEventListener("visibilitychange", hide);
    return () => {active = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", hide);};
  }, [phase, shown.id, shown.kind]);
  useLayoutEffect(() => {void preloadSceneAssets(frame.assets);}, [frame.id]);
  return <Context.Provider value={locked}>
    <div className="scene-sequence" data-scene={current.kind} data-scene-id={current.id} data-phase={phase} aria-busy={locked}>
      <div className="scene-sequence__frame" key={shown.id} inert={locked || undefined}>{current.content}</div>
    </div>
  </Context.Provider>;
}

const assets = new Map<string, Promise<void>>();
function preloadSceneAssets(urls: readonly string[] = []) {
  return Promise.all(urls.map(url => {
    let ready = assets.get(url);
    if (!ready) {
      ready = new Promise<void>(resolve => {
        const image = new Image();
        const timer = window.setTimeout(resolve, 3000);
        const finish = () => {window.clearTimeout(timer); resolve();};
        image.onload = () => {if (image.decode) void image.decode().catch(() => {}).then(finish); else finish();};
        image.onerror = finish;
        image.src = url;
      });
      assets.set(url, ready);
    }
    return ready;
  }));
}
