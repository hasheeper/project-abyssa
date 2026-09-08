import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import { RpScene, type RpMessage } from "../shared/ui/patterns/RpScene";
import { SceneSequence, useSceneSequenceBusy } from "../shared/presentation/adv/SceneSequence";
import { Stage } from "../shared/stage";
import { AbyssaProvider } from "../shared/ui/primitives/AbyssaProvider";
import { RibbonButton } from "../shared/ui/primitives/RibbonButton";
import { useSceneTransition } from "../shared/transition";
import { useGameSession, useGameState, gameErrorText } from "./react";
import { gameHref, rememberSave } from "./navigation";
import { storyActors, storyAssets, storyMessages } from "./story-actors";
import { resolveEmotionCue } from "../shared/ui/patterns/emotion-cues";
import { playerDisplayName, resolvePlayerText } from "../shared/domain/player-identity";
import { FIRST_MORNING_STORY, FIRST_MORNING_ENTRIES, firstMorningAssetsLines, morningOptionKeys, morningTranscript, morningPages, type MorningChoice, type MorningDecision, type MorningSelection } from "../content/presentation/first-morning";
import { MorningEffects } from "./MorningEffects";
import { StoryItemDisplay } from "./StoryItemDisplay";
import { storyItem } from "./story-items";
import { createMorningSound } from "./morning-sound";
import type { ActorPerformances } from "../shared/domain/presentation/performance";
import { avgPresentation } from "./avg-assets";
import bookIcon from "../assets/icons/items/open-book.svg";
import returnIcon from "../assets/icons/anticlockwise-rotation.svg";
import "../shared/ui/styles/dialogue.css";
import "../shared/ui/styles/components-controls.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/ui/styles/rp.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";
import "../shared/presentation/adv/reading-morph.css";
import "../shared/presentation/adv/reading-motion.css";
import "./first-morning.css";

const PRESENTATION=avgPresentation(FIRST_MORNING_STORY);
const {background}=PRESENTATION;
const INITIAL_SLOTS=FIRST_MORNING_STORY.presentation.initialSlots;
const ITEM_ASSETS=FIRST_MORNING_ENTRIES.flatMap(entry=>entry.kind==="branch"?Object.values(entry.variants):entry.kind==="decision"?[]:[entry])
  .flatMap(morningPages).flatMap(frame=>frame.itemId?[storyItem(frame.itemId).image]:[]);
const ASSETS=[...storyAssets(firstMorningAssetsLines,background),...new Set(ITEM_ASSETS)];
const ACTORS=storyActors(firstMorningAssetsLines).map(actor=> {
  const first=firstMorningAssetsLines.find(line=>line.characterId===actor.id);
  return {...actor,expression:resolveEmotionCue(actor,first && "emotion" in first ? first.emotion ?? "neutral" : "neutral").expression};
});

/** Keep authored name tokens; omit an empty vocative or the name before a spoken honorific. */
export function morningPlayerText(text:string,name?:string) {
  const source=playerDisplayName(name)==="你" ? text.replaceAll("{{user}}大人","大人").replaceAll("{{user}}先生","先生").replaceAll("{{user}}，水。","水。") : text;
  return resolvePlayerText(source,name);
}

export function morningMessages(step:number,choices:readonly MorningSelection[],page=Infinity): RpMessage[] {
  const transcript=morningTranscript(step,choices);
  return transcript.flatMap((beat,index):RpMessage[]=> {
    if(beat.kind==="decision") {
      const selected=choices.find(c=>FIRST_MORNING_ENTRIES[c.step]?.id===beat.id);
      return selected ? [{id:beat.id,kind:"narration",text:`〔${beat.options[selected.choice]}〕`}] : [];
    }
    return morningPages(beat).slice(0,index===transcript.length-1?page+1:undefined).flatMap(frame=> {
      const directions:RpMessage[]=(frame.actors??[]).map((actor,i)=>({id:`${frame.id}.stage.${i}`,kind:"stage",actorId:actor.characterId,text:"",emotion:actor.emotion}));
      if(frame.effect==="handoff") return [...directions,{id:frame.id,kind:"chapter" as const,text:frame.text}];
      if(!frame.text) return directions;
      return [...directions,...storyMessages([{...frame,text:morningPlayerText(frame.text)}]).map(message=>message.kind==="say" && message.actorId===FIRST_MORNING_STORY.player.actorId ? {...message,offstage:true} : message)];
    });
  });
}

type FirstMorningPlayerProps = {
  step:number;choices:readonly MorningSelection[];busy?:boolean;error?:string;
  lastStep?:number;
  onAdvance:(choice:"continue"|MorningChoice)=>void;onExit:()=>void;
};

/** Breakfast through departure is one continuous scene, with one arrival at its beginning. */
export function FirstMorningScene({covered = false, ...props}: FirstMorningPlayerProps & {covered?: boolean}) {
  const fromBeginning = useRef(props.step === 0);
  const arrival = fromBeginning.current && FIRST_MORNING_STORY.presentation.arrival;
  return <SceneSequence openingBlocked={covered} frame={{id:FIRST_MORNING_STORY.id,kind:"adv",assets:ASSETS,
    arrival:arrival ? {...arrival,background} : undefined,content:<FirstMorningPlayer {...props}/>
  }}/>;
}

/** Same two RP layouts and their original transition; one durable cursor and one branch history. */
export function FirstMorningPlayer({step,choices,lastStep=FIRST_MORNING_ENTRIES.length-1,busy=false,error,onAdvance,onExit}: FirstMorningPlayerProps) {
  const transitionBusy=useSceneSequenceBusy();
  const [layout,setLayout]=useState<"adv"|"nvl">(FIRST_MORNING_STORY.presentation.defaultMode);
  const [morph,setMorph]=useState<"to-adv"|"to-nvl"|null>(null),[phase,setPhase]=useState<"out"|"in">("out");
  const [reading,setReading]=useState(false),[settled,setSettled]=useState<string|null>(null),[revealed,setRevealed]=useState<string|null>(null);
  const [switched,setSwitched]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),switching=useRef(false),stage=useRef<HTMLElement>(null);
  const initialStep=useRef(step);
  const [pageCursor,setPageCursor]=useState({step,page:0});
  const page=pageCursor.step===step?pageCursor.page:0;
  const transcript=useMemo(()=>morningTranscript(step,choices),[step,choices]);
  const messages=useMemo(()=>morningMessages(step,choices,page),[step,choices,page]);
  const node=transcript.at(-1)!;
  const frames=node.kind==="decision"?[]:morningPages(node);
  const current=node.kind==="decision"?node:frames[page];
  const decision=current.kind==="decision" ? current : null;
  const silent=current.kind!=="decision" && !current.text && !!current.holdMs;
  const handoff="effect" in current && current.effect==="handoff";
  const chapter=handoff && "text" in current ? current.text.split("：") : [];
  const stageMessages=handoff?messages.slice(0,-1):messages;
  const key=current.id,locked=busy || transitionBusy || !!morph;
  const typing=layout==="adv" && !decision && !handoff && !silent && !reading && revealed!==key;
  const ready=!typing || settled===key;
  const last=step===lastStep;
  const pressure=transcript.reduce((active,beat)=>"effect" in beat && beat.effect==="pressure" ? true : "effect" in beat && beat.effect==="release" ? false : active,false);
  const [mutedKey,setMutedKey]=useState<string|null>(()=>step>0?key:null);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const autoAttempt=useRef<string|null>(null);
  const nextRef=useRef(()=>{});
  const sound=useRef<ReturnType<typeof createMorningSound>|null>(null);
  const live=!reading && !morph && visible && mutedKey!==key;
  const performances:ActorPerformances|undefined=live && current.kind!=="decision" ? Object.fromEntries((current.actors??[]).map(actor=>[actor.characterId,{key,motion:actor.motion,aside:actor.aside,still:actor.still}])) : undefined;
  const beat=current.kind!=="decision"?current:undefined;
  useEffect(()=> {
    const visibility=()=>{setVisible(!document.hidden);if(document.hidden)setMutedKey(key);};
    document.addEventListener("visibilitychange",visibility);
    return ()=>document.removeEventListener("visibilitychange",visibility);
  },[key]);
  useEffect(()=>()=>{sound.current?.close();},[]);
  useEffect(()=> {
    if(live && !locked && beat?.sound) return sound.current?.play(beat.sound);
  },[key,live,locked,beat?.sound]);
  useEffect(()=> {
    if(!silent || locked || reading || !visible || error || autoAttempt.current===key) return;
    const id=setTimeout(()=>{autoAttempt.current=key;nextRef.current();},beat?.holdMs??600);
    return ()=>clearTimeout(id);
  },[key,silent,locked,reading,visible,error,beat?.holdMs]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{if(!locked && !reading) stage.current?.focus({preventScroll:true});},[key,locked,reading]);

  function changeLayout() {
    if(locked || handoff || switching.current || !FIRST_MORNING_STORY.presentation.allowRp) return;
    setMutedKey(key);
    switching.current=true;
    setReading(false);setMorph(layout==="adv"?"to-nvl":"to-adv");setPhase("out");
    const half=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    timer.current=setTimeout(()=> {
      setLayout(layout==="adv"?"nvl":"adv");setRevealed(key);setSettled(key);setSwitched(true);setPhase("in");
      timer.current=setTimeout(()=>{setMorph(null);switching.current=false;},half);
    },half);
  }
  function next() {
    if(locked || switching.current) return;
    if(reading) {setReading(false);return;}
    if(decision) return;
    if(!ready) {setRevealed(key);return;}
    if(page<frames.length-1){setPageCursor({step,page:page+1});return;}
    onAdvance("continue");
  }
  nextRef.current=next;
  const label=reading?"返回当前对白":decision?"选择行动":silent?"继续":!ready?"显示全文":last?"结束本场":"下一句";
  const log=reading || layout==="nvl";
  return <main className={PRESENTATION.className} aria-label={FIRST_MORNING_STORY.title} data-layout={log?"nvl":"adv"} data-step={step}
    data-state={reading?"reading":ready?"idle":"typing"} data-decision={!!decision || undefined} data-morph={morph??undefined} data-phase={morph?phase:undefined}
    data-handoff={handoff && !reading || undefined} data-silent={silent && !reading || undefined}
    data-effect={live?beat?.effect:undefined} data-pressure={pressure || undefined}
    onPointerDownCapture={()=>{sound.current??=createMorningSound();sound.current?.unlock();}}
    onKeyDownCapture={()=>{sound.current??=createMorningSound();sound.current?.unlock();}}
    style={{"--rp-morph-ms":"560ms"} as CSSProperties}>
    <section className="rp-app__stage" aria-label={log?"RP 消息流":"AVG 对话"} ref={stage} tabIndex={0}
      onClick={e=>{if(!(e.target as HTMLElement).closest("button") && !reading) next();}}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if([" ","Enter","ArrowRight"].includes(e.key)){e.preventDefault();next();}if(e.key==="Escape")setReading(false);}}>
      {log ? <RpScene actors={ACTORS} messages={reading?messages:stageMessages} initialSlots={INITIAL_SLOTS} background={background} performances={performances} hydrate mode={reading?"log":"play"}/>
        : <AdvStage actors={ACTORS} messages={stageMessages} initialSlots={INITIAL_SLOTS} background={background} typing={typing} silent={silent} performances={performances}
          hydrate={switched || initialStep.current>0} onTypingEnd={()=>setSettled(key)}/>}
      <MorningEffects beat={beat} pressure={pressure} live={live && !locked} reading={reading}/>
      <StoryItemDisplay item={!reading && beat?.itemId ? storyItem(beat.itemId) : undefined}/>
      {decision && !reading && <MorningChoices decision={decision} disabled={locked} onChoose={onAdvance}/>}
      {handoff && !reading && <div className="first-morning__handoff" role="region" aria-label={current.text}>
        <div className="first-morning__chapter"><p>{chapter[0]}</p><h1>{chapter.slice(1).join("：")}</h1></div>
      </div>}
    </section>
    <footer className="rp-app__bar">
      <div className="rp-app__pager"><span className="rp-app__cell"><span className="rp-app__cell-main">{FIRST_MORNING_STORY.title}</span><span className="rp-app__cell-label">{PRESENTATION.locationLabel}</span></span></div>
      <button className="rp-app__cell rp-app__cue" type="button" aria-label={label} disabled={locked || !!decision && !reading} onClick={next}>
        <span className="rp-app__cue-line"><span className="rp-app__cue-word">{Array.from(label).map((char,i)=><span key={i}>{char}</span>)}</span></span>
      </button>
      <nav className="rp-app__tools" aria-label="演出控制">
        <button type="button" className="rp-app__cell rp-app__tool" aria-label={reading?"关闭回看":"回看已读对白"} aria-pressed={reading} disabled={locked} onClick={()=>{setMutedKey(key);setRevealed(key);setReading(v=>!v);setSwitched(true);}}>
          <i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${bookIcon}")`,WebkitMaskImage:`url("${bookIcon}")`}}/><span className="rp-app__cell-label">LOG</span>
        </button>
        <button type="button" className="rp-app__cell rp-app__tool" aria-label={layout==="adv"?"切换为 RP 舞台":"切换为 AVG 舞台"} disabled={locked || handoff || !FIRST_MORNING_STORY.presentation.allowRp} onClick={changeLayout}>
          <i className="rp-app__cell-main rp-app__tool-icon" data-glyph="true" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" strokeWidth="2.2"/>{layout==="adv"?<path d="M9 5v14M15 5v14" strokeWidth="2"/>:<path d="M6 15h12" strokeWidth="3"/>}</svg></i>
          <span className="rp-app__cell-label">{layout==="adv"?"RP":"AVG"}</span>
        </button>
        <button type="button" className="rp-app__cell rp-app__tool" aria-label="保存进度并返回标题" disabled={locked} onClick={onExit}>
          <i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" data-shrink="true" style={{maskImage:`url("${returnIcon}")`,WebkitMaskImage:`url("${returnIcon}")`}}/><span className="rp-app__cell-label">BACK</span>
        </button>
      </nav>
    </footer>
    {error && <p className="game-client-status" role="alert">{error}</p>}
  </main>;
}

function MorningChoices({decision,disabled,onChoose}:{decision:MorningDecision;disabled:boolean;onChoose:(choice:MorningChoice)=>void}) {
  return <section className="first-morning__choices" aria-label={decision.prompt} onClick={e=>e.stopPropagation()}>
    <p className="first-morning__choice-prompt">{decision.prompt}</p>
    <div className="first-morning__choice-list">
      {morningOptionKeys(decision.options).map(choice=><RibbonButton
        key={choice} className="first-morning__choice" variant="dark" size="lg" fullWidth
        disabled={disabled} onClick={()=>onChoose(choice)}
      >{decision.options[choice]}</RibbonButton>)}
    </div>
  </section>;
}

export function FirstMorningStory() {
  const session=useGameSession(),{record,status,error}=useGameState(),transition=useSceneTransition();
  const pending=useRef(false);
  const [extending,setExtending]=useState(false),[extensionError,setExtensionError]=useState("");
  const progress=record?.schemaVersion===4 ? record.snapshot.campaign.opening : undefined;
  useEffect(()=> {
    if(progress?.status!=="playing" && !pending.current) transition.navigate(gameHref("mansion",session.locator),{replace:true,cinematic:true,still:background});
  },[progress?.status,transition,session]);
  if(!progress) return null;
  const advance=async(choice:"continue"|MorningChoice)=> {
    if(status!=="ready" || pending.current) return;
    pending.current=true;
    if(record?.contentRef.contentVersion===5 && progress.step===66 && choice==="continue" && "extendOpening" in session.runtime.application) {
      setExtending(true);setExtensionError("");
      let leaving=false;
      try {
        const result=await session.runtime.application.extendOpening(record.head.saveId,record.head,true);
        if(result.ok) {
          const locator=result.receipt.after!;rememberSave(locator);
          leaving=true;
          transition.navigate(gameHref("mansion",locator),{replace:true,cinematic:true,still:background});
        } else setExtensionError(gameErrorText(result.error.code));
      } catch {setExtensionError("后续进度未保存，请重试。原档已保留。");}
      finally {if(!leaving){pending.current=false;setExtending(false);}}
      return;
    }
    const batch=await session.dispatch({type:"advance-opening",step:progress.step,choice});
    if(batch?.after.schemaVersion===4 && batch.after.snapshot.campaign.opening?.status==="viewed")
      transition.navigate(gameHref("mansion",session.locator),{replace:true,cinematic:true,still:background});
    pending.current=false;
  };
  return <AbyssaProvider><Stage background="var(--abyssa-rp-backdrop)">
    <FirstMorningScene covered={transition.isTransitioning} step={progress.step} choices={progress.choices} lastStep={record?.contentRef.contentVersion===5?66:undefined} busy={extending || status!=="ready" || progress.status!=="playing"}
      error={extensionError || (error?gameErrorText(error.code):undefined)} onAdvance={choice=>void advance(choice)} onExit={()=>transition.navigate(gameHref("title"))}/>
  </Stage></AbyssaProvider>;
}
