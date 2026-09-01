import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";
import { ExpeditionBagOdometer, ExpeditionOdometer } from "../ExpeditionReels";
import {
  LAYER_MULTIPLIERS,
  MAX_LAYER,
  type ExpeditionState
} from "../engine";
import { LOG_TONE_COLOR } from "./expedition-visuals";

export type ExpeditionBattleSidebarProps = {
  engine: ExpeditionState;
  layerClearPending: boolean;
  handFactor: number;
  layerFactor: number;
  projected: number;
};

export function ExpeditionBattleSidebar({
  engine,
  layerClearPending,
  handFactor,
  layerFactor,
  projected
}: ExpeditionBattleSidebarProps) {
  const logEntries = [...engine.log].slice(-40).reverse();

  return (
    <aside className="abyssa-expedition-region abyssa-expedition-sidebar" aria-label="远征账本">
      <span className="abyssa-expedition-sidebar__corners" aria-hidden="true">
        <i data-corner="tl" />
        <i data-corner="tr" />
        <i data-corner="br" />
        <i data-corner="bl" />
      </span>

      <header className="abyssa-expedition-sidebar__header">
        <span>RIFT YIELD</span>
        <small>
          {engine.location} · 第 {engine.layer}/{MAX_LAYER} 层 · 回合 {engine.round}
        </small>
      </header>

      <section
        className="abyssa-expedition-multiplier"
        data-finalizing={layerClearPending || undefined}
        aria-label={`本层散金 ${engine.gold}，牌型倍率 ${handFactor.toFixed(2)}${
          layerClearPending ? "（已计入最后回合）" : ""
        }，第 ${engine.layer} 层基础倍率 ${layerFactor}，本层预计入袋 ${projected}`}
      >
        <div className="abyssa-expedition-sidebar__section-title">
          <span>
            {layerClearPending
              ? "FINAL PAYOUT · 本回合已计入"
              : "CUMULATIVE MULTIPLIER"}
          </span>
        </div>
        <ExpeditionOdometer
          className="abyssa-expedition-multiplier__reels"
          value={handFactor * layerFactor}
          digits={2}
          decimals={2}
          prefix="×"
          label={`当前总倍率 ${(handFactor * layerFactor).toFixed(2)}`}
        />
        <div className="abyssa-expedition-multiplier__breakdown">
          <span>{layerClearPending ? "最终牌型" : "牌型"} ×{handFactor.toFixed(2)}</span>
          <i aria-hidden="true">·</i>
          <span>第 {engine.layer} 层 ×{layerFactor}</span>
        </div>
        <div className="abyssa-expedition-multiplier__amounts">
          <div data-currency="gold" data-value="base">
            <strong>{engine.gold.toLocaleString()}</strong>
          </div>
          <i aria-hidden="true">→</i>
          <div data-currency="gold" data-value="result">
            <strong>{projected.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      <span className="abyssa-expedition-sidebar__divider" aria-hidden="true"><i /></span>

      <section
        className="abyssa-expedition-purse"
        aria-label={`包裹 ${engine.bagGold} 金币，本层散金 ${engine.gold} 金币`}
      >
        <div className="abyssa-expedition-purse__heading">
          <strong>BAG &amp; MATERIALS</strong>
          <small>AUREI</small>
        </div>
        <span className="abyssa-expedition-purse__divider" aria-hidden="true" />
        <div className="abyssa-expedition-purse__amount">
          <div className="abyssa-expedition-purse__currency" data-kind="gold">
            <ExpeditionBagOdometer
              value={engine.bagGold}
              label={`包裹 ${engine.bagGold} 枚金币`}
            />
          </div>
          <span className="abyssa-expedition-purse__currency-divider" aria-hidden="true" />
          <div className="abyssa-expedition-purse__currency" data-kind="crystal">
            <CurrencyAmount
              value={engine.result?.crystal ? 1 : 0}
              currency="crystal"
              label={`${engine.result?.crystal ? 1 : 0} 枚远古晶石`}
            />
          </div>
        </div>
        <div className="abyssa-expedition-loot" role="region" aria-label="层区倍率" tabIndex={0}>
          <div className="abyssa-expedition-loot__list">
            {LAYER_MULTIPLIERS.map((layerMultiplier, index) => (
              <div
                className="abyssa-expedition-loot__item"
                data-current={index + 1 === engine.layer || undefined}
                data-passed={index + 1 < engine.layer || undefined}
                key={index}
              >
                <i
                  data-icon={index + 1 <= engine.deepestLayer ? "crystal" : "ore"}
                  aria-hidden="true"
                />
                <span>第 {index + 1} 层</span>
                <strong>×{layerMultiplier}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="abyssa-expedition-battle-log" aria-label="战斗日志">
        <header>BATTLE LOG</header>
        <ol>
          {logEntries.map((entry, index) => (
            <li key={`${entry.layer}-${entry.round}-${index}`}>
              <time>{`L${entry.layer}R${entry.round}`}</time>
              <span>
                <b data-tone={LOG_TONE_COLOR[entry.tone] ?? "system"}>{entry.text}</b>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
