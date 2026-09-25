import type { CSSProperties } from "react";
import { MoneyText, useMoney } from "../../../shared/ui/primitives/Money";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { usePlayerName } from "../../../shared/domain/PlayerIdentity";
import { MAX_HP, MAX_LAYER, type ExpeditionState } from "../view";
import { LayerSettlementBreakdown } from "./ExpeditionBattleChrome";
import { partyVisual } from "./expedition-visuals";

type Props = {
  engine: ExpeditionState;
  onSettle: () => void;
  busy?: boolean;
};

const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function ExpeditionSettlementLedger({ engine, onSettle, busy = false }: Props) {
  const money = useMoney();
  const playerName = usePlayerName();
  const result = engine.result!;
  const wiped = result.wiped;
  const lost = Math.max(0, result.baseGold - result.totalGold);
  const notes = engine.log.slice(-3);

  return (
    <div className="abyssa-expedition-overlay" role="dialog" aria-modal="true" aria-label="远征结算">
      <div className="abyssa-expedition-modal abyssa-settle" data-wide data-outcome={wiped ? "wipe" : "return"}>
        <header className="abyssa-settle__head">
          <small>远征账簿 · EXPEDITION LEDGER</small>
          <h3>{wiped ? "强行撤离" : "远征结束"}</h3>
          <span className="abyssa-settle__seal" aria-hidden="true">
            <b>{wiped ? "撤" : "归"}</b>
            <small>{wiped ? "WITHDRAWN" : "RETURNED"}</small>
          </span>
        </header>

        <ol className="abyssa-settle__depth" aria-label={`最深抵达第 ${result.deepestLayer} 层`}>
          {Array.from({ length: MAX_LAYER }, (_, i) => i + 1).map((layer) => (
            <li
              key={layer}
              style={vars({ "--i": layer - 1 })}
              data-state={
                layer === result.deepestLayer ? (wiped ? "fell" : "left")
                  : layer < result.deepestLayer ? "passed" : undefined
              }
            >
              L{layer}
            </li>
          ))}
        </ol>

        <div className="abyssa-settle__purse">
          <p className="abyssa-expedition-modal__total" data-currency="gold">
            ＋<MoneyText value={result.totalGold} />
          </p>
        </div>

        <dl className="abyssa-settle__lines">
          {wiped ? (
            <>
              <div><dt>包裹原有</dt><dd data-currency="gold"><MoneyText value={result.baseGold} /></dd></div>
              <div data-tone="bad"><dt>团灭损失一半</dt><dd>−{money.format(lost)}</dd></div>
              <div data-tone="bad"><dt>当前层收益</dt><dd>全部丢失</dd></div>
            </>
          ) : (
            <>
              <div><dt>包裹合计（各层独立结算之和）</dt><dd data-currency="gold"><MoneyText value={result.baseGold} /></dd></div>
              {result.multiplier !== 1 && <div><dt>离场倍率</dt><dd>×{result.multiplier}</dd></div>}
              {result.crystal && <div><dt>额外带回</dt><dd>远古晶石 ×1</dd></div>}
            </>
          )}
        </dl>

        {!wiped && engine.lastLayerSettlement && (
          <LayerSettlementBreakdown settlement={engine.lastLayerSettlement} />
        )}

        <ul className="abyssa-settle__party" aria-label="出征队伍">
          {engine.party.map((member, index) => {
            const visual = partyVisual(member.id, playerName);
            return (
              <li
                key={member.id}
                data-downed={member.downed || undefined}
                style={vars({ "--i": index, "--acc": visual.themeColor })}
                aria-label={`${visual.name} ${member.downed ? "力竭" : `生命 ${member.hp}/${MAX_HP}`}`}
              >
                <img src={visual.portrait} alt="" />
                <b>{visual.name}</b>
                <span aria-hidden="true">
                  {Array.from({ length: MAX_HP }, (_, i) => <i key={i} data-full={i < member.hp || undefined} />)}
                </span>
              </li>
            );
          })}
        </ul>

        {notes.length > 0 && (
          <section className="abyssa-expedition-modal__facts abyssa-settle__notes">
            <header>远征记事 · FIELD NOTES</header>
            <ul>
              {notes.map((entry, index) => (
                <li key={index}><small>L{entry.layer}·R{entry.round}</small>{entry.text}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="abyssa-expedition-modal__actions">
          <DiceActionButton label="结算并返回洋馆" primary disabled={busy} onClick={onSettle} />
        </div>
      </div>
    </div>
  );
}
