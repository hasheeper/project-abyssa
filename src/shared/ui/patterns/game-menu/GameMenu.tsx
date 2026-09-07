import { useEffect, useId, useRef, useState } from "react";
import compassIcon from "../../../../assets/icons/items/compass.svg";
import swordIcon from "../../../../assets/icons/items/broadsword.svg";
import campIcon from "../../../../assets/icons/items/camping-tent.svg";
import returnIcon from "../../../../assets/icons/items/leather-boot.svg";
import bookIcon from "../../../../assets/icons/items/book-pile.svg";
import keyIcon from "../../../../assets/icons/items/keyring.svg";
import archiveIcon from "../../../../assets/icons/items/bookmark.svg";
import clockIcon from "../../../../assets/icons/items/pocket-watch.svg";
import "./game-menu.css";

export type GameMenuEntry = {
  id: string; label: string; detail?: string; icon?: string;
  disabled?: boolean; href?: string; onSelect?: () => void;
};
export type GameMenuProps = {
  commands?: readonly GameMenuEntry[]; navigation: readonly GameMenuEntry[];
  busy?: boolean; title?: string; navigationHint?: string;
};
const icons: Record<string, string> = {
  "end-turn": clockIcon, finish: clockIcon, retreat: returnIcon, camp: campIcon,
  menu: bookIcon, mansion: keyIcon, journey: compassIcon, archive: archiveIcon,
};

/** One expanding rail: every icon is a direct action, never a category submenu. */
export function GameMenu({commands = [], navigation, busy = false, title = "旅途菜单", navigationHint = "选择前往的地点"}: GameMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const close = () => {setExpanded(false); toggle.current?.focus();};
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node)) setExpanded(false);};
    const escape = (event: KeyboardEvent) => {if (event.key === "Escape") {event.preventDefault(); setExpanded(false); toggle.current?.focus();}};
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);};
  }, [expanded]);
  const entry = (item: GameMenuEntry) => {
    const disabled = busy || item.disabled;
    const tooltip = [item.label, busy ? "行动进行中" : item.detail].filter(Boolean).join(" · ");
    const content = <>
      <i className="game-menu__icon" style={{maskImage:`url("${item.icon ?? icons[item.id] ?? swordIcon}")`}} aria-hidden="true"/>
      <span className="game-menu__label" aria-hidden="true">{item.label}</span>
      {item.disabled && item.detail === "尚未开放" && <span className="game-menu__locked" aria-hidden="true">未开放</span>}
    </>;
    return item.href && !disabled
      ? <a key={item.id} className="game-menu__entry" aria-label={item.label} href={item.href} title={tooltip} onClick={close}>{content}</a>
      : <button key={item.id} type="button" className="game-menu__entry" aria-label={item.label} title={tooltip} disabled={disabled} onClick={() => {if (!disabled) {close(); item.onSelect?.();}}}>{content}</button>;
  };
  return <aside className="game-menu" ref={root} aria-label="游戏菜单" data-no-pan data-expanded={expanded || undefined} onKeyDown={e => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const list = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
    const index = list.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (index + (e.key === "ArrowUp" ? -1 : 1) + list.length) % list.length;
    list[next]?.focus();
  }}>
    <span className="game-menu__frame" aria-hidden="true"/>
    <header className="game-menu__header">
      <button type="button" ref={toggle} className="game-menu__toggle" aria-label={expanded ? "收起菜单" : "展开菜单"} aria-expanded={expanded} aria-controls={`menu-entries-${uid}`} onClick={() => setExpanded(v => !v)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/><path className="game-menu__toggle-point" d="m10 8 4 4-4 4"/></svg>
        <span className="game-menu__label">{title}</span>
      </button>
    </header>
    <div className="game-menu__entries" id={`menu-entries-${uid}`}>
      {commands.length > 0 && <div className="game-menu__group">{commands.map(entry)}</div>}
      <nav className="game-menu__group" aria-label="场景导航" title={navigationHint}>{navigation.map(entry)}</nav>
    </div>
  </aside>;
}
