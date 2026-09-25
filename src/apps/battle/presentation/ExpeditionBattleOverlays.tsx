import { MoneyText } from "../../../shared/ui/primitives/Money";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import {
  getExpeditionStatus,
  getGreedSummary,
  type ExpeditionState
} from "../view";
import { LayerSettlementBreakdown } from "./ExpeditionBattleChrome";
import { ExpeditionSettlementLedger } from "./ExpeditionSettlementLedger";

export type ExpeditionBattleOverlaysProps = {
  engine: ExpeditionState;
  onGoDeeper: () => void;
  onLeaveExpedition: () => void;
  onSettle: () => void;
  busy?: boolean;
};

export function ExpeditionBattleOverlays({
  engine,
  onGoDeeper,
  onLeaveExpedition,
  onSettle,
  busy = false
}: ExpeditionBattleOverlaysProps) {
  const status = getExpeditionStatus(engine);
  const greed = status === "greed" ? getGreedSummary(engine) : null;

  return (
    <>
      {greed && (
        <div
          className="abyssa-expedition-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="继续深入？"
        >
          <div className="abyssa-expedition-modal" data-wide>
            <h3>继续深入？</h3>
            <div className="abyssa-expedition-modal__body">
              <p>第 {engine.layer} 层战利品已全部结算入包裹</p>
              {engine.lastLayerSettlement && (
                <LayerSettlementBreakdown settlement={engine.lastLayerSettlement} />
              )}
              <p className="abyssa-expedition-modal__highlight">
                现在离场可带回 <strong data-currency="gold"><MoneyText value={greed.bagTotal}/></strong>
              </p>
              <p>
                下一层（第 {greed.nextLayer} 层）收益倍率{" "}
                <strong>×{greed.nextLayerMultiplier}</strong>
              </p>
              {greed.downedCount > 0 && (
                <p data-tone="bad">
                  有 {greed.downedCount} 人力竭；深入后将半血重整，命数锈蚀不会恢复。
                </p>
              )}
              {greed.rustedFaceCount > 0 && (
                <p data-tone="bad">
                  全队命数骰当前共有 {greed.rustedFaceCount} 个锈面。
                </p>
              )}
              {greed.woundedCount > 0 && (
                <p data-tone="bad">另有 {greed.woundedCount} 人未满血。</p>
              )}
              <p data-tone="dim">
                {greed.crystalHint
                  ? "深度达到 3 后，离场时有机会取得远古晶石。"
                  : "继续深入会提高收益，也会出现更复杂的公开意图。"}
              </p>
            </div>
            <div className="abyssa-expedition-modal__actions">
              <DiceActionButton label="再深一层" primary disabled={busy} onClick={onGoDeeper} />
              <DiceActionButton label="带宝离场" disabled={busy} onClick={onLeaveExpedition} />
            </div>
          </div>
        </div>
      )}

      {status === "finished" && engine.result && (
        <ExpeditionSettlementLedger engine={engine} onSettle={onSettle} busy={busy} />
      )}
    </>
  );
}
