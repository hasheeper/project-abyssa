import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import gearIcon from "../../assets/icons/menu/gear-fill.svg";
import achievementIcon from "../../assets/icons/items/trophy-cup.svg";
import saveIcon from "../../assets/icons/menu/save.svg";
import loadIcon from "../../assets/icons/menu/load.svg";
import { MenuSidebar } from "./MenuSidebar";

afterEach(cleanup);

it("keeps six sidebar entries with an achievement placeholder instead of characters", () => {
  render(<MenuSidebar selectedId={null} onSelect={vi.fn()} />);
  for (const [label, asset] of [["设置", gearIcon], ["成就", achievementIcon], ["存档", saveIcon], ["读档", loadIcon]]) {
    const icon = screen.getByRole("button", { name: label }).querySelector<HTMLElement>(".menu-sidebar__icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon!.style.maskImage).toBe(`url("${asset}")`);
  }
  expect(screen.getAllByRole("button")).toHaveLength(6);
  expect(screen.queryByRole("button", { name: "回顾" })).toBeNull();
  expect(screen.queryByRole("button", { name: "角色" })).toBeNull();
});

it("exposes save/load next to settings and disables them while progress is unsettled", async () => {
  const onSelect = vi.fn();
  const { rerender } = render(<MenuSidebar selectedId={null} onSelect={onSelect} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "存档" }));
  await user.click(screen.getByRole("button", { name: "读档" }));
  expect(onSelect.mock.calls).toEqual([["save"], ["load"]]);
  rerender(<MenuSidebar selectedId={null} onSelect={onSelect} archiveDisabled />);
  expect(screen.getByRole("button", { name: "存档" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "读档" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "设置" })).toBeEnabled();
});

it("preserves pointer and keyboard selection for settings", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const { rerender } = render(<MenuSidebar selectedId={null} onSelect={onSelect} />);
  const settings = screen.getByRole("button", { name: "设置" });
  await user.click(settings);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("settings");
  rerender(<MenuSidebar selectedId="settings" onSelect={onSelect} />);
  expect(settings).toHaveAttribute("aria-pressed", "true");
  onSelect.mockClear();
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("settings");
});
