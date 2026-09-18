import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MapLoadoutPanel, type MapLoadoutItem } from "./MapLoadoutPanel";
afterEach(cleanup);
const items: MapLoadoutItem[] = [
  { id: "food", name: "食物", description: "恢复 1 点生命", icon: "/food.svg", quantity: 4, stock: 0, source: "免费配给", selected: true },
  { id: "ward", name: "护符", description: "抵挡 2 点攻击伤害", icon: "/ward.svg", quantity: 0, stock: 0, source: "战术补给", selected: false, blocked: "暂无库存" },
];
it("shows carried quantities separately from inventory without native checkboxes", () => {
  const { container } = render(<MapLoadoutPanel items={items} limit={6} onToggle={vi.fn()} onClose={vi.fn()}/>);
  expect(screen.getByRole("region", { name: "出征行囊" })).toBeInTheDocument();
  expect(container.querySelectorAll(".map-supplies__carried li")).toHaveLength(6);
  expect(container.querySelectorAll("input, details")).toHaveLength(0);
  expect(screen.getByText("恢复 1 点生命")).toBeInTheDocument();
});
it("allows inspecting an empty supply without carrying it", () => {
  const toggle = vi.fn();
  render(<MapLoadoutPanel items={items} limit={6} onToggle={toggle} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看补给：护符" }));
  expect(screen.getByText("抵挡 2 点攻击伤害")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "加入行囊" })).toBeDisabled();
  expect(toggle).not.toHaveBeenCalled();
});
it("uses the existing controlled selection and closes without issuing a departure", () => {
  const toggle = vi.fn(), close = vi.fn();
  render(<MapLoadoutPanel items={items} limit={6} onToggle={toggle} onClose={close}/>);
  fireEvent.click(screen.getByRole("button", { name: "移出行囊" }));
  expect(toggle).toHaveBeenCalledWith("food");
  fireEvent.click(screen.getByRole("button", { name: "完成整备" }));
  expect(close).toHaveBeenCalledOnce();
});
