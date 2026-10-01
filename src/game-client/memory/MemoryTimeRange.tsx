import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence } from "motion/react";
import type { MemoryJournalController } from "./useMemoryJournal";
import { MemoryRangeEditor } from "./MemoryRangeEditor";
import { allMemories, clampDay, memoryRangeLabel, moveMemoryRange, normalizeMemoryRange, rangeDays, type DayRange } from "./memory-range";
import "./memory-time-range.css";

type Part = "from" | "to" | "move" | "track";
type Gesture = { id: number; x: number; width: number; left: number; part: Part; range: DayRange; moved: boolean };
const dayAt = (x: number, left: number, width: number, now: number) => clampDay(Math.floor((x - left) / width * now) + 1, now);
const partOf = (target: EventTarget) => (target as HTMLElement).closest<HTMLElement>("[data-range-part]")?.dataset.rangePart as Part ?? "track";
const adjustmentKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function MemoryTimeRange({ journal, disabled = false }: { journal: MemoryJournalController; disabled?: boolean }) {
  const { range, now, cancelRangeEdit } = journal;
  const root = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), readout = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null), draftRef = useRef<DayRange | null>(null), keyboard = useRef(false);
  const [draft, setDraft] = useState<DayRange | null>(null), [trackWidth, setTrackWidth] = useState(700);
  const [editing, setEditing] = useState(false), [fromText, setFromText] = useState(""), [toText, setToText] = useState("");
  const cancelLatest = useRef<() => boolean>(() => false);
  const bounds = draft ?? rangeDays(range, now);
  const shownRange = draft ? normalizeMemoryRange({ kind: "days", ...draft }, now) : range;
  const left = (bounds.from - 1) / now * 100, width = (bounds.to - bounds.from + 1) / now * 100;
  const narrow = width / 100 * trackWidth < 42;
  const inactive = !draft && range.kind === "undated";
  const movable = bounds.from > 1 || bounds.to < now;
  const update = (value: DayRange | null) => { draftRef.current = value; setDraft(value); };
  const cancel = (restoreFocus = true) => {
    if (!gesture.current && !draftRef.current && !editing) return false;
    const pointer = gesture.current; gesture.current = null; keyboard.current = false;
    if (pointer && track.current?.hasPointerCapture?.(pointer.id)) track.current.releasePointerCapture(pointer.id);
    update(null); setEditing(false);
    if (restoreFocus) readout.current?.focus({ preventScroll: true });
    return true;
  };
  cancelLatest.current = () => cancel();
  useLayoutEffect(() => {
    cancelRangeEdit.current = () => cancelLatest.current();
    return () => { cancelRangeEdit.current = null; };
  }, [cancelRangeEdit]);
  useLayoutEffect(() => {
    if (!track.current || typeof ResizeObserver === "undefined") return;
    const measure = () => setTrackWidth(track.current?.getBoundingClientRect().width || 700);
    measure(); const observer = new ResizeObserver(measure); observer.observe(track.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const blur = () => { cancelLatest.current(); };
    const visibility = () => { if (document.hidden) cancelLatest.current(); };
    window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { cancelLatest.current(); }, [now, disabled]);
  useEffect(() => {
    if (!editing) return;
    const outside = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) setEditing(false); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [editing]);

  const commit = (value: DayRange) => { update(null); setEditing(false); journal.setRange({ kind: "days", ...value }); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || now <= 1 || event.button !== 0 || gesture.current) return;
    event.preventDefault(); setEditing(false);
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const part = partOf(event.target);
    const focus = (event.target as HTMLElement).closest<HTMLElement>("[data-range-part]") ?? event.currentTarget;
    focus.focus({ preventScroll: true });
    gesture.current = { id: event.pointerId, x: event.clientX, width: rect.width, left: rect.left, part, range: rangeDays(range, now), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 4) return;
    drag.moved = true;
    const delta = Math.round((event.clientX - drag.x) / drag.width * now);
    if (drag.part === "from") update({ from: Math.min(drag.range.to, clampDay(drag.range.from + delta, now)), to: drag.range.to });
    else if (drag.part === "to") update({ from: drag.range.from, to: Math.max(drag.range.from, clampDay(drag.range.to + delta, now)) });
    else if (drag.part === "move" && (drag.range.from > 1 || drag.range.to < now)) update(moveMemoryRange(drag.range, delta, now));
    else {
      const a = dayAt(drag.x, drag.left, drag.width, now), b = dayAt(event.clientX, drag.left, drag.width, now);
      update({ from: Math.min(a, b), to: Math.max(a, b) });
    }
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved && draftRef.current) commit(draftRef.current);
    else if (drag.part === "track" || drag.part === "move") {
      const day = dayAt(event.clientX, drag.left, drag.width, now); commit({ from: day, to: day });
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || now <= 1 || !adjustmentKeys.has(event.key)) return;
    event.preventDefault();
    const value = draftRef.current ?? rangeDays(range, now), part = partOf(event.target);
    const delta = event.key === "PageUp" ? 5 : event.key === "PageDown" ? -5 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
    const endpoint = (day: number, min: number, max: number) => event.key === "Home" ? min : event.key === "End" ? max : Math.max(min, Math.min(max, day + delta));
    keyboard.current = true;
    if (part === "from") update({ from: endpoint(value.from, 1, value.to), to: value.to });
    else if (part === "to") update({ from: value.from, to: endpoint(value.to, value.from, now) });
    else update(moveMemoryRange(value, event.key === "Home" ? 1 - value.from : event.key === "End" ? now - value.to : delta, now));
  };
  const finishKeyboard = () => { if (keyboard.current && draftRef.current) { keyboard.current = false; commit(draftRef.current); } };
  const openEditor = () => {
    setFromText(String(bounds.from)); setToText(String(bounds.to)); setEditing(value => !value);
  };
  const tickStep = now <= 12 ? 1 : Math.pow(10, Math.floor(Math.log10(now / 10))) * (now / Math.pow(10, Math.floor(Math.log10(now / 10))) <= 20 ? 2 : 5);
  const ticks = Array.from({ length: Math.ceil(now / tickStep) }, (_, i) => 1 + i * tickStep).filter(day => day <= now);
  const labelEvery = Math.max(1, Math.round(ticks.length / 5));
  const labels = ticks.filter((day, index) => index % labelEvery === 0 && day < now - now / 12);
  const inRange = (day: number) => !inactive && day >= bounds.from && day <= bounds.to;
  const goToNow = () => {
    const value = rangeDays(range, now);
    journal.setRange(range.kind === "days" ? { kind: "days", ...moveMemoryRange(value, now - value.to, now) } : allMemories, true);
  };

  return <div ref={root} className="memory-time" role="group" aria-label="记忆时间范围" data-dragging={!!draft || undefined} data-undated={inactive || undefined}
    data-disabled={disabled || undefined} onKeyDown={event => {
      if (event.key === "Escape" && cancel()) { event.preventDefault(); event.stopPropagation(); }
    }}>
    <div className="memory-time__summary">
      <span>时间范围</span>
      <button ref={readout} type="button" disabled={disabled} className="memory-time__readout" onClick={openEditor}
        aria-label={`调整日期：${memoryRangeLabel(shownRange)}`} aria-expanded={editing} aria-controls="memory-time-editor">
        {memoryRangeLabel(shownRange)}<span className="memory-time__edit-mark" aria-hidden="true" />
      </button>
      {range.kind !== "all" && <button className="memory-time__all" type="button" disabled={disabled} onClick={() => journal.setRange(allMemories, true)}>全部</button>}
    </div>
    <div className="memory-time__ruler" data-all={shownRange.kind === "all" || undefined} data-single={now === 1 || undefined}>
      <div className="memory-time__labels">
        {labels.map(day => <button type="button" disabled={disabled} key={day} data-active={inRange(day) || undefined}
          style={{ left: `${(day - .5) / now * 100}%`, "--time-age": .6 + .4 * day / now } as CSSProperties} onClick={() => commit({ from: day, to: day })} aria-label={`查看第 ${day} 天`}>
          <span>第</span><strong>{String(day).padStart(2, "0")}</strong><span>天</span></button>)}
        <button type="button" className="memory-time__now" disabled={disabled} style={{ left: `${(now - .5) / now * 100}%` }}
          onClick={goToNow} aria-label={`回到现在，第 ${now} 天`}><span>现在</span><strong>{String(now).padStart(2, "0")}</strong><span>天</span></button>
      </div>
      <div ref={track} className="memory-time__track" role="group" aria-label="时间刻度" tabIndex={disabled || now === 1 ? -1 : 0}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => cancel(false)}
        onLostPointerCapture={() => { if (gesture.current) cancel(false); }} onKeyDown={keyDown}
        onKeyUp={event => { if (adjustmentKeys.has(event.key)) finishKeyboard(); }} onBlur={finishKeyboard}>
        <div className="memory-time__baseline" aria-hidden="true" />
        <div className="memory-time__ticks" aria-hidden="true">{[...new Set([...ticks, now])].map(day => <i key={day}
          data-major={labels.includes(day) || day === now || undefined} data-now={day === now || undefined} data-active={inRange(day) || undefined}
          style={{ left: `${(day - .5) / now * 100}%` }} />)}</div>
        <div className="memory-time__selection" style={{ "--range-left": `${left}%`, "--range-width": `${width}%` } as CSSProperties} data-narrow={narrow || undefined}>
          <div className="memory-time__wash" aria-hidden="true" />
          <div className="memory-time__move" data-range-part="move" role="slider" aria-label="移动时间范围" aria-valuemin={1} aria-valuemax={now - (bounds.to - bounds.from)}
            aria-valuenow={bounds.from} aria-valuetext={memoryRangeLabel(shownRange)} aria-disabled={!movable || disabled}
            tabIndex={movable && !disabled ? 0 : -1} data-movable={movable || undefined} />
          {(!narrow || keyboard.current || gesture.current?.part === "from" || gesture.current?.part === "to") && (["from", "to"] as const).map(part => <div key={part} className={`memory-time__handle memory-time__handle--${part}`} data-range-part={part}
            role="slider" aria-label={part === "from" ? "起始日期" : "结束日期"} aria-valuemin={part === "from" ? 1 : bounds.from}
            aria-valuemax={part === "from" ? bounds.to : now} aria-valuenow={bounds[part]} aria-valuetext={`第 ${bounds[part]} 天`}
            aria-disabled={disabled || now === 1} tabIndex={disabled || now === 1 ? -1 : 0}><span /></div>)}
        </div>
      </div>
    </div>
    <AnimatePresence>{editing && <MemoryRangeEditor key="date-editor" now={now} fromText={fromText} toText={toText}
      onFromChange={setFromText} onToChange={setToText} onClose={() => cancel()}
      onApply={value => { readout.current?.focus({ preventScroll: true }); commit(value); }}/>}</AnimatePresence>
    <span className="memory-time__announcement" aria-live="polite">{memoryRangeLabel(range)}</span>
  </div>;
}
