import { equipmentArt } from "../../content/presentation/equipment";
import { MoneyText } from "../../shared/ui/primitives/Money";
import { useRef } from "react";
import { Stage } from "../../shared/stage";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { SceneArrivalTitle } from "../../shared/transition";
import { GameProvider, GameGate, useGameState, useGameSession } from "../../game-client/react";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { presentShopLoot } from "../../content/presentation/shop-first-visit";
import { presentGeneratedShopLoot } from "./generated-shop-loot";
import { routeSearch } from "../../shared/routing/location";
import { ShopCounter, type ShopCounterProps } from "./ShopCounter";
import { ShopFirstVisit } from "./ShopFirstVisit";
import { supplyArt as supplyPresentation } from "../../content/presentation/supply-icons";
import { gameErrorText } from "../../game-client/game-errors";
import { useSceneTransition } from "../../shared/transition";
import { gameHref } from "../../game-client/navigation";
import { ShopVisit } from "./ShopVisit";

export function ShopPage() {
  return <GameProvider><GameGate><ShopScene /></GameGate></GameProvider>;
}
function ShopScene() {
  const session = useGameSession(), state = useGameState(), record = state.record!;
  const campaign = record.snapshot.campaign, shop = session.runtime.queries.shop(record);
  const pending = useRef(false), transition = useSceneTransition();
  const advance = async (choice: "continue" | "skip") => {
    if (!shop?.introduction || state.status !== "ready" || pending.current) return;
    pending.current = true;
    try {return await session.dispatch({type: "advance-shop-introduction", shopId: shop.shopId, step: shop.introduction.step, choice});}
    finally {pending.current = false;}
  };
  const exit = () => transition.navigate(gameHref("mansion", session.locator));
  if (shop) {
    const counter: ShopCounterProps = {
      embedded: true, funds: shop.funds, crystals: shop.crystals, busy: state.status !== "ready", available: shop.available,
      navigation: <CampaignPanel/>, scrapPrice: record.contentRef.contentVersion >= 17 ? 2 : undefined,
      initialMode: new URLSearchParams(routeSearch()).get("mode") === "appraise" ? "appraise" : "buy",
      loot: shop.loot ? {
        items: shop.loot.items.map(item => ({...(item.generatedAppraisal ? presentGeneratedShopLoot(item.generatedAppraisal) : presentShopLoot(item)), definitionId: item.definitionId, stackable: item.stackable, instanceId: item.instanceId, resultId: item.resultId,
          appraisalFee: item.appraisalFee, normalAppraisalFee: item.definition.appraisalFee,
          appraisalReason: item.appraisalFee === 0 && item.definition.appraisalFee > 0 ? "落货查验" : undefined,
          salePrice: item.salePrice ?? 0, sellable: item.salePrice !== null, appraisable: item.appraisable,
          refused: item.refused, quantity: item.quantity, bundleTotal: item.bundleTotal})),
        history: shop.loot.history.map(trade => ({id: trade.id, kind: trade.kind, gold: trade.gold, item: {...(trade.generatedAppraisal ? presentGeneratedShopLoot(trade.generatedAppraisal) : presentShopLoot(trade.item)), definitionId: trade.item.definitionId, instanceId: trade.item.instanceId, resultId: trade.item.resultId,
          appraisalFee: trade.definition.appraisalFee, salePrice: trade.item.shopVisitOffer && trade.item.definitionId === "loot.tutorial.barrier-nail" ? 400 : trade.definition.salePrice}})),
      } : undefined,
      onAppraise: async instanceId => {
        const result = await session.dispatch({type: "appraise-loot", shopId: shop.shopId, instanceId, quoteVersion: shop.loot!.quoteVersion});
        return result ? null : gameErrorText(session.getSnapshot().error?.code ?? "storage-unavailable");
      },
      onSell: async (instanceId, quantity) => {
        const result = await session.dispatch({type: "sell-loot", shopId: shop.shopId, instanceId, quoteVersion: shop.loot!.quoteVersion, ...(quantity !== undefined ? {quantity} : {})});
        return result ? null : gameErrorText(session.getSnapshot().error?.code ?? "storage-unavailable");
      },
      products: shop.products.map(item => {
        const art = item.delivery === "equipment" ? equipmentArt[item.definitionId] : supplyPresentation[item.kind];
        return {id: item.id, name: item.name, price: item.price, capacity: item.capacity, owned: item.stored, iconUrl: art.icon,
          description: art.description, delivery: item.delivery, remaining: item.remaining, purchaseMaximum: item.purchaseMaximum, preview: item.preview, isNew: item.isNew,
          category: item.delivery === "equipment" ? "equipment" : item.kind === "divination-slip" ? "exploration" : "battle"};
      }),
      onPurchase: async (id, quantity) => {
        const result = await session.dispatch(shop.day !== undefined ? {type: "purchase-product", shopId: shop.shopId, productId: id, quantity, day: shop.day, quoteVersion: shop.quoteVersion, scheduleVersion: shop.scheduleVersion!}
          : {type: "purchase-supply", shopId: shop.shopId, definitionId: id, quantity, quoteVersion: shop.quoteVersion});
        return result ? null : gameErrorText(session.getSnapshot().error?.code ?? "storage-unavailable");
      },
    };
    if (shop.firstVisit) return <ShopFirstVisit progress={shop.firstVisit.progress} shopId={shop.shopId} quoteVersion={shop.loot!.quoteVersion}
      counter={counter} onExit={exit} onCommand={async command => {
        const result = await session.dispatch(command);
        if (!result) throw Error(gameErrorText(session.getSnapshot().error?.code ?? "storage-unavailable"));
        if (result.after.schemaVersion === 4 && result.after.snapshot.campaign.shopVisit?.status === "completed") exit();
      }}/>;
    return <ShopVisit introduction={shop.introduction} busy={state.status !== "ready"} onAdvance={advance} copper={record.contentRef.contentVersion >= 17} onExit={exit}>
      <ShopCounter {...counter}/>
    </ShopVisit>;
  }
  return <Stage background="var(--abyssa-shop-backdrop)" canvasClassName="abyssa-shop-stage">
    <AbyssaProvider><SceneArrivalTitle eyebrow="WATCHER'S CLIFF · MARKET" title="守望者杂货铺" tone="gold" />
      <section className="shop-closed game-client-panel" aria-label="杂货铺">
        <h1>守望者杂货铺</h1><p>交易尚未开放</p>
        <p data-testid="shop-funds">小队资金 <MoneyText value={campaign.funds.party}/> · 远古晶石 {campaign.funds.crystals}</p>
        <p>随时可以返回洋馆，或准备下一次远征。</p>
        <button disabled>购买</button><button disabled>出售</button><button disabled>鉴定</button>
      </section><CampaignPanel />
    </AbyssaProvider>
  </Stage>;
}
