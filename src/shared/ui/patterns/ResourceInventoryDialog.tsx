import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { RpgModal, type RpgModalProps } from "../primitives/RpgModal";
import { IconButton } from "../primitives/IconButton";
import { ItemSlot, ItemSlotStatic } from "../primitives/ItemSlot";
import { UiContentTransition } from "../motion/UiContentTransition";
import "./resource-inventory.css";

/** Fixed provisions plus an open-ended inventory. The latter accepts arbitrary
 * item identities and descriptions without a category registry. */
export interface ResourceInventoryEntry {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  unit: string;
  rarity?: string;
  type?: string;
  description?: string;
  note?: string;
  /** Equipped/reserved ownership is not available warehouse stock. */
  status?: string;
  ownership?: string;
}

export interface ResourceInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  entries: readonly ResourceInventoryEntry[];
  fixedEntries?: readonly ResourceInventoryEntry[];
  title?: string;
  className?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onPresentChange?: (present: boolean) => void;
  motionPreset?: RpgModalProps["motionPreset"];
}

const ITEM_COLUMNS = 7;
const INVENTORY_PAGE_SIZE = ITEM_COLUMNS * 2;
const NO_FIXED_ENTRIES: readonly ResourceInventoryEntry[] = [];

export function ResourceInventoryDialog({
  open, onClose, entries, fixedEntries = NO_FIXED_ENTRIES, title = "领地库存", className, returnFocusRef, onPresentChange, motionPreset,
}: ResourceInventoryDialogProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingPageFocus = useRef<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>({visibility: "hidden"});
  const pageCount = Math.max(1, Math.ceil(entries.length / INVENTORY_PAGE_SIZE));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageEntries = useMemo(() => entries.slice(page * INVENTORY_PAGE_SIZE, (page + 1) * INVENTORY_PAGE_SIZE), [entries, page]);

  const groups = useMemo(() => [
    {id: "fixed", label: "常备补给", entries: fixedEntries, emptyHint: "暂无补给"},
    {id: "sandbox", label: "物品库存", entries: pageEntries, emptyHint: "尚未存放其他物品"},
  ], [fixedEntries, pageEntries]);
  const orderedEntries = useMemo(() => groups.flatMap(group => group.entries), [groups]);
  const currentFocus = orderedEntries.some(entry => entry.id === focusId) ? focusId : orderedEntries[0]?.id;
  const selected = open ? orderedEntries.find(entry => entry.id === selectedId) : undefined;

  const closeDetail = useCallback((restore = false) => {
    if (restore && selectedId) buttons.current.get(selectedId)?.focus({preventScroll: true});
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    if (!open) { setSelectedId(null); setFocusId(null); setPageIndex(0); pendingPageFocus.current = null; }
    else if (selectedId && !orderedEntries.some(entry => entry.id === selectedId)) {
      setSelectedId(null);
      buttons.current.get(pageEntries[0]?.id ?? currentFocus ?? "")?.focus({preventScroll: true});
    } else if (focusId && !orderedEntries.some(entry => entry.id === focusId)) {
      const fallback = pageEntries[0]?.id ?? fixedEntries[0]?.id;
      setFocusId(fallback ?? null);
      if (document.activeElement === document.body) buttons.current.get(fallback ?? "")?.focus({preventScroll: true});
    }
  }, [open, orderedEntries, selectedId, currentFocus, focusId, pageEntries, fixedEntries]);

  useEffect(() => { if (pageIndex !== page) setPageIndex(page); }, [page, pageIndex]);

  useLayoutEffect(() => {
    const target = pendingPageFocus.current;
    if (!target) return;
    pendingPageFocus.current = null;
    buttons.current.get(target)?.focus({preventScroll: true});
  }, [page]);

  function changePage(nextPage: number, slot = 0) {
    const next = Math.max(0, Math.min(nextPage, pageCount - 1));
    if (next === page) return;
    const first = next * INVENTORY_PAGE_SIZE;
    const target = entries[Math.min(first + slot, entries.length - 1)];
    setSelectedId(null);
    setFocusId(target?.id ?? null);
    pendingPageFocus.current = target?.id ?? null;
    setPageIndex(next);
  }

  function handlePageKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "PageDown" && event.key !== "PageUp" || detailRef.current?.contains(event.target as Node)) return;
    event.preventDefault();
    const slot = Math.max(0, pageEntries.findIndex(entry => entry.id === focusId));
    changePage(page + (event.key === "PageDown" ? 1 : -1), slot);
  }

  useLayoutEffect(() => {
    if (!selected) return;
    const root = rootRef.current, detail = detailRef.current, anchor = buttons.current.get(selected.id);
    if (!root || !detail || !anchor) return;
    const bounds = root.getBoundingClientRect(), tile = anchor.getBoundingClientRect();
    // Stage is transformed: viewport pixels are not the panel's CSS pixels.
    const scale = bounds.width / root.clientWidth || 1;
    const anchorLeft = (tile.left - bounds.left) / scale;
    const anchorRight = (tile.right - bounds.left) / scale;
    const left = anchorRight + 16 + detail.offsetWidth <= root.clientWidth
      ? anchorRight + 16 : anchorLeft - detail.offsetWidth - 16;
    const top = (tile.top - bounds.top) / scale;
    const clamp = (x: number, y: number) => ({
      left: Math.max(0, Math.min(x, root.clientWidth - detail.offsetWidth)),
      top: Math.max(0, Math.min(y, root.clientHeight - detail.offsetHeight)),
    });
    // Prefer adjacent placement, then unused space below the fixed provision
    // row. Compare real card bounds, including names and counts.
    const occupied = [...root.querySelectorAll(".resource-inventory__items > li:not([data-placeholder])")].map(node => {
      const rect = node.getBoundingClientRect();
      return {left: (rect.left - bounds.left) / scale, right: (rect.right - bounds.left) / scale,
        top: (rect.top - bounds.top) / scale, bottom: (rect.bottom - bounds.top) / scale};
    });
    const overlap = (point: {left: number; top: number}) => occupied.reduce((sum, rect) => sum +
      Math.max(0, Math.min(point.left + detail.offsetWidth, rect.right) - Math.max(point.left, rect.left)) *
      Math.max(0, Math.min(point.top + detail.offsetHeight, rect.bottom) - Math.max(point.top, rect.top)), 0);
    const below = ((anchor.closest("li")?.getBoundingClientRect().bottom ?? tile.bottom) - bounds.top) / scale + 16;
    const candidates = [clamp(left, top), clamp(anchorLeft, below), clamp(root.clientWidth - detail.offsetWidth, top), clamp(0, top),
      clamp(anchorLeft, top - detail.offsetHeight - 16)];
    setPosition(candidates.reduce((best, point) => overlap(point) < overlap(best) ? point : best));
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || detailRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-resource-item]")) return;
      closeDetail(detailRef.current?.contains(document.activeElement));
    };
    const resize = () => closeDetail(true);
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); closeDetail(true);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", resize);
    };
  }, [selected, closeDetail]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = orderedEntries.findIndex(entry => entry.id === id);
    const group = groups.find(group => group.entries.some(entry => entry.id === id))!;
    const groupIndex = group.entries.findIndex(entry => entry.id === id);
    if (group.id === "sandbox") {
      const nextPageSlot = event.key === "ArrowRight" && groupIndex === pageEntries.length - 1 ? 0
        : event.key === "ArrowDown" && groupIndex + ITEM_COLUMNS >= INVENTORY_PAGE_SIZE ? groupIndex % ITEM_COLUMNS : null;
      const previousPageSlot = event.key === "ArrowLeft" && groupIndex === 0 ? INVENTORY_PAGE_SIZE - 1
        : event.key === "ArrowUp" && groupIndex < ITEM_COLUMNS ? groupIndex + ITEM_COLUMNS : null;
      if (nextPageSlot !== null && page < pageCount - 1) { event.preventDefault(); changePage(page + 1, nextPageSlot); return; }
      if (previousPageSlot !== null && page > 0) { event.preventDefault(); changePage(page - 1, previousPageSlot); return; }
    }
    let next: ResourceInventoryEntry | undefined;
    if (event.key === "ArrowRight") next = orderedEntries[Math.min(index + 1, orderedEntries.length - 1)];
    else if (event.key === "ArrowLeft") next = orderedEntries[Math.max(index - 1, 0)];
    else if (event.key === "ArrowDown") next = group.entries[groupIndex + ITEM_COLUMNS] ?? orderedEntries[Math.min(index + ITEM_COLUMNS, orderedEntries.length - 1)];
    else if (event.key === "ArrowUp") next = group.entries[groupIndex - ITEM_COLUMNS] ?? orderedEntries[Math.max(index - ITEM_COLUMNS, 0)];
    else if (event.key === "Home") next = orderedEntries[0];
    else if (event.key === "End") next = orderedEntries.at(-1);
    else return;
    event.preventDefault();
    closeDetail();
    if (next) { setFocusId(next.id); buttons.current.get(next.id)?.focus(); }
  }

  return <RpgModal open={open} onClose={onClose} title={title} header={null} motionPreset={motionPreset}
    signboard={title} signboardVariant="slim" className={className}
    panelClassName="resource-inventory-panel manor-utility__window" returnFocusRef={returnFocusRef} onPresentChange={onPresentChange}>
    <div className="resource-inventory" ref={rootRef} onKeyDown={handlePageKeys}>
      <div className="resource-inventory__overview">
          {groups.map(group => <section
            className="resource-inventory__group" data-area={group.id} key={group.id} aria-labelledby={`${uid}-${group.id}`}>
            <header className="resource-inventory__heading">
              <h3 id={`${uid}-${group.id}`}>{group.label}</h3>
              <span aria-hidden="true" />
            </header>
            <div className="resource-inventory__contents" id={group.id === "sandbox" ? `${uid}-inventory-page` : undefined}
              onScroll={() => closeDetail(true)}>
            {group.entries.length || group.id === "sandbox" ? <ul className="resource-inventory__items">
              {group.entries.map(entry => <li key={entry.id}>
                <div className="resource-inventory__art">
                <ItemSlot className="resource-inventory__item" data-resource-item={entry.id}
                  icon={entry.icon} name={entry.name} rarity={entry.rarity} size={92} showRarity={!!entry.rarity}
                  tone={group.id === "fixed" ? "interface" : "rarity"}
                  selected={selected?.id === entry.id} data-depleted={entry.quantity === 0 || undefined}
                  aria-label={`查看${entry.name}详情，${entry.quantity}${entry.unit}${entry.status ? `，${entry.status}` : ""}`}
                  aria-expanded={selected?.id === entry.id}
                  aria-controls={selected?.id === entry.id ? `${uid}-detail` : undefined}
                  tabIndex={currentFocus === entry.id ? 0 : -1}
                  ref={node => { if (node) buttons.current.set(entry.id, node); else buttons.current.delete(entry.id); }}
                  onFocus={() => setFocusId(entry.id)} onKeyDown={event => moveFocus(event, entry.id)}
                  onClick={() => { setPosition({visibility: "hidden"}); setSelectedId(selectedId === entry.id ? null : entry.id); }} />
                {entry.status && <small className="resource-inventory__status">{entry.status}</small>}
                <span className="abyssa-item-count resource-inventory__badge" data-depleted={entry.quantity === 0 || undefined} aria-hidden="true">
                  {entry.quantity.toLocaleString("zh-CN")}
                </span>
                </div>
                {group.id !== "fixed" && <span className="resource-inventory__name">{entry.name}</span>}
              </li>)}
              {group.id === "sandbox" && Array.from({length: INVENTORY_PAGE_SIZE - group.entries.length}, (_, index) =>
                <li key={`empty-${index}`} data-placeholder aria-hidden="true">
                  <ItemSlotStatic size={92} showRarity={false} />
                  <span className="resource-inventory__name" />
                </li>)}
            </ul> : <div className="resource-inventory__empty">
              <p>{group.emptyHint}</p>
            </div>}
            </div>
          </section>)}
      </div>
      {selected && <aside ref={detailRef} id={`${uid}-detail`} className="resource-inventory__detail"
        role="region" aria-label={`${selected.name}详情`} style={position}>
        <IconButton className="resource-inventory__detail-close" label="收起物品详情" icon="close" size="sm" onClick={() => closeDetail(true)} />
        <UiContentTransition contentKey={selected.id}>
        <header>
          <ItemSlotStatic className="resource-inventory__preview" icon={selected.icon} name={selected.name}
            tone={fixedEntries.some(entry => entry.id === selected.id) ? "interface" : "rarity"}
            rarity={selected.rarity} size={64} showRarity={!!selected.rarity} aria-hidden="true" />
          <div>{selected.type && <small>{selected.type}</small>}<h4>{selected.name}</h4></div>
        </header>
        <dl><dt>{selected.status ? "持有" : "库存"}</dt><dd><b>{selected.quantity.toLocaleString("zh-CN")}</b> {selected.unit}</dd></dl>
        {selected.description && <p className="resource-inventory__effect">{selected.description}</p>}
        {selected.ownership && <p className="resource-inventory__ownership">{selected.ownership}</p>}
        {selected.note && <p className="resource-inventory__note">{selected.note}</p>}
        </UiContentTransition>
      </aside>}
    </div>
    <footer className="resource-inventory__footer" onKeyDown={handlePageKeys}>
      <span>选择物品查看详情</span>
      <nav className="abyssa-inventory__pagination resource-inventory__pagination" aria-label="物品库存分页">
        <button type="button" aria-label="上一页" aria-controls={`${uid}-inventory-page`} disabled={page === 0}
          onClick={() => changePage(page - 1)}>‹</button>
        <span role="status" aria-live="polite" aria-atomic="true" aria-label={`物品库存，第 ${page + 1} 页，共 ${pageCount} 页`}>{page + 1} / {pageCount}</span>
        <button type="button" aria-label="下一页" aria-controls={`${uid}-inventory-page`} disabled={page === pageCount - 1}
          onClick={() => changePage(page + 1)}>›</button>
      </nav>
      <span><kbd>Esc</kbd> 返回</span>
    </footer>
  </RpgModal>;
}
