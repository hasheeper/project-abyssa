import { AirpReading } from "../airp-generation/AirpReading";
import { InlineFeedback } from "../../shared/ui/patterns/SceneFeedback";
import { directorTaskBrief, directorSettlementFeedback } from "../../game-runtime/airp-director-view";
import { navigateTo } from "../../shared/routing/location";
import { gameHref, recordLocator } from "../navigation";
import { GameOperationFeedback } from "../GameOperationFeedback";
import { DirectGenerationScene } from "../airp-generation/DirectGenerationScene";
import { DirectorControls } from "./DirectorControls";
import { useDirector } from "./useDirector";
import type { AuthoredLine } from "../../content/presentation/authored-story";
import { mansionSceneBackground } from "../mansion-backgrounds";
import "../airp.css";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";
import forwardIcon from "../../assets/icons/fast-forward-button.svg";
import { generationAction } from "../airp-generation/GenerationFlow";
import { directorOperationRevision, useDirectorOperation } from "./useDirectorOperation";
import { FlowGuide } from "../../shared/ui/patterns/flow/FlowGuide";
import { flowKey } from "../../shared/ui/patterns/flow/contracts";

export function DirectorScene() {
  const d = useDirector(), reading = d.view?.state.reading;
  const currentJob=d.view?.state.jobs.find(j=>j.id===reading?.jobId);
  const scope=JSON.stringify([d.session?.locator.saveId,d.session?.locator.epoch,reading?.jobId]);
  const revision=JSON.stringify([directorOperationRevision(currentJob),reading?.cursor,reading?.completed]);
  const {working,error,work}=useDirectorOperation(scope,revision);
  const act = async (operation: () => Promise<unknown>) => {try {await work(operation);} catch { /* Reported by the scoped operation and reader. */ }};
  if (!d.view || !reading) return null;
  const state = d.view.state, job = state.jobs.find(j => j.id === reading.jobId)!, event = state.events.find(e => e.id === reading.eventId)!;
  const taskKey = flowKey({...d.session.locator,family:"director",jobId:job.id,frameId:job.id});
  const worldPhase = d.view.context.world.phase;
  const correction = (job.lowContextVersion ?? 0) >= 18 && job.sceneGMEvaluation?.taskGuideConflict ? job.scene?.dialogue?.taskGuide ?? [] : [];
  const correctionMessage = "正文中的任务说法与实际目标有偏差，请以任务指引为准。";
  const background = mansionSceneBackground(job.scene?.locationId ?? event.card.locationId,
    job.scene?.phase ?? worldPhase);
  const busy = d.game.status !== "ready" || working || !!d.progress?.busy;
  const advance = d.advance ?? d.send;
  const pause = () => {if (!reading.paused) void d.send({type: "airp-director-pause"}).catch(() => {});};
  if (event.role === "result" && event.delivery?.status === "pending") return <DirectGenerationScene title={event.card.title} location="洋馆 · 待交付" background={background} onClose={pause} closeDisabled={busy}
    active={!reading.paused} taskId={taskKey} status="本趟目标已带回，等待交付确认" actions={[generationAction("deliver","确认交付",!busy,() => act(() => advance({type:"airp-director-deliver",eventId:event.id})),"storage")]}>
    <GameOperationFeedback session={d.session} state={d.game} local/>{error && <InlineFeedback message={error}/>}
  </DirectGenerationScene>;
  if (reading.completed) {
    const next = event.role === "action" && event.actionPhase !== null && event.card.actions[event.actionIndex]?.kind === "patrol"
      ? generationAction("depart","前往出击",!busy,() => act(async () => {
        const after=await d.send({type:"airp-director-pause"});navigateTo(gameHref("map",recordLocator(after)));
      }),"presentation")
      : event.role === "result" && event.status === "ready"
        ? generationAction("result","继续结果反馈",!busy,() => act(() => advance({type:"airp-director-open",eventId:event.id})),"storage")
        : generationAction("minimize","收起",!busy,()=>{},"presentation");
    const actions=next.id==="minimize"?[next]:[next,generationAction("minimize","收起",!busy,()=>{},"presentation")];
    return <DirectGenerationScene variant="guide" title={event.card.title} location="洋馆 · 阶段反馈" background={background} onClose={pause} closeDisabled={busy} active={!reading.paused} taskId={taskKey} actions={actions}
    phase="done" status={event.status === "resolved" ? "事件完成" : event.status === "closed" ? "本次已结束" : event.role === "action" ? job.scene?.role === "feedback" ? "行动已记录" : event.card.form === "sortie" ? "已接下委托" : "准备行动" : "本段已结束"}>
    <section className="director-stage-feedback" aria-label="任务进度与下一步">
      {!!correction.length && <InlineFeedback message={correctionMessage} tone="warning"/>}
      <FlowGuide guide={directorTaskBrief(event, d.view.context.capabilities, d.view.context.authorSources)}/>
      {["resolved", "closed"].includes(event.status) && <div className="flow-guide__receipts">{directorSettlementFeedback(d.game.record, event.id).map((line, i) => <p key={`settlement:${i}`} role="status">{line}</p>)}</div>}
      <GameOperationFeedback session={d.session} state={d.game} local/>
      {error && <InlineFeedback message={error}/>}
    </section>
  </DirectGenerationScene>;
  }
  const finished = !!job.text && reading.cursor >= job.text.lines.length, choices = finished ? job.scene!.choices : [];
  const attitudes = (job.lowContextVersion ?? 0) >= 8 && reading.cursor >= (job.text?.lines.length ?? 0) - 1 && !job.lowResponse ? job.lowChoices ?? [] : [];
  const optionIds = ["A", "B", "C"] as const;
  const lines: AuthoredLine[] = (job.text?.lines ?? []).map((l, i) => l.speaker === "narrator" ? {id: `${job.id}:${i}`, kind: "action", text: l.text} : {id: `${job.id}:${i}`, characterId: l.speaker, emotion: l.emotion, text: l.text});
  const previousScenes = event.readSceneIds.flatMap(id => {
    const prior = state.jobs.find(j=>j.id===id); if (!prior?.text || id===job.id) return [];
    // A legacy job without a frozen room retains a common backdrop. The event's
    // starting location is not evidence for the location of every later scene.
    return [{id,title:event.card.title,readCount:state.cursors[id] ?? 0,response:prior.lowResponse?.text,
      background:mansionSceneBackground(prior.scene?.locationId,
        prior.scene?.phase ?? worldPhase),
      lines:prior.text.lines.map((l,i):AuthoredLine=>l.speaker==="narrator"?{id:`${id}:${i}`,kind:"action",text:l.text}:{id:`${id}:${i}`,characterId:l.speaker,emotion:l.emotion,text:l.text})}];
  });
  return <DirectorControls jobId={job.id} title={event.card.title} location="洋馆 · 当前交谈" background={background}
    active={!reading.paused} initialReader={state.cursors[job.id] !== undefined && !reading.paused} onBackground={pause}
    reader={job.text ? () => <AirpReading embedded key={job.id} sceneId={job.id} wide title={event.card.title} location="MANSION" background={background} lines={lines} cursor={Math.min(reading.cursor, lines.length - 1)} busy={busy}
    previousScenes={previousScenes} error={error || d.game.error}
    onAdvance={()=>d.send({type:"airp-director-read",jobId:job.id,cursor:reading.cursor})}
    finalLabel={attitudes.length ? "选择回应态度" : finished ? "请选择行动" : reading.cursor === lines.length - 1 ? "确认本段已读" : "下一句"}
    onNext={() => {if (!finished && !attitudes.length) return advance({type: "airp-director-read", jobId: job.id, cursor: reading.cursor});}}
    choice={attitudes.length ? {id: `${job.id}:attitude`, prompt: "回应态度 · 不代替任务决定", options: attitudes.map((label, i) => ({id: optionIds[i], label}))}
      : choices.length ? {id: `${job.id}:decision`, prompt: event.role === "offer" ? "是否接下这件事" : "确认当前行动", options: choices.map((c, i) => ({id: optionIds[i], label: event.role === "offer" && c.id === "participate" && event.card.form !== "vignette" ? "接下委托" : c.label}))} : null}
    onChoose={async id => { let committed = false; await act(async () => {
      const index = optionIds.indexOf(id);
      if (attitudes.length) {
        await d.send({type: "airp-director-respond", jobId: job.id, index});
        await advance({type: "airp-director-read", jobId: job.id, cursor: reading.cursor});
      } else {
        const after = await advance({type: "airp-director-choose", eventId: event.id, choiceId: choices[index].id});
        const next = after.airpDirector?.events.find(e => e.id === event.id);
        if ((job.lowContextVersion ?? 0) >= 8 && (job.lowContextVersion ?? 0) < 11 && event.role === "offer" && next && ["acceptance", "result"].includes(next.role)) await d.send({type: "airp-director-open", eventId: event.id});
      }
      committed = true;
    }); if (!committed) throw Error("选择未能保存，请重试。"); }}
    controls={event.status === "offered" && finished ? <ReadingTool label="这次不接" caption="PASS" icon={forwardIcon} disabled={busy} onClick={() => void act(() => advance({type: "airp-director-decline", eventId: event.id}))}/> : undefined}
    feedback={<><GameOperationFeedback session={d.session} state={d.game} local/>
      {!!correction.length && reading.cursor >= lines.length - 1 && <InlineFeedback message={`${correctionMessage}\n${correction.join("\n")}`} tone="warning"/>}
      {error && <InlineFeedback message={error}/>}</>}/> : undefined}/>;
}
