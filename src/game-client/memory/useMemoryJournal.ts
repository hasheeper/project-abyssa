import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue } from "motion/react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { motionTokens, uiTransition } from "../../shared/ui/motion/presets";
import { orderedMemories, type MemoryEntry, type MemoryJournalData, type MemoryMode, type MemoryOrder } from "./memory-types";
import { bindMemoryLayout, captureMemoryLayout, type MemoryLayoutSnapshot } from "./memory-layout-motion";
import { allMemories, memoryRangeKey, normalizeMemoryRange, type MemoryRange } from "./memory-range";
import { narrativeActBlocks } from "../../game-runtime/memory-narrative";

type View = { scope: string; mode: MemoryMode; selectedId: string | null; range: MemoryRange; order: MemoryOrder };
type Anchor = { id: string; offset: number };
const initial = (scope: string): View => ({ scope, mode: "catalogue", selectedId: null, range: allMemories, order: "recent" });
const positionKey = (view: View) => `${view.scope}:${memoryRangeKey(view.range)}:${view.order}:${view.mode}`;

export function useMemoryJournal(scope: string, data: MemoryJournalData, nowDay: number) {
  const now = Number.isFinite(nowDay) ? Math.max(1, Math.floor(nowDay)) : 1;
  const [stored, setView] = useState(() => initial(scope));
  const [requestedRange, setRequestedRange] = useState(() => ({ scope, range: allMemories }));
  const deferredRange = useRef<View | null>(null);
  const cancelRangeEdit = useRef<(() => boolean) | null>(null);
  const view = stored.scope === scope ? stored : initial(scope);
  const current = useRef(view); current.current = view;
  const target = useRef(view);
  const [changing, setChanging] = useState(false);
  const [replay, setReplay] = useState<{ scope: string; entry: MemoryEntry; actId?: string } | null>(null);
  const [actSelection, setActSelection] = useState<{ scope: string; entryId: string; actId: string } | null>(null);
  const [replayLeaving, setReplayLeaving] = useState(false);
  const [expanded, setExpanded] = useState<{ scope: string; ids: ReadonlySet<string> }>(() => ({ scope, ids: new Set() }));
  const [changeKind, setChangeKind] = useState<"layout" | "reader" | "catalogue" | null>(null);
  const [hidden, setHidden] = useState(() => document.hidden);
  const { reduced } = useUiMotion();
  const opacity = useMotionValue(1), morph = useMotionValue(1);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const pendingLayout = useRef<MemoryLayoutSnapshot | null>(null);
  const release = useRef<(() => void) | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const catalogueRef = useRef<HTMLDivElement>(null), readerRef = useRef<HTMLElement>(null);
  const anchors = useRef(new Map<string, Anchor>()), readingOffsets = useRef(new Map<string, number>());
  const resetAnchor = useRef<string | null>(null);
  const focusIntent = useRef<"reader" | "entry" | "replay" | null>(null);
  const entries = data.status === "ready" ? data.entries : [];
  const visible = useMemo(() => orderedMemories(entries, view.range, view.order), [entries, view.range, view.order]);
  const selected = visible.find(entry => entry.id === view.selectedId) ?? null;
  const acts = selected?.narrative?.acts ?? [];
  const selectedAct = acts.find(act => actSelection?.scope === scope && actSelection.entryId === selected?.id && act.id === actSelection.actId) ?? acts[0] ?? null;
  const transcript = useMemo(() => selectedAct && selected ? narrativeActBlocks(selectedAct, selected) : selected?.blocks ?? [], [selected, selectedAct]);
  const range = requestedRange.scope === scope ? requestedRange.range : allMemories;
  // A replay remains a frozen prefix when new prose arrives. Retraction or edited
  // provenance invalidates it immediately, before another frame can be painted.
  const replayEntry = useMemo(() => {
    if (!replay || replay.scope !== scope || view.mode !== "reading" || replay.entry.id !== view.selectedId) return null;
    const currentEntry = entries.find(e => e.id === replay.entry.id);
    if (replay.actId && currentEntry && replay.entry.narrative) {
      return replay.entry.narrative.acts.every(savedAct => {
        const currentAct = currentEntry.narrative?.acts.find(a => a.id === savedAct.id);
        if (!currentAct || currentAct.replay !== savedAct.replay || currentAct.slices.length < savedAct.slices.length) return false;
        const units = (steps: typeof savedAct.slices[number]["steps"]) => steps.flatMap<unknown>(s => s.kind === "content" ? [...s.frames] : [s]);
        return savedAct.slices.every((slice, i) => {
          const next = currentAct.slices[i], before = units(slice.steps), after = units(next.steps);
          return next.id === slice.id && JSON.stringify(next.presentation) === JSON.stringify(slice.presentation)
            && after.length >= before.length && before.every((unit, n) => JSON.stringify(unit) === JSON.stringify(after[n]));
        });
      }) ? replay.entry : null;
    }
    if (!currentEntry?.replay || currentEntry.blocks.length < replay.entry.blocks.length) return null;
    return replay.entry.blocks.every((block, i) => JSON.stringify(block) === JSON.stringify(currentEntry.blocks[i])) ? replay.entry : null;
  }, [entries, replay, scope, view.mode, view.selectedId]);
  const finishReplay = useCallback(() => {
    setReplay(null); setReplayLeaving(false); focusIntent.current = "replay";
  }, []);
  const stopReplay = useCallback(() => {
    if (!replayEntry) return false;
    setReplayLeaving(true); return true;
  }, [replayEntry]);
  useLayoutEffect(() => {
    if (replay && !replayEntry) { setReplay(null); setReplayLeaving(false); focusIntent.current = "reader"; }
    else if (replayLeaving && (reduced || hidden)) finishReplay();
  }, [replay, replayEntry, replayLeaving, reduced, hidden, finishReplay]);

  const remember = useCallback(() => {
    if (inFlight.current) return;
    const list = catalogueRef.current, state = current.current;
    if (list) {
      const rect = list.getBoundingClientRect(), scale = rect.height / list.clientHeight || 1;
      const first = Array.from(list.querySelectorAll<HTMLElement>("[data-memory-id]")).find(row => row.getBoundingClientRect().bottom > rect.top + 1);
      if (first) anchors.current.set(positionKey(state), { id: first.dataset.memoryId!, offset: (first.getBoundingClientRect().top - rect.top) / scale });
      while (anchors.current.size > 48) anchors.current.delete(anchors.current.keys().next().value!);
    }
    if (readerRef.current && state.selectedId) readingOffsets.current.set(`${state.scope}:${state.selectedId}`, readerRef.current.scrollTop);
  }, []);

  const restore = useCallback(() => {
    const list = catalogueRef.current;
    if (list) {
      if (resetAnchor.current === positionKey(view)) { anchors.current.delete(positionKey(view)); resetAnchor.current = null; }
      const anchor = anchors.current.get(positionKey(view));
      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-memory-id]"));
      const row = rows.find(row => row.dataset.memoryId === anchor?.id);
      if (anchor && row) {
        const rect = list.getBoundingClientRect(), scale = rect.height / list.clientHeight || 1;
        list.scrollTop += (row.getBoundingClientRect().top - rect.top) / scale - anchor.offset;
      } else list.scrollTop = 0;
      if (view.mode === "reading") {
        const active = rows.find(row => row.dataset.memoryId === view.selectedId);
        if (active) {
          const rect = list.getBoundingClientRect(), scale = rect.height / list.clientHeight || 1;
          const entryRect = active.getBoundingClientRect();
          const top = (entryRect.top - rect.top) / scale, bottom = (entryRect.bottom - rect.top) / scale;
          if (top < 8) list.scrollTop += top - 8;
          else if (bottom > list.clientHeight - 24) list.scrollTop += bottom - list.clientHeight + 24;
        }
      }
    }
    if (readerRef.current) readerRef.current.scrollTop = readingOffsets.current.get(`${view.scope}:${view.selectedId}`) ?? 0;
  }, [view]);

  const change = useCallback((next: View, focus: typeof focusIntent.current = null) => {
    remember();
    const layout = next.mode !== current.current.mode;
    const kind = layout ? "layout" : memoryRangeKey(next.range) !== memoryRangeKey(current.current.range) || next.order !== current.current.order || next.mode === "catalogue" ? "catalogue" : "reader";
    const snapshot = layout && rootRef.current ? captureMemoryLayout(rootRef.current) : null;
    target.current = next; focusIntent.current = focus;
    const ticket = ++generation.current;
    animation.current?.stop(); release.current?.(); release.current = null;
    pendingLayout.current = snapshot;
    if (reduced || document.hidden) { opacity.set(1); pendingLayout.current = null; inFlight.current = false; setView(next); setChanging(false); setChangeKind(null); return; }
    inFlight.current = true; setChanging(true); setChangeKind(kind);
    if (layout) { setView(next); return; }
    animation.current = animate(opacity, 0, uiTransition(opacity.get() * motionTokens.memoryJournal.changeOutMs));
    void animation.current.then(() => { if (generation.current === ticket) setView(next); });
  }, [remember, reduced, opacity]);

  const settle = useCallback(() => {
    ++generation.current; animation.current?.stop(); release.current?.(); release.current = null;
    pendingLayout.current = null; inFlight.current = false;
    if (deferredRange.current) { target.current = deferredRange.current; deferredRange.current = null; }
    opacity.set(1); morph.set(1); setView(target.current); setChanging(false); setChangeKind(null);
  }, [opacity, morph]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useLayoutEffect(() => {
    if (stored.scope !== scope) {
      cancelRangeEdit.current?.(); deferredRange.current = null; resetAnchor.current = null;
      anchors.current.clear(); readingOffsets.current.clear(); target.current = initial(scope);
      setRequestedRange({ scope, range: allMemories });
      settle(); return;
    }
    if (reduced || hidden) { settle(); return; }
    if (!inFlight.current || target.current !== stored) return;
    const ticket = generation.current, snapshot = pendingLayout.current;
    const complete = () => {
      if (generation.current !== ticket) return;
      release.current?.(); release.current = null; pendingLayout.current = null;
      inFlight.current = false; opacity.set(1); setChanging(false); setChangeKind(null);
      // Keep the old rows and prose through the return choreography, then filter.
      const next = deferredRange.current;
      // Publish the deferred range after releasing this morph. Starting another
      // animation from its completion callback can inherit its stopped clock.
      if (next) { deferredRange.current = null; target.current = next; setView(next); }
    };
    if (snapshot && rootRef.current) {
      const opening = stored.mode === "reading";
      const duration = opening ? motionTokens.memoryJournal.openMs : motionTokens.memoryJournal.closeMs;
      const paint = bindMemoryLayout(rootRef.current, snapshot, opening);
      morph.set(0);
      const update = (progress: number) => paint.paint(progress);
      update(0); const unsubscribe = morph.on("change", update);
      release.current = () => { unsubscribe(); paint.clear(); };
      animation.current = animate(morph, 1, { duration: duration / 1000, ease: "linear" });
      void animation.current.then(complete);
      const owned = animation.current;
      // A completed morph may already have started the deferred filter's fade.
      // Cleanup owns only this animation, never whatever now occupies the ref.
      return () => owned?.stop();
    }
    animation.current = animate(opacity, 1, uiTransition(motionTokens.memoryJournal.changeInMs));
    void animation.current.then(complete);
    const owned = animation.current;
    return () => owned?.stop();
  }, [stored, scope, reduced, hidden, opacity, morph, settle, change]);
  useEffect(() => () => { ++generation.current; animation.current?.stop(); release.current?.(); }, []);

  // A new revision can retract the selected occurrence without changing the save.
  // Stop an in-flight morph before it can restore that now-invalid selection.
  useLayoutEffect(() => {
    const next = target.current;
    if (next.scope !== scope || !next.selectedId || entries.some(entry => entry.id === next.selectedId)) return;
    deferredRange.current = null;
    target.current = { ...next, mode: "catalogue", selectedId: null };
    focusIntent.current = null;
    settle();
  }, [entries, scope, settle]);

  const showCatalogue = useCallback(() => {
    if (stopReplay()) return true;
    if (cancelRangeEdit.current?.()) return true;
    const next = target.current.scope === scope ? target.current : current.current;
    if (next.mode !== "reading") return false;
    change({ ...next, mode: "catalogue" }, "entry"); return true;
  }, [change, scope, stopReplay]);

  const setRange = (input: MemoryRange, reset = false) => {
    const nextRange = normalizeMemoryRange(input, now);
    if (!reset && memoryRangeKey(nextRange) === memoryRangeKey(range)) return;
    const next: View = { ...view, range: nextRange, mode: "catalogue", selectedId: null, order: reset ? "recent" : view.order };
    setRequestedRange({ scope, range: nextRange });
    resetAnchor.current = reset ? positionKey(next) : null;
    if (deferredRange.current) { deferredRange.current = next; return; }
    if (view.mode === "reading" && !reduced && !document.hidden) {
      deferredRange.current = next;
      change({ ...view, mode: "catalogue" });
    } else change(next);
  };

  return { ...view, range, rangeKey: memoryRangeKey(view.range), now, cancelRangeEdit, selected, visible, undatedCount: entries.filter(entry => (entry.recordedDays ?? [entry.day]).includes(null)).length,
    changing, changeKind, reduced, opacity, rootRef, catalogueRef, readerRef, focusIntent, remember, restore, settle,
    acts, selectedAct, transcript,
    selectAct: (id: string) => { if (!selected || inFlight.current || !acts.some(a => a.id === id)) return; setActSelection({ scope, entryId: selected.id, actId: id }); },
    replayEntry, replayActId: replayEntry ? replay?.actId : undefined, replayLeaving, stopReplay, finishReplay,
    transcriptExpanded: !!selected && expanded.scope === scope && expanded.ids.has(selected.id),
    toggleTranscript: () => { if (!selected) return; const ids = new Set(expanded.scope === scope ? expanded.ids : []); if (ids.has(selected.id)) ids.delete(selected.id); else ids.add(selected.id); setExpanded({ scope, ids }); },
    startReplay: () => { if (!inFlight.current && view.mode === "reading" && selected && (selectedAct ? selectedAct.replay === "scene" : selected.replay) && !replayEntry) { remember(); setReplayLeaving(false); setReplay({ scope, entry: selected, actId: selectedAct?.id }); } },
    open: (id: string) => { if (!deferredRange.current && visible.some(entry => entry.id === id)) change({ ...view, mode: "reading", selectedId: id }, "reader"); },
    setRange,
    toggleOrder: () => { if (!inFlight.current) change({ ...view, order: view.order === "recent" ? "oldest" : "recent", mode: "catalogue" }); },
    showCatalogue,
  };
}
export type MemoryJournalController = ReturnType<typeof useMemoryJournal>;
