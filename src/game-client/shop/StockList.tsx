import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { DEFAULT_ITEM_RARITY, type ItemRarity } from "../../shared/ui/items/rarity";
import type { Mode } from "./stock-model";
import type { StockCategory } from "./stock-categories";

export type StockItem = {
  id: string; name: string; description: string; icon: string;
  owned: number; capacity?: number; price: number; identified?: boolean; category: StockCategory;
  isNew?: boolean;
  delivery?: "supply" | "equipment"; remaining?: number | null; purchaseMaximum?: number; preview?: import("../../game-runtime/equipment-view").EquipmentPreview;
  lotSize?: number; priceLabel?: string; rarity?: ItemRarity;
};
const PAGE_SIZE = 7;

/** The original shop's compact shelf and column wells, shared by all preview modes. */
export function StockList({items, selectedId, mode, funds, busy, pendingCount, onSelect, onAppraise, accessory}: {
  items: StockItem[]; selectedId?: string; mode: Mode; funds: number; busy: boolean; pendingCount: number;
  onSelect: (item: StockItem) => void; onAppraise: () => void;
  accessory?: ReactNode;
}) {
  const listId = useId();
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const selectedIndex = Math.max(0, items.findIndex(item => item.id === selectedId));
  const page = Math.floor(selectedIndex / PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const buying = mode === "buy", appraising = mode === "appraise";

  useEffect(() => {
    if (!pendingFocus.current) return;
    rows.current.get(pendingFocus.current)?.focus({preventScroll: true});
    pendingFocus.current = null;
  }, [selectedId, page]);

  function focusItem(index: number) {
    const item = items[index];
    if (busy || !item) return;
    const mounted = rows.current.get(item.id);
    if (mounted) mounted.focus({preventScroll: true}); else pendingFocus.current = item.id;
    onSelect(item);
  }
  function changePage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (next !== page) focusItem(next * PAGE_SIZE);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1)
      : event.key === "ArrowUp" ? Math.max(0, index - 1)
      : event.key === "PageDown" ? Math.min(items.length - 1, index + PAGE_SIZE)
      : event.key === "PageUp" ? Math.max(0, index - PAGE_SIZE) : null;
    if (next === null || busy) return;
    event.preventDefault(); focusItem(next);
  }

  return <section className="new-shop-stock" data-paginated={pageCount > 1 || undefined} aria-label={buying ? "补给货架" : appraising ? "鉴定柜台" : "回收柜台"}>
      <div className="new-shop-stock__columns">
        <div className="new-shop-stock__heading">
          <span className="new-shop-stock__label">物品</span>
          {accessory}
        </div>
        <span>{buying ? items.some(i => i.delivery === "equipment") ? "持有 / 库存" : "持有 / 上限" : "持有"}</span><span>{appraising ? "鉴定费" : buying ? "单价" : "报价"}</span>
      </div>
      <div className="new-shop-stock__well">
        {!!items.length && <span className="new-shop-stock__column-wells" aria-hidden="true"><i data-column="owned" /><i data-column="price" /></span>}
        {items.length ? <div className="new-shop-stock__list" id={listId} role="listbox" aria-label={buying ? "商品列表" : appraising ? "待鉴定与已鉴定物品" : "可出售物品"} aria-busy={busy}>
          {items.slice(pageStart, pageStart + PAGE_SIZE).map((item, index) => {
            const selected = item.id === selectedId;
            const full = buying && (item.purchaseMaximum ?? Math.max(0, (item.capacity ?? 0) - item.owned)) === 0;
            return <button key={item.id} className="new-shop-stock__item" type="button" role="option" aria-selected={selected}
              style={{"--entrance-index": index} as CSSProperties}
              ref={node => {if (node) rows.current.set(item.id, node); else rows.current.delete(item.id);}}
              tabIndex={selected ? 0 : -1} aria-posinset={pageStart + index + 1} aria-setsize={items.length}
              aria-label={item.name} aria-description={item.description} aria-controls="new-shop-detail" data-full={full || undefined} disabled={busy}
              onClick={() => onSelect(item)} onKeyDown={event => navigate(event, pageStart + index)}>
              <ItemSlotStatic className="new-shop-stock__slot" icon={item.icon} name={item.name} rarity={item.rarity ?? DEFAULT_ITEM_RARITY}
                showRarity={false} size={48} data-selected={selected || undefined} aria-hidden="true" />
              <span className="new-shop-stock__name"><strong>{item.name}{item.isNew && <small className="new-shop-stock__new">新货</small>}</strong><span className="new-shop-stock__description">{item.description}</span></span>
              <span className="new-shop-stock__owned" aria-label={buying ? `持有 ${item.owned}${item.capacity !== undefined ? `，上限 ${item.capacity}` : `，剩余 ${item.remaining}`}${full ? item.delivery === "equipment" ? "，售罄" : "，已备足" : ""}` : `持有 ${item.owned} 件`}>
                <b>{item.owned}</b>{buying && <span>{item.delivery === "equipment" ? ` · 余 ${item.remaining}` : ` / ${item.capacity}`}</span>}
              </span>
              <span className="new-shop-stock__price" data-short={mode !== "sell" && !item.identified && funds < item.price && !full || undefined}>
                {item.priceLabel || appraising && item.identified ? <span className="new-shop-stock__identified">{item.priceLabel ?? "已鉴定"}</span> : <CurrencyAmount value={item.price} />}
              </span>
            </button>;
          })}
        </div> : <div className="new-shop-stock__empty" id={listId}>
          <h2 tabIndex={-1}>{buying ? "暂无在售物资" : mode === "sell" ? "暂无可出售物品" : "还没有带回奇物"}</h2>
          <p>{pendingCount > 0 ? "先请缇比看看，再谈价钱。" : "下一次远征，或许会有些新发现。"}</p>
          {pendingCount > 0 && <RpgNotchedPillButton className="new-shop__action" label="去鉴定" onClick={onAppraise} />}
        </div>}
      </div>
      {pageCount > 1 && <footer className="new-shop-stock__footer">
        <nav className="new-shop-stock__pagination" aria-label="商品翻页">
          <button type="button" disabled={busy || page === 0} aria-label="上一页" title="上一页" aria-controls={listId} onClick={() => changePage(-1)}>
            <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M9 2 3 8l6 6" /></svg>
          </button>
          <span className="new-shop-stock__page-number" role="status" aria-live="polite" aria-label="货架页码"><b>{page + 1}</b><span> / </span>{pageCount}</span>
          <button type="button" disabled={busy || page === pageCount - 1} aria-label="下一页" title="下一页" aria-controls={listId} onClick={() => changePage(1)}>
            <svg viewBox="0 0 12 16" aria-hidden="true"><path d="m3 2 6 6-6 6" /></svg>
          </button>
        </nav>
      </footer>}
  </section>;
}
