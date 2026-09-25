import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LootItemView } from "./loot-item";
import { LootItemMeta } from "./LootItemMeta";

/** Portal inside the scaled game surface (or current modal), outside the scroll clip. */
export function LootHoverDetail({ id, item, quantity, anchor, onClose, onEnter, onLeave }: {
  id: string; item: LootItemView; quantity: number; anchor: HTMLElement;
  onClose: () => void; onEnter: () => void; onLeave: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 312, ready: false });
  useLayoutEffect(() => {
    setHost(anchor.closest<HTMLElement>(".abyssa-modal__panel")
      ?? anchor.closest<HTMLElement>(".battle-ledger-drawer__travel")
      ?? anchor.closest<HTMLElement>(".abyssa-expedition"));
  }, [anchor]);
  useLayoutEffect(() => {
    if (!host || !card.current) return;
    const place = () => {
      if (!anchor.isConnected || anchor.closest('[inert]')) { onClose(); return; }
      const boundary = host.getBoundingClientRect(), target = anchor.getBoundingClientRect();
      const scale = boundary.width / host.offsetWidth;
      if (!scale) return;
      const width = Math.min(312, host.clientWidth - 32);
      const height = card.current!.getBoundingClientRect().height / scale;
      const left = Math.max(16, Math.min((target.left - boundary.left) / scale, host.clientWidth - width - 16));
      const below = (target.bottom - boundary.top) / scale + 10;
      const above = (target.top - boundary.top) / scale - height - 10;
      const top = Math.max(16, Math.min(below + height <= host.clientHeight - 16 ? below : above, host.clientHeight - height - 16));
      setPosition(current => current.ready && current.left === left && current.top === top && current.width === width ? current : { left, top, width, ready: true });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    const outside = (event: PointerEvent) => {
      if (!anchor.contains(event.target as Node) && !card.current?.contains(event.target as Node)) onClose();
    };
    // A scroll can hide the source item; dismiss instead of leaving an orphaned tooltip.
    const scroll = (event: Event) => { if (!card.current?.contains(event.target as Node)) onClose(); };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(host); observer.observe(card.current); observer.observe(anchor);
    const drawer = host.closest(".battle-ledger-drawer");
    const visibility = new MutationObserver(place);
    if (drawer) visibility.observe(drawer, { attributes: true, attributeFilter: ["inert"] });
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect(); visibility.disconnect();
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", place);
    };
  }, [host, anchor, item.id, quantity, onClose]);
  if (!host) return null;
  return createPortal(<aside ref={card} id={id} role="tooltip" className="loot-hover-card"
    onMouseEnter={onEnter} onMouseLeave={onLeave}
    style={{ left: position.left, top: position.top, width: position.width, visibility: position.ready ? "visible" : "hidden" }}>
    <header><strong>{item.name}</strong><span className="loot-hover-card__quantity">× {quantity}</span></header>
    <LootItemMeta item={item}/>
    <p>{item.description}</p>
  </aside>, host);
}
