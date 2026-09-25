import "./loot.css";
import type { LootItemView } from "./loot-item";
import { LootPocketView } from "./LootPocketView";
import type { LootLedgerView } from "./loot-types";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { LOG_TONE_COLOR } from "../presentation/expedition-visuals";
import { usePlayerName } from "../../../shared/domain/PlayerIdentity";
import { resolvePlayerText } from "../../../shared/domain/player-identity";

export function LootLedger({ run, catalog, log, onClose, tutorial = false }: { run: LootLedgerView; catalog: Record<string, LootItemView>; log: DemoJourneyView["log"]; onClose: () => void; tutorial?: boolean }) {
  const playerName = usePlayerName();
  return <div className="abyssa-expedition-region abyssa-expedition-sidebar battle-ledger loot-ledger" aria-label="远征 LOG">
    <span className="abyssa-expedition-sidebar__corners" aria-hidden="true"><i data-corner="tl"/><i data-corner="tr"/><i data-corner="br"/><i data-corner="bl"/></span>
    <header className="abyssa-expedition-sidebar__header"><div className="battle-ledger__heading"><span>远征记录</span><small>第 {run.layer} 层 · LOG</small></div><button className="battle-ledger-drawer__close" onClick={onClose} aria-label="收起账本">收起</button></header>
    <div className="loot-ledger__bags">
      <LootPocketView title="未入袋" status="unbanked" pocket={run.unbanked} catalog={catalog}/>
      <LootPocketView title="已入袋" status="banked" pocket={run.banked} catalog={catalog} hint={tutorial ? "回馆统一领取" : undefined}/>
      {run.questItems && <LootPocketView title="委托物品" status="unbanked" pocket={run.questItems} catalog={catalog} hint="安全返回后交付 · 团灭遗失"/>}
    </div>
    <section className="abyssa-expedition-battle-log loot-ledger__log" aria-label="战斗日志"><header>战斗日志 <small>BATTLE LOG</small></header><ol>{[...log].slice(-40).reverse().map((entry, index) => <li key={`${entry.layer}:${entry.round}:${index}`}><time>L{entry.layer}·R{entry.round}</time><span><b data-tone={LOG_TONE_COLOR[entry.tone] ?? "system"}>{resolvePlayerText(entry.text, playerName)}</b></span></li>)}</ol></section>
    <footer className="loot-ledger__rule">{tutorial ? "教学关失败可重试本场，恢复对应检查点；收获在回馆后统一领取。" : "本层未入袋收获在撤退或失败时遗失；失败另折损一半已入袋收获。"}</footer>
  </div>;
}
