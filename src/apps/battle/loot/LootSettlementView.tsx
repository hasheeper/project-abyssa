import "./loot.css";
import { useEffect, useRef, useState, type Ref } from "react";
import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";
import { useMoney } from "../../../shared/ui/primitives/Money";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { UiModal } from "../../../shared/ui/motion/UiModal";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import { LootRewards } from "./LootPocketView";
import type { LootItemView } from "./loot-item";
import { hasLoot, itemCount, type LootOutcome, type LootPocket, type LootSettlement } from "./loot-types";
import "./loot-settlement.css";

const OUTCOMES: Record<LootOutcome, { title: string; english: string; rule: string }> = {
  cleared: { title: "远征完成", english: "EXPEDITION COMPLETE", rule: "所有收获，悉数带回。" },
  retreated: { title: "撤离归来", english: "RETURN FROM EXPEDITION", rule: "已入袋全部带回，本层收获遗失。" },
  failed: { title: "远征失利", english: "EXPEDITION LOST", rule: "本层收获遗失，已入袋保留一半。" },
};
const REVEAL_MS = 1250;

export interface LootSettlementContext {
  /** Supplied by the expedition adapter, never inferred from its visual skin. */
  locationName: string;
  progressLabel?: string;
}

/** Display-only count-up; claiming remains the caller's explicit transaction. */
function SettlementFunds({ value, complete }: { value: number; complete: boolean }) {
  const money = useMoney();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (complete) return;
    setShown(0);
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started - 220) / 650));
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, complete]);
  return <div className="loot-settlement__money" role="group" aria-label={`带回资金 ${money.format(value)}`}>
    <span>带回资金</span>
    <div aria-hidden="true"><CurrencyAmount value={complete ? value : shown} currency="lira"/></div>
  </div>;
}

export function LootSettlementView({ receipt, catalog, context, onConfirm, busy = false, error, confirmLabel = "返回", onReview, bonusFunds = 0, supplies, pendingReward, confirmRef }: {
  receipt: LootSettlement; catalog: Record<string, LootItemView>; context: LootSettlementContext; onConfirm: () => void;
  busy?: boolean; error?: string; confirmLabel?: string; onReview?: () => void; bonusFunds?: number; supplies?: LootPocket;
  /** Included in the displayed total, paid together with the receipt on confirmation. */
  pendingReward?: {label: string; copper: number}; confirmRef?: Ref<HTMLButtonElement>;
}) {
  const { reduced } = useUiMotion();
  const [finishedFor, setFinishedFor] = useState<LootSettlement | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const complete = reduced || finishedFor === receipt;
  const copy = OUTCOMES[receipt.outcome];
  const losses = [{ label: "未入袋遗失", pocket: receipt.lostUnbanked }, { label: "入袋折损", pocket: receipt.lostBanked }].filter(group => hasLoot(group.pocket));
  useEffect(() => {
    if (complete) return;
    const timer = setTimeout(() => setFinishedFor(receipt), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [complete, receipt]);
  // One action completes the reveal. The same click/keypress must never also leave.
  const finishReveal = () => { setFinishedFor(receipt); surface.current?.focus({ preventScroll: true }); };
  return <UiModal open title={copy.title} motionPreset="surface" dismissOnBackdrop={false} dismissOnEscape={false}
    onClose={onConfirm} className="loot-settlement-modal" panelClassName="loot-settlement-panel">
    <div ref={surface} tabIndex={-1} className="loot-settlement" data-result={receipt.outcome} data-size={receipt.returned.items.length > 6 ? "many" : "few"} data-reveal={complete ? "complete" : "playing"}
      onClickCapture={event => { if (!complete) { event.preventDefault(); event.stopPropagation(); finishReveal(); } }}
      onKeyDownCapture={event => { if (!complete && ["Enter", " ", "Escape"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); finishReveal(); } }}>
      <header className="loot-settlement__heading">
        <p>{context.locationName}{context.progressLabel && <><span>·</span>{context.progressLabel}</>}</p>
        <h2>{copy.title}</h2>
        <small>{copy.english}</small>
        <div className="loot-settlement__rule" aria-hidden="true"><i/><b/><i/></div>
      </header>
      <SettlementFunds value={receipt.returned.copper + (pendingReward?.copper ?? 0)} complete={complete}/>
      <div className="loot-settlement__contents" role="region" aria-label="远征收获明细" tabIndex={0}>
        {pendingReward && <p className="loot-settlement__bonus">{pendingReward.label} <CurrencyAmount value={pendingReward.copper}/> <small>已计入上方总额，确认后领取</small></p>}
        {bonusFunds > 0 && <p className="loot-settlement__bonus">首次接管奖励 <CurrencyAmount value={bonusFunds}/> <small>已另行入账</small></p>}
        <section className="loot-settlement__manifest" aria-label="带回收获">
          <header><i aria-hidden="true"/><h3>此行收获</h3><span>{itemCount(receipt.returned)} <small>件</small></span><i aria-hidden="true"/></header>
          <LootRewards pocket={receipt.returned} catalog={catalog} label="带回道具" scrollable={false}/>
        </section>
        {!!receipt.questReturned?.items.length && <section className="loot-settlement__manifest" aria-label="带回委托物品">
          <header><i/><h3>委托物品 · 待交付</h3><i/></header>
          <LootRewards pocket={receipt.questReturned} catalog={catalog} label="带回委托物品" scrollable={false}/>
          <p>返回洋馆后交给委托人。</p>
        </section>}
        {!!receipt.questLost?.items.length && <section className="loot-settlement__loss" aria-label="遗失委托物品"><h3>委托物品遗失</h3><p>{receipt.questLost.items.map(i => catalog[i.itemId]?.name ?? i.itemId).join("、")}未能带回。向委托人反馈后可再次出征。</p></section>}
        {!!supplies?.items.length && <section className="loot-settlement__manifest loot-settlement__supplies" aria-label="剩余战备">
          <header><i/><h3>剩余战备</h3><i/></header>
          <LootRewards pocket={supplies} catalog={catalog} label="带回战备" scrollable={false}/>
        </section>}
        {losses.length > 0 && <section className="loot-settlement__loss" aria-label="遗失记录">
          {losses.map(group => <section className="loot-settlement__loss-group" key={group.label}>
            <header><strong>{group.label}</strong><CurrencyAmount value={group.pocket.copper} currency="lira"/></header>
            {group.pocket.items.length > 0 && <p>{group.pocket.items.map(stack => `${catalog[stack.itemId]?.name ?? stack.itemId} ×${stack.quantity}`).join("　·　")}</p>}
          </section>)}
        </section>}
      </div>
      <footer className="loot-settlement__footer">
        <p>{pendingReward ? "确认后，收获与剩余战备一并入账。" : copy.rule}</p>
        {error && <p role="alert">{error}</p>}
        <div className="loot-settlement__return"><DiceActionButton ref={confirmRef} label={busy ? "正在入账" : error ? "重试结算" : confirmLabel} primary disabled={busy} onClick={onConfirm}/>
          {onReview && <DiceActionButton label="回顾落幕" disabled={busy} onClick={onReview}/>}</div>
      </footer>
    </div>
  </UiModal>;
}
