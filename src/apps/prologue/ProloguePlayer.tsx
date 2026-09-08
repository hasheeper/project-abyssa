import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GameGate, GameProvider, useGameSession, useGameState } from "../../game-client/react";
import { gameHref } from "../../game-client/navigation";
import { Stage } from "../../shared/stage";
import { SceneTransitionProvider, useSceneTransition } from "../../shared/transition";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { AbyssaLogo } from "../../shared/ui/branding/AbyssaLogo";
import { PROLOGUE_SHOTS, PROLOGUE_ACT_NAMES, CHARACTER_FADE_MS, PARAGRAPH_BREATH_MS, INTERTITLE_FADE_MS, CONTACT_TRANSITION_MS, readingDuration, typingDuration, shotEndTime } from "./script";
import { PrologueCanvas, type CanvasHandle, type SceneClock } from "./PrologueCanvas";
import { PrologueTransition, type OutgoingFrame } from "./PrologueTransition";
import { loadCg, retainCgs } from "./renderer";
import { resolvePlayerText } from "../../shared/domain/player-identity";

export function ProloguePage() {
  return <AbyssaProvider><Stage canvasClassName="prologue-stage"><SceneTransitionProvider minimumBlackoutMs={0}>
    <OpeningGate/>
  </SceneTransitionProvider></Stage></AbyssaProvider>;
}
function OpeningGate() {
  const transition=useSceneTransition(),release=useRef<(()=>void)|null>(null);
  useLayoutEffect(()=>{release.current=transition.holdReady();return()=>release.current?.();},[transition.holdReady]);
  return <GameProvider><GameGate allowPrologue><ProloguePlayer onReady={()=>{release.current?.();release.current=null;}}/></GameGate></GameProvider>;
}

function ProloguePlayer({onReady}:{onReady():void}) {
  const session=useGameSession(),state=useGameState(),transition=useSceneTransition();
  const progress=state.record?.schemaVersion===4?state.record.snapshot.campaign.prologue:undefined;
  const initialIndex=Math.max(0,PROLOGUE_SHOTS.findIndex(s=>s.id===progress?.shotId));
  const [index,setIndex]=useState(initialIndex),shot=PROLOGUE_SHOTS[index];
  const [beatIndex,setBeatIndex]=useState(0),beat=shot.beats[beatIndex];
  const [shown,setShown]=useState(false),[full,setFull]=useState(false),[fading,setFading]=useState(false);
  const [auto,setAuto]=useState(false),[history,setHistory]=useState(false),[hidden,setHidden]=useState(false);
  const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const [outgoing,setOutgoing]=useState<OutgoingFrame|null>(null),[holding,setHolding]=useState(false),[canContinue,setCanContinue]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const clock=useMemo<SceneClock>(()=>({time:0,cueTime:null,paused:false,ready:false}),[shot.id,retry]);
  const scene=useRef<CanvasHandle>(null),flight=useRef(false),alive=useRef(true),nextBeatAt=useRef<number|null>(null),beatStarted=useRef<number|null>(null),queued=useRef(false);
  const skipTimer=useRef<ReturnType<typeof setTimeout>|null>(null),historyClose=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null);
  const actions=useRef({advance:()=>{},finish:(_skip:boolean)=>{}});
  clock.paused=history || busy || !!outgoing || transition.isTransitioning || state.status!=="ready";

  useLayoutEffect(()=>{
    if(shown && beat?.cue && clock.cueTime===null)clock.cueTime=clock.time;
  },[shown,beat,clock]);

  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(skipTimer.current)clearTimeout(skipTimer.current);};},[]);
  useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduced(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[]);
  useEffect(()=>{
    if(progress?.status!=="playing" && !flight.current) {onReady(); transition.navigate(gameHref("mansion",session.locator),{replace:true,cinematic:true,still:shot.image});}
    else if(progress?.status==="playing" && !busy && !flight.current && progress.shotId!==shot.id){setIndex(Math.max(0,PROLOGUE_SHOTS.findIndex(s=>s.id===progress.shotId)));resetReading();}
  },[progress?.shotId,progress?.status,busy]);
  useEffect(()=>{
    retainCgs([shot.image,PROLOGUE_SHOTS[index+1]?.image]);
    const next=PROLOGUE_SHOTS[index+1]?.image;
    if(next)void loadCg(next).catch(()=>{}); // An explicit advance retries failed prefetches.
  },[index,shot]);
  useEffect(()=>{
    if(history){previousFocus.current=document.activeElement as HTMLElement;historyClose.current?.focus();}
    else previousFocus.current?.focus();
  },[history]);
  function resetReading(){setBeatIndex(0);setShown(false);setFull(false);setFading(false);setLoaded(false);setError(false);setCanContinue(false);beatStarted.current=null;nextBeatAt.current=null;queued.current=false;}

  async function changeShot() {
    if(flight.current || !clock.ready || state.status!=="ready")return;
    const next=PROLOGUE_SHOTS[index+1];if(!next){await finish(false);return;}
    flight.current=true;setBusy(true);
    try {
      if(next.image)await loadCg(next.image);
      if(!alive.current)return;
      if(shot.act===1 && !reduced){
        setFading(true);
        await new Promise(resolve=>setTimeout(resolve,240));
        if(!alive.current)return;
      }
      const capture=scene.current?.capture();
      const batch=await session.dispatch({type:"advance-prologue",shotId:shot.id});
      if(!alive.current)return;
      if(batch){
        // Contact cuts share a short dissolve and one incoming recoil, without a light flash.
        const duration=reduced?Math.min(500,shot.transition):next.entrance==="contact"?CONTACT_TRANSITION_MS:shot.transition;
        const kind=reduced?"dissolve":shot.effect==="glass"?"glass":shot.act===1?"memory":"dissolve";
        if(capture && duration)setOutgoing({image:capture,duration,kind});
        resetReading();setIndex(index+1);
      }
    }catch{if(alive.current)setError(true);}
    finally{flight.current=false;if(alive.current){setBusy(false);setFading(false);}}
  }
  async function finish(skip:boolean) {
    if(flight.current || state.status!=="ready")return;
    flight.current=true;setBusy(true);cancelSkip();
    // The handoff carries the exact composed frame, not a differently cropped original.
    let still=shot.image;
    try {still=scene.current?.capture()?.toDataURL("image/webp",.85)??still;}catch{/* Asset fallback keeps navigation available. */}
    const batch=await session.dispatch({type:"complete-prologue",shotId:shot.id,choice:skip?"skip":"continue"});
    if(!alive.current)return;
    if(batch)transition.navigate(gameHref("mansion",session.locator),{replace:true,cinematic:true,still});
    flight.current=false;setBusy(false);
  }
  function advance(){
    if(history || busy || outgoing || !loaded || transition.isTransitioning || fading)return;
    if(hidden){setHidden(false);return;}
    if(shot.effect==="black")return;
    if(shot.effect==="title"){if(clock.time>=shot.duration)void finish(false);return;}
    if(!shown){if(clock.time>=1200){setShown(true);setFull(true);beatStarted.current=clock.time;}return;}
    if(beat?.text==="" && clock.time-(beatStarted.current??0)<(beat.hold??0))return;
    if(!full && beat && clock.time-(beatStarted.current??0)<typingDuration(beat)){setFull(true);return;}
    if(beatIndex<shot.beats.length-1){setCanContinue(false);setFading(true);nextBeatAt.current=clock.time+(beat?.speaker && shot.beats[beatIndex+1]?.speaker ? 420 : PARAGRAPH_BREATH_MS);}
    else if(clock.time<shotEndTime(shot,clock.cueTime)){queued.current=true;setCanContinue(false);setFading(true);}
    else void changeShot();
  }
  actions.current={advance,finish:skip=>{void finish(skip);}};
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(!clock.ready || clock.paused || document.hidden)return;
      const time=clock.time;
      if(queued.current && time>=shotEndTime(shot,clock.cueTime)){queued.current=false;void changeShot();return;}
      if(nextBeatAt.current!==null && time>=nextBeatAt.current){nextBeatAt.current=null;setBeatIndex(n=>n+1);setCanContinue(false);setFading(false);setFull(false);setShown(true);beatStarted.current=time;return;}
      if(!shown && beat && time>=shot.delay){setShown(true);beatStarted.current=time;}
      if(shot.effect==="black"){
        if(time>=shot.duration-INTERTITLE_FADE_MS)setFading(true);
        if(time>=shot.duration)void changeShot();
        return;
      }
      if(shot.effect==="title"){
        if(time>=shot.duration){setCanContinue(true);if(auto)void finish(false);}return;
      }
      if(beat && shown && !fading && beatStarted.current!==null){
        if(time-beatStarted.current>=(beat.text==="" ? beat.hold??0 : typingDuration(beat)))setCanContinue(true);
        if((auto || beat.text==="") && time-beatStarted.current>=readingDuration(beat))actions.current.advance();
      }
    },80);
    return()=>clearInterval(timer);
  },[clock,shot,beat,beatIndex,shown,fading,auto,busy,outgoing,history,index]);

  function cancelSkip(){if(skipTimer.current)clearTimeout(skipTimer.current);skipTimer.current=null;setHolding(false);}
  function startSkip(){if(busy || outgoing || !loaded || history)return;cancelSkip();setHolding(true);skipTimer.current=setTimeout(()=>actions.current.finish(true),950);}
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setHistory(false);setHidden(false);return;}
      if(history){if(e.key==="Tab"){e.preventDefault();historyClose.current?.focus();}return;}
      if((e.target as HTMLElement).closest("button,a,input"))return;
      if([" ","Enter","ArrowRight"].includes(e.key) && !e.repeat){e.preventDefault();actions.current.advance();}
    };
    const blur=()=>cancelSkip(); window.addEventListener("keydown",key);window.addEventListener("blur",blur);
    const visibility=()=>{if(document.hidden)cancelSkip();};document.addEventListener("visibilitychange",visibility);
    return()=>{window.removeEventListener("keydown",key);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",visibility);};
  },[history]);

  const actNames=PROLOGUE_ACT_NAMES, numerals=["I","II","III","IV"];
  const memoryTransition=outgoing?.kind==="memory";
  const showUi=(loaded || memoryTransition) && !hidden && (!outgoing || memoryTransition) && shot.effect!=="black" && !transition.isTransitioning;
  const showIntertitle=loaded && shown && !fading && !outgoing && !hidden && !transition.isTransitioning;
  const log=PROLOGUE_SHOTS.slice(0,index+1).flatMap((s,i)=>s.beats.slice(0,i===index?beatIndex+(shown?1:0):undefined).filter(b=>b.text).map((b,j)=>({...b,key:`${s.id}-${j}`,act:s.act})));
  return <main className="prologue" data-shot={shot.id} data-act={shot.act} data-beat={beatIndex} data-ready={loaded} data-reduced={reduced} onContextMenu={e=>{e.preventDefault();setHidden(v=>!v);}}>
    <PrologueCanvas key={`${shot.id}-${retry}-${reduced}`} ref={scene} shot={shot} clock={clock} reduced={reduced} onReady={()=>{setLoaded(true);onReady();}} onError={()=>{setError(true);onReady();}}/>
    {outgoing && <PrologueTransition frame={outgoing} ready={loaded} onDone={()=>setOutgoing(null)}/>}
    <div className="prologue-memory-finish" aria-hidden="true"/>
    <button className="prologue-advance-area" aria-label="继续序幕" onClick={advance} disabled={busy || !!outgoing || history || !loaded}/>
    <div className="prologue-matte" aria-hidden="true" data-clear={shot.effect==="black"}/>
    {shot.effect==="black" && beat?.text && <div className="prologue-intertitle" data-visible={showIntertitle} aria-hidden={!showIntertitle} aria-live="polite" style={{"--intertitle-fade":`${INTERTITLE_FADE_MS}ms`} as CSSProperties}>
      {beat.text}
    </div>}
    {shot.effect==="title" && loaded && <div className="prologue-title">
      <AbyssaLogo background="none" crop="tight" intro={!reduced}/>
    </div>}
    <div className="prologue-ui" data-visible={showUi} inert={!showUi || history || !!outgoing}>
      <div className="prologue-act" aria-label={`第${numerals[shot.act-1]}幕 ${actNames[shot.act-1]}`}><span>{numerals[shot.act-1]}</span><i/>{actNames[shot.act-1]}</div>
      {shot.effect!=="black" && shown && beat?.text && <div key={`${shot.id}-${beatIndex}`} className="prologue-subtitles" data-fading={fading} data-full={full}>
        {beat.speaker && <div className="prologue-speaker">{resolvePlayerText(beat.speaker)}</div>}
        <p aria-live="polite" aria-atomic="true"><span className="prologue-sr">{beat.text}</span><span aria-hidden="true">{Array.from(beat.text).map((c,i)=>c==="\n"?<br key={i}/>:<span key={i} className="prologue-char" style={{"--char-delay":`${i*CHARACTER_FADE_MS}ms`} as CSSProperties}>{c}</span>)}</span></p>
      </div>}
      <div className="prologue-controls">
        <button type="button" aria-pressed={auto} onClick={()=>setAuto(v=>!v)}>自动<span>{auto?"开":"关"}</span></button>
        <i/>
        <button type="button" onClick={()=>setHistory(true)}>回看</button>
        <button type="button" onClick={()=>setHidden(true)}>隐字</button>
        <i/>
        <button type="button" className="prologue-skip" data-holding={holding} aria-label="按住跳过序幕" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);startSkip();}} onPointerUp={cancelSkip} onPointerCancel={cancelSkip} onLostPointerCapture={cancelSkip} onKeyDown={e=>{if(["Enter"," "].includes(e.key)&&!e.repeat){e.preventDefault();startSkip();}}} onKeyUp={e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();cancelSkip();}}} onBlur={cancelSkip}>长按跳过<span/></button>
      </div>
      <button className="prologue-next" onClick={advance} disabled={!canContinue || busy} aria-label={shot.effect==="title"?"进入洋馆":"下一段"}>
        {shot.effect==="title"?<span>前往守望者之崖</span>:null}<span aria-hidden="true">◇</span>
      </button>
    </div>
    {error && <div className="prologue-load-error" role="alert"><p>这幅画面暂时未能载入。</p><button onClick={()=>{setError(false);setRetry(n=>n+1);}}>重新载入</button><a href={gameHref("title")}>返回标题</a></div>}
    {history && <div className="prologue-history-shade" onClick={()=>setHistory(false)}><section className="prologue-history" role="dialog" aria-modal="true" aria-label="序幕回看" onClick={e=>e.stopPropagation()}>
      <header><span>已读的故事</span><button ref={historyClose} onClick={()=>setHistory(false)} aria-label="关闭回看">×</button></header>
      <div className="prologue-history__lines">{log.map((b,i)=><div key={b.key}>{(i===0 || log[i-1].act!==b.act) && <h2>{actNames[b.act-1]}</h2>}{b.speaker && <small>{resolvePlayerText(b.speaker)}</small>}<p>{b.text}</p></div>)}</div>
    </section></div>}
  </main>;
}
