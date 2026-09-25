import { useEffect, useId, useRef, useState } from "react";
import type { ShopLootInventory, ShopLootItem } from "./shop-loot-model";

/** Floats from the shelf toolbar; records never stretch the shelf or dialogue. */
export function ShopAppraisalHistory({entries, busy, onSelect}: {
  entries: ShopLootInventory["history"]; busy: boolean; onSelect: (item: ShopLootItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node)) setOpen(false);};
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault(); setOpen(false); trigger.current?.focus({preventScroll: true});
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);};
  }, [open]);
  return <div ref={root} className="shop-live__history">
    <button type="button" ref={trigger} disabled={busy} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>鉴定记录</button>
    {open && <section id={id} className="shop-live__records" aria-label="鉴定记录">
      {entries.length ? [...entries].reverse().map(entry => <button type="button" key={entry.id} disabled={busy} onClick={() => {
        setOpen(false); onSelect(entry.item); trigger.current?.focus({preventScroll: true});
      }}>{entry.item.name}</button>) : <p>尚无鉴定记录</p>}
    </section>}
  </div>;
}
