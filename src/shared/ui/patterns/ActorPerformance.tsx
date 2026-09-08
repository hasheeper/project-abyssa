import { useEffect, useRef, type ReactNode } from "react";
import "../styles/actor-performance.css";

import type { ActorPerformanceCue } from "../../domain/presentation/performance";
import { nod, waver, jump, shakeLight, shakeHeavy } from "./motions";
export type { ActorPerformances, ActorPerformanceCue } from "../../domain/presentation/performance";

/** Local acting layer. Never changes the calibrated PaperDoll position or its crop. */
export function ActorPerformance({cue, replay=false, children}: {cue?:ActorPerformanceCue;replay?:boolean;children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null);
  const mountKey=useRef(cue?.key);
  const consumed=useRef<string|undefined>(undefined);
  useEffect(()=> {
    if(replay || document.hidden) {consumed.current=cue?.key;return;}
    if(!cue?.motion || consumed.current===cue.key || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const spec={nod,waver,jump,shakeLight,shakeHeavy}[cue.motion]();
    let animation:Animation|undefined;
    // A newly mounted actor finishes the normal seat entrance before reacting.
    const timer=setTimeout(()=> {
      consumed.current=cue.key;
      if(!document.hidden) animation=ref.current?.animate?.(spec.keyframes,spec.options);
    },mountKey.current===cue.key?700:0);
    const hide=()=>{if(document.hidden){consumed.current=cue.key;clearTimeout(timer);animation?.cancel();}};
    document.addEventListener("visibilitychange",hide);
    return ()=>{clearTimeout(timer);animation?.cancel();document.removeEventListener("visibilitychange",hide);};
  },[cue?.key, cue?.motion, replay]);
  return <div ref={ref} className="actor-performance" data-performance={cue?.motion} data-still={cue?.still || undefined}>
    {children}
    {cue?.aside && <span key={cue.key} className="actor-performance__aside">{cue.aside}</span>}
  </div>;
}
