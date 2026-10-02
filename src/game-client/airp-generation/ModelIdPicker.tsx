import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ModelListController } from "../../game-runtime/airp-model-list";
import "./model-id-picker.css";

type Menu = { baseUrl: string; apiKey: string; host: HTMLElement; style: CSSProperties; side: "above" | "below" };

/** Keep the dropdown inside its settings dialog's input ownership, outside the scrolling columns. */
function placeMenu(field: HTMLElement): Pick<Menu, "host" | "style" | "side"> {
  const host = field.closest<HTMLElement>('[role="dialog"]') ?? field.closest<HTMLElement>(".abyssa-stage__canvas") ?? document.body;
  const box = field.getBoundingClientRect(), bounds = host.getBoundingClientRect();
  const scale = host === document.body ? 1 : bounds.width / host.offsetWidth || 1;
  const height = host === document.body ? window.innerHeight : bounds.height;
  const origin = host === document.body ? {left: 0, top: 0} : bounds;
  const below = height - (box.bottom - origin.top) - 8 * scale, above = box.top - origin.top - 8 * scale;
  const side = below < 280 * scale && above > below ? "above" : "below";
  return { host, side, style: {
    position: host === document.body ? "fixed" : "absolute",
    left: (box.left - origin.left) / scale, width: box.width / scale,
    top: (side === "above" ? box.top - origin.top : box.bottom - origin.top) / scale + (side === "above" ? -6 : 6),
    maxHeight: Math.max(120, (side === "above" ? above : below) / scale),
  }};
}

export function ModelIdPicker({ name, value, baseUrl, apiKey, catalog, onChange, settings }: {
  name: string; value: string; baseUrl: string; apiKey: string; catalog: ModelListController;
  onChange: (model: string) => void; settings: boolean;
}) {
  useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const id = useId(), field = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null), searchInput = useRef<HTMLInputElement>(null), options = useRef<HTMLUListElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null), [search, setSearch] = useState("");
  const open = !!menu && menu.baseUrl === baseUrl && menu.apiKey === apiKey;
  const state = catalog.read(baseUrl, apiKey), query = search.trim().toLocaleLowerCase();
  const matches = state.ids.filter(model => model.toLocaleLowerCase().includes(query));
  const close = (restoreFocus = false) => { setMenu(null); if (restoreFocus) trigger.current?.focus(); };

  useLayoutEffect(() => { if (open) searchInput.current?.focus({preventScroll: true}); }, [open]);
  useEffect(() => {
    if (!open) { if (menu) setMenu(null); return; }
    const outside = (event: Event) => {
      if (event.target instanceof Node && !field.current?.contains(event.target) && !popup.current?.contains(event.target)) setMenu(null);
    };
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) setMenu(null); };
    const resize = () => setMenu(null);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  const escape = (event: KeyboardEvent) => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
  };
  return <div className="airp-model-picker" onKeyDown={escape}>
    <div ref={field} className="airp-model-picker__field">
      <label><span className={settings ? "airp-settings-sr-only" : undefined}>{name}模型 ID</span>
        <input aria-label={`${name}模型 ID`} autoComplete="off" spellCheck={false} value={value} placeholder="选择或填写模型 ID" onChange={event => onChange(event.target.value)}/>
      </label>
      <button className="airp-model-picker__toggle" ref={trigger} type="button" aria-label={`选择${name}模型`} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
        onClick={() => {
          if (open) { close(); return; }
          if (!field.current) return;
          setMenu({baseUrl, apiKey, ...placeMenu(field.current)}); setSearch(""); void catalog.load(baseUrl, apiKey);
        }}>选择<span aria-hidden="true">⌄</span></button>
    </div>
    {open && createPortal(<div ref={popup} className="airp-model-picker__menu" data-side={menu.side} style={menu.style} onKeyDown={escape}>
      <div className="airp-model-picker__search">
        <input ref={searchInput} type="search" aria-label={`搜索${name}模型`} placeholder="搜索模型…" autoComplete="off" spellCheck={false}
          value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const buttons = options.current?.querySelectorAll<HTMLButtonElement>("button");
            if (!buttons?.length) return;
            event.preventDefault(); buttons[event.key === "ArrowDown" ? 0 : buttons.length - 1].focus();
          }}/>
        <button type="button" className="airp-model-picker__refresh" disabled={state.status === "loading"}
          onClick={() => void catalog.load(baseUrl, apiKey, true)}>刷新</button>
      </div>
      <ul id={id} ref={options} className="airp-model-picker__options" role="listbox" aria-label={`${name}模型列表`} aria-busy={state.status === "loading"} onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
        buttons[next].focus();
      }}>
        {state.status === "ready" && matches.map(model => <li key={model} role="none"><button type="button" role="option" aria-label={model} aria-selected={model === value}
          onClick={() => { onChange(model); close(true); }}><span className="airp-model-picker__check" aria-hidden="true">{model === value ? "✓" : ""}</span><span title={model}>{model}</span></button></li>)}
      </ul>
      {state.status === "failed" ? <p className="airp-model-picker__message" role="alert">{state.error}</p> : state.status === "loading" ? <p className="airp-model-picker__message" role="status">正在获取模型…</p>
        : !matches.length && <p className="airp-model-picker__message">{state.ids.length ? "没有匹配的模型" : "此连接未返回模型，可手动填写。"}</p>}
    </div>, menu.host)}
  </div>;
}
