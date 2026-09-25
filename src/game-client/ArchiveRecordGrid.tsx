import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import type { SaveSlotIndex } from "../game-runtime/save-slots";
import { saveScene, savedDate, savePhases } from "./save-scene";
import { SaveFileIcon } from "./SaveFileIcon";
import { slotTiming } from "./save-slots-motion";

export const ARCHIVE_PAGE_SIZE = 8;

function ArchiveImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="save-slots__image" aria-hidden="true" title="当前阶段的场景示意，非存档截图">
    {failed ? <span>场景预览</span> : <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>;
}

/** A complete archive, not the thirty-slot index: pagination never drops records. */
export function ArchiveRecordGrid({ saves, selected, page, changing, disabled, loading, archivedIds, index, onSelect, onActivate, onExport, onDelete }: {
  saves: PlayerSaveListEntry[]; selected?: string; page: number; changing: boolean; disabled: boolean; loading: boolean;
  archivedIds: Set<string>; index: SaveSlotIndex | null; onSelect: (id: string) => void; onActivate: () => void;
  onExport: (save: PlayerSaveListEntry) => void;
  onDelete?: (save: PlayerSaveListEntry) => void;
}) {
  const grid = useRef<HTMLDivElement>(null), pendingFocus = useRef(false);
  const selection = saves.findIndex(save => save.saveId === selected);
  useLayoutEffect(() => {
    if (changing || !pendingFocus.current || Math.floor(selection / ARCHIVE_PAGE_SIZE) !== page) return;
    pendingFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [changing, page, selection]);
  function move(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    if (disabled || changing || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter") { event.preventDefault(); if (!event.repeat) onActivate(); return; }
    const deltas: Record<string, number> = { ArrowLeft: -2, ArrowRight: 2, ArrowUp: -1, ArrowDown: 1, PageUp: -ARCHIVE_PAGE_SIZE, PageDown: ARCHIVE_PAGE_SIZE };
    const next = event.key === "Home" ? 0 : event.key === "End" ? saves.length - 1
      : event.key in deltas ? Math.max(0, Math.min(saves.length - 1, position + deltas[event.key])) : null;
    if (next === null) return;
    event.preventDefault(); pendingFocus.current = true; onSelect(saves[next].saveId);
  }
  return <div ref={grid} className="save-slots__grid title-archive__grid" role="list" aria-label={`本机存档 · 第 ${page + 1} 页`}
    aria-busy={changing || loading} data-loading={loading || undefined} inert={changing || loading}>
    {[0, 1].map(row => <div key={row} className="save-slots__rail" role="presentation" style={{ gridTemplateColumns:
      Array.from({ length: 4 }, (_, column) => `${Math.floor(selection / ARCHIVE_PAGE_SIZE) !== page || selection % 2 !== row ? 1
        : Math.floor(selection % ARCHIVE_PAGE_SIZE / 2) === column ? slotTiming.selectWeight : slotTiming.peerWeight}fr`).join(" ") }}>
      {Array.from({ length: 4 }, (_, column) => {
        const order = column * 2 + row, position = page * ARCHIVE_PAGE_SIZE + order, save = saves[position];
        const scene = save?.status === "ready" ? saveScene(save) : null;
        const archived = !!save && archivedIds.has(save.saveId);
        const savedAt = save?.status === "ready" ? index?.slots.find(slot => slot?.saveId === save.saveId && slot.epoch === save.summary.head.epoch)?.savedAt ?? null : null;
        return <div key={save?.saveId ?? position} className="save-slots__cell" role={save ? "listitem" : "presentation"}
          data-state={!save ? "empty" : scene ? "occupied" : "unavailable"} data-selected={save && selected === save.saveId || undefined}
          data-archived={archived || undefined} aria-hidden={!save || loading || undefined}>
          <span className="save-slots__probe" aria-hidden="true" style={{ animationDelay: `${(column * 2 + row) * 110}ms` }} />
          {save ? <>
            <button className="save-slots__slot" type="button" data-save-option="" disabled={disabled}
              aria-label={`选择档案 ${scene?.title ?? "暂不可读取"} · ${save.status === "ready" ? save.presentation?.playerName ?? save.saveId.slice(0, 8) : save.saveId.slice(0, 8)}`}
              aria-pressed={selected === save.saveId} tabIndex={selected === save.saveId ? 0 : -1}
              onClick={() => onSelect(save.saveId)} onFocus={() => { if (selected !== save.saveId) onSelect(save.saveId); }} onKeyDown={event => move(event, position)}>
              <span className="save-slots__body" data-slot-order={order}>
                <span className="save-slots__number"><small>ARCHIVE</small> {String(position + 1).padStart(2, "0")}</span>
                {scene ? <ArchiveImage key={scene.image} src={scene.image} /> : <span className="save-slots__image title-archive__missing">—</span>}
                <span className="save-slots__title">{scene?.title ?? "暂不可读取"}</span>
                <span className="save-slots__world"><span>{save.status === "ready" && save.presentation?.playerName || `档案 ${save.saveId.slice(0, 8)}`}</span>
                  {save.status === "ready" && <span>第 {save.clock.day} 天 · {savePhases[save.clock.phase]}</span>}</span>
                <span className="title-archive__record-meta"><time className="save-slots__date" dateTime={savedAt ?? undefined}>{savedDate(savedAt)}</time>
                  {archived && <span>已归档</span>}</span>
              </span>
              <span className="save-slots__anchor" data-slot-order={order} aria-hidden="true" />
            </button>
            <button className="save-slots__export" type="button" data-slot-order={order} disabled={disabled} title={scene ? "导出存档" : "导出诊断"}
              aria-label={scene ? "导出存档" : "导出诊断"} onClick={() => onExport(save)}><SaveFileIcon direction="export" /></button>
            {onDelete && <button className="save-slots__export save-slots__delete" type="button" data-slot-order={order} disabled={disabled}
              title="删除档案" aria-label={`删除档案 ${save.status === "ready" && save.presentation?.playerName || save.saveId}`}
              onClick={() => onDelete(save)}><SaveFileIcon direction="delete" /></button>}
          </> : <span className="save-slots__anchor title-archive__vacant" data-slot-order={order} aria-hidden="true" />}
        </div>;
      })}
    </div>)}
  </div>;
}
