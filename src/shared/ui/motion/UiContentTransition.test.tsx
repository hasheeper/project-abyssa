import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiContentTransition } from "./UiContentTransition";
import { UiMotionProvider } from "./UiMotionProvider";
import { animate } from "motion/react";

vi.mock("motion/react", async importOriginal => ({
  ...await importOriginal<typeof import("motion/react")>(),
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("does not animate initial mount or a same-identity update; replacements share one live tree", () => {
  const view = (key: string, text: string) => <UiContentTransition contentKey={key}><input aria-label="内容" defaultValue={text}/><span>{text}</span></UiContentTransition>;
  const { rerender, container, unmount } = render(view("a", "A"));
  const input = screen.getByRole("textbox");
  expect(animate).not.toHaveBeenCalled();
  rerender(view("a", "A更新"));
  expect(animate).not.toHaveBeenCalled();
  rerender(view("b", "B"));
  const first = vi.mocked(animate).mock.results[0].value;
  rerender(view("c", "C"));
  expect(first.stop).toHaveBeenCalledOnce();
  expect(animate).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("B")).toBeNull();
  expect(screen.getByRole("textbox")).toBe(input);
  expect(container.querySelectorAll('[data-ui-motion-preset="content"]')).toHaveLength(1);
  const second = vi.mocked(animate).mock.results[1].value;
  unmount();
  expect(second.stop).toHaveBeenCalledOnce();
});

it("stops an active change and jumps to full visibility when reduced", () => {
  const view = (key: string, reduced: boolean) => <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <UiContentTransition contentKey={key}>{key}</UiContentTransition>
  </UiMotionProvider>;
  const { rerender } = render(view("a", false));
  rerender(view("b", false));
  const opacity = vi.mocked(animate).mock.calls[0][0] as unknown as { get(): number };
  expect(opacity.get()).toBe(0.72);
  rerender(view("b", true));
  expect(opacity.get()).toBe(1);
  expect(vi.mocked(animate).mock.results[0].value.stop).toHaveBeenCalledOnce();
  rerender(view("c", true));
  expect(animate).toHaveBeenCalledOnce();
});
