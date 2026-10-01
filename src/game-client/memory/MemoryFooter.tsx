import { RpgShapeButton } from "../../shared/ui/primitives/RpgShapeButton";
import { allMemories, memoryRangeLabel } from "./memory-range";
import type { MemoryJournalController } from "./useMemoryJournal";
import { MemoryActPicker } from "./MemoryActPicker";
import "../../shared/ui/styles/scene-feedback.css";
import "./memory-footer.css";

export function MemoryFooter({ journal, available, onBack }: {
  journal: MemoryJournalController; available: boolean; onBack: () => void;
}) {
  const reading = journal.mode === "reading";
  const index = journal.visible.findIndex(entry => entry.id === journal.selectedId);
  const rangeLabel = journal.range.kind === "all" ? `第 1—${journal.now} 天` : memoryRangeLabel(journal.range);
  const canReplay = journal.selectedAct ? journal.selectedAct.replay === "scene" : !!journal.selected?.replay;
  return <div className="memory-footer" data-reading={reading || undefined}>
    <div className="memory-footer__browse">
      {reading ? <span className="memory-footer__context memory-footer__position" aria-label={`第 ${index + 1} 条，共 ${journal.visible.length} 条记录`}>
        <strong>{String(index + 1).padStart(2, "0")}</strong><span aria-hidden="true">/</span><span>{String(journal.visible.length).padStart(2, "0")}</span><small>条记录</small>
      </span> : <>
        {available && <span className="memory-footer__context memory-footer__summary"><span>{rangeLabel}</span><span>{journal.visible.length} 条记录</span></span>}
      </>}
    </div>
    <div className="memory-footer__scene">
      {reading ? <div className="memory-footer__recollection">
        <MemoryActPicker journal={journal}/>
        <button type="button" className="memory-footer__replay" aria-label={canReplay ? "回想场景" : "回想场景（仅文字记录）"}
          aria-disabled={!canReplay || undefined} disabled={journal.changing} onClick={journal.startReplay}>回想场景</button>
        {!canReplay && <span className="memory-footer__unavailable">仅文字记录</span>}
      </div> : available && journal.undatedCount > 0 && <button type="button" className="memory-footer__undated" aria-pressed={journal.range.kind === "undated"}
        aria-label={`时间未记录 · ${journal.undatedCount}`}
        onClick={() => journal.setRange(journal.range.kind === "undated" ? allMemories : { kind: "undated" }, journal.range.kind === "undated")}>
        <span>时间未记录</span><span className="memory-footer__undated-count">{journal.undatedCount}</span><i data-direction="next" aria-hidden="true"/>
      </button>}
    </div>
    <div className="memory-footer__actions">
      <nav className="memory-footer__navigation" aria-label="相邻记录" hidden={!reading}>
        <button type="button" disabled={index <= 0 || journal.changing} onClick={() => journal.open(journal.visible[index - 1].id)}>
          <i data-direction="previous" aria-hidden="true"/><span>前一条</span>
        </button>
        <button type="button" disabled={index < 0 || index === journal.visible.length - 1 || journal.changing} onClick={() => journal.open(journal.visible[index + 1].id)}>
          <span>后一条</span><i data-direction="next" aria-hidden="true"/>
        </button>
      </nav>
      <RpgShapeButton className="scene-feedback__action memory-footer__return" label={reading ? "返回目录" : "返回"}
        watermark={{ outerOpacity: .2, innerOpacity: .08 }} onClick={() => { if (!journal.showCatalogue()) onBack(); }}>
        <span>{reading ? "返回目录" : "返回"}</span>
      </RpgShapeButton>
    </div>
  </div>;
}
