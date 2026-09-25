import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AiSettingsButton } from "./AiSettingsButton";
import { Stage } from "../../shared/stage";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("opens only the shared full settings scene and returns to the untouched small window", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("No network expected"));
  const originalAction = vi.fn();
  const { container } = render(<UiMotionProvider preference="reduced"><Stage><section aria-label="生成窗口"><p>阶段已保存</p><button onClick={originalAction}>继续生成</button><AiSettingsButton/></section></Stage></UiMotionProvider>);
  expect(screen.queryByLabelText("公共 API Key")).toBeNull();
  const trigger = screen.getByRole("button", {name: "前往设置"}); trigger.focus(); fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole("tab", {name: "Model"})).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByRole("dialog", {name: "系统设置"})).toContainElement(screen.getByLabelText("公共 API Key"));
  expect(screen.getByRole("region", {name: "生成窗口"}).querySelector("input")).toBeNull();
  expect(container.querySelectorAll(".airp-direct-settings")).toHaveLength(1);
  const save = screen.getByRole("button", {name: "保存"}), back = screen.getByRole("button", {name: "返回"});
  expect(save).toHaveClass("abyssa-hex-button");
  expect(back).toHaveClass("abyssa-hex-button");
  expect(save.closest(".abyssa-system-panel__footer")).toBe(back.closest(".abyssa-system-panel__footer"));
  expect(screen.getAllByRole("button", {name: "保存"})).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole("dialog", {name: "系统设置"}), {key: "Escape"});
  await waitFor(() => expect(screen.queryByRole("dialog", {name: "系统设置"})).toBeNull());
  expect(screen.getByText("阶段已保存")).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled(); expect(originalAction).not.toHaveBeenCalled();
});
