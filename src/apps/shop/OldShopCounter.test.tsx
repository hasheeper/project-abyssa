import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OldShopCounter as ShopCounter, type ShopCounterProps } from "./OldShopCounter";
import { supplyPurchase, type ShopSupply } from "./shop-counter-model";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import type { ShopLootInventory } from "./shop-loot-model";

const products: ShopSupply[] = [
  { id: "item.ward", name: "护符", iconUrl: "/ward.svg", description: "抵挡 2 点攻击伤害", price: 4, owned: 0, capacity: 2 },
  { id: "item.holy-water", name: "圣水", iconUrl: "/water.svg", description: "解除骰子封印", price: 3, owned: 1, capacity: 2 },
];
const pagedProducts: ShopSupply[] = Array.from({ length: 9 }, (_, index) => ({
  ...products[0], id: `test.supply-${index + 1}`, name: `补给${index + 1}`, description: `测试说明${index + 1}`,
}));
function props(extra: Partial<ShopCounterProps> = {}): ShopCounterProps {
  return { products, funds: 10, crystals: 2, available: true, busy: false, onPurchase: vi.fn().mockResolvedValue(null), ...extra };
}
afterEach(cleanup);

describe("player shop counter", () => {
  it("shows live stock and integrated purchase details with the purchase mode selected", () => {
    render(<ShopCounter {...props()} />);
    const purchaseTab = screen.getByRole("tab", { name: "购买" });
    expect(purchaseTab).toHaveAttribute("aria-selected", "true");
    expect(purchaseTab).toBeEnabled();
    expect(screen.getByRole("tabpanel", { name: "购买" })).toHaveAttribute("id", purchaseTab.getAttribute("aria-controls"));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(document.querySelector(".shop-counter__selection")).toBeNull();
    expect(screen.getByLabelText("小队资金余额 10 G")).toBeInTheDocument();
    expect(screen.getByLabelText("远古晶石余额 2")).toHaveAttribute("data-currency", "crystal");
    expect(screen.getByLabelText("持有 1，上限 2")).toBeInTheDocument();
    expect(within(screen.getByRole("tablist", { name: "商店模式" })).getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tablist", { name: "商店模式" }).parentElement).toBe(screen.getByRole("tabpanel", { name: "购买" }).parentElement);
    expect(screen.queryByRole("navigation", { name: "商品分类" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "商品详情与购买" })).getByRole("button", { name: "购 买" })).toBeEnabled();
  });
  it("keeps sell and appraisal as labelled disabled placeholders and skips them in keyboard navigation", async () => {
    const user = userEvent.setup(), input = props();
    render(<ShopCounter {...input} />);
    for (const name of ["出售", "鉴定"]) {
      const tab = screen.getByRole("tab", { name });
      expect(tab).toBeDisabled();
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab).toHaveAttribute("tabindex", "-1");
      expect(tab).toHaveAccessibleDescription("暂未开放");
      expect(tab).toHaveAttribute("title", `${name}暂未开放`);
      expect(document.getElementById(tab.getAttribute("aria-describedby")!)).not.toBeVisible();
      await user.click(tab);
    }
    expect(screen.getByRole("tab", { name: "购买" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getAllByRole("option")).toHaveLength(products.length);
    expect(input.onPurchase).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: "购买" }));
    await user.tab();
    expect(screen.getByRole("option", { name: /护符/ })).toHaveFocus();
  });
  it("keeps the original copper six-layer item slots without quality markers", () => {
    render(<ShopCounter {...props()} />);
    const slots = document.querySelectorAll(".abyssa-item-slot");
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot).not.toHaveAttribute("data-tone");
      expect(slot).toHaveAttribute("data-rarity", "bronze");
      expect(slot).toHaveAttribute("data-show-rarity", "false");
      for (const layer of ["surface", "halo-a", "halo-b", "glyph-depth", "glyph", "glyph-highlight"]) {
        expect(slot.querySelector(`[data-layer="${layer}"]`)).not.toBeNull();
      }
      expect(slot.querySelector('[data-layer="rarity"]')).toBeNull();
    }
    expect(screen.getByRole("option", { name: /护符/ }).querySelector("button")).toBeNull();
    expect(screen.getByRole("img", { name: "护符 凡品" })).toBeInTheDocument();
  });
  it("updates the real crystal balance without treating crystals as spendable gold", () => {
    const input = props({ funds: 0, crystals: 20 }), { rerender } = render(<ShopCounter {...input} />);
    expect(screen.getByRole("button", { name: "银钱不足" })).toBeDisabled();
    expect(screen.getByLabelText("远古晶石余额 20")).toBeInTheDocument();
    rerender(<ShopCounter {...input} crystals={21} />);
    expect(screen.getByLabelText("远古晶石余额 21")).toBeInTheDocument();
    expect(input.onPurchase).not.toHaveBeenCalled();
  });
  it("uses the existing frames, merchant nameplate and dialogue for bounded groups", async () => {
    render(<ShopCounter {...props()} />);
    const stockFrame = screen.getByRole("region", { name: "补给货架" }).closest(".abyssa-frame");
    const detailFrame = screen.getByRole("region", { name: "商品详情与购买" }).closest(".abyssa-frame");
    expect(stockFrame).toHaveClass("shop-counter__stock-frame");
    expect(detailFrame).toHaveClass("shop-counter__detail-frame");
    // Both wooden counter frames use material rather than repeating diamonds.
    expect(stockFrame?.querySelector(":scope > .abyssa-frame__watermark")).toBeNull();
    expect(detailFrame?.querySelector(":scope > .abyssa-frame__watermark")).toBeNull();
    expect(stockFrame).not.toBe(detailFrame);
    expect(screen.getByRole("img", { name: "缇比·奥雷利亚" }).closest(".abyssa-frame")).toHaveClass("shop-counter__portrait-frame");
    expect(screen.getByText("缇比·奥雷利亚").closest(".abyssa-nameplate")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("region", {name: "缇比的对话"}));
    expect(screen.getByText("想补些什么？食物和治疗药水，洋馆已经替你备好啦。").closest(".abyssa-dialogue")).toBeInTheDocument();
  });
  it("previews the exact quantity/total and prevents an unaffordable purchase", async () => {
    const user = userEvent.setup(), input = props({ funds: 6 });
    render(<ShopCounter {...input} />);
    await user.click(screen.getByRole("button", { name: "增加数量" }));
    expect(screen.getByLabelText("补充数量")).toHaveTextContent("2");
    expect(screen.getByRole("status", { name: "补充后库存" })).toHaveTextContent("2 / 2");
    expect(screen.getByRole("group", { name: "库存预览" }).querySelector("b")).toHaveTextContent("0 / 2");
    expect(screen.getByRole("button", { name: "银钱不足" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "查看购买说明" }));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("还差 2");
    expect(input.onPurchase).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "减少数量" }));
    await user.click(screen.getByRole("button", { name: "购 买" }));
    expect(input.onPurchase).toHaveBeenCalledExactlyOnceWith("item.ward", 1);
    expect(document.querySelector(".shop-counter-feedback .scene-feedback__reward")).toHaveTextContent("获得道具护符×1");
    expect(document.querySelector(".shop-counter__notice")).not.toHaveTextContent("已补充");
  });
  it("uses one roving keyboard focus and resets quantity when selecting another supply", async () => {
    const user = userEvent.setup(); render(<ShopCounter {...props()} />);
    await user.click(screen.getByRole("button", { name: "增加数量" }));
    const first = screen.getByRole("option", { name: /护符/ });
    first.focus(); await user.keyboard("{ArrowDown}");
    const second = screen.getByRole("option", { name: /圣水/ });
    expect(second).toHaveFocus(); expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "-1");
    expect(screen.getByLabelText("补充数量")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "增加数量" })).toBeDisabled();
    await user.keyboard("{Home}"); expect(first).toHaveFocus();
    await user.keyboard("{End}"); expect(second).toHaveFocus();
  });
  it("keeps rows single-line and shows the selected supply explanation only in details", async () => {
    const user = userEvent.setup(); render(<ShopCounter {...props()} />);
    const list = screen.getByRole("listbox", { name: "商品列表" });
    const detail = screen.getByRole("region", { name: "商品详情与购买" });
    expect(list.querySelector("small:not(.abyssa-currency-amount__unit)")).toBeNull();
    for (const product of products) {
      expect(within(list).queryByText(product.description)).not.toBeInTheDocument();
      expect(screen.getByRole("option", { name: new RegExp(product.name) })).toHaveAccessibleDescription(product.description);
    }
    expect(within(detail).getByText(products[0].description)).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /圣水/ }));
    expect(within(detail).getByText(products[1].description)).toBeInTheDocument();
    expect(within(detail).queryByText(products[0].description)).not.toBeInTheDocument();
  });
  it("shares the first detail row between the name and stock, with a separate emblem and one control row", () => {
    render(<ShopCounter {...props()} />);
    const detail = screen.getByRole("region", { name: "商品详情与购买" });
    const title = within(detail).getByRole("heading", { name: "护符" });
    const stock = within(detail).getByRole("group", { name: "库存预览" });
    const copy = title.closest(".shop-counter__detail-copy");
    expect(title.parentElement).toHaveClass("shop-counter__detail-heading");
    expect(stock.parentElement).toBe(title.parentElement);
    expect(within(detail).getByText(products[0].description).parentElement).toBe(copy);
    expect(within(detail).getByRole("img", { name: "护符 凡品" }).parentElement).toHaveClass("shop-counter__detail-emblem");
    const checkout = detail.querySelector(".shop-counter__checkout");
    expect(checkout?.parentElement).toBe(detail);
    expect(within(detail).getByRole("button", { name: "增加数量" }).closest(".shop-counter__checkout")).toBe(checkout);
    expect(within(detail).getByRole("button", { name: "购 买" }).closest(".shop-counter__checkout")).toBe(checkout);
  });
  it("reuses one content preset on selection and never remounts or re-drops the board", async () => {
    const user = userEvent.setup(), input = props();
    const { rerender, container } = render(<ShopCounter {...input} />);
    const board = container.querySelector(".shop-counter-page");
    const frame = container.querySelector(".shop-counter__detail-frame");
    const content = container.querySelector('.shop-counter__description[data-ui-motion-preset="content"]');
    const quantity = screen.getByRole("button", { name: "增加数量" });
    expect(board).not.toHaveClass("abyssa-scene-panel");
    expect(content).not.toBeNull();
    await user.click(screen.getByRole("option", { name: /圣水/ }));
    expect(board).toHaveAttribute("data-shop-intro", "ready");
    expect(container.querySelector(".shop-counter__detail-frame")).toBe(frame);
    expect(container.querySelectorAll('[data-ui-motion-preset="content"]')).toHaveLength(1);
    expect(container.querySelector('[data-ui-motion-preset="content"]')).toBe(content);
    expect(screen.getByRole("button", { name: "增加数量" })).toBe(quantity);
    rerender(<ShopCounter {...input} funds={8} />);
    expect(board).toHaveAttribute("data-shop-intro", "ready");
    expect(screen.getByRole("heading", { name: "圣水" })).toBeInTheDocument();
  });
  it("keeps the recessed column beds outside the scrollable list and non-interactive", () => {
    render(<ShopCounter {...props()} />);
    const list = screen.getByRole("listbox", { name: "商品列表" });
    const well = list.parentElement!;
    expect(well).toHaveClass("shop-counter__stock-well");
    const columns = well.querySelector(".shop-counter__column-wells");
    expect(columns).toHaveAttribute("aria-hidden", "true");
    expect(columns?.querySelectorAll("i")).toHaveLength(2);
    expect(columns?.querySelector("button, [tabindex]")).toBeNull();
    expect(list.querySelector(".shop-counter__column-wells")).toBeNull();
    expect(within(list).getAllByRole("option")).toHaveLength(products.length);
  });
  it("keeps icon-only pagination in the shelf header, including a disabled single-page placeholder", () => {
    render(<ShopCounter {...props()} />);
    const navigation = screen.getByRole("navigation", { name: "商品翻页" });
    expect(navigation.closest(".shop-counter__columns")).not.toBeNull();
    expect(navigation.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.querySelector(".shop-counter__stock > .shop-counter__pagination")).toBeNull();
    expect(within(navigation).getByRole("status", { name: "货架页码" })).toHaveTextContent("1 / 1");
    for (const name of ["上一页", "下一页"]) {
      const button = within(navigation).getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("");
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    }
  });
  it("pages seven supplies at a time, focusing the selection and resetting the quote without buying", async () => {
    const user = userEvent.setup(), input = props({ products: pagedProducts });
    render(<ShopCounter {...input} />);
    expect(screen.getAllByRole("option")).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "增加数量" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByRole("status", { name: "货架页码" })).toHaveTextContent("2 / 2");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    const selected = screen.getByRole("option", { name: /补给8/ });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveAttribute("aria-posinset", "8");
    expect(selected).toHaveAttribute("aria-setsize", "9");
    expect(screen.getByRole("heading", { name: "补给8" })).toBeInTheDocument();
    expect(screen.getByLabelText("补充数量")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "上一页" }));
    expect(screen.getByRole("option", { name: /补给1/ })).toHaveFocus();
    expect(screen.getByRole("status", { name: "货架页码" })).toHaveTextContent("1 / 2");
    expect(input.onPurchase).not.toHaveBeenCalled();
  });
  it("keeps keyboard selection and focus together across page boundaries", async () => {
    const user = userEvent.setup();
    render(<ShopCounter {...props({ products: pagedProducts })} />);
    await user.click(screen.getByRole("option", { name: /补给7/ }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /补给8/ })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("option", { name: /补给7/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("option", { name: /补给9/ })).toHaveFocus();
    await user.keyboard("{Home}{PageDown}");
    expect(screen.getByRole("option", { name: /补给8/ })).toHaveFocus();
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("option", { name: /补给1/ })).toHaveFocus();
  });
  it("locks paging while busy and safely recovers when stock shrinks or empties", async () => {
    const user = userEvent.setup(), input = props({ products: pagedProducts, busy: true });
    const { rerender } = render(<ShopCounter {...input} />);
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    rerender(<ShopCounter {...input} busy={false} available={false} />);
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByRole("heading", { name: "补给8" })).toBeInTheDocument();
    rerender(<ShopCounter {...input} busy={false} products={pagedProducts.slice(0, 2)} />);
    expect(screen.getByRole("status", { name: "货架页码" })).toHaveTextContent("1 / 1");
    expect(screen.getByRole("option", { name: /补给1/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "补给1" })).toBeInTheDocument();
    rerender(<ShopCounter {...input} busy={false} products={[]} />);
    expect(screen.getByRole("status", { name: "货架页码" })).toHaveTextContent("1 / 1");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(input.onPurchase).not.toHaveBeenCalled();
  });
  it("keeps full supplies inspectable and shows zero purchase quantity", async () => {
    const user = userEvent.setup(); render(<ShopCounter {...props({ products: [{ ...products[0], owned: 2 }] })} />);
    await user.click(screen.getByRole("option", { name: /护符/ }));
    expect(screen.getByRole("button", { name: "已备足" })).toBeDisabled();
    expect(screen.getByLabelText("补充数量")).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "增加数量" })).toBeDisabled();
    const stock = screen.getByRole("group", { name: "库存预览" });
    expect(stock).toHaveTextContent("持有2 / 2已备足");
    expect(within(stock).queryByRole("status", { name: "补充后库存" })).not.toBeInTheDocument();
  });
  it("locks transaction controls while pending and displays authoritative errors without spending optimistically", async () => {
    let finish!: (value: string | null) => void;
    const input = props({ onPurchase: vi.fn(() => new Promise<string | null>(resolve => { finish = resolve; })) });
    const user = userEvent.setup(); render(<ShopCounter {...input} />);
    await user.dblClick(screen.getByRole("button", { name: "购 买" }));
    expect(input.onPurchase).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "正在装袋" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "增加数量" })).toBeDisabled();
    expect(screen.getByLabelText("小队资金余额 10 G")).toBeInTheDocument();
    await act(async () => finish("报价已更新，请重新选择。"));
    expect(screen.getByText("报价已更新，请重新选择。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "购 买" })).toBeEnabled();
  });
  it("reflects committed stock and funds and safely clamps the old quantity after a refresh", async () => {
    const user = userEvent.setup(), input = props();
    const { rerender } = render(<ShopCounter {...input} />);
    await user.click(screen.getByRole("button", { name: "增加数量" }));
    rerender(<ShopCounter {...input} funds={6} products={[{ ...products[0], owned: 1 }, products[1]]} />);
    expect(screen.getByLabelText("补充数量")).toHaveTextContent("1");
    expect(screen.getByLabelText("小队资金余额 6 G")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "购 买" }));
    expect(input.onPurchase).toHaveBeenCalledWith("item.ward", 1);
  });
  it("keeps unavailable guidance in a dismissible hint and handles an empty shelf", async () => {
    const user = userEvent.setup();
    const input = props({ available: false }), { rerender } = render(<ShopCounter {...input} />);
    expect(screen.getByRole("button", { name: "暂不可购买" })).toBeDisabled();
    const explanation = screen.getByText("请先结束当前旅程或剧情，再来补充物资。");
    expect(explanation).not.toBeVisible();
    const help = screen.getByRole("button", { name: "查看购买说明" });
    await user.click(help);
    expect(explanation).toBeVisible();
    expect(help).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(explanation).not.toBeVisible();
    rerender(<ShopCounter {...props({ products: [] })} />);
    expect(screen.getByRole("heading", { name: "暂无在售补给" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "购 买" })).not.toBeInTheDocument();
  });
  it("shows purchase guidance on hover and keyboard focus, and dismisses outside", async () => {
    const user = userEvent.setup();
    render(<ShopCounter {...props()} />);
    const help = screen.getByRole("button", { name: "查看购买说明" });
    await user.hover(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    await user.unhover(help);
    expect(help).toHaveAttribute("aria-expanded", "false");
    act(() => help.focus());
    expect(help).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("tab", { name: "购买" }));
    expect(help).toHaveAttribute("aria-expanded", "false");
  });
  it("releases the pending state after a rejected request", async () => {
    const user = userEvent.setup(); render(<ShopCounter {...props({ onPurchase: vi.fn().mockRejectedValue(new Error("offline")) })} />);
    await user.click(screen.getByRole("button", { name: "购 买" }));
    expect(screen.getByText(/交易未能确认/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "购 买" })).toBeEnabled();
  });
});

it("normalizes UI quantity to remaining capacity, without changing the runtime quote", () => {
  expect(supplyPurchase(products[0], 6, 99)).toEqual({ remaining: 2, quantity: 2, total: 8, shortfall: 2, after: 2 });
  expect(supplyPurchase({ ...products[0], owned: 2 }, 10, 1).quantity).toBe(0);
});

it("keeps successive acquisitions in order with each transaction's item and quantity", async () => {
  const input = props({funds: 20, loot: {items: [], history: []}, onAppraise: vi.fn(), onSell: vi.fn()});
  const user = userEvent.setup(), view = render(<ShopCounter {...input}/>);
  await user.click(screen.getByRole("button", {name: "增加数量"}));
  await user.click(screen.getByRole("button", {name: "购 买"}));
  expect(input.onPurchase).toHaveBeenLastCalledWith("item.ward", 2);
  view.rerender(<ShopCounter {...input} funds={12} products={[{...products[0], owned: 2}, products[1]]}/>);
  await user.click(screen.getByRole("option", {name: /圣水/}));
  await user.click(screen.getByRole("button", {name: "购 买"}));
  expect(input.onPurchase).toHaveBeenLastCalledWith("item.holy-water", 1);
  await user.click(screen.getByRole("tab", {name: "鉴定"}));
  const receipts = [...view.container.querySelectorAll(".shop-counter-feedback .scene-feedback__reward")];
  expect(receipts.map(node => node.textContent)).toEqual(["获得道具护符×2", "获得道具圣水×1"]);
  expect(receipts.map(node => node.querySelector(".abyssa-item-slot")?.getAttribute("aria-label")))
    .toEqual([expect.stringContaining("护符"), expect.stringContaining("圣水")]);
  expect(view.container.querySelector(".shop-counter-feedback")).not.toHaveTextContent("补充");
});

it("opens each inventory entry explicitly and returns to the remaining items after appraisal", async () => {
  const copy = shopLootPresentation["loot.tutorial.curio"];
  const names = ["铜环", "封蜡盒", "裂纹石片", "刻纹骨片", "生锈钥匙", "褪色徽章", "锈蚀锁扣", "盐封玻璃瓶", "黑色残片"];
  const items = names.map((unknownName, index) => ({...copy, unknownName,
    instanceId: `loot-${index}`, resultId: null, appraisalFee: 2, salePrice: 8,
  }));
  let finish!: (error: string | null) => void;
  const onAppraise = vi.fn(() => new Promise<string | null>(resolve => {finish = resolve;}));
  const onSell = vi.fn().mockResolvedValue(null);
  const input = props({loot: {items, history: []}, initialMode: "appraise", onAppraise, onSell});
  const user = userEvent.setup(), {rerender} = render(<ShopCounter {...input}/>);
  expect(within(screen.getByRole("list", {name: "待鉴定物品"})).getAllByRole("listitem")).toHaveLength(7);
  act(() => screen.getByRole("button", {name: "查看铜环详情"}).focus());
  await user.keyboard("{End}");
  expect(screen.getByRole("button", {name: "查看黑色残片详情"})).toHaveFocus();
  expect(screen.queryByRole("button", {name: "鉴 定"})).not.toBeInTheDocument();
  expect(onAppraise).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", {name: "黑色残片"})).toHaveFocus();
  expect(screen.queryByRole("list", {name: "待鉴定物品"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "鉴 定"}));
  expect(screen.getByRole("button", {name: "返回列表"})).toBeDisabled();
  expect(onAppraise).toHaveBeenCalledWith("loot-8");
  const identified = {...items[8], name: "黑曜石碎片", resultId: "obsidian"};
  const loot: ShopLootInventory = {items: [...items.slice(0, 8), identified], history: [{id: "trade-1", kind: "appraise", gold: 2, item: identified}]};
  rerender(<ShopCounter {...input} funds={8} loot={loot}/>);
  await act(async () => finish(null));
  const reading = within(screen.getByRole("complementary", {name: "店主缇比"}));
  expect(reading.getByRole("button", {name: "继续听"})).toHaveFocus();
  await user.click(reading.getByRole("region", {name: "缇比的对话"}));
  await user.click(reading.getByRole("button", {name: "继续听"}));
  expect(await reading.findByText(/你拿回来的只有架子/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "返回列表"}));
  expect(within(screen.getByRole("list", {name: "待鉴定物品"})).getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByRole("button", {name: "查看盐封玻璃瓶详情"})).toHaveFocus();
  expect(screen.queryByRole("button", {name: "查看黑色残片详情"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "上一页"}));
  await user.click(screen.getByRole("button", {name: "查看铜环详情"}));
  expect(screen.getByRole("heading", {name: "铜环"})).toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "返回列表"}));
  expect(screen.getByRole("button", {name: "查看铜环详情"})).toHaveFocus();
  await user.click(screen.getByRole("button", {name: "鉴定记录"}));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", {name: "鉴定记录"})).toHaveFocus();
  expect(screen.queryByRole("region", {name: "鉴定记录"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "鉴定记录"}));
  await user.click(screen.getByRole("button", {name: "黑曜石碎片"}));
  expect(screen.getByRole("heading", {name: "黑曜石碎片"})).toBeInTheDocument();
  expect(onAppraise).toHaveBeenCalledTimes(1);
  expect(onSell).not.toHaveBeenCalled();
});

it("uses the purchase layout for selling and removes only the selected instance", async () => {
  const copy = shopLootPresentation["loot.tutorial.curio"];
  const items = ["船灯铜环", "旧铜扣"].map((name, index) => ({...copy, name, instanceId: `known-${index}`, resultId: `result-${index}`, appraisalFee: 2, salePrice: 8 + index}));
  const unknown = {...copy, unknownName: "封蜡盒", instanceId: "unknown", resultId: null, appraisalFee: 2, salePrice: 8};
  const history: ShopLootInventory["history"] = items.map((item, index) => ({id: `appraisal-${index}`, kind: "appraise", gold: 2, item}));
  const onSell = vi.fn().mockResolvedValue(null), onAppraise = vi.fn().mockResolvedValue(null);
  const input = props({initialMode: "sell", loot: {items: [...items, unknown], history}, onAppraise, onSell});
  const user = userEvent.setup(), {rerender} = render(<ShopCounter {...input}/>);
  expect(within(screen.getByRole("listbox", {name: "可出售物品"})).getAllByRole("option")).toHaveLength(2);
  expect(screen.queryByRole("button", {name: "查看封蜡盒详情"})).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name: "出 售"})).toBeEnabled();
  expect(screen.getByRole("region", {name: "商品详情与出售"}).closest(".shop-counter__ledger")).not.toBeNull();
  expect(screen.getByText("可售物品 · 2")).toBeInTheDocument();
  expect(screen.getByText("单价")).toBeInTheDocument();
  expect(screen.getByLabelText("出售数量")).toHaveTextContent("1");
  expect(screen.getByLabelText("出售后库存")).toHaveTextContent("0");
  expect(screen.queryByRole("button", {name: "返回列表"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("option", {name: /旧铜扣/}));
  await user.click(screen.getByRole("button", {name: "出 售"}));
  expect(onSell).toHaveBeenCalledExactlyOnceWith("known-1");
  rerender(<ShopCounter {...input} loot={{items: [items[0], unknown], history: [...history, {id: "sale-1", kind: "sell", gold: 9, item: items[1]}]}}/>);
  expect(within(screen.getByRole("listbox", {name: "可出售物品"})).getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", {name: /船灯铜环/})).toHaveFocus();
  expect(screen.queryByRole("button", {name: "查看旧铜扣详情"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("option", {name: /船灯铜环/}));
  expect(screen.getByRole("heading", {name: "船灯铜环"})).toBeInTheDocument();
  expect(onSell).toHaveBeenCalledTimes(1);
  expect(onAppraise).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "出 售"}));
  rerender(<ShopCounter {...input} loot={{items: [unknown], history: [...history,
    {id: "sale-1", kind: "sell", gold: 9, item: items[1]}, {id: "sale-2", kind: "sell", gold: 8, item: items[0]},
  ]}}/>);
  expect(screen.getByRole("heading", {name: "暂无可出售物品"})).toHaveFocus();
  expect(screen.queryByRole("region", {name: "商品详情与出售"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", {name: "购买"}));
  expect([...document.querySelectorAll(".shop-counter-feedback .scene-feedback__notice")].map(node => node.textContent))
    .toEqual(["已出售旧铜扣，收入 9 G。", "已出售船灯铜环，收入 8 G。"]);
});


it.each(["buy", "sell", "appraise"] as const)("keeps count, pagination and price labels visible for an empty %s inventory", mode => {
  render(<ShopCounter {...props({products: [], initialMode: mode, loot: {items: [], history: []}, onAppraise: vi.fn(), onSell: vi.fn()})}/>);
  expect(screen.getByText(`${mode === "buy" ? "在售物资" : mode === "sell" ? "可售物品" : "待鉴定物品"} · 0`)).toBeInTheDocument();
  expect(screen.getByText(mode === "buy" ? "持有 / 上限" : "持有")).toBeInTheDocument();
  expect(screen.getByText(mode === "appraise" ? "鉴定费" : "单价")).toBeInTheDocument();
  expect(screen.getByRole("status", {name: "货架页码"})).toHaveTextContent("1 / 1");
  expect(screen.getByRole("button", {name: "上一页"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "下一页"})).toBeDisabled();
  expect(screen.getByLabelText("远古晶石余额 2")).toBeInTheDocument();
});
