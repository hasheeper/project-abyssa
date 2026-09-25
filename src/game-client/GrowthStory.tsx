import { useState } from "react";
import { StoryReading } from "./StoryReading";
import { ReadingTool } from "../shared/presentation/adv/ReadingTool";
import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { choicesByStep, isUserChoice, type UserChoiceTone } from "../content/presentation/authored-story";
import { useGameSession, useGameState } from "./react";
import { GameOperationFeedback } from "./GameOperationFeedback";
import type { D5GameRecord } from "../game-application";
import "../shared/ui/styles/components-core.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";

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
  const session = useGameSession(), {record,status} = useGameState();
  const [replayStep,setReplayStep] = useState(0);
  const c = record?.schemaVersion===4 ? record.snapshot.campaign : null;
  const story = c?.stories.find(s=>s.eventId===eventId && s.id===c.activeStoryId);
  const script = eventId===teamMilestoneStory.eventId ? teamMilestoneStory : growthStories[eventId];
  if(!script || !c || (!review && !story)) return null;
  const step = review ? replayStep : story!.step;
  const savedChoices = review
    ? recordedChoices(record?.schemaVersion===4 ? record : null,eventId)
    : story?.choices ?? [];
  const decisions=choicesByStep(savedChoices), current=script.lines[step], choice=isUserChoice(current) ? current : null;
  const busy = status!=="ready";
  const last = step===script.lines.length-1;
  const close = () => {
    if(review) onClose();
    else if(!busy) void session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"later"}).then(batch=>{if(batch) onClose();});
  };
  const next = async () => {
    if(busy || choice && !review) return;
    if(review) {if(last) onClose();else setReplayStep(step+1);return;}
    if(!last) return session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:"continue"});
    const batch = await session.dispatch({type:"complete-story",sessionId:story!.id});
    if(batch && batch.after.schemaVersion===4) onCompleted(!c.teamMilestone && !!batch.after.snapshot.campaign.teamMilestone);
    return batch;
  };
  const choose=async(tone:UserChoiceTone)=>{
    if(!await session.dispatch({type:"advance-story",sessionId:story!.id,step,choice:tone})) throw Error("选择未能保存，请重试。");
  };
  return <StoryReading<UserChoiceTone> sceneId={`${eventId}:${review}`} title={script.title} location={review ? "回顾" : "洋馆"} background=""
    lines={script.lines} cursor={step} decisions={decisions} busy={busy} replay={review} error={session.getSnapshot().error}
    canAdvance={!last && (!choice || review)} onNext={next} finalLabel={last ? review ? "结束回顾" : "完成片段" : "下一句"}
    choice={choice && !review ? {id:choice.id,prompt:choice.prompt,options:choice.options.map(o=>({id:o.tone,label:o.label}))} : null}
    onChoose={choose} onEscape={close}
    controls={<ReadingTool label={review ? "结束回顾" : "稍后继续"} caption="BACK" glyph="back" disabled={busy} onClick={close}/>}
    feedback={<GameOperationFeedback session={session} state={session.getSnapshot()} local/>}/>;
}
