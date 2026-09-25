import { directorStage } from "../../game-runtime/airp-director-view";
import { flowKey, type FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { downloadJson } from "../game-errors";
import { generationAction as action, type GenerationAction } from "../airp-generation/GenerationFlow";
import type { useDirector } from "./useDirector";
import { directorOperationRevision, useDirectorOperation } from "./useDirectorOperation";

/** Maps existing commands to presentation; opening the panel never executes this map. */
export function useDirectorFlow(d: ReturnType<typeof useDirector>, jobId?: string) {
  const view = d.view;
  const state = view?.state, day = view?.context.budget.day;
  const job = jobId ? state?.jobs.find(j => j.id === jobId) : state?.jobs.filter(j => j.kind === "day" && j.planning?.budget.day === day).at(-1);
  const today = state?.days.find(p => p.day === day);
  const accepted = !jobId && !!today && today.jobId === job?.id, stage = job && directorStage(job);
  const key=flowKey({saveId:d.session.locator.saveId,epoch:d.session.locator.epoch,family:"director",jobId:job?.id ?? `day:${day}`,frameId:job?.id ?? `day:${day}`});
  const {working,error,work}=useDirectorOperation(key,directorOperationRevision(job));
  const progress = d.progress;
  const busy = working || !!progress?.busy || d.game.status !== "ready";
  const owns = !progress?.jobId || progress.jobId === job?.id;
  const pending = owns && !!progress?.pendingResult, active = owns && !!progress?.busy;
  // A saved recovery can advance beyond a failed driver stage without rerunning it.
  const driverError=owns && (pending || !!stage && (!progress?.stage || progress.stage===stage)) ? progress?.error : null;
  const failure = d.game.error?.message || (!active && (error || driverError));
  const interrupted = !active && job?.attempts.some(a => a.status === "running");
  const canRevalidate = !!job?.lowFrame && stage === "writing" && job.attempts.at(-1)?.error === "invalid-output" && !!job.attempts.at(-1)?.output;
  const retryWriting = stage === "writing" && job?.attempts.some(a => a.stage === "writing" && a.status === "failed");
  const canReconnect = !!job?.lowFrame && !!stage && job.attempts.some(a => a.stage === stage && a.status === "failed");
  const canReplan = accepted && state?.events.some(e => today?.entryIds.includes(e.id) && e.publishedPhase === null && ["planned", "cancelled"].includes(e.status));
  const available = !busy && !progress?.pendingResult && !d.game.error;
  const actions: GenerationAction[] = [];
  const add = (id: string, label: string, run: () => Promise<unknown>, effect: GenerationAction["effect"] = "request", enabled = available) => {
    const a = action(id,label,enabled,() => work(run),effect); actions.push(a); return a;
  };
  let primary: GenerationAction | undefined;
  if (pending) primary = add("save", "重试保存", () => d.driver.retryCommit(d.port), "storage", !busy);
  else if (!accepted && !job) primary = add("day", "安排今日", async () => {const next = await d.prepareDay(); await d.run(next.id);});
  else if (!accepted && job && stage) primary = add("generate", job.kind === "day" ? "继续安排" : job.kind === "memory" ? "继续整理摘录" : stage === "scene-evaluate" ? "继续GM评估" : stage === "scene-plan" ? "继续GM分派" : stage === "formatting" || canRevalidate ? "继续后处理" : retryWriting ? "重新请求正文" : "生成这场对白", () => d.run(job.id));
  else if (!accepted && job?.kind === "day" && job.acceptedEntries !== null) primary = add("accept", "接纳今日安排", () => d.send({type:"airp-director-accept-day",jobId:job.id}), "storage");
  else if (job?.text && !stage && job.kind === "scene") primary = add("read", "开始阅读", async () => {
    if (state?.reading?.paused) await d.send({type:"airp-director-open", eventId:state.reading.eventId});
    if (state?.cursors[job.id] === undefined) await d.send({type:"airp-director-show",jobId:job.id});
  }, "presentation");
  const utilities: GenerationAction[] = [];
  if (d.game.error) {const reload=add("reload","重新读取",()=>d.session.refresh(),"storage",!working&&!active); if(pending)utilities.push(reload); else primary=reload;}
  if (!accepted && job?.kind === "day" && !progress?.busy && job.attempts.some(a => a.status === "failed")) utilities.push(add("revise", "修订未接纳日程", async () => {const next = await d.prepareDay(!!job.replaces); await d.run(next.id);}));
  if (canReplan) utilities.push(add("replan", "调整未发布安排", async () => {const next=await d.prepareDay(true); await d.run(next.id);}));
  if (canRevalidate) utilities.push(add("retain", "采用已保存正文（不调用）", () => d.send({type:"airp-director-revalidate-low",jobId:job!.id,readerVersion:5}), "storage"));
  if (canReconnect) utilities.push(add("reconnect", "确认使用当前连接（不调用）", () => d.reconnect(job!.id), "storage"));
  if (pending && !active) { const exportAction = action("export", "导出未保存输出", true, () => downloadJson(d.driver.exportPending(),"director-unsaved.json"), "storage"); actions.push(exportAction); utilities.push(exportAction); }
  let secondary: GenerationAction | undefined;
  if (active) {
    primary = action("minimize", "收起", true, () => {}, "presentation");
    actions.push(primary);
    if(!pending) {secondary = action("stop", "停止请求", true, d.driver.cancel, "stop"); actions.push(secondary);}
  }
  const steps = (job?.lowContextVersion ?? 0) >= 16 ? [["writing","正文"],["formatting","封装"],["scene-evaluate","GM"]]
    : (job?.lowContextVersion ?? 0) >= 14 ? [["scene-plan","GM分派"],["writing","正文"],["formatting","封装"],["scene-evaluate","GM评估"]]
    : job?.lowFrame ? [["writing","正文"],["formatting","封装"]] : job?.kind === "memory" ? [["memory","摘录"]]
    : job?.kind === "scene" ? [["planning","创作"],["writing","正文"],["formatting","封装"]] : [["director","安排"],["review","复核"]];
  const phase = active ? "running" : pending ? "unsaved" : failure ? "failed" : interrupted ? "interrupted" : job?.text && !stage ? "readable" : accepted ? "done" : "waiting";
  const task: FlowTaskView = {
    key,
    title: jobId ? job?.kind === "memory" ? "整理摘录" : "当前交谈" : "今日安排", location:"洋馆", phase,
    status: active ? progress.phase === "saving" ? "正在保存这一幕…" : "正在写下这一幕…" : pending ? "内容已生成，尚未保存" : failure ? "本次生成未完成" : interrupted ? "上次准备未完成" : accepted ? "今日安排已落定" : job?.text && !stage ? "这一幕已备好" : stage === "scene-evaluate" ? "正文已保存，等待评估" : "准备就绪",
    detail: active ? "收起后仍会继续生成。" : pending ? "重试保存会保留这份结果，不会重新生成。"
      : canRevalidate || stage === "formatting" ? "原稿已保存，继续处理正文。"
      : failure && retryWriting ? "本次未取得可用正文。重试将再次调用模型。"
      : failure ? "已保存阶段保留，可查看原因后继续。" : undefined,
    primary, secondary, utilities,
    stages: job ? steps.map(([id,label]) => ({id,label,state:job.attempts.some(a=>a.stage===id&&a.status==="succeeded") || id==="writing"&&!!job.lowRevalidatedWriting ? "past" : (active ? progress.stage : stage)===id ? "current" : "next"})) : undefined,
  };
  return {task,actions,job,error:failure,busy,work};
}
