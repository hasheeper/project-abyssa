import { Fragment, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { UiContentTransition } from "../shared/ui/motion/UiContentTransition";
import bookGlyph from "../assets/icons/items/notebook.svg";
import returnGlyph from "../assets/icons/items/backpack.svg";
import memoryGlyph from "../assets/icons/items/bookmark.svg";
import "./journal-browser.css";

export interface JournalEntry {
  id: string;
  title: string;
  meta: string;
  kind: "return" | "story" | "quest" | "memory";
  group: "current" | "archive" | "locked";
  actionable?: boolean;
  ongoing?: boolean;
  sourceId?: string;
  content: ReactNode;
}

/** Selection is reading state only. No entry is opened through a gameplay command. */
export function JournalBrowser({entries, selectedId, onSelect, empty, tools}: {
  entries: JournalEntry[]; selectedId: string | null; onSelect: (id: string | null) => void;
  empty: ReactNode; tools?: ReactNode;
}) {
  const uid = useId(), reader = useRef<HTMLElement>(null);
  const selected = entries.find(e => e.id === selectedId) ?? entries.find(e => e.group !== "locked");
  const previousSelection = useRef(selected?.id);
  useEffect(() => {
    if (selectedId !== (selected?.id ?? null)) onSelect(selected?.id ?? null);
  }, [selectedId, selected?.id, onSelect]);
  useEffect(() => {
    // A new reader already starts at zero. Even writing scrollTop=0 on mount
    // forces layout before the manor window has painted its first frame.
    if (previousSelection.current === selected?.id) return;
    previousSelection.current = selected?.id;
    if (reader.current) reader.current.scrollTop = 0;
  }, [selected?.id]);
  const move = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-journal-entry]")];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
    buttons[next]?.focus(); buttons[next]?.click();
  };
  return <div className="journal-browser">
    <nav className="journal-browser__index manor-utility__inset" aria-label="日志条目" onKeyDown={move}>
      {entries.length ? <ul className="journal-browser__entries">
        {entries.map(e => <li key={e.id}>
          <button type="button" data-journal-entry={e.id} data-source-id={e.sourceId} data-locked={e.group === "locked" || undefined}
            aria-label={`查看记录：${e.title}`} aria-description={e.meta}
            aria-current={selected?.id === e.id ? "true" : undefined} aria-controls={`${uid}-reader`}
            onClick={() => onSelect(e.id)}>
            <img src={e.kind === "return" ? returnGlyph : e.kind === "memory" ? memoryGlyph : bookGlyph} alt=""/>
            <span><strong title={e.title}>{e.title}</strong><small title={e.meta}>{e.meta}</small></span>
          </button>
        </li>)}
      </ul> : <p className="journal-browser__index-empty">尚无记事</p>}
      {tools && <div className="journal-browser__tools">{tools}</div>}
    </nav>
    <article ref={reader} id={`${uid}-reader`} className="journal-browser__reader" tabIndex={0} aria-label={selected?.title ?? "旅程记事"}>
      <UiContentTransition className="journal-browser__reading" contentKey={selected?.id ?? "empty"}>
        <Fragment key={selected?.id ?? "empty"}>{selected?.content ?? empty}</Fragment>
      </UiContentTransition>
    </article>
  </div>;
}

export function JournalRecordHeading({title, meta, detail}: {title: string; meta: string; detail?: ReactNode}) {
  return <header className="journal-record__heading">
    <p className="journal-record__meta">{meta}</p>
    {detail ? <div className="journal-record__title-row"><h3>{title}</h3>{detail}</div> : <h3>{title}</h3>}
  </header>;
}
