import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StoryChoices, type StoryDecision } from "./StoryChoices";
import { UiMotionProvider } from "../motion/UiMotionProvider";

afterEach(cleanup);
const decision: StoryDecision<"A" | "B"> = {id: "breakfast", prompt: "如何回应？", options: [{id: "A", label: "端走盘子"}, {id: "B", label: "喂她一口"}]};

it("uses one material, keeps decision identity, and supports arrow-key focus", () => {
  const choose = vi.fn();
  const view = render(<StoryChoices decision={decision} onChoose={choose}/>);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toHaveClass("abyssa-ribbon-button");
  act(() => buttons[0].focus()); fireEvent.keyDown(buttons[0], {key: "ArrowDown"});
  expect(buttons[1]).toHaveFocus();
  expect(buttons[1]).toHaveAttribute("data-highlighted", "true");
  fireEvent.keyDown(buttons[1], {key: "Home"}); expect(buttons[0]).toHaveFocus();
  view.rerender(<StoryChoices decision={decision} onChoose={choose} placement="inline"/>);
  expect(screen.getAllByRole("button")[0]).toBe(buttons[0]);
  expect(choose).not.toHaveBeenCalled();
  expect(view.container.querySelectorAll(".story-choices__gem")).toHaveLength(2);
  expect(view.container.querySelector(".story-choices__prompt")).toBeNull();
  expect(view.container.querySelector(".story-choices")).toHaveAttribute("aria-label", decision.prompt);
  fireEvent.pointerEnter(buttons[1]);
  expect(buttons[1]).toHaveAttribute("data-highlighted", "true");
});

it("keeps fast successful confirmation and the host gate until the real exit completes", async () => {
  const present = vi.fn(), choose = vi.fn(() => Promise.resolve());
  const wrap = (value: StoryDecision<"A" | "B"> | null) => <StoryChoices decision={value} onChoose={choose} onPresentChange={present}/>;
  const view = render(wrap(decision));
  const button = screen.getByRole("button", {name: "喂她一口"});
  await act(async () => fireEvent.click(button));
  view.rerender(wrap(null));
  expect(button).toHaveAttribute("data-selected", "true");
  expect(button).toBeDisabled();
  expect(present).toHaveBeenLastCalledWith(true);
  expect(view.container.querySelector(".story-choices")).toHaveAttribute("data-present", "false");
  await waitFor(() => expect(view.container.querySelector(".story-choices")).toBeNull());
  expect(present).toHaveBeenLastCalledWith(false);
  expect(choose).toHaveBeenCalledExactlyOnceWith("B");
});

it("dispatches immediately once, keeps selected feedback while pending, and permits a failed retry", async () => {
  let reject!: (reason: Error) => void;
  const choose = vi.fn(() => new Promise<void>((_, no) => {reject = no;}));
  render(<StoryChoices decision={decision} onChoose={choose}/>);
  const first = screen.getByRole("button", {name: "端走盘子"});
  fireEvent.click(first); fireEvent.click(first);
  expect(choose).toHaveBeenCalledExactlyOnceWith("A");
  expect(first).toHaveAttribute("data-selected", "true");
  expect(first).toBeDisabled();
  await act(async () => reject(new Error("save failed")));
  expect(screen.getByRole("alert")).toHaveTextContent("请重试");
  expect(first).toBeEnabled();
  fireEvent.click(first); expect(choose).toHaveBeenCalledTimes(2);
});

it("keeps disappearing options inert until removal and reopens the same undecided point", async () => {
  const choose = vi.fn(), wrap = (value: StoryDecision<"A" | "B"> | null) => <UiMotionProvider preference="reduced"><StoryChoices decision={value} onChoose={choose}/></UiMotionProvider>;
  const view = render(wrap(decision));
  const button = screen.getByRole("button", {name: "喂她一口"});
  view.rerender(wrap(null));
  expect(screen.queryByRole("button", {name: "喂她一口"})).toBeNull();
  fireEvent.click(button); expect(choose).not.toHaveBeenCalled();
  view.rerender(wrap(decision));
  await waitFor(() => expect(screen.getByRole("button", {name: "喂她一口"})).toBeEnabled());
  expect(view.container.querySelectorAll(".story-choices")).toHaveLength(1);
});

it("does not activate while the scene is covered or on a double-click's second event", async () => {
  const choose = vi.fn(), view = render(<StoryChoices decision={decision} enterBlocked onChoose={choose}/>);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<StoryChoices decision={decision} onChoose={choose}/>);
  fireEvent.click(screen.getByRole("button", {name: "端走盘子"}), {detail: 2});
  expect(choose).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", {name: "端走盘子"}), {detail: 1}));
  expect(choose).toHaveBeenCalledOnce();
});
