import { Stage } from "../../shared/stage";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { SceneArrivalTitle } from "../../shared/transition";
import { GameProvider, GameGate, useGameState, useGameSession } from "../../game-client/react";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { ShopCounter } from "./ShopCounter";
import { supplyArt as supplyPresentation } from "../../content/presentation/supply-icons";
import { gameErrorText } from "../../game-client/game-errors";

export function ShopPage() {
  return <GameProvider><GameGate><ShopScene /></GameGate></GameProvider>;
}
function ShopScene() {
  const session = useGameSession(), state = useGameState(), record = state.record!;
  const campaign = record.snapshot.campaign, shop = session.runtime.queries.shop(record);
  if (shop) return <><ShopCounter funds={shop.funds} crystals={shop.crystals} busy={state.status !== "ready"} available={shop.available}
    products={shop.products.map(item => ({id:item.id,name:item.name,price:item.price,capacity:item.capacity,owned:item.stored,iconUrl:supplyPresentation[item.kind].icon,
      description:supplyPresentation[item.kind].description}))}
    onPurchase={async (definitionId,quantity) => {
      const result = await session.dispatch({type:"purchase-supply",shopId:shop.shopId,definitionId,quantity,quoteVersion:shop.quoteVersion});
      return result ? null : gameErrorText(session.getSnapshot().error?.code ?? "storage-unavailable");
    }}
  /><CampaignPanel/></>;
  return <Stage background="var(--abyssa-shop-backdrop)" canvasClassName="abyssa-shop-stage">
    <AbyssaProvider><SceneArrivalTitle eyebrow="WATCHER'S CLIFF · MARKET" title="守望者杂货铺" tone="gold" />
      <section className="shop-closed game-client-panel" aria-label="杂货铺">
        <h1>守望者杂货铺</h1><p>交易尚未开放</p>
        <p data-testid="shop-funds">小队金币 {campaign.funds.party} · 远古晶石 {campaign.funds.crystals}</p>
        <p>随时可以返回洋馆，或准备下一次远征。</p>
        <button disabled>购买</button><button disabled>出售</button><button disabled>鉴定</button>
      </section><CampaignPanel />
    </AbyssaProvider>
  </Stage>;
}
