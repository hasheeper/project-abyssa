import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ResourceInventoryDialog, type ResourceInventoryEntry } from "./ResourceInventoryDialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const entry = (id: string, type = "物品", quantity = 2): ResourceInventoryEntry => ({
  id, type, quantity, name: id, icon: "/item.svg", unit: "份", description: `${id}效果`,
});
const fixedEntries = ["食物", "药水", "护符", "圣水", "保养工具", "幸运符", "卦签"].map(name => entry(name, "补给"));

it("keeps seven fixed provisions above one uncategorized sandbox inventory with original slot art", () => {
  const {container} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries}
    entries={[entry("短刃", "装备"), entry("褪色的缎带"), entry("某人的手写字条")]} />);
  expect(screen.getAllByRole("heading", {level: 3}).map(node => node.textContent)).toEqual(["常备补给", "物品库存"]);
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-area="fixed"] .resource-inventory__name')).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="fixed"] [data-tone="interface"]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="fixed"] [data-rarity]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(11);
  for (const item of container.querySelectorAll("[data-resource-item]")) {
    expect(item).toHaveClass("abyssa-item-slot");
    expect([...item.querySelectorAll("[data-layer]")].map(layer => layer.getAttribute("data-layer")))
      .toEqual(["surface", "halo-a", "halo-b", "glyph-depth", "glyph", "glyph-highlight"]);
    expect(item.querySelector("img")).toBeNull();
  }
  expect(container.querySelector(".resource-inventory__detail")).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("gridcell")).toBeNull();
  expect(screen.queryByText(/凡品|仓储上限|上一页|下一页/)).toBeNull();
});

it("paginates the open inventory in fourteen-slot pages without moving the fixed provisions", async () => {
  const user = userEvent.setup();
  const {container, rerender} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={[]} />);
  expect(screen.queryByText("尚未存放其他物品")).toBeNull();
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder] .abyssa-item-slot[data-empty]')).toHaveLength(14);
  expect(container.querySelector('[data-placeholder] button')).toBeNull();
  const pager = screen.getByRole("navigation", {name: "物品库存分页"});
  expect(within(pager).getByRole("status")).toHaveTextContent("1 / 1");
  expect(within(pager).getByRole("button", {name: "上一页"})).toBeDisabled();
  expect(within(pager).getByRole("button", {name: "下一页"})).toBeDisabled();
  const entries = Array.from({length: 31}, (_, i) => entry(`未预定义物件${i}`));
  rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={entries} />);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(14);
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(0);
  await user.click(screen.getByRole("button", {name: "查看未预定义物件0详情，2份"}));
  await user.click(within(pager).getByRole("button", {name: "下一页"}));
  expect(within(pager).getByRole("status")).toHaveTextContent("2 / 3");
  expect(screen.queryByRole("region", {name: "未预定义物件0详情"})).toBeNull();
  expect(screen.getByRole("button", {name: "查看未预定义物件14详情，2份"})).toHaveFocus();
  expect(screen.queryByRole("button", {name: "查看未预定义物件0详情，2份"})).toBeNull();
  expect(container.querySelectorAll('[data-area="fixed"] [data-resource-item]')).toHaveLength(7);
  await user.keyboard("{PageDown}");
  expect(within(pager).getByRole("status")).toHaveTextContent("3 / 3");
  expect(screen.getByRole("button", {name: "查看未预定义物件28详情，2份"})).toHaveFocus();
  expect(container.querySelectorAll('[data-area="sandbox"] [data-resource-item]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(11);
  expect(within(pager).getByRole("button", {name: "下一页"})).toBeDisabled();
  await user.keyboard("{PageUp}");
  expect(screen.getByRole("button", {name: "查看未预定义物件14详情，2份"})).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("button", {name: "查看未预定义物件13详情，2份"})).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("button", {name: "查看未预定义物件14详情，2份"})).toHaveFocus();
  // Inventory shrink clamps the current page and cannot leave stale detail or focus.
  rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={entries.slice(0, 2)} />);
  expect(within(pager).getByRole("status")).toHaveTextContent("1 / 1");
  expect(screen.getByRole("button", {name: "查看未预定义物件0详情，2份"})).toHaveFocus();
  expect(container.querySelectorAll('[data-area="sandbox"] [data-placeholder]')).toHaveLength(12);
  expect(screen.getAllByRole("heading", {level: 3})).toHaveLength(2);
});

it("renders corner counts including zero and one without a separate count row", () => {
  const {container} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={[entry("食物", "补给", 0), entry("药水", "补给", 1)]}
    entries={[entry("旧钥匙", "物品", 8), entry("水晶", "物品", 12345)]} />);
  expect([...container.querySelectorAll(".resource-inventory__badge")].map(node => node.textContent?.trim())).toEqual(["0", "1", "8", "12,345"]);
  expect(container.querySelector(".resource-inventory__quantity")).toBeNull();
  expect(container.querySelectorAll("[data-placeholder] .resource-inventory__badge")).toHaveLength(0);
});

it("reserves a name line for all fourteen inventory cells regardless of occupancy", () => {
  const {container, rerender} = render(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries} entries={[]} />);
  for (const count of [0, 1, 7, 8, 14]) {
    rerender(<ResourceInventoryDialog open onClose={() => {}} fixedEntries={fixedEntries}
      entries={Array.from({length: count}, (_, index) => entry(`物品${index}`))} />);
    const cells = container.querySelectorAll('[data-area="sandbox"] .resource-inventory__items > li');
    expect(cells).toHaveLength(14);
    for (const cell of cells) {
      const name = cell.querySelector(".resource-inventory__name");
      expect(name).not.toBeNull();
      if (cell.hasAttribute("data-placeholder")) {
        expect(cell).toHaveAttribute("aria-hidden", "true");
        expect(name).toBeEmptyDOMElement();
        expect(cell.querySelector("button")).toBeNull();
      }
    }
    expect(container.querySelectorAll('[data-area="fixed"] .resource-inventory__name')).toHaveLength(0);
  }
});

it("resets pagination on reopen", async () => {
  const user = userEvent.setup(), entries = Array.from({length: 15}, (_, i) => entry(`库存${i}`));
  const {rerender} = render(<ResourceInventoryDialog open onClose={() => {}} entries={entries}/>);
  await user.click(screen.getByRole("button", {name: "下一页"}));
  expect(screen.getByRole("status")).toHaveTextContent("2 / 2");
  rerender(<ResourceInventoryDialog open={false} onClose={() => {}} entries={entries}/>);
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries}/>);
  expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
});

it("opens a zero-stock resource, switches detail, and uses Escape before closing the window", async () => {
  const user = userEvent.setup(), onClose = vi.fn();
  render(<ResourceInventoryDialog open onClose={onClose} fixedEntries={[entry("食物", "补给", 0), entry("药水")]} entries={[]} />);
  const food = screen.getByRole("button", {name: "查看食物详情，0份"});
  await user.click(food);
  const detail = screen.getByRole("region", {name: "食物详情"});
  expect(within(detail).getByText("食物效果")).toBeVisible();
  expect(within(detail).getAllByRole("button")).toHaveLength(1); // inspection only
  expect(detail.querySelector(".abyssa-item-slot [data-layer=halo-a]")).not.toBeNull();
  expect(food).toHaveAttribute("aria-expanded", "true");
  await user.click(screen.getByRole("button", {name: "查看药水详情，2份"}));
  expect(screen.queryByRole("region", {name: "食物详情"})).toBeNull();
  expect(screen.getByRole("region", {name: "药水详情"})).toBeVisible();
  // Escape must work even if Tab has returned to the outer close button.
  screen.getByRole("button", {name: "关闭领地库存"}).focus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", {name: "药水详情"})).toBeNull();
  expect(screen.getByRole("button", {name: "查看药水详情，2份"})).toHaveFocus();
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});

it("dismisses on background, scroll and resize, and restores focus from detail", async () => {
  const user = userEvent.setup();
  const {container} = render(<ResourceInventoryDialog open onClose={() => {}} entries={[entry("药水")]} />);
  const item = screen.getByRole("button", {name: "查看药水详情，2份"});
  await user.click(item);
  await user.click(screen.getByRole("button", {name: "收起物品详情"}));
  expect(item).toHaveFocus();
  await user.click(item);
  await user.click(screen.getByRole("heading", {name: "物品库存"}));
  expect(screen.queryByRole("region", {name: "药水详情"})).toBeNull();
  await user.click(item);
  fireEvent.scroll(container.querySelector('[data-area="sandbox"] .resource-inventory__contents')!);
  expect(screen.queryByRole("region", {name: "药水详情"})).toBeNull();
  await user.click(item);
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("region", {name: "药水详情"})).toBeNull();
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
  await user.keyboard("{Enter}");
  expect(screen.getByRole("region", {name: "资源8详情"})).toBeVisible();
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries.slice(0, 2)} />);
  expect(screen.queryByRole("region", {name: "资源8详情"})).toBeNull();
  expect(items()[0]).toHaveFocus();
  await user.keyboard("{End}{Home}"); expect(items()[0]).toHaveFocus();
  await user.click(items()[0]);
  rerender(<ResourceInventoryDialog open={false} onClose={() => {}} entries={entries} />);
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={entries} />);
  expect(container.querySelector(".resource-inventory__detail")).toBeNull();
});

it("converts scaled stage coordinates and flips/clamps detail at the right and bottom edges", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("resource-inventory") ? 948 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("resource-inventory") ? 456 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(304);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(260);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("resource-inventory")
      ? {x: 100, y: 40, left: 100, top: 40, right: 574, bottom: 268, width: 474, height: 228, toJSON() {}}
      : {x: 512, y: 230, left: 512, top: 230, right: 554, bottom: 271, width: 42, height: 41, toJSON() {}};
  });
  const {rerender} = render(<ResourceInventoryDialog open onClose={() => {}} entries={[entry("药水")]} />);
  fireEvent.click(screen.getByRole("button", {name: "查看药水详情，2份"}));
  const detail = screen.getByRole("region", {name: "药水详情"});
  expect(detail).toHaveStyle({left: "504px", top: "196px"});
  rerender(<ResourceInventoryDialog open onClose={() => {}} entries={[entry("药水", "补给", 1)]} />);
  await waitFor(() => expect(within(detail).getByText("1", {selector: "b"})).toBeVisible());
});
