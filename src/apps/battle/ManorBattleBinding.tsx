import { useState } from "react";
import { useGameSession, useGameState } from "../../game-client/react";
import { storyAssets } from "../../game-client/story-actors";
import { clockworkMemoryScript } from "../../content/presentation/clockwork-memory";
import { mariettaMemoryScript } from "../../content/presentation/marietta-memory";
import { MemoryStory } from "../../game-client/MemoryStory";
import { StoryReading } from "../../game-client/StoryReading";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { useSceneReadingProgress } from "../../game-client/scene-reading-progress";
import { SceneSequence, type SceneFrame } from "../../shared/presentation/adv/SceneSequence";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { useManorBattlePresentation } from "./controller/useManorBattlePresentation";
import { ManorBattleView } from "./ManorBattleView";
import { ManorConclusion } from "./ManorConclusion";
import type { ExpeditionBattleScreenProps } from "./ExpeditionBattleScreen";
import { manorJourneyStory } from "./presentation/manor-journey-story";
import { manorConclusionForParty } from "../../content/presentation/manor-conclusion";
import { manorScenes } from "../../content/presentation/old-manor";
import manorHome from "../../assets/backgrounds/manor-night-gallery.jpg";
import "./battle-story.css";

/** The battle queue stays mounted across every local story boundary, including the final hit. */
export function ManorBattleBinding({reviewing = false, ...props}: ExpeditionBattleScreenProps & {reviewing?: boolean}) {
  const session = useGameSession(), game = useGameState(), record = game.record!;
  const p = useManorBattlePresentation(), v = p.view;
  const progress = useSceneReadingProgress(`${record.head.saveId}:${record.head.epoch}`);
  const [review, setReview] = useState<{step:number; line:number} | null>(null);
  const memory = record.schemaVersion === 4 ? record.snapshot.campaign.memory : null;
  const matchesMemory = !!memory && session.locator.memory?.id === memory.id && session.locator.memory.attempt === memory.attempt;
  const terminal = record.schemaVersion !== 1 ? record.snapshot.campaign.settlements.find(t => t.runId === session.locator.expeditionId) : null;
  const story = v.story?.terminalId === terminal?.id ? v.story : null;
  const endingStep = review?.step ?? (story?.status === "pending" ? story.step : null);
  const event = !reviewing ? manorJourneyStory(v) : null;
  const reading = event && progress.read(event.id) < event.lines.length;
  let frame: SceneFrame;
  if (matchesMemory && memory.node !== "battle" && !p.busy) {
    const scripts = memory.templateId === "profile.memory.clockwork.v1" ? clockworkMemoryScript : mariettaMemoryScript;
    const lines = scripts[memory.node as keyof typeof scripts] ?? scripts["return-pending"];
    const background = ["history-opening","teaching","history-complete"].includes(memory.node) ? manorScenes["old-manor.service-corridor"] : manorHome;
    frame = {assets:storyAssets(lines,background),id:`memory:${memory.id}:${memory.attempt}:${memory.node}`, kind:"adv", content:<MemoryStory record={record}/>};
  } else if ((!v.expedition || reviewing) && endingStep !== null) {
    const step = endingStep, atHome = step === 4;
    const manorConclusionDialogue = manorConclusionForParty(terminal?.partyIds ?? []);
    const stepKey = `ending:${story?.terminalId}:${step}`;
    const prefix = atHome ? [] : manorConclusionDialogue.slice(0,step).flat();
    const lines = [...prefix,...manorConclusionDialogue[step]];
    const line = Math.min(review?.line ?? progress.read(stepKey),manorConclusionDialogue[step].length-1);
    const finishStep = (skip: boolean) => {
      if (game.status !== "ready") return;
      if (review) { setReview(skip || step === 4 ? null : {step:step+1,line:0}); return; }
      if (story) void session.dispatch({type:"acknowledge-story",terminalId:story.terminalId,step:story.step,choice:skip ? "skip" : "continue"});
    };
    frame = {assets:storyAssets(manorConclusionDialogue.flat(),atHome ? manorHome : manorScenes["old-manor.banquet-hall"]),id:`ending:${atHome ? "home" : "banquet"}`,kind:"adv",content:<StoryReading
      title="家宴落幕" location={atHome ? "洋馆 · 餐桌" : "克雷格旧庄园 · 宴会厅"} background={atHome ? manorHome : manorScenes["old-manor.banquet-hall"]}
      lines={lines} replay={!!review} cursor={prefix.length+line} busy={game.status !== "ready"} finalLabel={step === 4 ? "完成阅读" : "继续"}
      onNext={() => {if (line === manorConclusionDialogue[step].length-1) finishStep(false); else if (review) setReview({...review,line:line+1}); else progress.write(stepKey,line+1);}}
      onSkip={() => finishStep(true)}/>};
  } else if (event && reading && !p.busy) {
    const cursor = progress.read(event.id);
    frame = {assets:storyAssets(event.lines,manorScenes[v.room!.sceneId]),id:`event:${event.id}`,kind:"adv",content:<StoryReading title={event.title} location="克雷格旧庄园" background={manorScenes[v.room!.sceneId]}
      lines={event.lines} cursor={cursor} finalLabel="返回行动" onNext={() => progress.write(event.id,cursor+1)} onSkip={() => progress.write(event.id,event.lines.length)}/>};
  } else {
    frame = {id:"battle",kind:"battle",content:<>{!v.expedition || reviewing
      ? <ManorConclusion {...props} record={record} onReview={() => setReview({step:0,line:0})}/>
      : <ManorBattleView {...props} presentation={p}/>}<CampaignPanel/></>};
  }
  const battle = frame.kind === "battle";
  frame.content = <div className={battle ? `battle-story-shell abyssa-battle-stage abyssa-battle-stage--${props.uiSkin ?? "old-manor"}` : "battle-story-shell"}>
    <AbyssaProvider className={battle ? "abyssa-expedition-theme" : undefined} data-battle-ui-skin={battle ? props.uiSkin : undefined} style={{height:"100%"}}>{frame.content}</AbyssaProvider>
  </div>;
  return <SceneSequence frame={frame} blocked={p.busy}/>;
}
