import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { LAYER_MULTIPLIERS, type ExpeditionState } from "../view";
import { LOG_TONE_COLOR } from "./expedition-visuals";
import type { ReactNode } from "react";

export type ExpeditionLedgerProps = {
  objective?: ReactNode;
  engine: Pick<ExpeditionState, "location" | "layer" | "round" | "gold" | "bagGold" | "deepestLayer" | "log"> & {result?: {crystal: boolean} | null};
  title?: string;
  memory?: { readoutLabel?: string; protection: number; preview: string | null; onLeave: () => void; busy: boolean };
  layers?: readonly number[];
  layerClearPending: boolean;
  handFactor: number;
  layerFactor: number;
  projected: number;
  earthFactor?: number;
};

/** The drop-down contains records; live readings stay in the monitor. */
export function ExpeditionLedger({
  engine, layers = LAYER_MULTIPLIERS, memory, onClose, objective, handFactor, layerFactor, earthFactor = 1, projected,
}: ExpeditionLedgerProps & {onClose?: () => void}) {
  const logEntries = [...engine.log].slice(-40).reverse();

  return (
    <div className="abyssa-expedition-region abyssa-expedition-sidebar battle-ledger" aria-label="远征账本">
      <span className="abyssa-expedition-sidebar__corners" aria-hidden="true">
        <i data-corner="tl"/><i data-corner="tr"/><i data-corner="br"/><i data-corner="bl"/>
      </span>
      <header className="abyssa-expedition-sidebar__header">
        <div className="battle-ledger__heading">
          <span>{memory ? "回忆记录" : "远征记录"}</span>
          <small>{engine.location} · {memory ? "历史交锋" : `第 ${engine.layer}/${layers.length} 层`} · 回合 {engine.round}</small>
        </div>
        {onClose && <button type="button" className="battle-ledger-drawer__close" aria-label="收起账本" onClick={onClose}>收回
        </button>}
      </header>

      <div className="battle-ledger__records">
        {objective}
        {!memory && <section className="battle-ledger__yield" aria-label="收益倍率明细">
          <p>牌型 ×{handFactor.toFixed(2)} · 层深 ×{layerFactor.toFixed(2)} · 大地加成 ×{earthFactor.toFixed(2)} ＝ 总倍率 ×{(handFactor * layerFactor * earthFactor).toFixed(2)}</p>
          <p>层深取当前楼层的倍率；至少四名尘世队员会带来大地加成 ×1.10，不要求本轮掷出同花。</p>
          <p>本层散金 {engine.gold} G，按当前倍率清层可得 {projected} G（四舍五入）。战斗中的读数只是预估，不是已经到账。</p>
          <p>每轮牌型加成在本层累积，清层后重置；已入袋的金币不再重复乘算。收益倍率不增加攻击伤害。</p>
        </section>}
        <section className="abyssa-expedition-battle-log" aria-label="战斗日志">
          <header>战斗日志 <small>BATTLE LOG</small></header>
          <ol>
            {logEntries.map((entry, index) => (
              <li key={`${entry.layer}-${entry.round}-${index}`}>
                <time>{`L${entry.layer}R${entry.round}`}</time>
                <span><b data-tone={LOG_TONE_COLOR[entry.tone] ?? "system"}>{entry.text}</b></span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {memory && <div className="battle-ledger__memory-leave"><DiceActionButton disabled={memory.busy} onClick={memory.onLeave} label="暂离回忆"/></div>}

    </div>
  );
}
