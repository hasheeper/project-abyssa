import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DirectGenerationScene } from "./DirectGenerationScene";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

afterEach(cleanup);
it("layers the supplied scene between the surrounding scrim and soft dialog while retaining the mansion", () => {
  render(<><div data-testid="resident-mansion">主洋馆</div><DirectGenerationScene title="旧药箱的搭扣" location="洋馆 · 公共休息室" background="/scene-morning.webp"><button>生成这场对白</button></DirectGenerationScene></>);
  expect(screen.getByRole("heading", {level: 2, name: "旧药箱的搭扣"})).toBeInTheDocument();
  expect(screen.getByText("洋馆 · 公共休息室")).toBeInTheDocument();
  const scene = document.querySelector(".generation-flow-layer .flow-scene")!;
  expect(scene.querySelector("img")).toHaveAttribute("src", "/scene-morning.webp");
  const modal = screen.getByRole("dialog").closest(".flow-dialog");
  expect(scene.nextElementSibling).toBe(modal);
  expect(scene.parentElement).toHaveClass("abyssa-stage__canvas");
  expect(modal?.querySelector(".flow-scene")).toBeNull();
  expect(modal?.querySelector(".abyssa-modal__scrim")).toBeInTheDocument();
  expect(scene.querySelector(".flow-scene__view")?.previousElementSibling).toHaveClass("flow-scene__curtain");
  expect(screen.getByTestId("resident-mansion")).toBeInTheDocument();
  expect(screen.getByRole("dialog", {name: "旧药箱的搭扣"})).toHaveClass("flow-dialog__panel");
  expect(document.querySelector(".airp-direct-gate, .abyssa-modal__signboard, .rp-app__stage")).toBeNull();
  expect(screen.getByRole("button", {name: "生成这场对白"})).toBeEnabled();
});

it("hands off to the side notice only after the shared modal has exited", async () => {
  const onClose = vi.fn();
  render(<UiMotionProvider preference="reduced"><DirectGenerationScene title="旧药箱的搭扣" location="洋馆" background="/scene.webp" onClose={onClose}><p>待开始</p></DirectGenerationScene></UiMotionProvider>);
  const close = screen.getByRole("button", {name: "收起，任务继续保留"});
  expect(close).toHaveClass("flow-collapse");
  expect(close.closest(".flow-context")).toBeNull();
  fireEvent.click(close);expect(onClose).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.getByRole("button",{name:/旧药箱的搭扣.*查看进度/})).toBeEnabled();
});

it("allows minimizing during work without changing or cancelling that work", async () => {
  const onClose = vi.fn();
  render(<UiMotionProvider preference="reduced"><DirectGenerationScene title="旧药箱的搭扣" location="洋馆" background="/scene.webp" onClose={onClose} closeDisabled><p>保存中</p></DirectGenerationScene></UiMotionProvider>);
  expect(screen.getByText("保存中").parentElement).toHaveAttribute("aria-busy","true");
  fireEvent.click(screen.getByRole("button", {name: "收起，任务继续保留"}));
  await waitFor(()=>expect(onClose).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button",{name:/旧药箱的搭扣.*查看进度/}));
  expect(screen.getByText("保存中")).toBeInTheDocument();
});
