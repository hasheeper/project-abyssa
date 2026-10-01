import { useLayoutEffect } from "react";
import { motion, type MotionStyle } from "motion/react";
import { SystemPanel } from "../../shared/ui/patterns/SystemPanel";
import { MemoryTimeRange } from "./MemoryTimeRange";
import { allMemories } from "./memory-range";
import { MemoryFooter } from "./MemoryFooter";
import { MemoryCatalogue } from "./MemoryCatalogue";
import { MemoryReader } from "./MemoryReader";
import type { MemoryJournalController } from "./useMemoryJournal";
import type { MemoryJournalData } from "./memory-types";
import windowScene from "../../assets/memory/window-scene.webp";
import "./memory.css";
import type { SystemSceneMotion } from "../system-panel-motion";
import { useMemorySceneMotion } from "./memory-scene-motion";

const MotionPanel = motion.create(SystemPanel);
export function MemoryPanel({ journal, data, onBack, sceneMotion }: {
  journal: MemoryJournalController; data: MemoryJournalData; onBack: () => void; sceneMotion?: SystemSceneMotion;
}) {
  const root = journal.rootRef;
  useMemorySceneMotion(root, sceneMotion, `${journal.mode}:${journal.rangeKey}:${journal.order}:${journal.selectedId}:${journal.visible.length}`);
  const settle = journal.settle;
  useLayoutEffect(() => () => settle(), [settle]);
  useLayoutEffect(() => {
    journal.restore();
    const intent = journal.focusIntent.current;
    const target = intent === "replay" ? root.current?.querySelector<HTMLElement>(".memory-footer__replay") : intent === "reader" ? root.current?.querySelector<HTMLElement>("#memory-reader-title")
      : intent === "entry" ? root.current?.querySelector<HTMLElement>(".memory-entry[aria-current]") : null;
    let active = true;
    queueMicrotask(() => { if (active && target?.isConnected) target.focus({ preventScroll: true }); });
    journal.focusIntent.current = null;
    return () => { active = false; };
  }, [journal.restore, journal.focusIntent, journal.replayEntry]);
  const reading = journal.mode === "reading";
  return <MotionPanel ref={root} embedded label="MEMORY" description="记忆手记" className="memory-panel"
    data-memory-mode={journal.mode} data-memory-changing={journal.changing || undefined} data-memory-change={journal.changeKind ?? undefined} data-ui-motion={journal.reduced ? "reduced" : "full"}
    style={{ "--memory-content-opacity": journal.opacity } as MotionStyle}
    tabs={<MemoryTimeRange key={journal.scope} journal={journal} disabled={data.status === "unavailable"}/>}
    footer={<MemoryFooter journal={journal} available={data.status === "ready"} onBack={onBack}/>}
  >
    <section className="memory-page" id="memory-page" role="region" aria-label="记忆内容">
      <div className="memory-scene" aria-hidden="true"><img src={windowScene} alt="" draggable={false}/></div>
      <div className="memory-page__heading"><span>{reading ? "记录目录" : "编年手记"}</span>
        {data.status === "ready" && !!data.issues?.length && <span className="memory-page__notice" role="status" title={data.issues.map(issue => `${issue.source}：${issue.message}`).join("\n")}>
          部分经历暂未收录<span className="memory-page__notice-detail">{data.issues.map(issue => <span key={issue.source}>{issue.source}：{issue.message}</span>)}</span>
        </span>}
        {journal.visible.length > 1 && <button type="button" disabled={journal.changing} onClick={journal.toggleOrder} aria-label={journal.order === "recent" ? "按时间从近到远排列，切换为从远到近" : "按时间从远到近排列，切换为从近到远"}>
          {journal.order === "recent" ? "时间从近到远" : "时间从远到近"}<span aria-hidden="true"> ↕</span>
        </button>}
      </div>
      {journal.visible.length ? <div className="memory-page__contents" aria-busy={journal.changing}>
        <MemoryCatalogue journal={journal}/><MemoryReader journal={journal}/>
      </div> : <div className="memory-empty" role="status"><span aria-hidden="true">◇</span><h2>{data.status === "unavailable" ? "暂时无法读取记忆" : data.issues?.length ? "部分经历暂时无法读取" : "这一页还没有记录"}</h2>
        <p>{data.status === "unavailable" ? data.message ?? "暂时没有可读取的记忆来源。" : journal.range.kind === "all" ? "已经读过的故事，将按时间留在这里。" : "这段时间没有已收录的记忆。"}</p>
        {journal.range.kind !== "all" && <button type="button" onClick={() => journal.setRange(allMemories, true)}>查看全部经历</button>}</div>}
    </section>
  </MotionPanel>;
}
