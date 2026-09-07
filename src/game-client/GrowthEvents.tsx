import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { DiceActionButton } from "../shared/ui/patterns/action-dock/DiceActionButton";
import { useGameSession, useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";
import { equipmentNames } from "./character-presentation";

export function GrowthEvents({onReview}: {onReview:(id:string)=>void}) {
  const session = useGameSession(), {record,status} = useGameState();
  if(record?.schemaVersion!==4) return null;
  const view = session.runtime.queries.progression(record)!;
  const busy = status!=="ready";
  return <section aria-label="馆内片段与整备">
    <h3>馆内片段与整备</h3>
    {!view.canMove && <p>出征期间配置已冻结，归来后可继续片段。</p>}
    {view.events.filter(e=>!e.completed && (e.basisId || e.session)).map(e=>{
      const meta = growthStories[e.eventId];
      return <DiceActionButton key={e.eventId} label={`${e.session ? "继续" : "谈起"} · ${meta.title}`} disabled={busy || !view.canBegin && view.activeStoryId!==e.session?.id || !view.canMove} onClick={()=>void session.dispatch({type:"begin-story",eventId:e.eventId,basisId:e.basisId!})}/>;
    })}
    {!view.events.some(e=>!e.completed && e.basisId) && <p>新的片段会在符合条件的归来后开放。</p>}
    {!!view.inventory.length && <p>{view.inventory.map(i=>`${equipmentNames[i.definitionId]} ×1`).join("、")} · 已收下。<a href={gameHref("character-status",recordLocator(record),{characterId:"eustice",tab:"dice",from:"menu"})}>前往骰装</a></p>}
    <details><summary>成长与整备记录</summary>
      {view.events.map(e=>{
        const meta=growthStories[e.eventId];
        return <p key={e.eventId}>{meta.title} · {e.completed ? <button onClick={()=>onReview(e.eventId)}>回顾</button> : e.basisId ? "可以交谈" : e.kind==="gift" ? "需要一次第三层撤离或五层通关" : e.ownerId==="marietta" ? "开放亲征后参加维护归来；Lv.3还需Lv.2后的新一趟" : e.level===3 ? "接管庄园，并在Lv.2后新出发归来" : "本人参加第三层撤离或五层通关"}{e.completed && <small> · {meta.resultText}</small>}</p>;
      })}
      {view.teamMilestone && <p>{teamMilestoneStory.resultText} <button onClick={()=>onReview(teamMilestoneStory.eventId)}>回顾「这边交给我」</button></p>}
    </details>
  </section>;
}
