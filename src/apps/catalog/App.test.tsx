import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("component catalog", () => {
  /* 这个用例会渲染**整册 30 个组件**的预览(含 BattleScreen / RpScene 这类
     重量级 pattern),实测独立运行也要 5.3~6.7s,本就贴着 5s 默认上限,
     并行跑时随机超时。给它单独放宽,而不是为了迁就计时去砍预览内容 ——
     后者会削弱组件目录本身的价值。 */
  it("allows the preview sidebar to collapse and reopen", () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".demo-shell");

    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(shell).not.toHaveAttribute("data-sidebar-collapsed");
  }, 20_000);
});
