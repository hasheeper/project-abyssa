import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ResourceInventoryDialog, type ResourceInventoryEntry } from "./ResourceInventoryDialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const entry = (id: string, type = "物品", quantity = 2): ResourceInventoryEntry => ({
  id, type, quantity, name: id, icon: "/item.svg", unit: "份", description: `${id}效果`,
});
const fixedEntries = ["食物", "药水", "护符", "圣水", "保养工具", "幸运符", "卦签"].map(name => entry(name, "补给"));

const leftHeadings = (container: HTMLElement) =>
  [...container.querySelectorAll(".resource-inventory__overview h3")].map(node => node.textContent);
// 刚挂载时窗口还在入场动画里(透明),挂载后立即检查的内容只断言存在,不断言可见。
it("keeps seven fixed provisions above one uncategorized sandbox inventory with original slot art", () => {
  const {container} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries}
    entries={[entry("短刃", "装备"), entry("褪色的缎带"), entry("某人的手写字条")]} />);
  expect(leftHeadings(container)).toEqual(["常备补给", "物品库存"]);
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(3);
  expect(container.querySelectorAll(".resource-inventory__name")).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="fixed"] [data-tone="interface"]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="fixed"] [data-rarity]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(18);
  for (const item of container.querySelectorAll("[data-resource-item]")) {
    expect(item).toHaveClass("abyssa-item-slot");
    expect([...item.querySelectorAll("[data-layer]")].map(layer => layer.getAttribute("data-layer")))
      .toEqual(["surface", "halo-a", "halo-b", "glyph-depth", "glyph", "glyph-highlight"]);
    expect(item.querySelector("img")).toBeNull();
  }
  // 详情常驻:未操作时显示第一件,名牌写它的类别。
  const detail = screen.getByRole("region", {name: "食物详情"});
  expect(within(detail).getByRole("heading", {level: 3})).toHaveTextContent("补给");
  expect(within(detail).getByText("食物效果")).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "查看食物详情，2份"})).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("gridcell")).toBeNull();
  expect(screen.queryByText(/凡品|仓储上限|上一页|下一页|返回/)).toBeNull();
});

it("paginates the open inventory in twenty-one-slot pages without moving the fixed provisions", async () => {
  const user = userEvent.setup();
  const {container, rerender} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={[]} />);
  expect(screen.queryByText("尚未存放其他物品")).toBeNull();
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder] .abyssa-item-slot[data-empty]')).toHaveLength(21);
  expect(container.querySelector('[data-placeholder] button')).toBeNull();
  const pager = screen.getByRole("navigation", {name: "物品库存分页"});
  expect(within(pager).getByRole("status")).toHaveTextContent("1 / 1");
  expect(within(pager).getByRole("button", {name: "上一页"})).toBeDisabled();
  expect(within(pager).getByRole("button", {name: "下一页"})).toBeDisabled();
  const entries = Array.from({length: 31}, (_, i) => entry(`未预定义物件${i}`));
  rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={entries} />);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(21);
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(0);
  await user.click(screen.getByRole("button", {name: "查看未预定义物件0详情，2份"}));
  await user.click(within(pager).getByRole("button", {name: "下一页"}));
  expect(within(pager).getByRole("status")).toHaveTextContent("2 / 2");
  expect(screen.queryByRole("region", {name: "未预定义物件0详情"})).toBeNull();
  expect(screen.getByRole("region", {name: "未预定义物件21详情"})).toBeVisible();
  expect(screen.getByRole("button", {name: "查看未预定义物件21详情，2份"})).toHaveFocus();
  expect(screen.queryByRole("button", {name: "查看未预定义物件0详情，2份"})).toBeNull();
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(10);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(11);
  expect(within(pager).getByRole("button", {name: "下一页"})).toBeDisabled();
  await user.keyboard("{PageUp}");
  expect(within(pager).getByRole("status")).toHaveTextContent("1 / 2");
  expect(screen.getByRole("button", {name: "查看未预定义物件0详情，2份"})).toHaveFocus();
  await user.keyboard("{PageDown}");
  expect(screen.getByRole("button", {name: "查看未预定义物件21详情，2份"})).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("button", {name: "查看未预定义物件20详情，2份"})).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("button", {name: "查看未预定义物件21详情，2份"})).toHaveFocus();
  // Inventory shrink clamps the current page and cannot leave stale detail or focus.
  rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={entries.slice(0, 2)} />);
  expect(within(pager).getByRole("status")).toHaveTextContent("1 / 1");
  expect(screen.getByRole("button", {name: "查看未预定义物件0详情，2份"})).toHaveFocus();
  expect(screen.getByRole("region", {name: "未预定义物件0详情"})).toBeVisible();
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(19);
  expect(leftHeadings(container)).toHaveLength(2);
});

it("renders corner counts including zero and one without a separate count row", () => {
  const {container} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={[entry("食物", "补给", 0), entry("药水", "补给", 1)]}
    entries={[entry("旧钥匙", "物品", 8), entry("水晶", "物品", 12345)]} />);
  expect([...container.querySelectorAll(".resource-inventory__badge")].map(node => node.textContent?.trim())).toEqual(["0", "1", "8", "12,345"]);
  expect(container.querySelector(".resource-inventory__quantity")).toBeNull();
  expect(container.querySelectorAll("[data-placeholder] .resource-inventory__badge")).toHaveLength(0);
});

it("keeps twenty-one inventory cells per page regardless of occupancy", () => {
  const {container, rerender} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={[]} />);
  for (const count of [0, 1, 7, 8, 21]) {
    rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries}
      entries={Array.from({length: count}, (_, index) => entry(`物品${index}`))} />);
    const cells = container.querySelectorAll('[data-area="sandbox"] .resource-inventory__items > li');
    expect(cells).toHaveLength(21);
    for (const cell of cells) {
      if (!cell.hasAttribute("data-placeholder")) continue;
      expect(cell).toHaveAttribute("aria-hidden", "true");
      expect(cell.querySelector("button")).toBeNull();
    }
  }
});

it("resets pagination on reopen", async () => {
  const user = userEvent.setup(), entries = Array.from({length: 22}, (_, i) => entry(`库存${i}`));
  const {rerender} = render(<ResourceInventoryDialog open onClose={() => {}} entries={entries}/>);
  await user.click(screen.getByRole("button", {name: "下一页"}));
  expect(screen.getByRole("status")).toHaveTextContent("2 / 2");
  rerender(<ResourceInventoryDialog open={false} onClose={() => {}} entries={entries}/>);
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries}/>);
  expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
});

it("follows the selected slot with a persistent detail panel and closes on Escape", async () => {
  const user = userEvent.setup(), onClose = vi.fn();
  render(<ResourceInventoryDialog open onClose={onClose} fixedEntries={[entry("食物", "补给", 0), entry("药水")]} entries={[]} />);
  const food = screen.getByRole("button", {name: "查看食物详情，0份"});
  await user.click(food);
  const detail = screen.getByRole("region", {name: "食物详情"});
  expect(within(detail).getByText("食物效果")).toBeVisible();
  expect(within(detail).queryAllByRole("button")).toHaveLength(0); // inspection only
  expect(detail.querySelector(".abyssa-item-slot [data-layer=halo-a]")).not.toBeNull();
  expect(food).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", {name: "查看药水详情，2份"}));
  expect(screen.queryByRole("region", {name: "食物详情"})).toBeNull();
  expect(screen.getByRole("region", {name: "药水详情"})).toBeVisible();
  expect(food).toHaveAttribute("aria-pressed", "false");
  // 背景点击不收起详情;详情常驻,Esc 直接关窗。
  await user.click(screen.getByRole("heading", {name: "物品库存"}));
  expect(screen.getByRole("region", {name: "药水详情"})).toBeVisible();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows status and ownership in the detail and rerenders its quantity in place", async () => {
  const reserved = {...entry("药水"), status: "待交付", ownership: "委托物"};
  const {rerender} = render(<ResourceInventoryDialog open onClose={() => {}} entries={[reserved]} />);
  const detail = screen.getByRole("region", {name: "药水详情"});
  expect(within(detail).getByText("待交付")).toBeInTheDocument();
  expect(within(detail).getByText("委托物")).toBeInTheDocument();
  expect(within(detail).getByText("持有")).toBeInTheDocument();
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={[{...reserved, quantity: 1}]} />);
  await waitFor(() => expect(within(detail).getByText("1", {selector: "b"})).toBeInTheDocument());
});

it("supports roving keyboard focus and reconciles removed selection without stale detail", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);
  const user = userEvent.setup();
  const entries = Array.from({length: 9}, (_, i) => entry(`资源${i}`));
  const {container, rerender} = render(<ResourceInventoryDialog open onClose={() => {}} entries={entries} />);
  const items = () => container.querySelectorAll<HTMLButtonElement>("[data-resource-item]");
  await waitFor(() => expect(screen.getByRole("button", {name: "关闭领地库存"})).toHaveFocus());
  items()[0].focus();
  await user.keyboard("{ArrowDown}"); expect(items()[7]).toHaveFocus();
  await user.keyboard("{ArrowRight}"); expect(items()[8]).toHaveFocus();
  await user.keyboard("{ArrowUp}"); expect(items()[1]).toHaveFocus();
  await user.keyboard("{ArrowLeft}"); expect(items()[0]).toHaveFocus();
  await user.keyboard("{End}"); expect(items()[8]).toHaveFocus();
  expect([...items()].filter(node => node.tabIndex === 0)).toHaveLength(1);
  expect(screen.getByRole("region", {name: "资源8详情"})).toBeVisible();
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries.slice(0, 2)} />);
  expect(screen.queryByRole("region", {name: "资源8详情"})).toBeNull();
  expect(screen.getByRole("region", {name: "资源0详情"})).toBeVisible();
  expect(items()[0]).toHaveFocus();
  await user.keyboard("{End}{Home}"); expect(items()[0]).toHaveFocus();
  await user.click(items()[1]);
  rerender(<ResourceInventoryDialog open={false} onClose={() => {}} entries={entries} />);
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries} />);
  expect(screen.getByRole("region", {name: "资源0详情"})).toBeVisible();
});

it("shows a placeholder detail when the warehouse is empty", () => {
  render(<ResourceInventoryDialog open onClose={() => {}} entries={[]} />);
  expect(screen.getByText("尚无物品")).toBeInTheDocument();
  expect(screen.getByRole("heading", {name: "物品详情"})).toBeInTheDocument();
});
