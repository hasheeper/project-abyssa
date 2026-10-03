import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { surfaceTransition } from "../../shared/ui/motion/presets";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import type { MemoryJournalController } from "./useMemoryJournal";
import "../../shared/ui/styles/scene-feedback.css";
import "./memory-act-picker.css";

function ActList({ journal, id, onSelect }: {
  journal: MemoryJournalController; id: string; onSelect: (actId: string) => void;
}) {
  const present = useIsPresent(), { reduced } = useUiMotion();
  return <motion.div className="memory-act-picker__list scene-feedback__surface" id={id} role="group" aria-label="选择回想的幕"
    inert={!present} aria-hidden={!present || undefined} data-ui-motion={reduced ? "reduced" : undefined}
    initial={{ opacity: 0, filter: reduced ? "none" : "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: reduced ? "none" : "blur(2px)" }} transition={surfaceTransition(reduced, !present)}>
    <div className="memory-act-picker__items">
      {journal.acts.map((item, i) => <button type="button" key={item.id} aria-pressed={item.id === journal.selectedAct?.id}
        onClick={() => onSelect(item.id)}>
        <span className="memory-act-picker__number">{String(i + 1).padStart(2, "0")}</span>
        <span className="memory-act-picker__title">{item.title}</span>
        {item.replay === "text" && <small>文字</small>}
      </button>)}
    </div>
  </motion.div>;
}

export function MemoryActPicker({ journal }: { journal: MemoryJournalController }) {
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId(), act = journal.selectedAct, index = journal.acts.findIndex(a => a.id === act?.id);
  const { reduced } = useUiMotion();
  useEffect(() => { setOpen(false); }, [journal.selectedId, journal.mode]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (!act) return null;
  if (journal.acts.length === 1) return <span className="memory-act-picker__current" aria-label={`第 1 幕：${act.title}`}>
    <span>第</span><span>01</span><span>幕</span>
  </span>;
  return <div className="memory-act-picker" ref={root} data-ui-motion={reduced ? "reduced" : undefined} onKeyDown={e => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button type="button" ref={trigger} className="memory-act-picker__trigger" aria-label={`选择回想的幕，当前第 ${index + 1} 幕：${act.title}`}
      aria-expanded={open} aria-controls={id} disabled={journal.changing} onClick={() => setOpen(value => !value)}>
      <span>第</span><span>{String(index + 1).padStart(2, "0")}</span><span>幕</span><i className="memory-act-picker__caret" aria-hidden="true"/>
    </button>
    <AnimatePresence>{open && <ActList key={journal.selectedId} journal={journal} id={id}
      onSelect={actId => { journal.selectAct(actId); setOpen(false); trigger.current?.focus({ preventScroll: true }); }}/>}</AnimatePresence>
  </div>;
}
