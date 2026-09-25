import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { ShopCounter, type ShopCounterProps } from "./ShopCounter";
import { groupShopLoot, type ShopLootItem } from "./shop-loot-model";
import { ORDINARY_DROPS_CATALOG } from "../../game-runtime/ordinary-drops-context";
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
afterEach(cleanup);
function item(definitionId: string, serial: number, known = true): ShopLootItem {
  const definition = ORDINARY_DROPS_CATALOG.data.loot!.definitions[definitionId];
  return {...shopLootPresentation[definitionId], definitionId, instanceId: `${definitionId}:${serial}`, resultId: known ? definition.resultId : null,
    stackable: known && definition.quantity === 1 && !definition.bundleWith, quantity: definition.quantity ?? 1,
    salePrice: known ? definition.salePrice : 2, appraisalFee: definition.appraisalFee, appraisable: !definition.initiallyKnown, sellable: definition.sellable !== false};
}
const props = (items: ShopLootItem[], extra: Partial<ShopCounterProps> = {}): ShopCounterProps => ({products: [], initialMode: "sell", funds: 4400, crystals: 0,
  busy: false, available: true, loot: {items, history: []}, onPurchase: vi.fn(async () => null), onSell: vi.fn(async () => null), onAppraise: vi.fn(async () => null), ...extra});
const scene = (p: ShopCounterProps) => <UiMotionProvider preference="reduced"><ShopCounter {...p}/></UiMotionProvider>;

it("merges compatible known items and separates unknown identities and tutorial lots", () => {
  const shell = [item("loot.salvage.shell", 1), item("loot.salvage.shell", 2)];
  const unknown = [item("loot.curio.navigation-compass", 1, false), item("loot.curio.navigation-compass", 2, false)];
  const coins = item("loot.tutorial.cross-coins", 1);
  const groups = groupShopLoot([...shell, ...unknown, coins], "sell");
  expect(groups.map(g => g.owned)).toEqual([2, 1, 1, 12]);
  expect(groupShopLoot(unknown, "appraise")).toHaveLength(2);
});

it("shows one sale row with owned count, a quantity total, and retained selection after partial sale", async () => {
  const items = [1, 2, 3].map(n => item("loot.salvage.shell", n)), input = props(items);
  const view = render(scene(input)); await screen.findByRole("tab", {name: "出售"});
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", {name: "螺壳"})).toHaveTextContent("3");
  fireEvent.click(screen.getByRole("button", {name: "增加数量"}));
  expect(screen.getByLabelText("出售后库存")).toHaveTextContent("1");
  expect(document.querySelector(".new-shop-detail__total")).toHaveTextContent("160");
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "出售"})));
  expect(input.onSell).toHaveBeenCalledExactlyOnceWith(items[0].instanceId, 2);
  view.rerender(scene({...input, funds: 4560, loot: {items: [items[2]], history: items.slice(0, 2).map((item, i) => ({id: `sold-${i}`, kind: "sell", gold: 80, item}))}}));
  expect(screen.getByRole("option", {name: "螺壳"})).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", {name: "螺壳"})).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "增加数量"})).toBeDisabled();
  expect(document.querySelector(".scene-feedback__notice")).toHaveTextContent("螺壳 ×2");
});

it("keeps a large sale catalog pageable and shows four-digit item quotes", async () => {
  const ids = Object.keys(ORDINARY_DROPS_CATALOG.data.loot!.definitions).filter(id => !id.startsWith("loot.tutorial."));
  render(scene(props(ids.map(id => item(id, 1))))); await screen.findByRole("tab", {name: "出售"});
  expect(screen.getAllByRole("option")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", {name: "下一页"}));
  fireEvent.click(screen.getByRole("button", {name: "下一页"}));
  const reed = screen.getByRole("option", {name: "报时钟音簧"});
  expect(reed).toHaveTextContent("1,200");
  fireEvent.click(reed);
  expect(screen.getByRole("heading", {name: "报时钟音簧"})).toBeInTheDocument();
  expect(screen.getByLabelText("货架页码")).toHaveTextContent("3 / 3");
});

it("uses a short repeat appraisal while keeping each new instance chargeable", async () => {
  const previous = item("loot.curio.navigation-compass", 1), pending = item("loot.curio.navigation-compass", 2, false);
  const input = props([pending], {initialMode: "appraise", loot: {items: [pending], history: [{id: "prior-appraisal", kind: "appraise", gold: 300, item: previous}]}});
  render(scene(input)); await screen.findByRole("button", {name: "鉴定"});
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "鉴定"})));
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent("又是一只航海罗盘");
  expect(input.onAppraise).toHaveBeenCalledExactlyOnceWith(pending.instanceId);
});

it("does not treat a partially confirmed failed bulk response as fully sold", async () => {
  const items = [1, 2].map(n => item("loot.salvage.shell", n));
  const input = props(items, {onSell: vi.fn(async () => "写入待确认")});
  const view = render(scene(input)); await screen.findByRole("tab", {name: "出售"});
  fireEvent.click(screen.getByRole("button", {name: "增加数量"}));
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "出售"})));
  const first = {id: "sold-1", kind: "sell" as const, gold: 80, item: items[0]};
  view.rerender(scene({...input, loot: {items: [items[1]], history: [first]}}));
  expect(screen.getByRole("alert")).toHaveTextContent("写入待确认");
  view.rerender(scene({...input, loot: {items: [], history: [first, {id: "sold-2", kind: "sell", gold: 80, item: items[1]}]}}));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(input.onSell).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".scene-feedback__notice")).toHaveTextContent("160 G");
});
