import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExpeditionLedger, type ExpeditionLedgerProps } from "./ExpeditionLedger";
import { ExpeditionBagOdometer, ExpeditionOdometer } from "../ExpeditionReels";
import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";

/** Original mechanical reels share one instrument body; records slide over its right edge. */
export function ExpeditionBattleLedger(props: ExpeditionLedgerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null), button = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  const panelId = useId();
  const {engine, memory, handFactor, layerFactor, earthFactor = 1, layerClearPending} = props;
  const close = (focus = false) => {setOpen(false); if (focus) button.current?.focus();};
  useLayoutEffect(() => {
    setDrawerHost(root.current?.closest<HTMLElement>(".abyssa-expedition-frame__interior") ?? null);
  }, []);
  useEffect(() => {
    if (!open) return;
    drawerRef.current?.querySelector<HTMLButtonElement>(".battle-ledger-drawer__close")?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !drawerRef.current?.contains(target)) setOpen(false);
    };
    // Clicking a non-focusable log line can move focus to the document body.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const drawer = <div ref={drawerRef} id={panelId} className="battle-ledger-drawer" data-open={open || undefined} inert={!open} aria-hidden={!open} role="region" aria-label={memory ? "回忆战记录" : "账本详情"}>
    <div className="battle-ledger-drawer__travel">
      <ExpeditionLedger {...props} onClose={() => close(true)}/>
    </div>
  </div>;
  return <section ref={root} className="battle-sidebar-readouts" aria-label={memory ? "回忆战读数" : "远征读数"}>
    <section className="abyssa-expedition-multiplier" data-finalizing={layerClearPending || undefined} aria-label={memory ? memory.readoutLabel ?? "侍偶护域" : "收益倍率"}>
      <div className="battle-meter-mount">
        <div className="abyssa-expedition-sidebar__section-title"><span>{memory ? memory.readoutLabel ?? "侍偶护域" : "收益倍率"}</span></div>
          <ExpeditionOdometer className="abyssa-expedition-multiplier__reels"
            value={memory ? memory.protection : handFactor * layerFactor * earthFactor}
            digits={2} decimals={memory ? 0 : 2} prefix={memory ? undefined : "×"}
            label={memory ? `${memory.readoutLabel ?? "侍偶护域"} · ${memory.protection}` : `当前总倍率 ${(handFactor * layerFactor * earthFactor).toFixed(2)}`}/>
      </div>
    </section>
    <section className="abyssa-expedition-purse" aria-label={memory ? "往昔记录" : "远征包裹"}>
        <div className="abyssa-expedition-purse__heading"><strong>{memory ? "往昔记录" : "已入袋 · G"}</strong>
        <button ref={button} type="button" className="battle-ledger-toggle" aria-label={memory ? "回忆战记录" : "远征账本"}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5c3.5-1 5.5 0 8 1.5 2.5-1.5 4.5-2.5 8-1.5v15c-3.5-1-5.5 0-8 1.5-2.5-1.5-4.5-2.5-8-1.5Z M12 6v15 M7 8l2 1 M7 12l2 1 M15 9l2-1 M15 13l2-1"/></svg>
        <span>{memory ? "查阅" : "账簿"}</span>
      </button>
        </div>
          {memory ? <p className="battle-sidebar-readouts__note">固定勇者小队<br/><small>不计当下收益</small></p> :
            <div className="abyssa-expedition-purse__amount">
              <div className="abyssa-expedition-purse__currency" data-kind="gold">
              <ExpeditionBagOdometer value={engine.bagGold} label={`包裹 ${engine.bagGold} 枚金币`}/>
              </div>
              <span className="abyssa-expedition-purse__currency-divider" aria-hidden="true"/>
              <div className="abyssa-expedition-purse__currency" data-kind="crystal">
                <CurrencyAmount value={engine.result?.crystal ? 1 : 0} currency="crystal" label={`${engine.result?.crystal ? 1 : 0} 枚远古晶石`}/>
              </div>
            </div>}
    </section>
    {drawerHost ? createPortal(drawer, drawerHost) : drawer}
  </section>;
}
