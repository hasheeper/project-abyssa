import { useEffect, useRef, useState } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import type { RpActor, RpMessage } from "../shared/ui/patterns/rp-stage";
import { archiveIdentities } from "../content/characters/identities";
import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { useGameSession, useGameState } from "./react";
import { gameErrorText } from "./game-errors";
import "../shared/ui/styles/dialogue.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";
import forwardIcon from "../assets/icons/fast-forward-button.svg";
import returnIcon from "../assets/icons/anticlockwise-rotation.svg";

const spriteBaseUrl = import.meta.env.DEV ? "/src/assets/characters/paper-dolls/" : `${import.meta.env.BASE_URL}character-art/`;
const actors: RpActor[] = archiveIdentities.map(a=>({id:a.id,name:a.selectorLabel ?? a.name,secondaryName:a.secondaryName,spriteBaseUrl,portrait:a.id==="kael" ? a.portraitUrl : undefined}));

/** D5-D's approved ADV and reading bar, bound to finite growth/gift sessions. */
export function GrowthStory({eventId,review,onClose,onCompleted}: {eventId:string; review:boolean; onClose:()=>void; onCompleted:(milestone:boolean)=>void}) {
  const session = useGameSession(), {record,status,error} = useGameState();
  const [replayStep,setReplayStep] = useState(0), [settledLine,setSettledLine] = useState<string|null>(null), [revealed,setRevealed] = useState<string|null>(null);
  const stage = useRef<HTMLElement>(null);
  useEffect(()=>{stage.current?.focus();},[]);
  const c = record?.schemaVersion===4 ? record.snapshot.campaign : null;
  const story = c?.stories.find(s=>s.eventId===eventId && s.id===c.activeStoryId);
  const script = eventId===teamMilestoneStory.eventId ? teamMilestoneStory : growthStories[eventId];
  if(!script || !c || (!review && !story)) return null;
  const step = review ? replayStep : story!.step, key = `${eventId}:${review}:${step}`;
  const busy = status!=="ready", typing = !review && revealed!==key, settled = !typing || settledLine===key;
  const last = step===script.lines.length-1;
  const messages:RpMessage[] = script.lines.slice(0,step+1).map(l=>l.characterId ? {id:l.id,kind:"say",actorId:l.characterId,text:l.text} : {id:l.id,kind:"narration",text:l.text});
  const close = () => {
    if(review) onClose();
    else if(!busy) void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"later"}).then(batch=>{if(batch) onClose();});
  };
  const next = () => {
    if(busy) return;
    if(!settled) {setRevealed(key);return;}
    if(review) {if(last) onClose();else setReplayStep(step+1);return;}
    if(!last) {void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"continue"});return;}
    void session.dispatch({type:"complete-story",sessionId:story!.id}).then(batch=>{
      if(batch && batch.after.schemaVersion===4) onCompleted(!c.teamMilestone && !!batch.after.snapshot.campaign.teamMilestone);
    });
  };
  const label = !settled ? "显示全文" : last ? review ? "结束回顾" : "完成片段" : "下一句";
  return <main className="rp-app" data-layout="adv" data-state={settled ? "idle" : "typing"} aria-label={script.title}>
    <section ref={stage} className="rp-app__stage" aria-label="ADV 对话" tabIndex={0} onClick={next} onKeyDown={e=>{
      if(e.target!==e.currentTarget) return;
      if([" ","Enter","ArrowRight"].includes(e.key)) {e.preventDefault();next();}
      if(e.key==="Escape") {e.preventDefault();close();}
    }}>
      <AdvStage actors={actors} messages={messages} typing={typing} hydrate onTypingEnd={()=>setSettledLine(key)}/>
    </section>
    <footer className="rp-app__bar">
      <div className="rp-app__pager"><span className="rp-app__cell"><span className="rp-app__cell-main">{script.title}</span><span className="rp-app__cell-label">{review ? "RECAP" : "MANSION"}</span></span></div>
      <button type="button" className="rp-app__cell rp-app__cue" aria-label={label} disabled={busy} onClick={next}><span className="rp-app__cue-line"><span className="rp-app__cue-word">{Array.from(label).map((char,i)=><span key={i}>{char}</span>)}</span></span></button>
      <nav className="rp-app__tools" aria-label="演出控制">
        {!review && !last && <button type="button" className="rp-app__cell rp-app__tool" aria-label="跳至片段末句" disabled={busy} onClick={()=>void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"skip"})}><i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${forwardIcon}")`,WebkitMaskImage:`url("${forwardIcon}")`}}/><span className="rp-app__cell-label" aria-hidden="true">SKIP</span></button>}
        <button type="button" className="rp-app__cell rp-app__tool" aria-label={review ? "结束回顾" : "稍后继续"} disabled={busy} onClick={close}><i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${returnIcon}")`,WebkitMaskImage:`url("${returnIcon}")`}}/><span className="rp-app__cell-label" aria-hidden="true">BACK</span></button>
      </nav>
    </footer>
    {error && <div className="game-client-status" role="alert">{gameErrorText(error.code)} <button onClick={()=>void session.refresh()}>重新读取 / 重试</button></div>}
  </main>;
}
