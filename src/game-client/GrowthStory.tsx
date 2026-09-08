import { useEffect, useRef, useState } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { choicesByStep, isUserChoice, type UserChoiceTone } from "../content/presentation/authored-story";
import { useGameSession, useGameState } from "./react";
import { gameErrorText } from "./game-errors";
import { storyActors, storyMessages } from "./story-actors";
import { StoryChoicePanel } from "./StoryChoicePanel";
import type { D5GameRecord } from "../game-application";
import "../shared/ui/styles/dialogue.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";
import forwardIcon from "../assets/icons/fast-forward-button.svg";
import returnIcon from "../assets/icons/anticlockwise-rotation.svg";

function recordedChoices(record:D5GameRecord|null,eventId:string) {
  if(!record) return [];
  let sessionId:string|null=null;
  for(const fact of record.facts) {
    if(fact.kind!=="progression") continue;
    const event=fact.payload;
    if(event.type==="story-started" && event.eventId===eventId) sessionId=event.sessionId;
  }
  if(!sessionId) return [];
  const result:{step:number;tone:UserChoiceTone}[]=[];
  for(const fact of record.facts) {
    if(fact.kind!=="progression") continue;
    const event=fact.payload;
    if(event.type==="story-advanced" && event.sessionId===sessionId && ["iron","seasoned","pragmatic"].includes(event.choice)) result.push({step:event.step,tone:event.choice as UserChoiceTone});
  }
  return result;
}

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
  const savedChoices = review
    ? recordedChoices(record?.schemaVersion===4 ? record : null,eventId)
    : story?.choices ?? [];
  const decisions=choicesByStep(savedChoices), current=script.lines[step], choice=isUserChoice(current) ? current : null;
  const busy = status!=="ready", typing = !choice && !review && revealed!==key, settled = !typing || settledLine===key;
  const last = step===script.lines.length-1;
  const messages=storyMessages(script.lines.slice(0,step+1),decisions);
  const close = () => {
    if(review) onClose();
    else if(!busy) void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"later"}).then(batch=>{if(batch) onClose();});
  };
  const next = () => {
    if(busy || choice && !review) return;
    if(!settled) {setRevealed(key);return;}
    if(review) {if(last) onClose();else setReplayStep(step+1);return;}
    if(!last) {void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"continue"});return;}
    void session.dispatch({type:"complete-story",sessionId:story!.id}).then(batch=>{
      if(batch && batch.after.schemaVersion===4) onCompleted(!c.teamMilestone && !!batch.after.snapshot.campaign.teamMilestone);
    });
  };
  const choose=(tone:UserChoiceTone)=>{
    if(review || busy || !choice) return;
    void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:tone});
  };
  const label = choice && !review ? "选择行动" : !settled ? "显示全文" : last ? review ? "结束回顾" : "完成片段" : "下一句";
  return <main className="rp-app" data-layout="adv" data-state={settled ? "idle" : "typing"} aria-label={script.title}>
    <section ref={stage} className="rp-app__stage" aria-label="ADV 对话" tabIndex={0} onClick={next} onKeyDown={e=>{
      if(e.target!==e.currentTarget) return;
      if([" ","Enter","ArrowRight"].includes(e.key)) {e.preventDefault();next();}
      if(e.key==="Escape") {e.preventDefault();close();}
    }}>
      <AdvStage actors={storyActors(script.lines)} messages={messages} typing={typing} hydrate replay={review} onTypingEnd={()=>setSettledLine(key)}/>
      {choice && !review && <StoryChoicePanel choice={choice} disabled={busy} onChoose={choose}/>}
    </section>
    <footer className="rp-app__bar">
      <div className="rp-app__pager"><span className="rp-app__cell"><span className="rp-app__cell-main">{script.title}</span><span className="rp-app__cell-label">{review ? "RECAP" : "MANSION"}</span></span></div>
      <button type="button" className="rp-app__cell rp-app__cue" aria-label={label} disabled={busy || !!choice && !review} onClick={next}><span className="rp-app__cue-line"><span className="rp-app__cue-word">{Array.from(label).map((char,i)=><span key={i}>{char}</span>)}</span></span></button>
      <nav className="rp-app__tools" aria-label="演出控制">
        {!review && !last && <button type="button" className="rp-app__cell rp-app__tool" aria-label="跳至片段末句" disabled={busy} onClick={()=>void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"skip"})}><i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${forwardIcon}")`,WebkitMaskImage:`url("${forwardIcon}")`}}/><span className="rp-app__cell-label" aria-hidden="true">SKIP</span></button>}
        <button type="button" className="rp-app__cell rp-app__tool" aria-label={review ? "结束回顾" : "稍后继续"} disabled={busy} onClick={close}><i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${returnIcon}")`,WebkitMaskImage:`url("${returnIcon}")`}}/><span className="rp-app__cell-label" aria-hidden="true">BACK</span></button>
      </nav>
    </footer>
    {error && <div className="game-client-status" role="alert">{gameErrorText(error.code)} <button onClick={()=>void session.refresh()}>重新读取 / 重试</button></div>}
  </main>;
}
