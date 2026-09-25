import { useRef, type KeyboardEvent } from "react";
import type { StockFilter } from "./stock-categories";

export function StockCategories({categories, selected, busy, onChange}: {
  categories: {id: StockFilter; label: string; count: number}[];
  selected: StockFilter; busy: boolean; onChange: (id: StockFilter) => void;
}) {
  const buttons = useRef(new Map<StockFilter, HTMLButtonElement>());
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (busy || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === "ArrowRight" ? (index + 1) % categories.length
      : event.key === "ArrowLeft" ? (index + categories.length - 1) % categories.length
      : event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(categories[next].id);
    buttons.current.get(categories[next].id)?.focus({preventScroll: true});
  }
  return <div className="new-shop-categories" role="tablist" aria-label="物品分类">
    {categories.map((category, index) => <span className="new-shop-categories__tab" key={category.id}>
      <button type="button" className="new-shop-categories__button" data-selected={selected === category.id || undefined}
        role="tab" id={`new-shop-category-${category.id}`} aria-controls="new-shop-category-panel"
        aria-label={category.label} aria-description={`${category.count} 件物品`} aria-selected={selected === category.id}
        tabIndex={selected === category.id ? 0 : -1} disabled={busy}
        ref={node => {if (node) buttons.current.set(category.id, node); else buttons.current.delete(category.id);}}
        onClick={() => onChange(category.id)} onKeyDown={event => navigate(event, index)}>
        <svg viewBox="0 0 128 44" preserveAspectRatio="none" aria-hidden="true">
          <path className="new-shop-categories__face" d="M1 44V7L7 1H121L127 7V44Z" />
          <path className="new-shop-categories__edge" d="M1 44V7L7 1H121L127 7V44" />
          <path className="new-shop-categories__highlight" d="M5 17V9L9 5H119L123 9V17" />
        </svg>
      </button>
      <span className="new-shop-categories__copy" aria-hidden="true"><span>{category.label}</span><small>{category.count}</small></span>
    </span>)}
  </div>;
}
