import { useRef, useState, type CSSProperties, type ComponentProps, type ReactNode } from "react";
import lantern from "./assets/icons/lantern.svg";
import purse from "./assets/icons/purse.svg";
import coins from "./assets/icons/coins.svg";
import magnifier from "./assets/icons/magnifier.svg";
import { type ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import { Stage } from "../../shared/stage";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { SceneFeedback, type SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import { LoadingPlaque } from "../../shared/transition/LoadingPlaque";
import type { PageUiIntroState } from "../../shared/transition/usePageUiIntro";
import { shopEntrance, type ShopEntranceProfile } from "./entrance";
import { NewShopIntro, useNewShopPreparation } from "./useNewShopIntro";
import { MerchantWindow } from "./MerchantWindow";
import { CounterForeground } from "./CounterForeground";
import { NavigationChrome, NavigationPlate } from "./NavigationChrome";
import { ShopSignHangers } from "./ShopSignHangers";
import { StockList, type StockItem } from "./StockList";
import { StockCategories } from "./StockCategories";
import { type StockFilter } from "./stock-categories";
import type { Mode } from "./stock-model";

const modes = [{id: "buy", name: "购买", icon: purse}, {id: "sell", name: "出售", icon: coins}, {id: "appraise", name: "鉴定", icon: magnifier}] as const;

function Symbol({src, className = ""}: {src: string; className?: string}) {
  return <span className={`new-shop__symbol ${className}`} style={{"--symbol": `url("${src}")`} as CSSProperties} aria-hidden="true" />;
}
function Sign() {
  return <div className="new-shop__sign"><RpgHeader label="" aria-hidden="true" /><ShopSignHangers /><h1 id="new-shop-title">WARDEN SHOP</h1></div>;
}

type ReadingAction = {label: string; ariaLabel: string; disabled: boolean; onAction: () => void};

export type ShopSurfaceProps = {
  overlay?: ReactNode;
  embedded?: boolean; entranceProfile?: ShopEntranceProfile; entranceCycle?: number;
  mode: Mode; category: StockFilter; categories: ComponentProps<typeof StockCategories>["categories"];
  rows: StockItem[]; selected?: StockItem; funds: number; crystals: number; pendingCount: number;
  busy: boolean; interactionDisabled?: boolean; disabledModes?: Mode[];
  switchMode: (mode: Mode) => void; changeCategory: (category: StockFilter) => void; select: (item: StockItem) => void;
  speech: {line: ShopDialogueLine; turn: number}; onContinue?: () => void; continueLabel?: string;
  detail: (readingAction?: ReadingAction) => ReactNode; history?: ReactNode; footer?: ReactNode; navigation?: ReactNode;
  feedback: SceneFeedbackEntry[]; onDismiss: (id: string) => void;
};

/** Shared production composition. Data and commands belong to the caller. */
export function ShopSurface({embedded, entranceProfile = "standard", entranceCycle = 0, mode, category, categories,
  rows, selected, funds, crystals, pendingCount, busy, interactionDisabled, disabledModes = [],
  switchMode, changeCategory, select, speech, onContinue, continueLabel, detail, history, footer, navigation, feedback, onDismiss, overlay}: ShopSurfaceProps) {
  const preparation = useNewShopPreparation();
  const introRoot = useRef<HTMLElement>(null);
  const [introState, setIntroState] = useState<PageUiIntroState>("waiting");
  const [completedTurn, setCompletedTurn] = useState<number | null>(null);
  const typing = completedTurn !== speech.turn;
  const readingDisabled = introState !== "ready" || !!interactionDisabled;
  function advanceSpeech() {
    if (readingDisabled) return;
    if (typing) setCompletedTurn(speech.turn);
    else onContinue?.();
  }
  const readingAction = onContinue ? {
    label: typing ? "继续" : continueLabel ?? "继续",
    ariaLabel: typing ? "显示完整台词" : continueLabel ?? "继续鉴定",
    disabled: readingDisabled, onAction: advanceSpeech,
  } : undefined;
  const scene = <AbyssaProvider className="new-shop"
    data-shop-intro={introState} data-entry-profile={entranceProfile} style={shopEntrance(entranceProfile).style}>
    <NewShopIntro key={entranceCycle} root={introRoot} ready={preparation.ready} profile={entranceProfile} onState={setIntroState} />
    {preparation.status === "loaded" && <>
    <div className="new-shop__room" aria-hidden="true" />
    <div className="new-shop__room-shade" aria-hidden="true" />
    <nav className="new-shop__navigation" aria-label="商店功能" inert={!preparation.ready}>
      <NavigationChrome part="body" />
      <div className="new-shop__banner"><NavigationChrome part="banner" /><Symbol src={lantern} /><span>SHOP</span></div>
      <div className="new-shop__modes" role="tablist" aria-label="商店模式" aria-orientation="vertical">
        {modes.map((item, index) => <button key={item.id} type="button" role="tab" id={`new-shop-${item.id}-tab`} aria-label={item.name}
          style={{"--entrance-index": index} as CSSProperties}
          aria-selected={mode === item.id} aria-controls="new-shop-panel" disabled={busy || disabledModes.includes(item.id)} title={disabledModes.includes(item.id) ? `${item.name}暂未开放` : undefined} tabIndex={mode === item.id ? 0 : -1}
          onKeyDown={event => {
            const next = event.key === "ArrowDown" ? (index + 1) % modes.length : event.key === "ArrowUp" ? (index + modes.length - 1) % modes.length : null;
            if (next === null || disabledModes.includes(modes[next].id)) return;
            event.preventDefault(); switchMode(modes[next].id); document.getElementById(`new-shop-${modes[next].id}-tab`)?.focus();
          }} onClick={() => switchMode(item.id)}>
          <NavigationPlate />
          <Symbol src={item.icon} className={`new-shop__mode-icon new-shop__mode-icon--${item.id}`} />
          <span className="new-shop__mode-label">{item.name}</span>{item.id === "appraise" && pendingCount > 0 && <small aria-label={`${pendingCount} 件待鉴定`}>{pendingCount}</small>}
        </button>)}
      </div>
      {footer}
    </nav>
    <div className="new-shop__counter-plane">
    <header className="new-shop__header" aria-labelledby="new-shop-title" inert={!preparation.ready}>
      <div className="new-shop__header-title"><Sign /></div>
      <div className="new-shop__balances" role="group" aria-label="小队资产">
        <div><CurrencyAmount value={funds} currency="gold" label="小队资金余额" /><span className="new-shop__balance-label">小队资金</span></div>
        <div><CurrencyAmount value={crystals} currency="crystal" label="远古晶石余额" /><span className="new-shop__balance-label">远古晶石</span></div>
      </div>
      <StockCategories categories={categories} selected={category} busy={busy} onChange={changeCategory} />
    </header>
    <main ref={introRoot} id="new-shop-panel" className="new-shop__ledger" role="tabpanel" aria-labelledby={`new-shop-${mode}-tab`} inert={!preparation.ready}>
      <RpgFrame className="new-shop-stock-shell" padding="none" watermark={false}>
        <div id="new-shop-category-panel" className="new-shop__category-panel" role="tabpanel" aria-labelledby={`new-shop-category-${category}`}>
          <StockList key={mode} items={rows} selectedId={selected?.id} mode={mode} funds={funds} busy={busy}
            accessory={history} pendingCount={pendingCount} onSelect={select} onAppraise={() => switchMode("appraise")} />
        </div>
      </RpgFrame>
      {detail(readingAction)}
    </main>
    <MerchantWindow ready={introState === "ready"} line={speech.line} turn={speech.turn} typing={typing}
      onTypingEnd={() => setCompletedTurn(speech.turn)} onAdvance={advanceSpeech} />
    </div>
    <CounterForeground ready={introState === "ready"} />
    <SceneFeedback dock className="new-shop__feedback" entries={feedback} paused={introState !== "ready"} edge="right" onDismiss={onDismiss} />
    {navigation}
    {overlay}
    </>}
    {preparation.showCover && <div className="new-shop__preparing" data-status={preparation.status}>
      <LoadingPlaque className="new-shop__loading-plaque" role={preparation.status === "error" ? "alert" : "status"}>
        <p>{preparation.status === "error" ? "店铺暂时未能打开。" : "正在整理柜台"}</p>
        {preparation.status === "error" && <button onClick={preparation.retry}>重新加载</button>}
      </LoadingPlaque>
    </div>}
  </AbyssaProvider>;
  return embedded ? scene : <Stage canvasClassName="new-shop-stage">{scene}</Stage>;
}
