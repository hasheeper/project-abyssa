import { dayLabel } from "./memory-types";
import { RpgShapeButton } from "../../shared/ui/primitives/RpgShapeButton";
import { MemoryParticipants } from "./MemoryParticipants";
import { MemoryActPicker } from "./MemoryActPicker";
import type { MemoryJournalController } from "./useMemoryJournal";

export function MemoryReader({ journal }: { journal: MemoryJournalController }) {
  const entry = journal.selected;
  const canReplay = journal.selectedAct ? journal.selectedAct.replay === "scene" : !!entry?.replay;
  return <article className="memory-reader" ref={journal.readerRef} hidden={journal.mode !== "reading" && journal.changeKind !== "layout"} aria-hidden={journal.mode !== "reading" || undefined} aria-labelledby="memory-reader-title" tabIndex={0}>
    {entry && <div className="memory-reader__text">
      <div className="memory-reader__context" data-memory-reader-item="context"><span>{dayLabel(entry.day)}{entry.phase && ` · ${entry.phase}`}</span>{entry.location && <span>{entry.location}</span>}</div>
      <div className="memory-reader__heading" data-memory-reader-item="title">
        <h2 id="memory-reader-title" tabIndex={-1}>{entry.title}</h2>
        <MemoryParticipants entry={entry} />
      </div>
      <div className="memory-reader__prose memory-reader__summary" data-memory-reader-item="summary"><p>{entry.summary ?? entry.preview}</p></div>
      <div className="memory-reader__recollection" data-memory-reader-item="recollection" role="group" aria-label="记录阅读操作">
        {(journal.selectedAct || canReplay) && <div className="memory-reader__act-actions">
          <svg className="memory-reader__act-frame" viewBox="0 0 244 44" preserveAspectRatio="none" aria-hidden="true">
            <path d="M11 7 H240 V30 L233 37 H4 V14 Z" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke"/>
          </svg>
          <MemoryActPicker journal={journal}/>
          {canReplay && <button type="button" className="memory-reader__replay" disabled={journal.changing} onClick={journal.startReplay}>
            <i className="memory-reader__control-icon" data-action="replay" aria-hidden="true"/>回想场景
          </button>}
        </div>}
        <RpgShapeButton label={journal.transcriptExpanded ? "收起原文" : "展开原文"} className="scene-feedback__action memory-reader__action memory-reader__expand"
          watermark={false} aria-expanded={journal.transcriptExpanded} aria-controls="memory-transcript"
          onClick={journal.toggleTranscript}><i className="memory-reader__control-icon" data-action="transcript" aria-hidden="true"/>{journal.transcriptExpanded ? "收起原文" : "展开原文"}</RpgShapeButton>
      </div>
      <div id="memory-transcript" className="memory-reader__prose" hidden={!journal.transcriptExpanded}>
        {journal.selectedAct && <h3 className="memory-reader__act-title">第 {journal.acts.findIndex(a => a.id === journal.selectedAct?.id) + 1} 幕 · {journal.selectedAct.title}</h3>}
        {journal.transcript.filter(block => block.text.trim()).map((block, index) => <p key={`${entry.id}:${journal.selectedAct?.id}:${index}`} data-memory-reader-item={`block-${index}`} className={block.kind === "choice" ? "memory-reader__choice" : block.kind === "receipt" ? "memory-reader__receipt" : undefined}>
        {block.speaker && <span className="memory-reader__speaker">{block.speaker}</span>}{block.text}
      </p>)}</div>
      {journal.transcriptExpanded && <span className="memory-reader__end" data-memory-reader-item="end" aria-hidden="true" />}
    </div>}
  </article>;
}
