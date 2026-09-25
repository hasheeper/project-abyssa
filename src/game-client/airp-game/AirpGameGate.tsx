import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useGameSession, useGameState } from "../react";
import { airpGameView, nodeStage, pendingHomeBoundary } from "../../game-runtime/airp-game-runtime";
import { aiConfiguration, effectiveAiConfiguration } from "../../game-runtime/airp-configuration";
import { AirpReading } from "../airp-generation/AirpReading";
import { GenerationFlow, generationAction, type GenerationAction } from "../airp-generation/GenerationFlow";
import { flowKey, type FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { AiSettingsButton } from "../settings/AiSettingsButton";
import { InlineFeedback } from "../../shared/ui/patterns/SceneFeedback";
import { GameOperationFeedback } from "../GameOperationFeedback";
import type { AuthoredLine } from "../../content/presentation/authored-story";
import manor from "../../assets/backgrounds/old-manor/service-corridor.jpg";
import shore from "../../assets/backgrounds/tide-reef/bg.tide-reef.shore.jpg";
import { navigateTo } from "../../shared/routing/location";
import { gameHref, recordLocator } from "../navigation";
import { CallLog } from "../airp-generation/CallLog";
import { nodeCallLog } from "../../game-runtime/airp-call-log";
import { directorCommissions, commissionRouteName } from "../../game-runtime/airp-commission-view";
import { CommissionList } from "../airp-director/CommissionList";
import "../airp-generation/direct-game.css";
import { registerBackgroundDriver, taskSessionFor } from "../airp-generation/background-tasks";

const emptySubscribe = () => () => {}, emptySnapshot = () => null;
export function AirpGameGate({ children }: { children: ReactNode }) {
  const session = useGameSession(), game = useGameState(), record = game.record;
  const needsTaskHost=record?.schemaVersion===4&&[22,24,26,28].includes(record.contentRef.contentVersion);
  const taskSession=useMemo(()=>needsTaskHost?taskSessionFor(session):session,[session,needsTaskHost]);
  const flow = useMemo(() => {
    if(!("airpGame" in taskSession.runtime))return null;
    const value=taskSession.runtime.airpGame.forSave(session.locator.saveId,record?.contentRef.contentVersion,session.locator.epoch);
    registerBackgroundDriver(taskSession,value.gmDriver,"plan");registerBackgroundDriver(taskSession,value.nodeDriver,"node");registerBackgroundDriver(taskSession,value.settlementDriver,"settlement");return value;
  }, [session,taskSession,record?.contentRef.contentVersion]);
  const [working, setWorking] = useState(false), [error, setError] = useState(""), [present, setPresent] = useState(false);
  const flight = useRef(false);
  const gmProgress = useSyncExternalStore(flow?.gmDriver.subscribe ?? emptySubscribe, flow?.gmDriver.getSnapshot ?? emptySnapshot);
  const nodeProgress = useSyncExternalStore(flow?.nodeDriver.subscribe ?? emptySubscribe, flow?.nodeDriver.getSnapshot ?? emptySnapshot);
  const settleProgress = useSyncExternalStore(flow?.settlementDriver.subscribe ?? emptySubscribe, flow?.settlementDriver.getSnapshot ?? emptySnapshot);
  const hasUnsavedRequest = [gmProgress, nodeProgress, settleProgress].some(p => p?.busy || p?.pendingResult);
  useEffect(() => {
    if (!hasUnsavedRequest) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedRequest]);
  const formal = record?.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion ?? 0) ? record : null;
  useEffect(() => {
    if (!flow || !formal || working) return;
    let alive = true;
    void flow.sync().then(async () => { const r = await flow.host.read(); if (alive && r.head.revision !== formal.head.revision) await session.refresh({ background: true, notify: true }); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : "进度同步未完成。"); });
    return () => { alive = false; };
  }, [flow, formal?.head.revision, working, session]);
  if (!formal || !flow) return <div className="airp-game-page">{children}</div>;
  const home = pendingHomeBoundary(formal), view = airpGameView(formal), node = home ? null : view?.node, plan = view?.plan;
  const preparing = !home && !!plan && plan.status !== "started", key = home?.factId ?? (preparing ? plan!.id : node?.id);
  if (!key) return <><div className="airp-game-page">{children}</div>{error && !game.error && <div className="game-client-status"><InlineFeedback message="进度同步未完成。" details={{id:error,raw:error}}/></div>}</>;
  const needsRewardUpgrade = preparing && !!plan!.frames.at(-1)!.context.rules.commissions.length && plan!.frames.at(-1)!.context.rules.commissionRewardVersion !== 1;
  const busy = working || !!gmProgress?.busy || !!nodeProgress?.busy || !!settleProgress?.busy;
  const pending = !!(gmProgress?.pendingResult || nodeProgress?.pendingResult || settleProgress?.pendingResult);
  const background = !home && formal.airpGame!.preparation?.departure.routeId.includes("tide-reef") ? shore : manor;
  const act = async (fn: () => Promise<unknown>) => {
    if (flight.current) return;
    flight.current = true; setWorking(true); setError("");
    try {await fn();} catch (e) {setError(e instanceof Error ? e.message : "操作未完成。"); throw e;}
    finally {try {if(taskSession!==session)await taskSession.refresh({background:true,notify:true});await session.refresh({background:true,notify:true});} catch {setError("存档未刷新，请重新读取后继续。");} finally {flight.current=false; setWorking(false);}}
  };
  const connection = (slot: "planning" | "writing" | "updater") => { const c = effectiveAiConfiguration(aiConfiguration.getSnapshot()); return {config:c.models[slot],key:c.keys[slot]}; };
  const revalidatedWriting = node?.writingRevalidation && node.attempts.at(-1)?.stage === "writing";
  const message = error || game.error?.message || gmProgress?.error || (revalidatedWriting ? null : nodeProgress?.error) || settleProgress?.error;
  const runningSettlement = formal.airpGame!.settlement.jobs.find(j => j.status === "running");
  const currentSettlement = formal.airpGame!.settlement.jobs.find(j => j.frames.at(-1)?.input.scope.boundaryId === node?.id);
  const homeJob = home && formal.airpGame!.settlement.jobs.find(j => j.frames.at(-1)?.input.scope.boundaryId === home.factId);
  const recoverableStage = node && nodeStage(node);
  const retryWriting = recoverableStage === "writing" && node?.attempts.some(a => a.stage === "writing" && a.status === "failed");
  const readable = !!node?.text && !node.selected;
  const interrupted = !busy && (runningSettlement || plan?.status === "running" || node?.attempts.some(a => a.status === "running"));
  const actions: GenerationAction[] = [], utilities: GenerationAction[] = [];
  const add = (id:string,label:string,run:()=>Promise<unknown>,effect:GenerationAction["effect"]="request",enabled=!busy&&!pending) => {
    const result=generationAction(id,label,enabled,()=>act(run),effect); actions.push(result); return result;
  };
  let primary: GenerationAction | undefined, secondary: GenerationAction | undefined;
  if (home) {
    primary=add("settle-home","结算并查看结果",async()=>{const id=await flow.settleHome(); await flow.settlementDriver.run(flow.host.settlement,id,connection("updater")); if(flow.settlementDriver.getSnapshot().error) throw Error(flow.settlementDriver.getSnapshot().error!);});
    if(!homeJob || ["failed","pending"].includes(homeJob.status)) utilities.push(add("facts","仅记程序事实并继续（不评估关系与叙事状态）",()=>flow.useHomeProgramFacts(),"storage",!busy&&!hasUnsavedRequest));
    if(homeJob && ["failed","stale"].includes(homeJob.status)) utilities.push(add("refresh",homeJob.status==="stale"?"更新结算依据（不调用）":"更新结算连接（不调用）",()=>flow.refreshHomeSettlement(),"storage",!busy&&!hasUnsavedRequest));
    if(!busy && homeJob?.status==="running") utilities.push(add("interrupt","标记中断后重试",()=>flow.settlementDriver.markInterrupted(flow.host.settlement,homeJob.id),"storage"));
  } else {
    if(preparing) primary=add("prepare",plan!.status==="accepted"?"确认出征":"生成本次安排",async()=>{
      if(plan!.status!=="accepted"){await flow.gmDriver.run(flow.host.gm,plan!.id,connection("planning"));if(flow.gmDriver.getSnapshot().error)throw Error(flow.gmDriver.getSnapshot().error!);return;}
      const permit=await flow.gm.departurePermit(plan!.id);await session.refresh({background:true});
      const result=await session.dispatch({type:"start-expedition",...permit.departure});if(!result)throw Error("出征尚未提交，请重试。");await flow.sync();
      navigateTo(gameHref("battle",recordLocator(await flow.host.read())));
    },plan!.status==="accepted"?"storage":"request",!busy&&!pending&&!needsRewardUpgrade);
    if(node && !node.selected) primary=readable?add("read","开始阅读",()=>flow.nodes.show(node.id),"presentation"):
      add("generate",recoverableStage==="formatting" || node.attempts.some(a=>a.stage==="writing"&&a.output)?"继续后处理":retryWriting?"重新请求正文":"生成这场对白",async()=>{
        if(node.status==="waiting")await flow.nodes.open(node.id);await flow.nodes.usePostprocessing(node.id);
        for(let i=0;i<2;i++){const job=(await flow.nodes.read()).ledger.jobs.find(j=>j.id===node.id)!;const stage=nodeStage(job);if(!stage)break;
          await flow.nodeDriver.run(flow.host.nodes,node.id,connection(stage==="writing"?"writing":"updater"));if(flow.nodeDriver.getSnapshot().error)throw Error(flow.nodeDriver.getSnapshot().error!);}
      });
    if(node?.selected && view?.boundary) primary=add("settle","结算并继续",async()=>{
      const id=await flow.settle(node.id),job=(await flow.settlement.read()).ledger.jobs.find(j=>j.id===id)!;
      if(job.status==="failed"&&job.problem==="invalid-output"){try{await flow.settlement.revalidate(id);}catch{/* Explicit retry can issue a new request. */}}
      await flow.settlementDriver.run(flow.host.settlement,id,connection("updater"));if(flow.settlementDriver.getSnapshot().error)throw Error(flow.settlementDriver.getSnapshot().error!);
      await flow.nodes.complete(node.id);await flow.sync();
    });
    if(node?.selected&&view?.boundary&&(!currentSettlement||["pending","failed"].includes(currentSettlement.status))) utilities.push(add("facts","仅记程序事实并继续（不评估关系与叙事状态）",async()=>{await flow.useProgramFacts(node.id);await flow.sync();},"storage",!busy&&!hasUnsavedRequest));
    if(node&&recoverableStage&&node.attempts.some(a=>a.stage===recoverableStage))utilities.push(add("connection","确认使用当前连接（不调用）",()=>flow.changeNodeConnection(node.id,connection(recoverableStage==="writing"?"writing":"updater").config),"storage",!busy&&!hasUnsavedRequest));
    if(node&&recoverableStage==="writing"&&node.attempts.some(a=>a.stage==="writing"&&a.status==="failed"&&a.output))utilities.push(add("retain","采用已保存正文（不调用）",()=>flow.nodes.revalidateWriting(node.id),"storage",!busy&&!hasUnsavedRequest));
    if(node&&currentSettlement&&["failed","stale"].includes(currentSettlement.status))utilities.push(add("refresh-settlement",currentSettlement.status==="stale"?"更新结算依据（不调用）":"更新结算连接（不调用）",()=>flow.refreshSettlement(node.id),"storage",!busy&&!hasUnsavedRequest));
    if(preparing)utilities.push(add("cancel-plan","取消本次安排",()=>flow.gm.cancel(plan!.id),"storage"));
    if(preparing&&(needsRewardUpgrade||["failed","stale","accepted"].includes(plan!.status)))utilities.push(add("refresh-plan","更新出征依据（不调用）",async()=>{await flow.host.registerCommissions();await flow.gm.refresh(plan!.id);},"storage"));
    if(node&&!node.shown&&!node.reads.length)utilities.push(add("skip","跳过本场",()=>flow.nodes.skip(node.id),"storage"));
    if(interrupted)utilities.push(add("interrupt","标记中断后重试",async()=>{
      if(runningSettlement)await flow.settlementDriver.markInterrupted(flow.host.settlement,runningSettlement.id);
      else if(preparing)await flow.gmDriver.markInterrupted(flow.host.gm,plan!.id);
      else if(node){const attempt=node.attempts.find(a=>a.status==="running")!;await flow.nodes.interrupt(node.id,attempt.id,Date.now());}
    },"storage"));
  }
  if(pending)primary=add("save","重试保存",async()=>{
    if(gmProgress?.pendingResult)await flow.gmDriver.retrySave(flow.host.gm);
    if(nodeProgress?.pendingResult)await flow.nodeDriver.retrySave(flow.host.nodes);
    if(settleProgress?.pendingResult)await flow.settlementDriver.retrySave(flow.host.settlement);
  },"storage",!busy);
  else if(busy){primary=generationAction("minimize","收起",true,()=>{},"presentation");secondary=generationAction("stop","停止请求",true,()=>{flow.gmDriver.cancel();flow.nodeDriver.cancel();flow.settlementDriver.cancel();},"stop");actions.push(primary,secondary);}
  if(game.error&&!busy){const reload=add("reload","重新读取",()=>session.refresh(),"storage",true);if(pending)utilities.unshift(reload);else primary=reload;}
  const stageIndex=preparing?0:home||node?.selected?2:1;
  const task:FlowTaskView={key:flowKey({saveId:formal.head.saveId,epoch:formal.head.epoch,family:home?"settlement":"expedition",jobId:key,frameId:key}),
    title:home?.title??(preparing?"出征安排":node?.selected?"记下这段经历":"副本 · 当前场景"),location:home?"洋馆 · 经历结算":commissionRouteName(formal.airpGame!.preparation!.departure.routeId),
    phase:pending?"unsaved":busy?"running":message||needsRewardUpgrade?"failed":interrupted?"interrupted":readable?"readable":"waiting",
    status:pending?"内容已生成，尚未保存":busy?preparing?"正在安排这次出征…":home||node?.selected?"正在整理这一段经历…":"正在写下这一幕…":needsRewardUpgrade?"出征依据已变化":message?"本次处理未完成":interrupted?"上次准备未完成":readable?"这一幕已备好":preparing&&plan?.status==="accepted"?"本次出征安排已备好":home?"本次反馈已读完，等待结算":"准备就绪",
    detail:pending?"重试保存会保留这份结果，不会重新生成。":busy?"收起后仍会继续生成。":needsRewardUpgrade?"这份旧安排尚未包含委托物品，请先更新出征依据。":revalidatedWriting||recoverableStage==="formatting"?"已保留原稿，继续时只调用后处理。":message&&retryWriting?"本次未取得可用正文。重试将再次调用模型。":undefined,
    stages:["安排","演出","结算"].map((label,i)=>({id:label,label,state:i<stageIndex?"past":i===stageIndex?"current":"next"})),primary,secondary,utilities};
  const reader = readable && node?.text ? () => {
    const text=node.text!,finished=node.reads.length===text.lines.length;
    const lines:AuthoredLine[]=text.lines.map((l,i)=>l.speaker==="narrator"?{id:`${node.id}:${i}`,kind:"action",text:l.text}:{id:`${node.id}:${i}`,characterId:l.speaker,emotion:l.emotion,text:l.text});
    const previousScenes=Object.values(formal.airpGame!.nodes).flatMap(n=>n.jobs).filter(j=>j.planId===node.planId&&j.id!==node.id&&j.reads.length>0)
      .sort((a,b)=>a.reads[0].revision-b.reads[0].revision).flatMap(j=>j.text?[{id:j.id,title:"副本 · 已读场景",readCount:j.reads.length,response:j.selected?.text,
        lines:j.text.lines.map((l,i):AuthoredLine=>l.speaker==="narrator"?{id:`${j.id}:${i}`,kind:"action",text:l.text}:{id:`${j.id}:${i}`,characterId:l.speaker,emotion:l.emotion,text:l.text})}]:[]);
    return <AirpReading embedded sceneId={node.id} wide title="副本 · 当前场景" location="EXPEDITION" background={background} lines={lines} cursor={Math.min(node.reads.length,lines.length-1)} busy={busy}
      previousScenes={previousScenes} error={error||game.error} onNext={async()=>{if(finished)return;await flow.nodes.readLine(node.id,node.reads.length);await session.refresh({background:true,notify:true});if(session.getSnapshot().error)throw Error("阅读进度未能刷新，请重试。");}}
      finalLabel={finished?"请选择态度":node.reads.length===lines.length-1?"确认本段已读":"下一句"}
      choice={finished?{id:`${node.id}:attitude`,prompt:"你的态度",options:text.choices.map((label,i)=>({id:(["A","B","C"] as const)[i],label}))}:null}
      onChoose={async id=>{await act(()=>flow.nodes.choose(node.id,["A","B","C"].indexOf(id)));if(session.getSnapshot().error)throw Error("选择未能确认，请重试。");}}
      feedback={<GameOperationFeedback session={session} state={game} local/>}/>;
  }:undefined;
  return <><div className="airp-game-page" data-suspended={present}>{children}</div><GameOperationFeedback session={session} state={game} local managed/><GenerationFlow task={task} actions={actions} reader={reader} readerLocked initialReader={!!node&&(!!node.shown||!!node.reads.length)&&!node.selected} onPresentationChange={setPresent} background={background}
    backgroundOwner={taskSession} returnPage={home?"mansion":preparing?"map":"battle"} lane={home||node?.selected?"settlement":preparing?"plan":"node"}
    details={message?<p>{message}</p>:undefined} footer={<><AiSettingsButton label="连接设置"/>{node&&<CallLog entries={nodeCallLog(node)} warnings={[...node.writingWarnings,...(node.text?.formatWarnings??[])]}/>}</>}>
    {preparing&&<CommissionList title="本趟委托" tasks={directorCommissions(formal,formal.airpGame!.preparation!.departure.routeId)??[]} includedIds={plan!.frames.at(-1)!.context.rules.commissions.map(c=>c.eventId)}/>}
    {preparing&&!!plan?.prepared&&!!view?.commissionRewards.length&&<section aria-label="委托物品安排"><h3>委托物品安排</h3><ul>{view.commissionRewards.map(r=><li key={r.definitionId}>{r.label} · 第{r.layer}层{r.awardWhen==="room-cleared"?"目标战斗胜利后取得":"完成整层后取得"}。安全带回后交付，团灭遗失。</li>)}</ul></section>}
    {home&&<p>{home.kind==="event"?"结算后查看关系与记忆记录。":"结算后继续下一步；整件任务尚未因此完成。"}</p>}
  </GenerationFlow></>;
}
