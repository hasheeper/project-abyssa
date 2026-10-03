import { RpgShapeButton } from "../../shared/ui/primitives/RpgShapeButton";
import { allMemories } from "./memory-range";
import type { MemoryJournalController } from "./useMemoryJournal";
import "../../shared/ui/styles/scene-feedback.css";
import "./memory-footer.css";

export function MemoryFooter({ journal, available, onBack }: {
  journal: MemoryJournalController; available: boolean; onBack: () => void;
}) {
  const reading = journal.mode === "reading";
  const index = journal.visible.findIndex(entry => entry.id === journal.selectedId);
  return <div className="memory-footer" data-reading={reading || undefined}>
    <div className="memory-footer__browse">
      {reading ? <nav className="memory-footer__navigation" aria-label="相邻记录">
        <button type="button" disabled={index <= 0 || journal.changing} onClick={() => journal.open(journal.visible[index - 1].id)}>
          <i data-direction="previous" aria-hidden="true"/><span>前一条</span>
        </button>
        <span className="memory-footer__context memory-footer__position" aria-label={`第 ${index + 1} 条，共 ${journal.visible.length} 条记录`}>
          <strong>{String(index + 1).padStart(2, "0")}</strong><span aria-hidden="true">/</span><span>{String(journal.visible.length).padStart(2, "0")}</span>
        </span>
        <button type="button" disabled={index < 0 || index === journal.visible.length - 1 || journal.changing} onClick={() => journal.open(journal.visible[index + 1].id)}>
          <span>后一条</span><i data-direction="next" aria-hidden="true"/>
        </button>
      </nav> : available && <>
        <span className="memory-footer__context">{journal.visible.length} 条记录</span>
        {journal.undatedCount > 0 && <button type="button" className="memory-footer__undated" aria-pressed={journal.range.kind === "undated"}
          aria-label={`时间未记录 · ${journal.undatedCount}`}
          onClick={() => journal.setRange(journal.range.kind === "undated" ? allMemories : { kind: "undated" }, journal.range.kind === "undated")}>
          <span>时间未记录</span><span className="memory-footer__undated-count">{journal.undatedCount}</span>
        </button>}
      </>}
    </div>
    <RpgShapeButton className="scene-feedback__action memory-footer__return" label={reading ? "返回目录" : "返回"}
      watermark={{ outerOpacity: .2, innerOpacity: .08 }} onClick={() => { if (!journal.showCatalogue()) onBack(); }}>
      <span>{reading ? "返回目录" : "返回"}</span>
    </RpgShapeButton>
  </div>;
}
