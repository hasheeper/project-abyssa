import type { CSSProperties } from "react";
import type { MorningBeat } from "../content/presentation/first-morning";

/** Scene-owned layers. No frame/button styling, canvas, full-screen filter animation or per-frame React updates. */
export function MorningEffects({beat,pressure,live,reading}:{beat?:MorningBeat;pressure:boolean;live:boolean;reading:boolean}) {
  const effect=live?beat?.effect:undefined;
  return <>
    <div className="first-morning__pressure" data-active={pressure && !reading} aria-hidden="true"/>
    <div className="morning-shadow" data-active={pressure && !reading} aria-hidden="true"/>
    {effect==="break" && <div key={beat?.id} className="morning-break" aria-hidden="true">
      <div className="first-morning__impact"/>
      <svg viewBox="0 0 1600 824" preserveAspectRatio="none">
        {Array.from({length:11},(_,i)=><path key={i} d="M0 0 12 -36 7 18 Z" style={{"--sx":`${850+(i%4)*80}px`,"--sy":`${140+Math.floor(i/4)*80}px`,"--dx":`${(i-5)*110}px`,"--dy":`${140+(i%3)*130}px`,"--spin":`${(i%2?1:-1)*(75+i*19)}deg`,"--delay":`${i*12}ms`} as CSSProperties}/>) }
      </svg>
    </div>}
  </>;
}
