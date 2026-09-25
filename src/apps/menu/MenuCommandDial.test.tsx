import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MenuCommandDial } from "./MenuCommandDial";
import { useState } from "react";
import type { MenuCommandId } from "./MenuCommandDial";
import medievalVillageIcon from "../../assets/icons/menu/medieval-village-01.svg";
import characterIcon from "../../assets/icons/menu/roster-scylla.svg";
import twoCoinsIcon from "../../assets/icons/items/two-coins.svg";
import mapSwordIcon from "../../assets/icons/menu/map-sword.svg";

afterEach(cleanup);

it("uses the compact ROSTER label for the existing character page", () => {
  render(<MenuCommandDial selectedId="estate" onSelect={vi.fn()} onActivate={vi.fn()} />);
  expect(screen.getByText("ROSTER")).toBeInTheDocument();
  expect(screen.queryByText("CHARACTER")).toBeNull();
  expect(screen.queryByText("STORAGE")).toBeNull();
  expect(screen.getByRole("button", { name: "角色 · 查看角色档案" })).toBeInTheDocument();
});

it.each([
  ["estate", medievalVillageIcon],
  ["roster", characterIcon],
  ["shop", twoCoinsIcon],
  ["sortie", mapSwordIcon]
])("uses the approved %s icon in the actual command dial", (command, asset) => {
  const { container } = render(<MenuCommandDial selectedId="estate" onSelect={vi.fn()} onActivate={vi.fn()} />);
  const icon = container.querySelector<HTMLElement>(`.menu-dial__content[data-command="${command}"] .menu-dial__icon`);
  expect(icon).not.toBeNull();
  expect(icon!.style.getPropertyValue("--menu-dial-icon")).toBe(`url("${asset}")`);
});

it("paints reusable engravings without selectors crossing the SVG use shadow tree", () => {
  const { container } = render(<MenuCommandDial selectedId="estate" onSelect={vi.fn()} onActivate={vi.fn()} />);
  const motifs = container.querySelectorAll("defs > g");
  expect(motifs).toHaveLength(2);
  for (const motif of motifs) {
    expect(motif).toHaveAttribute("fill", "none");
    expect(motif).toHaveAttribute("stroke", "currentColor");
    expect(motif).toHaveAttribute("stroke-width");
    expect(Number(motif.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(1.8);
    expect(Number(motif.getAttribute("stroke-width"))).toBeLessThanOrEqual(2);
    for (const leaf of motif.querySelectorAll('path[fill="currentColor"]')) {
      expect(Number(leaf.getAttribute("fill-opacity"))).toBeGreaterThan(0);
      expect(Number(leaf.getAttribute("fill-opacity"))).toBeLessThanOrEqual(.35);
    }
    expect(motif.querySelector("[class]")).toBeNull();
    expect(motif.querySelector("circle")).toHaveAttribute("fill", "currentColor");
  }
  const instances = container.querySelectorAll("use.menu-dial__filigree");
  expect(instances).toHaveLength(10);
  expect(container.querySelectorAll("use.menu-dial__filigree--wing")).toHaveLength(6);
  for (const instance of instances) {
    const referencedId = instance.getAttribute("href")!.slice(1);
    expect([...motifs].some(motif => motif.id === referencedId)).toBe(true);
  }
});

it("gives each command a focus contour matching its inset, with no extra tab stops", async () => {
  const onSelect = vi.fn(), onActivate = vi.fn(), user = userEvent.setup();
  const { container } = render(<MenuCommandDial selectedId="estate" onSelect={onSelect} onActivate={onActivate} />);
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  const panels = container.querySelectorAll(".menu-dial__panel");
  expect(panels).toHaveLength(4);
  for (const panel of panels) {
    expect(panel.querySelector(".menu-dial__panel-focus")).toHaveAttribute("d", panel.querySelector(".menu-dial__panel-inset")!.getAttribute("d"));
  }
  for (const button of screen.getAllByRole("button")) {
    await user.tab();
    expect(button).toHaveFocus();
  }
  expect(onSelect).not.toHaveBeenCalled();
  expect(onActivate).not.toHaveBeenCalled();
});

it("preserves select-then-activate behavior for pointer and keyboard", async () => {
  const onSelect = vi.fn(), onActivate = vi.fn(), user = userEvent.setup();
  const { rerender } = render(<MenuCommandDial selectedId="estate" onSelect={onSelect} onActivate={onActivate} />);
  await user.click(screen.getByRole("button", { name: /角色/ }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("roster");
  expect(onActivate).not.toHaveBeenCalled();
  rerender(<MenuCommandDial selectedId="roster" onSelect={onSelect} onActivate={onActivate} />);
  await user.keyboard("{Enter}");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("roster");
});

it("keeps motif identifiers local when two dials are mounted", () => {
  const { container } = render(<>
    <MenuCommandDial selectedId="estate" onSelect={vi.fn()} onActivate={vi.fn()} />
    <MenuCommandDial selectedId="sortie" onSelect={vi.fn()} onActivate={vi.fn()} />
  </>);
  const ids = [...container.querySelectorAll("defs > g")].map(motif => motif.id);
  expect(new Set(ids).size).toBe(4);
});

it("keeps entry, feedback and transparent hit areas on separate planes", async () => {
  const onSelect = vi.fn(), onActivate = vi.fn(), user = userEvent.setup();
  const { container } = render(<MenuCommandDial selectedId="estate" onSelect={onSelect} onActivate={onActivate} />);
  for (const entry of container.querySelectorAll(".menu-dial__content-entry")) {
    const motion = entry.querySelector(".menu-dial__content-motion");
    expect(motion).toHaveAttribute("data-command", entry.getAttribute("data-command"));
    expect(motion?.querySelector(".menu-dial__content")).not.toBeNull();
    expect(entry.querySelector("button")).toBeNull();
  }
  await user.hover(screen.getByRole("button", { name: /角色/ }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(onActivate).not.toHaveBeenCalled();
  expect(container.querySelector(".menu-dial__response")).toBeNull();
});

it("acknowledges selection and repeated confirmation without accumulating effect nodes", async () => {
  const onActivate = vi.fn(), user = userEvent.setup();
  function Controlled() {
    const [selected, select] = useState<MenuCommandId>("estate");
    return <MenuCommandDial selectedId={selected} onSelect={select} onActivate={onActivate} />;
  }
  const { container } = render(<Controlled />);
  const roster = screen.getByRole("button", { name: /角色/ });
  await user.click(roster);
  expect(roster).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".menu-dial__panel[data-command=roster] .menu-dial__response")).toHaveAttribute("data-kind", "select");
  expect(onActivate).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  const firstConfirmation = container.querySelector(".menu-dial__response");
  expect(firstConfirmation).toHaveAttribute("data-kind", "confirm");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("roster");
  await user.keyboard(" ");
  expect(onActivate).toHaveBeenCalledTimes(2);
  expect(container.querySelector(".menu-dial__response")).not.toBe(firstConfirmation);
  expect(container.querySelectorAll(".menu-dial__response")).toHaveLength(1);
  expect(container.querySelectorAll(".menu-dial__hub-response")).toHaveLength(1);
});

it("treats a double click on an unselected command as select then one activation", async () => {
  const onSelect = vi.fn(), onActivate = vi.fn(), user = userEvent.setup();
  function Controlled() {
    const [selected, select] = useState<MenuCommandId>("estate");
    return <MenuCommandDial selectedId={selected} onSelect={id => { select(id); onSelect(id); }} onActivate={onActivate} />;
  }
  render(<Controlled />);
  await user.dblClick(screen.getByRole("button", { name: /角色/ }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("roster");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("roster");
});
