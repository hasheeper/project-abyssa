import "./loot.css";
import "../../../shared/ui/styles/items.css";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";
import { lootItemLabel, type LootItemView } from "./loot-item";
import { LootKindMark } from "./LootKindMark";
import { LootHoverDetail } from "./LootHoverDetail";
import { itemCount, type LootPocket } from "./loot-types";

/** Acquisition lines have no slots or nested disclosure. Only the two pockets fold. */
export function LootRewards({ pocket, catalog, label, scrollable = true }: {
  pocket: LootPocket; catalog: Record<string, LootItemView>; label: string; scrollable?: boolean;
}) {
  const tooltipId = useId();
  const [active, setActive] = useState<{ itemId: string; anchor: HTMLElement } | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keep = useCallback(() => { if (leaveTimer.current) clearTimeout(leaveTimer.current); leaveTimer.current = null; }, []);
  const close = useCallback(() => { keep(); setActive(null); }, [keep]);
  const leave = useCallback(() => { keep(); leaveTimer.current = setTimeout(close, 140); }, [close, keep]);
  const show = (itemId: string, anchor: HTMLElement, hover = false) => {
    keep();
    if (hover) leaveTimer.current = setTimeout(() => { leaveTimer.current = null; setActive({itemId, anchor}); }, 120);
    else setActive({itemId, anchor});
  };
  useEffect(() => keep, [keep]);
  const activeItem = active && catalog[active.itemId];
  const activeStack = active && pocket.items.find(stack => stack.itemId === active.itemId);
  return <div className="loot-rewards">
    {pocket.items.length ? <div className="loot-rewards__scroll" tabIndex={scrollable ? 0 : undefined} role={scrollable ? "region" : undefined} aria-label={scrollable ? `${label}列表` : undefined}>
      <ul className="loot-rewards__list" aria-label={label}>
        {pocket.items.map((stack, index) => {
          const definition = catalog[stack.itemId];
          const name = definition?.name ?? stack.itemId;
          return <li key={stack.itemId} style={{ "--loot-order": Math.min(index, 5) } as CSSProperties}>
            <button type="button" className="loot-reward" aria-label={definition ? lootItemLabel(definition, stack.quantity) : `${name}，数量 ${stack.quantity}`} aria-describedby={active?.itemId === stack.itemId ? tooltipId : undefined}
              onMouseEnter={event => show(stack.itemId, event.currentTarget, true)} onMouseLeave={leave}
              onFocus={event => show(stack.itemId, event.currentTarget)} onBlur={leave}
              onClick={event => show(stack.itemId, event.currentTarget)}>
              <span className="loot-reward__art abyssa-rarity" data-rarity={definition?.rarity ?? "unknown"} aria-hidden="true">
                <i className="loot-reward__icon" style={{ "--loot-icon": definition ? `url("${definition.icon}")` : undefined } as CSSProperties}/>
                {definition && <LootKindMark kind={definition.kind}/>}
              </span>
              <span className="loot-reward__name">{name}</span>
              <b><small>×</small>{stack.quantity}</b>
            </button>
          </li>;
        })}
      </ul>
    </div> : <p className="loot-rewards__empty">暂无道具收获</p>}
    {active && activeItem && activeStack && <LootHoverDetail id={tooltipId} item={activeItem} quantity={activeStack.quantity} anchor={active.anchor} onClose={close} onEnter={keep} onLeave={leave}/>}
  </div>;
}

export function LootPocketView({ title, pocket, catalog, status, hint }: {
  title: string; pocket: LootPocket; catalog: Record<string, LootItemView>; status: "banked" | "unbanked"; hint?: string;
}) {
  const [open, setOpen] = useState(status === "unbanked");
  const id = useId();
  return <section className="loot-pocket" data-status={status} aria-label={title}>
    <button className="loot-pocket__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="loot-pocket__title">
        <span className="loot-pocket__heading"><strong>{title}</strong><span className="loot-pocket__count">{itemCount(pocket)}<small> 件</small></span></span>
        <small>{hint ?? (status === "unbanked" ? "清层后入袋" : "撤退全部保留")}</small>
      </span>
      <CurrencyAmount value={pocket.copper} currency="lira"/>
      <svg className="loot-pocket__chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path className="loot-pocket__chevron-body" d="m4 8 8 8 8-8-2-2-6 6-6-6Z"/>
        <path className="loot-pocket__chevron-edge" d="m5 8 7 7 7-7"/>
      </svg>
    </button>
    <div id={id} className="loot-pocket__reveal" data-open={open} inert={!open} aria-hidden={!open}><div>
      <LootRewards pocket={pocket} catalog={catalog} label={`${title}道具`}/>
    </div></div>
  </section>;
}
