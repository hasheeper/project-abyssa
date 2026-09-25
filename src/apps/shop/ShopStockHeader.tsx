import type { ReactNode } from "react";

export const SHOP_PAGE_SIZE = 7;

/** Shared inventory metadata. Zero stock still keeps the labels and page slot. */
export function ShopStockHeader({title, count, page, pageCount, busy, listId, ownedLabel, priceLabel, actions, onPage}: {
  title: string; count: number; page: number; pageCount: number; busy: boolean;
  listId: string; ownedLabel: string; priceLabel: string; actions?: ReactNode; onPage: (direction: -1 | 1) => void;
}) {
  return <div className="shop-counter__columns">
    <div className="shop-counter__stock-heading">
      <span>{title} · {count}</span>
      {actions}
      <nav className="shop-counter__pagination" aria-label="商品翻页">
        <button type="button" className="shop-counter__page-button" disabled={busy || page === 0}
          aria-label="上一页" title="上一页" aria-controls={listId} onClick={() => onPage(-1)}>
          <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M9 2 3 8l6 6"/></svg>
        </button>
        <span className="shop-counter__page-number" role="status" aria-live="polite" aria-label="货架页码"><b>{page + 1}</b><span> / </span>{pageCount}</span>
        <button type="button" className="shop-counter__page-button" disabled={busy || page === pageCount - 1}
          aria-label="下一页" title="下一页" aria-controls={listId} onClick={() => onPage(1)}>
          <svg viewBox="0 0 12 16" aria-hidden="true"><path d="m3 2 6 6-6 6"/></svg>
        </button>
      </nav>
    </div>
    <span>{ownedLabel}</span><span>{priceLabel}</span>
  </div>;
}

export function ShopColumnWells() {
  return <span className="shop-counter__column-wells" aria-hidden="true"><i data-column="owned"/><i data-column="price"/></span>;
}
