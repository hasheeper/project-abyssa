import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ShopFirstVisit } from "./ShopFirstVisit";
import type { ShopCounterProps } from "./ShopCounter";
import { presentShopLoot } from "../../content/presentation/shop-first-visit";
import type { ShopVisitProgress } from "../../game-core/contracts/shop-visit";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { SceneTransitionProvider } from "../../shared/transition";

vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
vi.mock("../../shared/presentation/adv/SceneSequence", async importOriginal => ({...await importOriginal<typeof import("../../shared/presentation/adv/SceneSequence")>(), SceneSequence: ({frame}: {frame: {content: ReactNode}}) => frame.content, useSceneSequenceBusy: () => false}));
afterEach(cleanup);
const progress = (phase: ShopVisitProgress["phase"], choice: "A" | "B" | null = null): ShopVisitProgress => ({version: 1, status: "active", phase, step: 0, choice, items: {coins: "coins", nail: "nail", token: "token", bread: "bread"}});
const items = [
  {instanceId: "coins", definitionId: "loot.tutorial.cross-coins", quantity: 11, resultId: "known.cross-coins", salePrice: 1800, sampled: true as const},
  {instanceId: "nail", definitionId: "loot.tutorial.barrier-nail", quantity: 1, resultId: "appraisal.barrier-nail", salePrice: 400},
  {instanceId: "token", definitionId: "loot.tutorial.candle-token", quantity: 1, resultId: "known.candle-token", salePrice: 2},
].map(item => ({...presentShopLoot({...item, shopVisitOffer: 1}), ...item, appraisalFee: 0, normalAppraisalFee: 300}));
const products = ["ward", "holy-water", "divination-slip", "maintenance-kit", "lucky-charm", "potion"].map((id, i) => ({id: `product.item.${id}`, name: ["护符", "圣水", "卦签", "保养工具", "幸运符", "药水"][i], price: [400, 300, 300, 600, 800, 260][i], iconUrl: "/test.svg", description: "补给", owned: 0, capacity: 4}));
const counter = (): ShopCounterProps => ({funds: 6000, crystals: 0, busy: false, available: true, products, loot: {items, history: []},
  onPurchase: vi.fn(async () => null), onAppraise: vi.fn(async () => null), onSell: vi.fn(async () => null), scrapPrice: 2});
function scene(p: ShopVisitProgress, props = counter(), onCommand = vi.fn(async () => {})) {
  render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopFirstVisit progress={p} shopId="shop.mansion" quoteVersion={2} counter={props} onCommand={onCommand} onExit={() => {}}/></SceneTransitionProvider></UiMotionProvider>);
  return {onCommand, props};
}

it("shows the exact unknown name, crossed-out fee and inspection reason at the appraisal gate", async () => {
  const props = counter(); props.loot = {items: items.map(item => item.instanceId === "nail" ? {...item, resultId: null} : item), history: []};
  const {onCommand} = scene(progress("appraise"), props);
  expect(await screen.findByRole("heading", {name: "锈蚀黑钉"})).toBeInTheDocument();
  expect(screen.getByLabelText("常规鉴定费 300 G").tagName).toBe("DEL");
  expect(document.querySelector(".new-shop-detail__total")).toHaveTextContent(/0\s*G落货查验/);
  expect(screen.getByText("未鉴定物按 2 G 收购。")).toBeInTheDocument();
  expect(screen.getByRole("tab", {name: "购买"})).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole("button", {name: /^鉴定$/})));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({type: "appraise-shop-visit", shopId: "shop.mansion", quoteVersion: 2});
});

it.each(["A", "B"] as const)("preselects the branch %s basket without charging the bundled token twice", async choice => {
  const {onCommand} = scene(progress("sell", choice));
  const basket = await screen.findByRole("region", {name: "确认出售清单"});
  expect(within(basket).getAllByRole("listitem")).toHaveLength(choice === "A" ? 3 : 2);
  expect(basket).toHaveTextContent("旧十字币 ×11");
  expect(basket).toHaveTextContent(choice === "A" ? /2,202\s*G/ : /1,802\s*G/);
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "确认卖出"})));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({type: "sell-shop-visit", shopId: "shop.mansion", quoteVersion: 2});
});

it("offers five supplies and allows leaving without purchasing", async () => {
  const {onCommand, props} = scene(progress("buy", "B"));
  await screen.findByRole("tab", {name: "购买"});
  expect(screen.getAllByRole("option")).toHaveLength(5);
  expect(screen.queryByRole("option", {name: "药水"})).toBeNull();
  expect(screen.getByRole("tab", {name: "出售"})).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "结束购买"})));
  expect(props.onPurchase).not.toHaveBeenCalled();
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({type: "advance-shop-visit", shopId: "shop.mansion", phase: "buy", step: 0, choice: "continue"});
});

it("keeps the first-act blanket line and authored player speech verbatim", async () => {
  scene({...progress("arrival"), step: 10});
  const reading = await screen.findByRole("main", {name: "守望者杂货铺"});
  expect(reading).toHaveAttribute("data-frame-id", "shop.visit.arrival.10");
  fireEvent.click(screen.getByRole("button", {name: "显示全文"}));
  expect(reading).toHaveTextContent("毯子拿回去了。");
  expect(reading.querySelector('.rp-adv__actor[data-character="kael"]')).toBeNull();
});
