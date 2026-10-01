import { dayLabel } from "./memory-types";
import { MemoryParticipants } from "./MemoryParticipants";
import type { MemoryJournalController } from "./useMemoryJournal";

export function MemoryReader({ journal }: { journal: MemoryJournalController }) {
  const entry = journal.selected;
  return <article className="memory-reader" ref={journal.readerRef} hidden={journal.mode !== "reading" && journal.changeKind !== "layout"} aria-hidden={journal.mode !== "reading" || undefined} aria-labelledby="memory-reader-title" tabIndex={0}>
    {entry && <div className="memory-reader__text">
      <div className="memory-reader__context" data-memory-reader-item="context"><span>{dayLabel(entry.day)}{entry.phase && ` · ${entry.phase}`}</span>{entry.location && <span>{entry.location}</span>}</div>
      <div className="memory-reader__heading" data-memory-reader-item="title">
        <h2 id="memory-reader-title" tabIndex={-1}>{entry.title}</h2>
        <MemoryParticipants entry={entry} />
      </div>
      <div className="memory-reader__prose memory-reader__summary" data-memory-reader-item="summary"><p>{entry.summary ?? entry.preview}</p></div>
      <button type="button" className="memory-reader__expand" data-memory-reader-item="transcript-toggle" aria-expanded={journal.transcriptExpanded} aria-controls="memory-transcript"
        onClick={journal.toggleTranscript}>{journal.transcriptExpanded ? "收起原文" : "展开原文"}<span aria-hidden="true">{journal.transcriptExpanded ? "−" : "+"}</span></button>
      <div id="memory-transcript" className="memory-reader__prose" hidden={!journal.transcriptExpanded}>
        {journal.selectedAct && <h3 className="memory-reader__act-title">第 {journal.acts.findIndex(a => a.id === journal.selectedAct?.id) + 1} 幕 · {journal.selectedAct.title}</h3>}
        {journal.transcript.filter(block => block.text.trim()).map((block, index) => <p key={`${entry.id}:${journal.selectedAct?.id}:${index}`} data-memory-reader-item={`block-${index}`} className={block.kind === "choice" ? "memory-reader__choice" : block.kind === "receipt" ? "memory-reader__receipt" : undefined}>
        {block.speaker && <span className="memory-reader__speaker">{block.speaker}</span>}{block.text}
      </p>)}</div>
      <span className="memory-reader__end" data-memory-reader-item="end" aria-hidden="true" />
    </div>}
  </article>;
}
