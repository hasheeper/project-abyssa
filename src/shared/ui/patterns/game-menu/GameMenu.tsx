import { useEffect, useId, useRef, useState } from "react";
import { useTutorialSuspension } from "../../../tutorial";
import compassIcon from "../../../../assets/icons/menu/map-sword.svg";
import swordIcon from "../../../../assets/icons/items/broadsword.svg";
import campIcon from "../../../../assets/icons/items/camping-tent.svg";
import returnIcon from "../../../../assets/icons/anticlockwise-rotation.svg";
import menuIcon from "../../../../assets/icons/items/scroll-unfurled.svg";
import bookIcon from "../../../../assets/icons/items/book-pile.svg";
import keyIcon from "../../../../assets/icons/menu/medieval-village-01.svg";
import archiveIcon from "../../../../assets/icons/items/bookmark.svg";
import clockIcon from "../../../../assets/icons/items/pocket-watch.svg";
import saveIcon from "../../../../assets/icons/menu/save.svg";
import loadIcon from "../../../../assets/icons/menu/load.svg";
import settingsIcon from "../../../../assets/icons/menu/gear-fill.svg";
import "./game-menu.css";

export type GameMenuEntry = {
  id: string; label: string; shortLabel?: string; detail?: string; icon?: string;
  disabled?: boolean; href?: string; onSelect?: () => void;
};
export type GameMenuProps = {
  commands?: readonly GameMenuEntry[]; navigation: readonly GameMenuEntry[];
  system?: readonly GameMenuEntry[];
  busy?: boolean; title?: string; navigationHint?: string;
};
const icons: Record<string, string> = {
  "end-turn": clockIcon, finish: clockIcon, retreat: returnIcon, camp: campIcon,
  menu: menuIcon, mansion: keyIcon, journey: compassIcon, archive: bookIcon, "battle-guide": archiveIcon,
  save: saveIcon, load: loadIcon, settings: settingsIcon,
};
const captions: Record<string, string> = {
  "end-turn": "END TURN", finish: "CONFIRM", retreat: "RETREAT", camp: "CAMP",
  menu: "MENU", mansion: "MANOR", journey: "SORTIE", archive: "TITLE",
  handbook: "GUIDE", "battle-guide": "HELP", "exit-guided": "FREE",
  save: "SAVE", load: "LOAD", settings: "SETTINGS",
};

/** Icons stay fixed while compact and expanded captions crossfade. */
export function GameMenu({commands = [], navigation, system = [], busy = false, title = "旅途菜单", navigationHint = "选择前往的地点"}: GameMenuProps) {
  const [expanded, setExpanded] = useState(false);
  useTutorialSuspension(expanded);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const entriesId = useId();
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setExpanded(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  const entry = (item: GameMenuEntry) => {
    const disabled = busy || item.disabled;
    const caption = item.shortLabel ?? captions[item.id] ?? item.label;
    const tooltip = [item.label, busy ? "行动进行中" : item.detail].filter(Boolean).join(" · ");
    const content = <>
      <i className="game-menu__icon" data-icon={item.id} style={{maskImage:`url("${item.icon ?? icons[item.id] ?? swordIcon}")`}} aria-hidden="true"/>
      <span className="game-menu__label game-menu__label--compact" aria-hidden="true">{caption}</span>
      <span className="game-menu__label game-menu__label--expanded" aria-hidden="true">{caption}</span>
    </>;
    return item.href && !disabled
      ? <a key={item.id} className="game-menu__entry" aria-label={item.label} href={item.href} title={tooltip} onClick={() => setExpanded(false)}>{content}</a>
      : <button key={item.id} type="button" className="game-menu__entry" aria-label={item.label} title={tooltip} disabled={disabled} onClick={() => {
        if (disabled) return;
        setExpanded(false);
        item.onSelect?.();
      }}>{content}</button>;
  };
  return <aside className="game-menu" ref={root} aria-label="游戏菜单" data-no-pan data-expanded={expanded || undefined} onKeyDown={e => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const list = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
    if (!list.length) return;
    const index = list.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (index + (e.key === "ArrowUp" ? -1 : 1) + list.length) % list.length;
    list[next]?.focus();
  }}>
    <span className="game-menu__frame" aria-hidden="true"/>
    <button type="button" ref={toggle} className="game-menu__toggle" aria-label={expanded ? "收起菜单" : "展开菜单"} aria-expanded={expanded} aria-controls={entriesId} title={expanded ? "收起菜单" : "展开菜单"} onClick={() => setExpanded(value => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7 5 5-5 5m6-10 5 5-5 5"/></svg>
      <span className="game-menu__caption game-menu__label--compact" aria-hidden="true">OPEN</span>
      <span className="game-menu__caption game-menu__label--expanded" aria-hidden="true">CLOSE</span>
    </button>
    <div className="game-menu__entries" id={entriesId}>
      {commands.length > 0 && <div className="game-menu__group" role="group" aria-label={title}>{commands.map(entry)}</div>}
      <nav className="game-menu__group" aria-label="场景导航" title={navigationHint}>{navigation.map(entry)}</nav>
      {system.length > 0 && <div className="game-menu__group" role="group" aria-label="存档与设置">{system.map(entry)}</div>}
    </div>
  </aside>;
}
