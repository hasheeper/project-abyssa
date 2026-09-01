import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Dice Studio", () => {
  it("renders the shared six-face die and keeps the inspector on the selected face", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "战斗六面骰调试台" })).toBeInTheDocument();
    expect(screen.getByLabelText("六面战斗骰")).toBeInTheDocument();
    for (const face of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByLabelText(`骰子第 ${face} 面`)).toBeInTheDocument();
    }

    const controls = screen.getByLabelText("骰面控制");
    fireEvent.click(within(controls).getByRole("button", { name: "4" }));

    expect(screen.getByRole("heading", { name: "第 4 面参数" })).toBeInTheDocument();
    expect(screen.getByText(/当前面 4 · 对面 3/)).toBeInTheDocument();
  });

  it("clears the pending roll timer when the studio unmounts", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    const { unmount } = render(<App />);
    const timerCountBeforeRoll = vi.getTimerCount();

    fireEvent.click(screen.getByRole("button", { name: "掷骰" }));

    expect(screen.getByRole("button", { name: "投掷中" })).toBeDisabled();
    expect(vi.getTimerCount()).toBeGreaterThan(timerCountBeforeRoll);

    unmount();
    expect(vi.getTimerCount()).toBe(timerCountBeforeRoll);
  });
});
