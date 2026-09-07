import { useEffect, useRef, useState } from "react";
import { DiceActionButton } from "./DiceActionButton";
import "./item-dock.css";

export type DockItem = {
  id: string; name: string; icon: string; charges: number; description: string;
  unavailableReason?: string;
  targets: readonly { id: string; label: string; onSelect: () => void }[];
};
export type ItemDockProps = {
  items: readonly DockItem[]; busy: boolean;
};

/** The scene supplies legal targets and commands. This tray owns selection only. */
export function ItemDock({items, busy}: ItemDockProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const targetsPanel = useRef<HTMLElement>(null);
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (selected) targetsPanel.current?.querySelector<HTMLButtonElement>(".dice-action-button:not(:disabled)")?.focus();
    else if (returnFocus.current) {
      buttons.current.get(returnFocus.current)?.focus();
      returnFocus.current = null;
    }
  }, [selected]);
  const item = items.find(i => i.id === selected);
  // Restore after the target view is removed and the slots are visible again.
  const cancel = () => { returnFocus.current = selected; setSelected(null); };
  return <section className="item-dock" aria-label="七槽道具坞" onKeyDown={e => {
    if (e.key === "Escape" && selected) {e.preventDefault(); e.stopPropagation(); cancel();}
  }}>
    {item && <section ref={targetsPanel} className="item-dock__targets" aria-label={`${item.name}的使用目标`}>
      <header><i style={{maskImage:`url("${item.icon}")`}} aria-hidden="true"/><strong>{item.name}</strong><button type="button" onClick={cancel}>返回道具</button></header>
      <div className="item-dock__target-list">
        {item.targets.map(target => <DiceActionButton key={target.id} label={target.label} disabled={busy || !!item.unavailableReason} onClick={() => {
          if (busy || item.unavailableReason) return;
          // Clear the target before dispatch so repeated clicks cannot reuse this selection.
          cancel(); target.onSelect();
        }}/>)}
        {!item.targets.length && <p>{item.unavailableReason ?? "当前没有可用目标"}</p>}
      </div>
    </section>}
    <ol className="item-dock__slots" aria-label="携带道具">
      {Array.from({length:7}, (_, index) => {
        const supply = items[index];
        return <li key={supply?.id ?? `empty-${index}`} data-empty={!supply || undefined}>
          {supply ? <button type="button" ref={node => {if(node) buttons.current.set(supply.id,node); else buttons.current.delete(supply.id);}}
            aria-label={`${supply.name}，剩余 ${supply.charges} 次`}
            aria-description={busy ? "行动演出中" : supply.unavailableReason ?? supply.description}
            title={busy ? "行动演出中" : supply.unavailableReason ?? supply.name}
            aria-disabled={busy || !!supply.unavailableReason || !supply.targets.length}
            aria-pressed={selected === supply.id}
            onClick={() => {if (!busy && !supply.unavailableReason && supply.targets.length) setSelected(selected === supply.id ? null : supply.id);}}>
            <i style={{maskImage:`url("${supply.icon}")`}} aria-hidden="true"/>
            <strong aria-hidden="true">{supply.charges}</strong>
          </button> : <span className="item-dock__empty" aria-label={`空槽 ${index + 1}`}>◇</span>}
        </li>;
      })}
    </ol>
  </section>;
}
