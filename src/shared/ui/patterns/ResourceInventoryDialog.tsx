import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { RpgModal, type RpgModalProps } from "../primitives/RpgModal";
import { ItemSlot, ItemSlotStatic } from "../primitives/ItemSlot";
import { UiContentTransition } from "../motion/UiContentTransition";
import { ManorItemShowcase, ManorPager, ManorPanel, ManorStat, ManorStats } from "./ManorParts";
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
  /** 两块名牌上的图标地址。由调用方从素材库取(manorIcon),共用件本身不依赖素材库。 */
  sectionIcons?: {fixed?: string; sandbox?: string};
}

const ITEM_COLUMNS = 7;
const INVENTORY_PAGE_SIZE = ITEM_COLUMNS * 3;
const NO_FIXED_ENTRIES: readonly ResourceInventoryEntry[] = [];

export function ResourceInventoryDialog({
  open, onClose, entries, fixedEntries = NO_FIXED_ENTRIES, title = "领地库存", className, returnFocusRef, onPresentChange, motionPreset, sectionIcons,
}: ResourceInventoryDialogProps) {
  const uid = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingPageFocus = useRef<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(entries.length / INVENTORY_PAGE_SIZE));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageEntries = useMemo(() => entries.slice(page * INVENTORY_PAGE_SIZE, (page + 1) * INVENTORY_PAGE_SIZE), [entries, page]);

  const groups = useMemo(() => [
    {id: "fixed", label: "常备补给", icon: sectionIcons?.fixed, entries: fixedEntries, emptyHint: "暂无补给"},
    {id: "sandbox", label: "物品库存", icon: sectionIcons?.sandbox, entries: pageEntries, emptyHint: "尚未存放其他物品"},
  ], [fixedEntries, pageEntries, sectionIcons?.fixed, sectionIcons?.sandbox]);
  const orderedEntries = useMemo(() => groups.flatMap(group => group.entries), [groups]);
  // 光标即选中:右栏常驻显示光标所在的物品;光标失效时回到第一件。
  const selected = orderedEntries.find(entry => entry.id === cursorId) ?? orderedEntries[0];
  const selectedFixed = !!selected && fixedEntries.some(entry => entry.id === selected.id);

  useEffect(() => {
    if (!open) { setCursorId(null); setPageIndex(0); pendingPageFocus.current = null; return; }
    if (!cursorId || orderedEntries.some(entry => entry.id === cursorId)) return;
    const fallback = pageEntries[0]?.id ?? fixedEntries[0]?.id ?? null;
    setCursorId(fallback);
    // 被移除的格位带走了焦点时,把它交给新的光标。
    if (document.activeElement === document.body) buttons.current.get(fallback ?? "")?.focus({preventScroll: true});
  }, [open, orderedEntries, cursorId, pageEntries, fixedEntries]);

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
    setCursorId(target?.id ?? null);
    pendingPageFocus.current = target?.id ?? null;
    setPageIndex(next);
  }

  function handlePageKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "PageDown" && event.key !== "PageUp") return;
    event.preventDefault();
    const slot = Math.max(0, pageEntries.findIndex(entry => entry.id === selected?.id));
    changePage(page + (event.key === "PageDown" ? 1 : -1), slot);
  }

  function moveCursor(event: KeyboardEvent<HTMLButtonElement>, id: string) {
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
    if (next) { setCursorId(next.id); buttons.current.get(next.id)?.focus(); }
  }

  return <RpgModal open={open} onClose={onClose} title={title} header={null} motionPreset={motionPreset}
    signboard={title} signboardVariant="slim" className={className}
    panelClassName="resource-inventory-panel manor-utility__window" returnFocusRef={returnFocusRef} onPresentChange={onPresentChange}>
    <div className="resource-inventory" onKeyDown={handlePageKeys}>
      {/* 左:两块名牌面板,各自随内容高度;分页骑在「物品库存」面板上沿。 */}
      <div className="resource-inventory__overview">
          {groups.map(group => <ManorPanel className="resource-inventory__group" data-area={group.id} key={group.id}
            label={group.label} icon={group.icon}
            aside={group.id === "sandbox" ? <ManorPager subject="物品库存" page={page} count={pageCount}
              controls={`${uid}-inventory-page`} onPage={next => changePage(next)}/> : undefined}>
            <div className="resource-inventory__contents" id={group.id === "sandbox" ? `${uid}-inventory-page` : undefined}>
            {group.entries.length || group.id === "sandbox" ? <ul className="resource-inventory__items">
              {group.entries.map(entry => <li key={entry.id}>
                <div className="resource-inventory__art">
                <ItemSlot className="resource-inventory__item" data-resource-item={entry.id}
                  icon={entry.icon} name={entry.name} rarity={entry.rarity} showRarity={!!entry.rarity}
                  tone={group.id === "fixed" ? "interface" : "rarity"}
                  selected={selected?.id === entry.id} data-depleted={entry.quantity === 0 || undefined}
                  aria-label={`查看${entry.name}详情，${entry.quantity}${entry.unit}${entry.status ? `，${entry.status}` : ""}`}
                  aria-controls={`${uid}-detail`}
                  tabIndex={selected?.id === entry.id ? 0 : -1}
                  ref={node => { if (node) buttons.current.set(entry.id, node); else buttons.current.delete(entry.id); }}
                  onFocus={() => setCursorId(entry.id)} onKeyDown={event => moveCursor(event, entry.id)}
                  onClick={() => setCursorId(entry.id)} />
                {entry.status && <small className="resource-inventory__status">{entry.status}</small>}
                <span className="abyssa-item-count resource-inventory__badge" data-depleted={entry.quantity === 0 || undefined} aria-hidden="true">
                  {entry.quantity.toLocaleString("zh-CN")}
                </span>
                </div>
              </li>)}
              {group.id === "sandbox" && Array.from({length: INVENTORY_PAGE_SIZE - group.entries.length}, (_, index) =>
                <li key={`empty-${index}`} data-placeholder aria-hidden="true">
                  <ItemSlotStatic showRarity={false} />
                </li>)}
            </ul> : <div className="resource-inventory__empty">
              <p>{group.emptyHint}</p>
            </div>}
            </div>
          </ManorPanel>)}
      </div>
      {/* 右:同一种面板,名牌写类别;里面依次是展台、数值、说明,附注沉到底部。 */}
      {selected ? <ManorPanel id={`${uid}-detail`} className="resource-inventory__detail" aria-label={`${selected.name}详情`}
        label={selected.type ?? "物品详情"}>
        <UiContentTransition className="resource-inventory__sheet" contentKey={selected.id}>
          <ManorItemShowcase icon={selected.icon} name={selected.name} tag={selected.status}
            tone={selectedFixed ? "interface" : "rarity"} rarity={selected.rarity}/>
          <ManorStats className="resource-inventory__stats">
            <ManorStat label={selected.status ? "持有" : "库存"} value={selected.quantity.toLocaleString("zh-CN")} unit={selected.unit}/>
          </ManorStats>
          {selected.description && <p className="resource-inventory__effect">{selected.description}</p>}
          {selected.ownership && <p className="resource-inventory__ownership">{selected.ownership}</p>}
          {selected.note && <p className="resource-inventory__note">{selected.note}</p>}
        </UiContentTransition>
      </ManorPanel> : <ManorPanel id={`${uid}-detail`} className="resource-inventory__detail" label="物品详情">
        <p className="resource-inventory__vacant">尚无物品</p>
      </ManorPanel>}
    </div>
  </RpgModal>;
}
