import { dayLabel, memoryActorLabels, type MemoryEntry } from "./memory-types";
import type { MemoryJournalController } from "./useMemoryJournal";
import { MemoryIcon } from "./MemoryIcon";

export function MemoryCatalogue({ journal }: { journal: MemoryJournalController }) {
  const groups: { day: number | null; entries: MemoryEntry[] }[] = [];
  for (const entry of journal.visible) {
    const previous = groups.at(-1);
    if (previous && previous.day === entry.day) previous.entries.push(entry);
    else groups.push({ day: entry.day, entries: [entry] });
  }
  return <div className="memory-catalogue" ref={journal.catalogueRef} aria-label="记忆目录" tabIndex={0}>
    <div className="memory-catalogue__track">
      {groups.map(group => <section className="memory-date-group" key={group.day ?? "unknown"} aria-label={dayLabel(group.day)}>
        <h2 className="memory-date-group__heading">{dayLabel(group.day)}</h2>
        <ol className="memory-date-group__entries">
          {group.entries.map((entry, index) => <li key={entry.id} data-memory-id={entry.id} data-first={index === 0 || undefined}>
            <button type="button" className="memory-entry" aria-label={`阅读：${entry.title}`} aria-current={journal.selectedId === entry.id ? "true" : undefined}
              onClick={() => journal.open(entry.id)}>
              <span className="memory-entry__node" aria-hidden="true" />
              <span className="memory-entry__when" data-undated={entry.day === null || undefined} aria-hidden="true"><span>{dayLabel(entry.day)}</span><small>{entry.phase}</small></span>
              <span className="memory-entry__art" data-memory-icon={entry.artwork ? undefined : ""}>
                {entry.artwork ? <img src={entry.artwork} alt="" draggable={false}/> : <MemoryIcon entry={entry}/>}
              </span>
              <span className="memory-entry__copy">
                <strong>{entry.title}</strong>
                <span className="memory-entry__preview">{entry.preview}</span>
              </span>
              <span className="memory-entry__meta" title={entry.actors.join("、")}>{[entry.location, ...memoryActorLabels(entry.actors)].filter(Boolean).map((text, i) => <span className="memory-entry__tag" key={text}>{i > 0 && <span aria-hidden="true"> · </span>}{text}</span>)}</span>
            </button>
          </li>)}
        </ol>
      </section>)}
    </div>
  </div>;
}
