import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StockList, type StockItem } from "./StockList";

afterEach(cleanup);
const stock: StockItem[] = Array.from({length: 9}, (_, index) => ({
  id: `item-${index}`, name: `物品 ${index + 1}`, description: "测试补给", icon: "/item.svg",
  owned: 0, capacity: 2, price: 1, category: "battle",
}));
function Shelf({items}: {items: StockItem[]}) {
  const [id, select] = useState(items[0].id);
  return <StockList items={items} selectedId={items.some(item => item.id === id) ? id : items[0].id}
    mode="buy" funds={49} busy={false} pendingCount={0} onAppraise={() => {}} onSelect={item => select(item.id)} />;
}

it("pages from the shelf footer, retains keyboard focus, and omits pagination for a single page", () => {
  const view = render(<Shelf items={stock} />);
  const footer = document.querySelector<HTMLElement>(".new-shop-stock__footer")!;
  expect(within(footer).getByRole("navigation", {name: "商品翻页"})).toBeInTheDocument();
  expect(document.querySelector(".new-shop-stock__columns nav")).toBeNull();
  expect(screen.getAllByRole("option")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", {name: "下一页"}));
  expect(screen.getByLabelText("货架页码")).toHaveTextContent("2 / 2");
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(screen.getByRole("option", {name: "物品 8"})).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("option", {name: "物品 8"}), {key: "Home"});
  expect(screen.getByRole("option", {name: "物品 1"})).toHaveFocus();
  view.rerender(<Shelf items={stock.slice(0, 3)} />);
  expect(screen.queryByRole("navigation", {name: "商品翻页"})).toBeNull();
  expect(screen.getAllByRole("option")).toHaveLength(3);
});
