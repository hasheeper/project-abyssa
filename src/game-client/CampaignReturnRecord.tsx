import { MoneyText, useMoney } from "../shared/ui/primitives/Money";
import { manorIcon } from "../shared/ui/patterns/manor-icons";
import type { ReactNode } from "react";
import { ManorGlyph } from "../shared/ui/patterns/ManorSection";
import { JOURNAL_GLYPHS } from "./journal-format";

interface ReturnSettlement {
  deepestLayer: number;
  totalGold: number;
  lostLooseGold: number;
  lostBankedGold: number;
}
export interface JournalCredit { id: string; label: string; gold: number }

function GoldAmount({value}: {value: number}) {
  const money = useMoney();
  return <><span>{money.copper(value).toLocaleString("en-US")}</span>{" "}<small>G</small></>;
}

/** 归来记事标题行右端的抵达层数。 */
export function ReturnDepth({layer}: {layer: number}) {
  return <p className="campaign-journal__depth">最深抵达 <strong>第 {layer} 层</strong></p>;
}

/** Read-only layout: every credit is supplied by the already-committed record.
 *  标题与「已结算」状态由日志头部统一绘制,这里只排归来记述与入账单。 */
export function CampaignReturnRecord({settlement, credits, children}: {
  settlement: ReturnSettlement; credits: JournalCredit[]; children: ReactNode;
}) {
  const total = credits.reduce((sum, credit) => sum + credit.gold, settlement.totalGold);
  return <section className="campaign-journal__return" aria-label="远征归来">
    <section className="campaign-journal__return-notes">{children}
      {(settlement.lostLooseGold > 0 || settlement.lostBankedGold > 0) && <p className="campaign-journal__loss">途中损失 · 散金 <MoneyText value={settlement.lostLooseGold}/> / 入袋 <MoneyText value={settlement.lostBankedGold}/></p>}
    </section>
    <aside className="campaign-journal__settlement" aria-label="本次入账">
      <div className="campaign-journal__settlement-heading"><ManorGlyph src={manorIcon(JOURNAL_GLYPHS.receipt)}/><h4>本次入账</h4></div>
      <dl className="campaign-journal__stats">
        <div><dt>远征收益</dt><dd className="campaign-journal__amount" data-testid="journal-expedition-gold"><GoldAmount value={settlement.totalGold}/></dd></div>
        {credits.map(credit => <div key={credit.id}><dt>{credit.label}</dt><dd className="campaign-journal__amount" data-testid={`journal-credit-${credit.id}`}><GoldAmount value={credit.gold}/></dd></div>)}
      </dl>
      <div className="campaign-journal__total"><span>合计入账</span><strong className="campaign-journal__amount" data-testid="journal-total-gold"><GoldAmount value={total}/></strong></div>
    </aside>
  </section>;
}
