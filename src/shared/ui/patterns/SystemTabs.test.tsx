import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { SystemTabs } from "./SystemTabs";
afterEach(cleanup);
function Example({ pages = false, disabled = false }: { pages?: boolean; disabled?: boolean }) {
  const [selected, setSelected] = useState("1");
  return <SystemTabs pages={pages} disabled={disabled} label="分类" selected={selected} onChange={setSelected}
    items={[{ id: "1", label: "一" }, { id: "2", label: "二" }, { id: "3", label: "三" }]} />;
}
it("shares a roving focus and selection contract for section tabs", async () => {
  render(<Example />); const user = userEvent.setup();
  await user.tab(); expect(screen.getByRole("tab", { name: "一" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "二" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "二" })).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{End}"); expect(screen.getByRole("tab", { name: "三" })).toHaveFocus();
  await user.keyboard("{ArrowRight}"); expect(screen.getByRole("tab", { name: "一" })).toHaveFocus();
});
it("uses pagination semantics with the same selected treatment", async () => {
  render(<Example pages />); const user = userEvent.setup();
  expect(screen.getByRole("navigation", { name: "分类" })).toHaveClass("abyssa-system-tabs");
  await user.click(screen.getByRole("button", { name: "二" }));
  expect(screen.getByRole("button", { name: "二" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "二" })).toHaveAttribute("data-selected", "true");
  expect(screen.getByRole("button", { name: "一" })).toHaveAttribute("tabindex", "-1");
});
it("disables the whole shared tab row during an operation", () => {
  render(<Example disabled />);
  for (const tab of screen.getAllByRole("tab")) expect(tab).toBeDisabled();
});
