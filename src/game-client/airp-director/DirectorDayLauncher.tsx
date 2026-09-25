import type { FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { JournalButton, JournalStatus, type JournalStatusTone } from "../JournalPrimitives";

function dayStatus(task: FlowTaskView): {label: string; note: string; tone: JournalStatusTone} {
  switch (task.phase) {
    case "running": return {label: "正在准备安排", note: "收起后仍会继续，完成时会提醒你。", tone: "pending"};
    case "failed": return {label: "安排未完成", note: "查看原因后，可继续准备。", tone: "failed"};
    case "interrupted": return {label: "安排待继续", note: "上次进度已保留。", tone: "pending"};
    case "unsaved": return {label: "安排待保存", note: "内容已备好，保存后继续。", tone: "pending"};
    case "done": return {label: "今日安排已落定", note: "已出现的事项会记在左侧。", tone: "settled"};
    default: return task.primary?.id === "accept"
      ? {label: "安排待确认", note: "查看准备好的安排，确认后生效。", tone: "ready"}
      : task.primary?.id === "generate"
      ? {label: "安排待继续", note: "继续完成今天的安排。", tone: "pending"}
      : {label: "尚未安排", note: "准备今天的馆内安排。", tone: "ready"};
  }
}

/** Opens the existing flow. Viewing the journal never prepares or accepts a day. */
export function DirectorDayLauncher({task, onOpen}: {task: FlowTaskView; onOpen: () => void}) {
  return <>
    <JournalStatus {...dayStatus(task)}/>
    <div className="journal-record__actions"><JournalButton emphasis={task.phase === "waiting" ? "primary" : "normal"} onClick={onOpen}>查看今日安排</JournalButton></div>
  </>;
}
