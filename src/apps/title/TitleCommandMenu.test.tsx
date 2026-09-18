import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TitleCommandMenu } from "./TitleCommandMenu";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";

afterEach(cleanup);

it("sequences the four entries after the independent Logo and lets keyboard input skip the wait", async () => {
  const user = userEvent.setup(), onActivate = vi.fn();
  const { container } = render(<TitleCommandMenu intro defaultCommand="begin" disabled={false} onActivate={onActivate} />);
  const nav = screen.getByRole("navigation");
  expect(nav).toHaveAttribute("data-intro", "true");
  expect(nav.style.getPropertyValue("--title-menu-start")).toBe("4020ms");
  expect([...container.querySelectorAll<HTMLElement>(".title-commands__entry")]
    .map(entry => entry.style.getPropertyValue("--title-entry-index"))).toEqual(["0", "1", "2", "3"]);
  await user.keyboard("{End}");
  expect(nav).not.toHaveAttribute("data-intro");
  expect(screen.getByRole("button", { name: "设定" })).toHaveFocus();
  expect(onActivate).not.toHaveBeenCalled();
});

it("does not hide or replay title entries under reduced motion", () => {
  const { rerender } = render(<AbyssaProvider motionPreference="reduced">
    <TitleCommandMenu intro defaultCommand="begin" disabled={false} onActivate={vi.fn()} />
  </AbyssaProvider>);
  expect(screen.getByRole("navigation")).not.toHaveAttribute("data-intro");
  rerender(<AbyssaProvider motionPreference="system">
    <TitleCommandMenu intro defaultCommand="begin" disabled={false} onActivate={vi.fn()} />
  </AbyssaProvider>);
  expect(screen.getByRole("navigation")).not.toHaveAttribute("data-intro");
});

it("preserves authored title feedback independently of ordinary controls, with inherited reduction", async () => {
  const user = userEvent.setup(), onActivate = vi.fn();
  const { container, rerender } = render(<AbyssaProvider motionPreference="reduced">
    <TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate}/>
  </AbyssaProvider>);
  const markers = container.querySelector(".title-commands__markers");
  expect(markers?.querySelectorAll(".title-commands__gem")).toHaveLength(2);
  expect(markers?.querySelector(".abyssa-control-motion__art")).toBeNull();
  expect(screen.getByRole("navigation")).toHaveAttribute("data-ui-motion", "reduced");
  for (const button of screen.getAllByRole("button")) {
    expect(button).not.toHaveClass("abyssa-control-motion");
    expect(button.querySelectorAll(":scope > .abyssa-control-motion__art")).toHaveLength(0);
    expect(button.querySelector(".title-commands__finish")).not.toBeNull();
    expect(button.querySelector(".title-commands__sheen")).not.toBeNull();
  }
  await user.keyboard("{End} ");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("settings");
  expect(screen.getByRole("button", { name: "设定" })).toHaveAttribute("data-highlighted");
  rerender(<AbyssaProvider motionPreference="system">
    <TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate}/>
  </AbyssaProvider>);
  expect(container.querySelector(".title-commands__markers")).toBe(markers);
  expect(screen.getByRole("navigation")).toHaveAttribute("data-ui-motion", "full");
  expect(screen.getByRole("button", { name: "设定" })).toHaveAttribute("data-highlighted");
});

it("has immediate Tab targets and confirms the default action once without an intro", async () => {
  const user = userEvent.setup(), onActivate = vi.fn();
  const { container } = render(<TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate} />);
  for (const entry of container.querySelectorAll<HTMLElement>(".title-commands__entry")) {
    expect(entry).toBeVisible();
    expect(entry.style.animationDelay).toBe("");
  }
  await user.keyboard("{Tab}");
  expect(screen.getByRole("button", { name: "继续游戏" })).toHaveFocus();
  cleanup();
  render(<TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate} />);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "新的开始" })).toHaveFocus();
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("begin");
});

it("keeps one selection across pointer and keyboard, and does not undo the user's choice after saves load", async () => {
  const onActivate = vi.fn();
  const user = userEvent.setup();
  const { rerender, container } = render(<TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate} />);
  const begin = screen.getByRole("button", { name: "新的开始" });
  const archive = screen.getByRole("button", { name: "记录" });
  expect(begin).toHaveAttribute("data-highlighted");
  await user.keyboard("{ArrowDown}");
  expect(begin).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(archive).toHaveFocus();
  await user.hover(begin);
  expect(begin).toHaveFocus();
  expect(begin).toHaveAttribute("data-highlighted");
  rerender(<TitleCommandMenu defaultCommand="continue" disabled={false} onActivate={onActivate} />);
  expect(begin).toHaveAttribute("data-highlighted");
  expect(container.querySelectorAll("[data-highlighted]")).toHaveLength(1);
  await user.unhover(begin);
  expect(begin).toHaveAttribute("data-highlighted");
  await user.keyboard("{Enter}");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("begin");
});

it("respects dialog and other controls, and suspends shortcuts while the title is blocked", async () => {
  const onActivate = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<><TitleCommandMenu defaultCommand="begin" disabled={false} onActivate={onActivate} />
    <button>辅助操作</button><div role="dialog"><input aria-label="档案名称" /></div></>);
  const input = screen.getByRole("textbox");
  act(() => input.focus());
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input).toHaveFocus();
  expect(onActivate).not.toHaveBeenCalled();
  const other = screen.getByRole("button", { name: "辅助操作" });
  act(() => other.focus());
  await user.keyboard("{ArrowDown}");
  expect(other).toHaveFocus();
  rerender(<TitleCommandMenu defaultCommand="begin" disabled onActivate={onActivate} />);
  fireEvent.keyDown(document.body, { key: "Enter" });
  fireEvent.keyDown(document.body, { key: "ArrowDown" });
  expect(onActivate).not.toHaveBeenCalled();
});

it("honors Home/End and wraps arrow navigation without turning actions into toggle buttons", async () => {
  const user = userEvent.setup();
  render(<TitleCommandMenu defaultCommand="continue" disabled={false} onActivate={vi.fn()} />);
  await user.keyboard("{End}");
  expect(screen.getByRole("button", { name: "设定" })).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("button", { name: "继续游戏" })).toHaveFocus();
  await user.keyboard("{ArrowUp}");
  expect(screen.getByRole("button", { name: "设定" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(screen.getByRole("button", { name: "继续游戏" })).toHaveFocus();
  for (const button of screen.getAllByRole("button")) expect(button).not.toHaveAttribute("aria-pressed");
});
