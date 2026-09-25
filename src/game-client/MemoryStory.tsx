import { useState } from "react";
import { useSceneTransition } from "../shared/transition";
import { StoryReading } from "./StoryReading";
import { RpgModal } from "../shared/ui/primitives/RpgModal";
import { DiceActionButton } from "../shared/ui/patterns/action-dock/DiceActionButton";
import { mariettaMemoryScript } from "../content/presentation/marietta-memory";
import { clockworkMemoryScript } from "../content/presentation/clockwork-memory";
import { manorEnemyArt, manorScenes } from "../content/presentation/old-manor";
import { storyActors } from "./story-actors";
import { usePlayerName } from "../shared/domain/PlayerIdentity";
import { choicesByStep, isUserChoice, type UserChoiceTone } from "../content/presentation/authored-story";
import type { AnyGameRecord } from "../game-application";
import { useSceneSequenceBusy } from "../shared/presentation/adv/SceneSequence";
import manorHome from "../assets/backgrounds/manor-night-gallery.jpg";
import { useGameSession, useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";
import bookIcon from "../assets/icons/items/open-book.svg";
import "../shared/ui/styles/components-core.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/ui/styles/items.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";
import { ReadingTool } from "../shared/presentation/adv/ReadingTool";

type StoryNode = keyof typeof mariettaMemoryScript;
const nextNodes = {"present-intro": "history-opening", "history-opening": "teaching", teaching: "battle", "history-complete": "return-pending"} as const;

/** Authored story binding. The original ADV stage receives only committed transcript prefixes. */
export function MemoryStory({record: snapshot}: {record?: AnyGameRecord} = {}) {
  const playerName = usePlayerName();
  const {navigate} = useSceneTransition();
  const session = useGameSession(), game = useGameState();
  const record = snapshot ?? game.record, status = game.status;
  const transitioning = useSceneSequenceBusy();
  const view = record?.schemaVersion === 4 ? session.runtime.queries.memory(record) : null;
  const [recap, setRecap] = useState<{node:StoryNode; step:number} | null>(null);
  const [menu, setMenu] = useState(false), [rules, setRules] = useState(false);
  if (!record || !view?.memory) return null;

  const memory = view.memory, ref = {kind:"memory" as const,id:memory.id,attempt:memory.attempt};
  const clockwork = view.memory?.templateId === "profile.memory.clockwork.v1";
  const scripts = clockwork ? clockworkMemoryScript : mariettaMemoryScript;
  const node = recap?.node ?? memory.node, busy = status !== "ready" || transitioning;
  const script = node in scripts ? scripts[node as StoryNode] : null;
  const story = view.story;
  const step = recap?.step ?? (node === "return-pending" ? story?.step ?? view.deferredStory?.step ?? 0 : memory.step);
  const send = session.dispatch.bind(session);
  const goHome = () => navigate(gameHref("mansion", {saveId:record.head.saveId,epoch:record.head.epoch}));
  const replay = (node:StoryNode) => {setRecap({node,step:0});setMenu(false);};
  const retry = () => void send({type:"retry-memory",runRef:ref}).then(batch => {if(batch) navigate(gameHref("battle",recordLocator(batch.after)));});
  const advance = (tone?: UserChoiceTone) => {
    if (!script || busy) return;
    if (recap) {
      if(step === script.length-1) setRecap(null);
      else setRecap({...recap,step:step+1});
    } else if (node === "return-pending") {
      if (!story) return send({type:"begin-story",eventId:"story.marietta.return",basisId:view.completion!.id});
      if (step === script.length-1) return send({type:"complete-story",sessionId:story.id}).then(batch => {if(batch) goHome();return batch;});
      else return send({type:"advance-story",sessionId:story.id,step,choice:tone ?? "continue"});
    } else if (node in nextNodes) {
      const current = node as keyof typeof nextNodes;
      if(step === script.length-1) return send({type:"advance-memory",runRef:ref,node:nextNodes[current],choice:"continue"});
      else return send({type:"read-memory",runRef:ref,node:current,step,...(tone ? {choice:tone} : {})});
    }
  };
  const historical = ["history-opening","teaching","history-complete"].includes(node);
  const actors = storyActors(script ?? scripts["return-pending"], playerName).map(actor => historical && !clockwork && actor.id === "marietta"
    ? {...actor, portrait: manorEnemyArt["memory.marietta"].url} : actor);
  const terminalText = memory.node === "completed" ? "玛丽埃塔可以加入亲征队伍。" : memory.node === "failed" ? clockwork ? "钟声尚未停下。可以重新挑战刻仪兽；当下物资与时间没有变化。" : "未能突破防线。可以从本尊战起点重新挑战；当下的物资与时间没有变化。" : "回忆暂歇。再次进入时从教学与战斗起点重试。";
  const savedChoices = node === "return-pending" ? story?.choices ?? [] : (memory.choices ?? []).filter(item=>item.node===node).map(({step,tone})=>({step,tone}));
  const decisions = choicesByStep(savedChoices);
  if(recap && script) script.forEach((line,index)=>{if(isUserChoice(line) && !decisions.has(index)) (decisions as Map<number,UserChoiceTone>).set(index,"pragmatic");});
  const current = script?.[step], choice = isUserChoice(current) ? current : null;
  const needsStory = node === "return-pending" && !story && !recap;
  const nextLabel = !script ? view.canRetry ? "重新挑战" : "回顾当下对话" : needsStory ? "继续当下对话" : recap && step === script.length-1 ? "结束回顾" : node === "return-pending" && step === script.length-1 ? "确认同行" : step === script.length-1 ? node === "teaching" ? clockwork ? "迎战刻仪兽" : "迎战提线魔女" : "继续" : "下一句";
  const next = () => {
    if(!script) {if(view.canRetry) retry();else if(view.claim) replay("return-pending");return;}
    return advance();
  };
  return <><div inert={menu || rules || undefined} style={{height:"100%"}}>
    <StoryReading<UserChoiceTone> sceneId={`${memory.id}:${memory.attempt}:${node}:${!!recap}`}
      title={clockwork ? "停下来的钟声" : "王座前的提线魔女"} location={historical ? "过去 · 回忆" : "当下 · 洋馆"}
      background={historical ? manorScenes["old-manor.service-corridor"] : manorHome}
      lines={script ?? [{id:`memory.${memory.node}`,kind:"action",text:terminalText}]} cursor={script ? step : 0}
      actors={actors} decisions={decisions} busy={busy || menu || rules} error={game.error} replay={!!recap}
      canAdvance={!!script && !needsStory && step<script.length-1 && (!choice || !!recap)} onNext={next} finalLabel={nextLabel}
      choice={choice && !recap ? {id:choice.id,prompt:choice.prompt,options:choice.options.map(o=>({id:o.tone,label:o.label}))} : null}
      onChoose={async tone=>{if(await advance(tone) === null) throw Error("选择未能保存，请重试。");}}
      onEscape={()=>setMenu(true)}
      controls={<>
        {node === "teaching" && <ReadingTool label="回忆战规则" caption="RULES" icon={bookIcon} disabled={busy} onClick={() => setRules(true)}/>}
        <ReadingTool label="章节选项" caption="MENU" icon={bookIcon} disabled={busy} onClick={() => setMenu(true)}/>
        <ReadingTool label="返回洋馆" caption="BACK" glyph="back" disabled={busy} onClick={goHome}/>
      </>}/>
    </div>
    <RpgModal open={rules} onClose={() => setRules(false)} title="回忆战规则">
      {clockwork ? <p>刻仪兽：摆锤蓄势后发动钟鸣重击，交替循环。看清意图目标，在重击前安排防御或治疗。</p> : <><p>初阵：玛—侍偶A—侍偶B—侍偶C</p>
      <p>侍偶护域：1。每次受到伤害按相邻侍偶数减少，最多减2。</p>
      <p>下一意图：收线重排，预计护域1→2。本回合出手顺序不变。侍偶倒下后会收拢补位。</p></>}
      <p>固定勇者小队与局部补给；不消耗当下物资，不推进当下时间。</p>
    </RpgModal>
    <RpgModal open={menu} onClose={() => setMenu(false)} title="章节选项">
      <div style={{display:"grid",gap:12}}>
        {story && !recap && <DiceActionButton label="稍后继续" disabled={busy} onClick={() => void send({type:"advance-story",sessionId:story.id,step,choice:"later"}).then(batch => {if(batch) goHome();})}/>}
        {!recap && ["present-intro","history-opening","teaching","failed"].includes(memory.node) && <DiceActionButton label="暂离回忆" disabled={busy} onClick={() => void send({type:"leave-memory",runRef:ref}).then(batch => {if(batch) goHome();})}/>}
        {!recap && ["teaching","failed","left"].includes(memory.node) && <DiceActionButton label="回顾开场" disabled={busy} onClick={() => replay("history-opening")}/>}
        {view.claim && ([["history-opening","回顾旧日交锋"],["history-complete","回顾越过红线"],["return-pending","回顾当下对话"]] as const).map(([node,label]) => <DiceActionButton key={node} label={clockwork && node === "history-complete" ? "回顾钟声停歇" : label} disabled={busy} onClick={() => replay(node)}/>)}
        <DiceActionButton label="返回洋馆" disabled={busy} onClick={goHome}/>
      </div>
    </RpgModal>
  </>;
}
