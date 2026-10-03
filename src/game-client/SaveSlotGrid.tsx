import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import { slotRecord, SAVE_SLOT_COUNT, type SaveSlotIndex } from "../game-runtime/save-slots";
import { saveScene, savedDate, savePhases as phases } from "./save-scene";
import { SaveFileIcon } from "./SaveFileIcon";
import { slotSelectionTracks } from "./save-slots-motion";
import { SAVE_SLOT_COLUMNS, SAVE_SLOT_ROWS, SAVE_SLOTS_PER_PAGE } from "./save-slots-layout";

export const slotNumber = (index: number) => String(index + 1).padStart(2, "0");
function SlotImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="save-slots__image" aria-hidden="true">
    {!failed && <img src={src} alt="" onError={() => setFailed(true)} />}
  </span>;
}

export function SaveSlotGrid({ index, saves, selected, onSelect, disabled, onActivate, onExport, onDelete, protectedSaveId, page, changing, loading = false }: {
  index: SaveSlotIndex | null; saves: PlayerSaveListEntry[]; selected: number; onSelect: (index: number) => void;
  disabled: boolean; onActivate: () => void; onExport: (save: PlayerSaveListEntry) => void;
  onDelete?: (position: number) => void; protectedSaveId?: string;
  page: number; changing: boolean; loading?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null), focusNext = useRef(false);
  useLayoutEffect(() => {
    if (!focusNext.current || changing || page !== Math.floor(selected / SAVE_SLOTS_PER_PAGE)) return;
    focusNext.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-slot="${selected}"]`)?.focus({ preventScroll: true });
  }, [selected, changing, page]);
  function move(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    if (disabled || changing || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SAVE_SLOT_COLUMNS, ArrowDown: SAVE_SLOT_COLUMNS, PageUp: -SAVE_SLOTS_PER_PAGE, PageDown: SAVE_SLOTS_PER_PAGE };
    let next = position;
    if (event.key in deltas) next = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, position + deltas[event.key]));
    else if (event.key === "Home") next = page * SAVE_SLOTS_PER_PAGE;
    else if (event.key === "End") next = Math.min(SAVE_SLOT_COUNT, (page + 1) * SAVE_SLOTS_PER_PAGE) - 1;
    else if (event.key === "Enter") { event.preventDefault(); if (!event.repeat) onActivate(); return; }
    else return;
    event.preventDefault(); focusNext.current = true; onSelect(next);
  }
  const [settledSelection, setSettledSelection] = useState(selected);
  useLayoutEffect(() => { if (!changing) setSettledSelection(selected); }, [selected, changing]);
  const visualSelection = changing && page === Math.floor(settledSelection / SAVE_SLOTS_PER_PAGE) ? settledSelection : selected;
  return <div className="save-slots__grid" ref={grid} role="group" inert={changing || loading} aria-busy={changing || loading} data-loading={loading || undefined} aria-label={`本机存档 · 第 ${page + 1} 页`}>
    {Array.from({ length: SAVE_SLOT_ROWS }, (_, row) => <div className="save-slots__rail" key={row} style={{ gridTemplateColumns: slotSelectionTracks(
      Math.floor(visualSelection / SAVE_SLOT_COLUMNS) === page * SAVE_SLOT_ROWS + row ? visualSelection % SAVE_SLOT_COLUMNS : null) }}>
      {Array.from({ length: SAVE_SLOT_COLUMNS }, (_, column) => {
        const position = page * SAVE_SLOTS_PER_PAGE + row * SAVE_SLOT_COLUMNS + column;
        if (position >= SAVE_SLOT_COUNT) return null;
        const binding = index?.slots[position] ?? null;
        const save = slotRecord(binding, saves), scene = save?.status === "ready" ? saveScene(save) : null;
        const state = !binding ? "empty" : scene ? "occupied" : "unavailable";
        return <div className="save-slots__cell" key={position} data-state={state} data-selected={position === visualSelection || undefined} aria-hidden={loading || undefined}>
          <span className="save-slots__probe" aria-hidden="true" style={{ animationDelay: `${(column * 2 + row) * 110}ms` }} />
          <button type="button" className="save-slots__slot" data-slot={position} disabled={disabled || loading}
            aria-label={`槽位 ${slotNumber(position)} · ${scene?.title ?? (binding ? "暂不可读取" : "空白存档")}`}
            aria-pressed={position === selected} tabIndex={position === selected ? 0 : -1}
            onClick={() => onSelect(position)} onFocus={() => { if (position !== selected) onSelect(position); }}
            onKeyDown={event => move(event, position)}>
            {!loading && <span className="save-slots__body">
            <span className="save-slots__number"><small>SLOT</small> {slotNumber(position)}</span>
            {scene && save?.status === "ready" ? <>
              <SlotImage key={scene.image} src={scene.image} />
              <span className="save-slots__title">{scene.title}</span>
              <span className="save-slots__world"><span>{save.presentation?.playerName || "未命名旅程"}</span><span>第 {save.clock.day} 天 · {phases[save.clock.phase]}</span></span>
              <time className="save-slots__date" dateTime={binding?.savedAt ?? undefined}>{savedDate(binding?.savedAt ?? null)}</time>
            </> : <span className="save-slots__placeholder"><i aria-hidden="true" />{binding ? "暂不可读取" : "空白存档"}</span>}
            </span>}
            <span className="save-slots__anchor" aria-hidden="true" />
          </button>
          {!loading && save && <button type="button" className="save-slots__export" disabled={disabled} aria-label={`导出槽位 ${slotNumber(position)}`}
            title={`导出槽位 ${slotNumber(position)}`} onClick={() => onExport(save)}><SaveFileIcon direction="export" /></button>}
          {!loading && binding && onDelete && <button type="button" className="save-slots__export save-slots__delete"
            disabled={disabled || binding.saveId === protectedSaveId} aria-label={`删除槽位 ${slotNumber(position)}`}
            title={binding.saveId === protectedSaveId ? "当前旅程正在使用，请返回标题后删除" : `删除槽位 ${slotNumber(position)}`}
            onClick={() => onDelete(position)}><SaveFileIcon direction="delete" /></button>}
        </div>;
      })}
    </div>)}
  </div>;
}
