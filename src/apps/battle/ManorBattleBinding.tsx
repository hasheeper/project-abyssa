import { useSceneTransition } from "../../shared/transition";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useGameSession, useGameState } from "../../game-client/react";
import { storyAssets } from "../../game-client/story-actors";
import { clockworkMemoryScript } from "../../content/presentation/clockwork-memory";
import { mariettaMemoryScript } from "../../content/presentation/marietta-memory";
import { MemoryStory } from "../../game-client/MemoryStory";
import { StoryReading } from "../../game-client/StoryReading";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { AirpPanel } from "../../game-client/AirpPanel";
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
import { tideStory, tideStoryEdition } from "../../content/presentation/tide-cave";
import { tideScene } from "./presentation/tide-scene";
import { TutorialOverview } from "./presentation/TutorialOverview";
import { gameErrorText } from "../../game-client/game-errors";
import { gameHref } from "../../game-client/navigation";
import { useSceneReveal } from "../../shared/transition/useSceneReveal";
import { manorScene } from "./presentation/manor-scene";
import { useBattleSceneAssets } from "./presentation/useBattleSceneAssets";
import { BattleRoomLoading } from "./presentation/BattleRoomLoading";
import "./battle-motion.css";
import "./battle-entry-content.css";

/** The battle queue stays mounted across every local story boundary, including the final hit. */
export function ManorBattleBinding({reviewing = false, ...props}: ExpeditionBattleScreenProps & {reviewing?: boolean}) {
  const session = useGameSession(), game = useGameState(), record = game.record!;
  const p = useManorBattlePresentation({coordinateRoomAssets:true}), v = p.view;
  const transition = useSceneTransition();
  const progress = useSceneReadingProgress(`${record.head.saveId}:${record.head.epoch}`);
  const [review, setReview] = useState<{step:number; line:number} | null>(null);
  const confirmingOverview = useRef(false);
  const memory = record.schemaVersion === 4 ? record.snapshot.campaign.memory : null;
  const matchesMemory = !!memory && session.locator.memory?.id === memory.id && session.locator.memory.attempt === memory.attempt;
  const scene = !matchesMemory && !reviewing ? manorScene(v, props.uiSkin) : undefined;
  const incomingScene=p.pendingRoom ? manorScene(p.pendingRoom.view,props.uiSkin) : undefined;
  const preparation = useBattleSceneAssets(incomingScene?.assets ?? scene?.assets);
  // A pending destination must not hide the already-ready, still-displayed board.
  const sceneReady=!!p.pendingRoom||preparation.status==="ready";
  useEffect(()=>{
    if(p.pendingRoom&&preparation.status==="ready")p.roomAssetsReady(p.pendingRoom.id);
  },[p.pendingRoom?.id,preparation.status,p.roomAssetsReady]);
  const roomLoading=p.journeyMotion==="loading"||p.journeyMotion==="loaded"
    ? <BattleRoomLoading state={p.journeyMotion==="loaded"?"revealing":preparation.status==="error"?"error":"loading"}
        location={(incomingScene??scene)?.location} onRetry={preparation.retry}/> : undefined;
  useSceneReveal(scene ? "fade" : undefined);
  const terminal = record.schemaVersion !== 1 ? record.snapshot.campaign.settlements.find(t => t.runId === session.locator.expeditionId) : null;
  const story = v.story?.terminalId === terminal?.id ? v.story : null;
  const endingStep = review?.step ?? (story?.status === "pending" ? story.step : null);
  const tutorial = v.tutorial?.runRef ? v.tutorial : null;
  const tutorialStage = tideScene(v);
  const battleBackground = scene?.background ?? tutorialStage?.background;
  const tutorialScene = tutorial?.story ? tideStory(tutorial.story.id, tideStoryEdition(record.contentRef.contentVersion)) : null;
  const tutorialReadingKey = tutorial?.story ? `tutorial:${tutorial.runRef!.id}:${tutorial.attempt}:${tutorial.story.id}${tutorial.guide ? `:${tutorialScene!.revision}` : ""}` : "";
  const firstSceneOverview = record.contentRef.contentVersion >= 11 && tutorial?.story?.id === "S3-1";
  const overviewVisible = firstSceneOverview && tutorialScene && progress.read(tutorialReadingKey) >= tutorialScene.lines.length;
  const narrative = session.runtime.queries.narrative(record);
  const cueKey = narrative?.binding && v.expedition?.run.id === narrative.binding.runId
    ? `airp:${narrative.instance!.id}:${narrative.binding.runId}:${narrative.carrying ? "found" : "departure"}` : null;
  const event = !reviewing && !tutorial ? manorJourneyStory(v) : null;
  const reading = event && progress.read(event.id) < event.lines.length;
  let frame: SceneFrame;
  if (overviewVisible) {
    const beginBattle = async () => {
      if (confirmingOverview.current) return;
      confirmingOverview.current = true;
      try {
        // Replay a failed write's original request before considering another command.
        if (session.getSnapshot().error) await session.refresh();
        const current = session.getSnapshot();
        if (!current.record || current.status !== "ready") return;
        const next = session.runtime.queries.tutorial(current.record);
        if (next?.runRef?.id !== tutorial.runRef!.id || next.attempt !== tutorial.attempt || next.story?.id !== "S3-1") return;
        await session.dispatch({type: "tutorial-read", runRef: next.runRef!, storyId: next.story.id, step: next.story.step, choice: "continue"});
      } finally { confirmingOverview.current = false; }
    };
    frame = {id: `tutorial:overview:${tutorial.runRef!.id}:${tutorial.attempt}`, kind: "adv", content: <TutorialOverview
      busy={transition.isTransitioning || !["ready", "error"].includes(game.status)}
      error={game.error ? gameErrorText(game.error.code) : ""} onBegin={() => void beginBattle()}
      onReturn={() => transition.navigate(gameHref("title"), {destination: "标题", channel: "正在返回"})}/>};
  } else if (tutorial?.story && !p.busy) {
    const slot = tutorial.story, scene = tutorialScene!;
    const key = tutorialReadingKey;
    const cursor = Math.min(progress.read(key), scene.lines.length - 1);
    const chosen = tutorial.choices.find(c => c.storyId === slot.id)?.choice;
    const finish = (choice: "continue" | "A" | "B" | "C" = "continue") => {
      // The last opening-story input opens the manual, not the first encounter.
      // This is a reading position only; confirmation commits the original tutorial-read.
      if (firstSceneOverview) { progress.write(key, scene.lines.length); return; }
      if (session.getSnapshot().status === "ready") void session.dispatch({type: "tutorial-read", runRef: tutorial.runRef!, storyId: slot.id, step: slot.step, choice});
    };
    frame = {id: `tutorial:${slot.id.startsWith("S4") ? "home" : slot.id}`, kind: "adv", backdrop: scene.stages[cursor].background, assets: [...new Set([...storyAssets(scene.lines, scene.background), ...scene.backgrounds])], arrival: slot.id === "S3-1" ? {background:scene.background,eyebrow:"CHAPTER 01",title:"雾滩·退潮岩窟"} : undefined, content: <StoryReading
      {...scene} {...scene.stages[cursor]} wide cursor={cursor} busy={game.status !== "ready"} finalLabel={firstSceneOverview ? "玩法总览" : scene.isFinal ? "完成阅读" : "继续"}
      choice={chosen ? null : scene.choice} onChoose={finish}
      onNext={() => cursor < scene.lines.length - 1 ? progress.write(key, cursor + 1) : finish()}
      onSkip={() => scene.choice && !chosen ? progress.write(key, scene.lines.length - 1) : finish()}/>};
  } else if (matchesMemory && memory.node !== "battle" && !p.busy) {
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
  } else if (!reviewing && cueKey && narrative?.cue && progress.read(cueKey) === 0 && !p.busy) {
    const lines = [{ id: cueKey, kind: "action" as const, text: narrative.cue }];
    const background = manorScenes[v.room!.sceneId];
    frame = { id: cueKey, kind: "adv", assets: storyAssets(lines, background), content: <StoryReading title={narrative.title} location="克雷格旧庄园 · 巡守" background={background} lines={lines} cursor={0} finalLabel="继续巡守" onNext={() => progress.write(cueKey, 1)} onSkip={() => progress.write(cueKey, 1)}/> };
  } else if (event && reading && !p.busy) {
    const cursor = progress.read(event.id);
    frame = {assets:storyAssets(event.lines,manorScenes[v.room!.sceneId]),id:`event:${event.id}`,kind:"adv",content:<StoryReading title={event.title} location="克雷格旧庄园" background={manorScenes[v.room!.sceneId]}
      lines={event.lines} cursor={cursor} finalLabel="返回行动" onNext={() => progress.write(event.id,cursor+1)} onSkip={() => progress.write(event.id,event.lines.length)}/>};
  } else {
    frame = {id:"battle",kind:"battle",battleMotion:scene ? "board" : undefined,assets:scene?.assets ?? (tutorialStage ? [tutorialStage.background] : undefined),content:<>{!v.expedition || reviewing
      ? <ManorConclusion {...props} record={record} onReview={() => setReview({step:0,line:0})}/>
      : <ManorBattleView {...props} presentation={p} scene={scene} sceneReady={sceneReady} roomLoading={roomLoading}/>}<CampaignPanel/>{!v.expedition && !reviewing && <aside className="campaign-panel campaign-panel--report"><AirpPanel compact/></aside>}</>};
  }
  const battle = frame.kind === "battle";
  frame.content = <div className={battle ? `battle-story-shell abyssa-battle-stage abyssa-battle-stage--${props.uiSkin ?? "old-manor"}` : "battle-story-shell"}
    data-manor-scene={battle ? scene?.id ?? (tutorial ? `tide-tutorial-${tutorial.encounter ?? "journey"}` : undefined) : undefined} data-manor-assets={battle && scene ? sceneReady?"ready":preparation.status : undefined}
    style={battleBackground ? {"--manor-scene-image": `url("${battleBackground}")`} as CSSProperties : undefined}>
    <AbyssaProvider className={battle ? "abyssa-expedition-theme" : undefined} data-battle-ui-skin={battle ? props.uiSkin : undefined} style={{height:"100%"}}>{frame.content}</AbyssaProvider>
  </div>;
  return <><SceneSequence frame={frame} blocked={p.busy || !!scene && !sceneReady}
    openingBlocked={transition.isTransitioning || !!scene && !sceneReady}/>
    {battle && scene && !p.pendingRoom && preparation.status !== "ready" && <div className="battle-scene-preparation" role={preparation.status === "error" ? "alert" : "status"}>
      <div><h2>{preparation.status === "error" ? "战场画面准备失败" : "正在准备战场"}</h2>
        <p>{preparation.status === "error" ? "场景或立绘未能加载，进度未受影响。" : `克雷格旧庄园 · ${scene.location}`}</p>
        {preparation.status === "error" && <button className="abyssa-ribbon-button" onClick={preparation.retry}>重新加载画面</button>}
      </div>
    </div>}
  </>;
}
