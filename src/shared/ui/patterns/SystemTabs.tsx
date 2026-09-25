import type { KeyboardEvent } from "react";
import "../styles/system-tabs.css";

/** One light, unboxed tab treatment for in-scene system sections. */
export function SystemTabs<T extends string>({ label, items, selected, onChange, disabled = false, pages = false }: {
  label: string; items: readonly { id: T; label: string; accessibleLabel?: string; controls?: string; tabId?: string }[];
  selected: T; onChange: (id: T) => void; disabled?: boolean; pages?: boolean;
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); onChange(items[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus({ preventScroll: true });
  }
  return <nav className="abyssa-system-tabs" role={pages ? undefined : "tablist"} aria-label={label}>
    {items.map((item, index) => <button type="button" key={item.id} role={pages ? undefined : "tab"} id={item.tabId}
      aria-label={item.accessibleLabel} aria-controls={item.controls} aria-selected={pages ? undefined : selected === item.id}
      aria-current={pages && selected === item.id ? "page" : undefined} tabIndex={selected === item.id ? 0 : -1}
      data-selected={selected === item.id || undefined} disabled={disabled} onClick={() => onChange(item.id)} onKeyDown={event => move(event, index)}>{item.label}</button>)}
  </nav>;
}
