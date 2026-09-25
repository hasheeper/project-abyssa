import type { DirectDriverState } from "../../game-runtime/airp-direct-driver";
import type { DirectProgressFacts, DirectStage } from "../../game-runtime/airp-direct-progress";

export const directStageLabels: Record<DirectStage, string> = {planning: "大纲", writing: "正文", formatting: "格式化", updater: "读后记忆"};
export const stageLabelsFor = (version: number) => (version === 5 || version === 6) ? {...directStageLabels, planning: "创作", writing: "润色"} : directStageLabels;
export const generationStages = ["planning", "writing", "formatting"] as const;
export type DirectProgress = {
  title: string; note: string | null; detailError: string | null; tone: "quiet" | "active" | "warning";
  primary: "generate" | "update" | "save" | "settings" | null; primaryLabel: string;
  cancelLabel: string | null; canHandwrite: boolean; canExportPending: boolean;
  clockSince: number | null; rail: {stage: typeof generationStages[number]; label: string; status: string}[];
};
/** Pure and inexpensive: rendering, opening details and ticking never perform work. */
export function projectDirectProgress(facts: DirectProgressFacts, driver: DirectDriverState, ready: boolean, connectionIssue: string | null, resourceVersion = 4): DirectProgress {
  const labels = stageLabelsFor(resourceVersion);
  const {task} = facts, op = driver.operation;
  const owned = !!op && op.sceneId === task.sceneId && (op.saveId === null || op.saveId === facts.saveId && op.epoch === facts.epoch);
  const active = owned && driver.busy, pending = owned && driver.pendingResult;
  const blocked = driver.busy || driver.pendingResult || !ready;
  const last = task.attempts.at(-1);
  const liveError = owned && (!op.stage || !task.attempts.some(a => a.stage === op.stage && a.status === "succeeded")) ? driver.error : null;
  const view: DirectProgress = {title: "正文已保存", note: null, detailError: liveError, tone: "quiet", primary: null, primaryLabel: "",
    cancelLabel: null, canHandwrite: facts.canGenerate && !blocked, canExportPending: pending, clockSince: null,
    rail: generationStages.map(stage => {
      const attempts = task.attempts.filter(a => a.stage === stage), latest = attempts.at(-1);
      const status = attempts.some(a => a.status === "succeeded") ? "已保存"
        : active && op.stage === stage ? op.phase === "saving" ? "保存中" : "进行中"
        : pending && op.stage === stage ? "未保存" : latest?.status === "running" || latest?.status === "interrupted" ? "待确认"
        : latest?.status === "failed" ? "未完成" : "待执行";
      return {stage, label: labels[stage], status};
    })};
  if (active) {
    const label = op.stage ? labels[op.stage] : "结果";
    view.tone = "active";
    if (op.phase === "waiting-lock") {view.title = "正在等待此存档的其他操作"; view.cancelLabel = "停止等待"; view.clockSince = op.phaseStartedAt;}
    else if (op.phase === "requesting") {
      view.title = op.stage === "updater" ? op.repair ? "正在修复记忆格式" : "正在整理本场记忆"
        : op.repair ? "正在修复格式" : `正在生成${label}`;
      view.cancelLabel = "取消请求"; view.clockSince = op.phaseStartedAt;
    } else if (op.phase === "saving") view.title = `${label}已返回，正在保存`;
    else if (op.phase === "cancelling") view.title = "正在停止本页操作";
    else view.title = op.mode === "update" ? "正在准备整理记忆" : "正在准备生成";
    return view;
  }
  if (pending) return {...view, title: `${labels[op.stage ?? "planning"]}已返回，但尚未保存`,
    note: "请先保存或导出；刷新、切档或关闭页面会丢失内存结果。", detailError: driver.error, tone: "warning",
    primary: ready ? "save" : null, primaryLabel: "仅重试保存输出"};
  if (task.source === "handwritten") return {...view, title: "本场使用手写稿", detailError: null};
  if (task.memoryId) return {...view, title: "本场记忆已保存", detailError: null};
  if (facts.generating || facts.canUpdate) {
    view.title = facts.canUpdate ? "待整理本场记忆" : task.source === "undecided" ? "准备生成这场对白" : "可以继续本场生成";
    if (facts.capacityReached) return {...view, title: "本任务已达重试上限", note: "可展开技术详情核对原始输出。", tone: "warning"};
    if (last?.status === "running") {view.title = "上次执行结果待确认"; view.note = "其他页面可能仍在处理。本页不会自动重发；续跑先核对进度，重新调用可能再次计费。"; view.tone = "warning";}
    else if (last?.outcomeUnknown) {view.title = "本次结果未确认"; view.note = "重试可能再次计费，已保存阶段不会重跑。"; view.tone = "warning";}
    else if (last?.status === "failed" || liveError) {
      view.title = facts.canUpdate ? "记忆整理未完成" : `${labels[last?.stage ?? op?.stage ?? "planning"]}未完成`;
      view.note = facts.canUpdate ? "阅读和交付已保存，只需重试记忆整理。" : "已保存阶段保留，可继续原任务。"; view.tone = "warning";
      if (liveError?.includes("同档") && liveError.includes("不支持")) {view.title = "此环境暂不支持直连生成"; view.note = liveError;}
    }
    if (owned && op.phase === "cancelled" && !last) view.title = "已停止本页操作";
    if (!blocked && (facts.canGenerate || facts.canUpdate)) {
      view.primary = connectionIssue ? "settings" : facts.canUpdate ? "update" : "generate";
      view.primaryLabel = connectionIssue ? "打开AI设置" : facts.canUpdate ? last?.stage === "updater" ? "重新整理记忆" : "整理已读记忆"
        : task.source === "undecided" ? "生成这场对白" : "继续原任务";
      if (connectionIssue) view.note = [view.note, connectionIssue].filter(Boolean).join(" ");
    }
  } else if (task.read) view.title = "正文已读，确认交付后可整理记忆";
  if (!owned && (driver.busy || driver.pendingResult) && (facts.canGenerate || facts.canUpdate)) view.note = driver.pendingResult ? "另一场任务有未保存输出，请先处理。" : "另一场任务正在处理。";
  return view;
}

export function directElapsed(since: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
