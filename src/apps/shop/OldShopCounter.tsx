import { useMoney } from "../../shared/ui/primitives/Money";
import { useId, useRef, useState, type ReactNode } from "react";
import { shopDialogue, type ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { ShopAppraisalPanel } from "./ShopAppraisalPanel";
import { ShopTradePanel } from "./ShopTradePanel";
import { ShopMerchantDialogue } from "./ShopMerchantDialogue";
import { SceneFeedback, type SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import type { ShopMode, ShopLootInventory } from "./shop-loot-model";
import { ShopFrame } from "./ShopFrame";
import type { ShopSupply } from "./shop-counter-model";
import { useShopIntro } from "./useShopIntro";
import "./shop-motion.css";
import "../../shared/ui/motion/page-board.css";

export type ShopCounterProps = {
  products: ShopSupply[];
  loot?: ShopLootInventory;
  initialMode?: ShopMode;
  onAppraise?: (id: string) => Promise<string | null>;
  onSell?: (id: string) => Promise<string | null>;
  funds: number;
  crystals: number;
  busy: boolean;
  available: boolean;
  onPurchase: (id: string, quantity: number) => Promise<string | null>;
  navigation?: ReactNode;
  embedded?: boolean;
};
/** Normal trades share a counter; appraisal owns its authored reveal and dialogue. */
export function OldShopCounter({products, funds, crystals, busy, available, onPurchase, loot, initialMode = "buy", onAppraise, onSell, navigation, embedded}: ShopCounterProps) {
  const intro = useShopIntro(), uid = useId();
  const hasLoot = !!loot && !!onAppraise && !!onSell;
  const money = useMoney();
  const [mode, setMode] = useState<ShopMode>(hasLoot ? initialMode : "buy");
  const [dialogueHost, setDialogueHost] = useState<HTMLDivElement | null>(null);
  const [portraitHost, setPortraitHost] = useState<HTMLDivElement | null>(null);
  const [tradePending, setTradePending] = useState(false);
  const [tradeLine, setTradeLine] = useState<{line: ShopDialogueLine; turn: number}>();
  const [feedback, setFeedback] = useState<SceneFeedbackEntry[]>([]);
  const feedbackSerial = useRef(0);
  const working = busy || tradePending;
  return <ShopFrame className="shop-counter-page" intro={intro} navigation={navigation} embedded={embedded} feedback={
    <SceneFeedback className="shop-counter-feedback" entries={feedback} edge="right" paused={intro.state !== "ready"}
      onDismiss={id => setFeedback(current => current.filter(entry => entry.id !== id))}/>
  }>
    <div className="shop-counter" ref={intro.ref} data-mode={mode}>
      <section className="shop-counter__main" aria-label="交易区">
        <header className="shop-counter__heading">
          <div className="shop-counter__balances" role="group" aria-label="小队资产">
            <div className="shop-counter__purse"><span>小队资金</span><CurrencyAmount value={funds} currency="gold" label="小队资金余额" /></div>
            <div className="shop-counter__purse"><span>远古晶石</span><CurrencyAmount value={crystals} currency="crystal" label="远古晶石余额" /></div>
          </div>
        </header>
        <div className="shop-counter__body">
          <div className="shop-counter__modes" role="tablist" aria-label="商店模式">
            {([["buy", "购买"], ["sell", "出售"], ["appraise", "鉴定"]] as const).map(([entry, label]) =>
              <span className="shop-counter__mode" data-unavailable={entry !== "buy" && !hasLoot || undefined} key={entry}>
                <button className="shop-counter__tab" id={`${uid}-${entry}-tab`} type="button" role="tab" aria-selected={mode === entry}
                  aria-controls={`${uid}-${entry}-panel`} aria-label={label} tabIndex={entry !== "buy" && !hasLoot ? -1 : 0} disabled={working || entry !== "buy" && !hasLoot}
                  aria-describedby={entry !== "buy" && !hasLoot ? `${uid}-${entry}-unavailable` : undefined}
                  title={entry !== "buy" && !hasLoot ? `${label}暂未开放` : undefined}
                  onClick={() => {setMode(entry); setTradeLine(undefined);}}><span>{label}{entry === "appraise" && !!loot?.items.some(i => !i.resultId) && <small> · {loot.items.filter(i => !i.resultId).length}</small>}</span></button>
                {entry !== "buy" && !hasLoot && <span id={`${uid}-${entry}-unavailable`} hidden>暂未开放</span>}
              </span>
            )}
          </div>
        {mode === "appraise" && hasLoot ? <ShopAppraisalPanel loot={loot!} funds={funds} busy={busy} available={available}
          panelId={`${uid}-appraise-panel`} tabId={`${uid}-appraise-tab`} onAppraise={onAppraise!}
          dialogueHost={dialogueHost} portraitHost={portraitHost} dialogueReady={intro.state === "ready"}
          onMode={next => {setMode(next); setTradeLine(undefined);}} onPending={setTradePending}/>
        : <ShopTradePanel key={mode} mode={mode === "sell" && hasLoot ? "sell" : "buy"}
          products={mode === "sell" && hasLoot ? loot!.items.filter(i => i.resultId).map(i => ({
            id: i.instanceId, name: i.name, description: i.description, iconUrl: i.iconUrl, owned: 1, price: i.salePrice, successLine: i.sold,
          })) : products}
          funds={funds} busy={busy} available={available} panelId={`${uid}-${mode}-panel`} tabId={`${uid}-${mode}-tab`}
          confirmedSales={loot?.history.filter(t => t.kind === "sell").map(t => t.item.instanceId)}
          onTrade={mode === "sell" && hasLoot ? id => onSell!(id) : onPurchase} onPending={setTradePending}
          onSuccess={({item, quantity, total, recovered}) => {
            setTradeLine(previous => ({line: item.successLine ?? shopDialogue.purchased, turn: (previous?.turn ?? 0) + 1}));
            const id = `shop-trade-${++feedbackSerial.current}`;
            const entry: SceneFeedbackEntry = mode === "sell"
              ? {id, kind: "notice", tone: "success", message: recovered ? `出售已确认，收入 ${money.format(total)}。` : `已出售${item.name}，收入 ${money.format(total)}。`}
              : {id, kind: "reward", reward: {id: item.id, kind: "item", name: item.name, icon: item.iconUrl, quantity}};
            setFeedback(current => [...current, entry]);
          }}
          emptyAction={mode === "sell" && loot?.items.some(i => !i.resultId) ? <>
            <p>带回的物品需先鉴定，才能报价出售。</p>
            <RpgNotchedPillButton className="shop-counter__purchase" label="去鉴定" disabled={working} onClick={() => setMode("appraise")}/>
          </> : undefined}/>}
        </div>
      </section>
      <aside className="shop-counter__merchant" aria-label="店主缇比">
        <RpgFrame className="shop-counter__portrait-frame" padding="none">
          <div className="shop-counter__scenery" aria-hidden="true" />
          <div className="shop-counter__portrait" ref={setPortraitHost}/>
          <div className="shop-counter__portrait-shade" aria-hidden="true" />
        </RpgFrame>
        <Nameplate name="缇比·奥雷利亚" secondaryName="TIBBY AURELIA" />
        <div className="shop-counter__dialogue-host" ref={setDialogueHost}>
          {mode !== "appraise" && <ShopMerchantDialogue line={tradeLine?.line ?? shopDialogue[mode === "sell" ? "sell" : "buy"]}
            lineKey={`${mode}:${tradeLine?.turn ?? "welcome"}`} ready={intro.state === "ready"} portraitHost={portraitHost}/>}
        </div>
      </aside>
    </div>
  </ShopFrame>;
}
