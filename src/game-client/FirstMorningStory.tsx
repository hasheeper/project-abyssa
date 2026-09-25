import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import { RpScene, type RpMessage } from "../shared/ui/patterns/RpScene";
import { SceneSequence, useSceneSequenceBusy } from "../shared/presentation/adv/SceneSequence";
import { Stage } from "../shared/stage";
import { AbyssaProvider } from "../shared/ui/primitives/AbyssaProvider";
import { StoryChoices } from "../shared/ui/patterns/StoryChoices";
import { useSceneTransition } from "../shared/transition";
import { useGameSession, useGameState, gameErrorText } from "./react";
import { gameHref, rememberSave } from "./navigation";
import { storyActors, storyAssets, storyMessages } from "./story-actors";
import { resolveEmotionCue } from "../shared/ui/patterns/emotion-cues";
import { playerDisplayName, resolvePlayerText } from "../shared/domain/player-identity";
import { usePlayerName } from "../shared/domain/PlayerIdentity";
import { FIRST_MORNING_STORY, FIRST_MORNING_ENTRIES, firstMorningAssetsLines, morningOptionKeys, morningTranscript, morningPages, type MorningChoice, type MorningSelection } from "../content/presentation/first-morning";
import { MorningEffects } from "./MorningEffects";
import { StoryItemDisplay } from "./StoryItemDisplay";
import { storyItem } from "./story-items";
import { createMorningSound } from "./morning-sound";
import type { ActorPerformances } from "../shared/domain/presentation/performance";
import { avgPresentation } from "./avg-assets";
import { ReadingControls } from "../shared/presentation/adv/ReadingControls";
import { ReadingTool } from "../shared/presentation/adv/ReadingTool";
import { useReadingPlayback } from "../shared/presentation/adv/useReadingPlayback";
import { useReadingReview } from "../shared/presentation/adv/useReadingReview";
import { useReadingPresentation } from "../shared/presentation/adv/useReadingPresentation";
import "../shared/ui/styles/components-core.css";
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

export function morningMessages(step:number,choices:readonly MorningSelection[],page=Infinity,playerName?:string): RpMessage[] {
  const transcript=morningTranscript(step,choices);
  return transcript.flatMap((beat,index):RpMessage[]=> {
    if(beat.kind==="decision") {
      const selected=choices.find(c=>FIRST_MORNING_ENTRIES[c.step]?.id===beat.id);
      return selected ? [{id:beat.id,kind:"choice",text:beat.options[selected.choice]!,sequence:choices.indexOf(selected)+1}] : [];
    }
    return morningPages(beat).slice(0,index===transcript.length-1?page+1:undefined).flatMap(frame=> {
      const directions:RpMessage[]=(frame.actors??[]).map((actor,i)=>({id:`${frame.id}.stage.${i}`,kind:"stage",actorId:actor.characterId,text:"",emotion:actor.emotion}));
      if(frame.effect==="handoff") return [...directions,{id:frame.id,kind:"chapter" as const,text:frame.text}];
      if(!frame.text) return directions;
      return storyMessages([{...frame,text:morningPlayerText(frame.text,playerName)}], undefined, playerName).map(message=>message.kind==="say" && message.actorId===FIRST_MORNING_STORY.player.actorId ? {...message,offstage:true} : message);
    });
  });
}

type FirstMorningPlayerProps = {
  step:number;choices:readonly MorningSelection[];busy?:boolean;error?:string;
  lastStep?:number;
  onAdvance:(choice:"continue"|MorningChoice)=>void|Promise<void>;onExit:()=>void;
};

/** Breakfast through departure is one continuous scene, with one arrival at its beginning. */
export function FirstMorningScene({covered = false, ...props}: FirstMorningPlayerProps & {covered?: boolean}) {
  const fromBeginning = useRef(props.step === 0);
  const arrival = fromBeginning.current && FIRST_MORNING_STORY.presentation.arrival;
  return <SceneSequence openingBlocked={covered} frame={{id:FIRST_MORNING_STORY.id,kind:"adv",assets:ASSETS,
    arrival:arrival ? {...arrival,background} : undefined,content:<FirstMorningPlayer {...props}/>
  }}/>;
}

/** Shared AVG/NVL layouts and transition; one durable cursor and one branch history. */
export function FirstMorningPlayer({step,choices,lastStep=FIRST_MORNING_ENTRIES.length-1,busy=false,error,onAdvance,onExit}: FirstMorningPlayerProps) {
  const playerName = usePlayerName();
  const actors = useMemo(() => ACTORS.map(actor => actor.id === FIRST_MORNING_STORY.player.actorId ? {...actor, name: playerName} : actor), [playerName]);
  const transitionBusy=useSceneSequenceBusy();
  const presentation = useReadingPresentation(FIRST_MORNING_STORY.presentation.defaultMode);
  const {layout, reading, morph, phase, switched, switching} = presentation;
  const [settled,setSettled]=useState<string|null>(null),[revealed,setRevealed]=useState<string|null>(null);
  const [choicesPresent,setChoicesPresent]=useState(false);
  const stage=useRef<HTMLElement>(null);
  const initialStep=useRef(step);
  const [pageCursor,setPageCursor]=useState({step,page:0});
  const page=pageCursor.step===step?pageCursor.page:0;
  const transcript=useMemo(()=>morningTranscript(step,choices),[step,choices]);
  const liveMessages=useMemo(()=>morningMessages(step,choices,page,playerName),[step,choices,page,playerName]);
  const reviewPages=useMemo(()=>transcript.flatMap((beat,index)=>beat.kind==="decision" ? [] : morningPages(beat)
    .slice(0,index===transcript.length-1?page+1:undefined).map((frame,p)=>({id:frame.id,messages:morningMessages(index,choices,p,playerName)}))),[transcript,choices,page,playerName]);
  const review=useReadingReview([{id:FIRST_MORNING_STORY.id,title:FIRST_MORNING_STORY.title,pages:reviewPages}]);
  const messages=review.page?.messages ?? liveMessages;
  const node=transcript.at(-1)!;
  const frames=node.kind==="decision"?[]:morningPages(node);
  const current=node.kind==="decision"?node:frames[page];
  const decision=current.kind==="decision" ? current : null;
  const silent=current.kind!=="decision" && !current.text && !!current.holdMs;
  const handoff="effect" in current && current.effect==="handoff";
  const chapter=handoff && "text" in current ? current.text.split("：") : [];
  const stageMessages=handoff && !review.reviewing?messages.slice(0,-1):messages;
  const choiceExiting=choicesPresent && !decision;
  const key=current.id,blocked=busy || transitionBusy || !!morph || choiceExiting;
  const typing=!decision && !handoff && !silent && !reading && !review.reviewing && revealed!==key;
  const ready=!typing || settled===key;
  const last=step===lastStep;
  const canAdvance=!decision && !handoff && !(last && page>=frames.length-1);
  const advanceOrdinary=()=>{if(page<frames.length-1) setPageCursor({step,page:page+1});else return onAdvance("continue");};
  const reveal=()=>{setRevealed(key);setSettled(key);};
  const playback=useReadingPlayback({key,ready,blocked:blocked || silent,boundary:!canAdvance,suspended:reading || review.reviewing || !!morph,error,
    reveal,advance:advanceOrdinary});
  const locked=blocked || playback.pending;
  const pressure=transcript.flatMap((beat,index)=>beat.kind==="decision"?[]:morningPages(beat).slice(0,index===transcript.length-1?page+1:undefined))
    .reduce((active,frame)=>frame.effect==="pressure"?true:frame.effect==="release"?false:active,false);
  const [mutedKey,setMutedKey]=useState<string|null>(()=>step>0?key:null);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const autoAttempt=useRef<string|null>(null);
  const nextRef=useRef(()=>{});
  const sound=useRef<ReturnType<typeof createMorningSound>|null>(null);
  const live=!reading && !review.reviewing && !morph && visible && mutedKey!==key;
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
    if(!silent || locked || reading || review.reviewing || !visible || error || autoAttempt.current===key) return;
    const id=setTimeout(()=>{autoAttempt.current=key;nextRef.current();},beat?.holdMs??600);
    return ()=>clearTimeout(id);
  },[key,silent,locked,reading,review.reviewing,visible,error,beat?.holdMs]);
  useEffect(()=>{if(!locked && !reading) stage.current?.focus({preventScroll:true});},[key,locked,reading]);

  function changePresentation(nextLayout: "adv" | "nvl", nextReading: boolean) {
    if(locked || switching.current) return;
    playback.stop();
    setMutedKey(key);
    presentation.changePresentation(nextLayout, nextReading, () => {setRevealed(key);setSettled(key);});
  }
  function changeLayout() {
    if(handoff || !FIRST_MORNING_STORY.presentation.allowRp) return;
    changePresentation(layout==="adv"?"nvl":"adv", false);
  }
  function toggleReading() {changePresentation(layout, !reading);}
  function next() {
    if(locked || switching.current) return;
    playback.stop();
    if(reading) {toggleReading();return;}
    if(review.reviewing) {review.next();return;}
    if(decision) return;
    if(!ready) {setRevealed(key);return;}
    void playback.run(advanceOrdinary);
  }
  nextRef.current=()=>{void playback.run(advanceOrdinary);};
  const label=reading?"返回当前对白":review.reviewing?review.atEnd?"返回当前进度":"重播下一句":decision?"选择行动":silent?"继续":!ready?"显示全文":last?"结束本场":"下一句";
  const log=reading || layout==="nvl";
  const choiceUi = <StoryChoices decision={decision && !reading && !review.reviewing ? {
    id: decision.id, prompt: decision.prompt,
    options: morningOptionKeys(decision.options).map(id => ({id, label: decision.options[id]!})),
  } : null} placement={log ? "inline" : "overlay"} disabled={locked}
    enterBlocked={transitionBusy || !!morph && phase === "out"} onChoose={async id=>{playback.stop();await onAdvance(id);}} onPresentChange={setChoicesPresent}/>;
  return <main className={PRESENTATION.className} aria-label={FIRST_MORNING_STORY.title} data-layout={log?"nvl":"adv"} data-step={step}
    data-state={reading?"reading":ready?"idle":"typing"} data-decision={!!decision || undefined} data-morph={morph??undefined} data-phase={morph?phase:undefined}
    data-handoff={handoff && !reading && !review.reviewing || undefined} data-silent={silent && !reading && !review.reviewing || undefined}
    data-replaying={review.reviewing || undefined}
    data-effect={live?beat?.effect:undefined} data-pressure={pressure || undefined}
    onPointerDownCapture={()=>{sound.current??=createMorningSound();sound.current?.unlock();}}
    onKeyDownCapture={()=>{sound.current??=createMorningSound();sound.current?.unlock();}}
    style={{"--rp-morph-ms":"560ms"} as CSSProperties}>
    <section className="rp-app__stage" aria-label={log?"NVL 消息流":"AVG 对话"} ref={stage} tabIndex={0}
      onClick={e=>{if(!(e.target as HTMLElement).closest("button") && !reading) next();}}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if([" ","Enter","ArrowRight"].includes(e.key)){e.preventDefault();next();}if(e.key==="Escape" && reading)toggleReading();}}>
      {log ? <RpScene actors={actors} messages={reading?messages:stageMessages} initialSlots={INITIAL_SLOTS} background={background} performances={performances} hydrate typing={typing} onTypingEnd={()=>setSettled(key)} mode={reading || review.reviewing?"log":"play"} actions={choiceUi}/>
        : <AdvStage actors={actors} messages={stageMessages} initialSlots={INITIAL_SLOTS} background={background} typing={typing} silent={silent && !review.reviewing} performances={performances} replay={review.reviewing}
          hydrate={switched || initialStep.current>0} onTypingEnd={()=>setSettled(key)}/>}
      <MorningEffects beat={beat} pressure={pressure} live={live && !locked} reading={reading || review.reviewing}/>
      <StoryItemDisplay item={!reading && !review.reviewing && beat?.itemId ? storyItem(beat.itemId) : undefined}/>
      {!log && choiceUi}
      {handoff && !reading && !review.reviewing && <div className="first-morning__handoff" role="region" aria-label={current.text}>
        <div className="first-morning__chapter"><p>{chapter[0]}</p><h1>{chapter.slice(1).join("：")}</h1></div>
      </div>}
    </section>
    <ReadingControls layout={layout} reading={reading} reviewing={review.reviewing} auto={playback.auto} skipping={playback.skipping} disabled={locked}
      layoutDisabled={handoff || !FIRST_MORNING_STORY.presentation.allowRp} canReplay={review.canReplay}
      canPlay={canAdvance && !reading && !review.reviewing} canSkip={!reading && !review.reviewing && (canAdvance || !ready)}
      sceneIndex={review.index} sceneTotal={review.total} location={PRESENTATION.locationLabel} label={label} nextDisabled={!!decision && !reading && !review.reviewing}
      onLayout={changeLayout} onLog={toggleReading} onReplay={()=>{playback.stop();setMutedKey(key);reveal();if(review.reviewing)review.exit();else review.replay();}}
      onScene={index=>{playback.stop();setMutedKey(key);review.go(index);}} onAuto={()=>playback.toggle("auto")}
      onSkip={()=>{if(canAdvance)playback.toggle("skip");else reveal();}} onNext={next}
      actions={<ReadingTool label="保存进度并返回标题" caption="BACK" glyph="back" disabled={locked} onClick={()=>{playback.stop();onExit();}}/>}/>
    {error && <p className="game-client-status" role="alert">{error}</p>}
  </main>;
}

export function FirstMorningStory() {
  const session=useGameSession(),{record,status,error}=useGameState(),transition=useSceneTransition();
  const pending=useRef(false);
  const [extending,setExtending]=useState(false),[extensionError,setExtensionError]=useState("");
  const progress=record?.schemaVersion===4 ? record.snapshot.campaign.opening : undefined;
  useEffect(()=> {
    if(progress?.status!=="playing" && !pending.current) transition.navigate(gameHref(record?.schemaVersion===4 && record.snapshot.campaign.tutorial?.status==="pending" ? "battle" : "mansion",session.locator),{replace:true,cinematic:true,still:background});
  },[progress?.status,transition,session,record]);
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
    let batch;
    try {batch=await session.dispatch({type:"advance-opening",step:progress.step,choice});}
    finally {pending.current=false;}
    // Session reports rejected writes as null, not a rejected Promise. Let the
    // choice presenter restore its selected row without changing save semantics.
    if(!batch && choice!=="continue") throw new Error("Opening choice was not committed");
    if(batch?.after.schemaVersion===4 && batch.after.snapshot.campaign.opening?.status==="viewed")
      transition.navigate(gameHref(record?.schemaVersion===4 && record.snapshot.campaign.tutorial?.status==="pending" ? "battle" : "mansion",session.locator),{replace:true,cinematic:true,still:background});
  };
  return <AbyssaProvider><Stage background="var(--abyssa-rp-backdrop)">
    <FirstMorningScene covered={transition.isTransitioning} step={progress.step} choices={progress.choices} lastStep={record?.contentRef.contentVersion===5?66:undefined} busy={extending || status!=="ready" || progress.status!=="playing"}
      error={extensionError || (error?gameErrorText(error.code):undefined)} onAdvance={advance} onExit={()=>transition.navigate(gameHref("title"))}/>
  </Stage></AbyssaProvider>;
}
