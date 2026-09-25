import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShopMerchantDialogue } from "./ShopMerchantDialogue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {cleanup(); vi.useRealTimers();});

it("waits for the visible counter, types progressively, and keeps settled speech across unrelated updates", () => {
  const line = {text: "先替你看看。", emotion: "confused" as const};
  const draw = (ready: boolean, disabled = false) => <ShopMerchantDialogue line={line} lineKey="inspect" ready={ready} disabled={disabled} portraitHost={null}/>;
  const view = render(draw(false));
  const dialogue = screen.getByRole("region", {name: "缇比的对话"});
  act(() => vi.advanceTimersByTime(1500));
  expect(dialogue.textContent).toBe("");
  view.rerender(draw(true));
  expect(dialogue.textContent).toBe("");
  act(() => vi.advanceTimersByTime(56));
  expect(dialogue.textContent).toBe("先替");
  view.rerender(draw(true, true));
  expect(dialogue.textContent).toBe("先替");
  act(() => vi.advanceTimersByTime(500));
  expect(dialogue).toHaveTextContent(line.text);
  expect(dialogue).toHaveAttribute("aria-busy", "false");
  view.rerender(draw(true));
  expect(dialogue).toHaveTextContent(line.text);
});

it("reveals before continuing and changes the AVG eye/mouth layers with the new speech", () => {
  const portrait = document.createElement("div"); document.body.append(portrait);
  const next = vi.fn();
  const view = render(<ShopMerchantDialogue line={{text: "铜还不错，我按旧铜收。", emotion: "confident"}} lineKey="first" ready
    portraitHost={portrait} onContinue={next} continueLabel="继续听"/>);
  act(() => vi.advanceTimersByTime(56));
  const button = screen.getByRole("button", {name: "继续听"});
  fireEvent.click(button);
  expect(next).not.toHaveBeenCalled();
  expect(screen.getByRole("region", {name: "缇比的对话"})).toHaveTextContent("铜还不错，我按旧铜收。");
  fireEvent.click(button);
  expect(next).toHaveBeenCalledTimes(1);
  const doll = screen.getByRole("img", {name: "缇比·奥雷利亚"});
  const base = portrait.querySelector('[data-part="base"]');
  expect(doll).toHaveAttribute("data-expression", "l");
  view.rerender(<ShopMerchantDialogue line={{text: "盐壳不算重量哦。", emotion: "wry"}} lineKey="second" ready
    portraitHost={portrait} onContinue={next} continueLabel="再听一遍"/>);
  expect(doll).toHaveAttribute("data-expression", "i");
  expect(portrait.querySelector('[data-part="base"]')).toBe(base);
  expect(portrait.querySelector('[data-part="eyes"]')).toHaveAttribute("src", expect.stringContaining("eyes_2.png"));
  expect(portrait.querySelector('[data-part="mouth"]')).toHaveAttribute("src", expect.stringContaining("mouth_3.png"));
  const dialogue = screen.getByRole("region", {name: "缇比的对话"});
  expect(dialogue.textContent).toBe("");
  fireEvent.keyDown(dialogue, {key: "Enter"});
  expect(dialogue).toHaveTextContent("盐壳不算重量哦。");
  expect(next).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(dialogue, {key: " "});
  expect(next).toHaveBeenCalledTimes(2);
  view.unmount(); portrait.remove();
});

it("cancels unfinished speech when switching and starts the same line again on a new replay", () => {
  const view = render(<ShopMerchantDialogue line={{text: "还没有说完的旧台词。", emotion: "smile"}} lineKey="old" ready portraitHost={null}/>);
  act(() => vi.advanceTimersByTime(56));
  const line = {text: "收好了。", emotion: "joy" as const};
  view.rerender(<ShopMerchantDialogue line={line} lineKey="new" ready portraitHost={null}/>);
  act(() => vi.advanceTimersByTime(28));
  expect(screen.getByRole("region", {name: "缇比的对话"}).textContent).toBe("收");
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("region", {name: "缇比的对话"}).textContent).toBe(line.text);
  view.rerender(<ShopMerchantDialogue line={line} lineKey="replay" ready portraitHost={null}/>);
  expect(screen.getByRole("region", {name: "缇比的对话"}).textContent).toBe("");
  act(() => vi.advanceTimersByTime(28));
  expect(screen.getByRole("region", {name: "缇比的对话"}).textContent).toBe("收");
  // Returning before the intervening line finishes must still start fresh.
  view.rerender(<ShopMerchantDialogue line={line} lineKey="new" ready portraitHost={null}/>);
  expect(screen.getByRole("region", {name: "缇比的对话"}).textContent).toBe("");
});
