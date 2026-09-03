import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("character status app", () => {
  it("exposes three archive tabs", () => {
    render(<App />);

    const tablist = screen.getByRole("tablist", { name: "角色档案分类" });
    expect(tablist.querySelectorAll('[role="tab"]')).toHaveLength(3);
    for (const label of ["概要", "骰装", "记事"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "概要" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("only mounts the edge weave for themes that display it", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(container.querySelector(".abyssa-character-screen__edge-weave")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /尤斯缇丝/ }));
    expect(container.querySelector(".abyssa-character-screen__edge-weave")).toBeNull();

    await user.click(screen.getByRole("button", { name: /艾比希斯/ }));
    expect(container.querySelector(".abyssa-character-screen__edge-weave")).not.toBeNull();
  });

  /* 六维评级已删除:它不参战也不叙事。档案不得把它加回来。 */
  it("no longer renders the six parameter ranks", () => {
    const { container } = render(<App />);

    expect(container.querySelector(".abyssa-status-panel__parameters")).toBeNull();
    expect(screen.queryByLabelText("参数")).not.toBeInTheDocument();
    expect(screen.queryByText("PARAMETERS")).not.toBeInTheDocument();
    for (const axis of ["LIFE", "POWER", "AGILITY", "MANA", "CONTROL", "TACTICS"]) {
      expect(screen.queryByText(axis)).not.toBeInTheDocument();
    }
    expect(screen.getByText("BIOGRAPHY")).toBeInTheDocument();
    expect(screen.getByText(/PACT 能力/)).toBeInTheDocument();
    expect(screen.queryByText("INHERENT TRAITS")).not.toBeInTheDocument();
  });

  it("renders the bond, live status, pact, and biography skeleton", () => {
    const { container } = render(<App />);

    expect(screen.getByLabelText("羁绊与当前状态")).toBeInTheDocument();
    expect(screen.queryByText("【默认的默契】")).not.toBeInTheDocument();
    expect(screen.getByText("62/100")).toBeInTheDocument();
    expect(screen.getByText("轻伤休养")).toBeInTheDocument();
    expect(screen.getByText("· 2天")).toBeInTheDocument();
    expect(screen.getByText("闭门阅卷中")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-status-panel__bond-main")).not.toBeNull();
    expect(container.querySelector(".abyssa-status-panel__status")).not.toBeNull();
    expect(container.querySelector('[data-icon="wound"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="book"]')).not.toBeNull();
    expect(container.querySelectorAll('.abyssa-status-panel__bond-node[data-state="complete"]')).toHaveLength(3);
    expect(container.querySelectorAll('.abyssa-status-panel__bond-node[data-state="current"]')).toHaveLength(1);
    expect(container.querySelectorAll('.abyssa-status-panel__bond-node[data-state="locked"]')).toHaveLength(1);
    expect(container.querySelector('.abyssa-bond-crystal[data-state="current"]')).toHaveAttribute("data-highlight", "false");
    expect(container.querySelector('.abyssa-bond-crystal[data-state="current"]')).toHaveAttribute("data-progress", "62");
    expect(
      [...container.querySelectorAll(".abyssa-bond-crystal__stage-mark")].map((node) => node.textContent)
    ).toEqual(["I", "II", "III", "V"]);
    expect(
      container.querySelector('.abyssa-bond-crystal[data-state="current"] .abyssa-bond-crystal__stage-mark')
    ).toBeNull();
    expect(container.querySelector<HTMLElement>(".abyssa-status-panel__bond-track")?.style.getPropertyValue("--abyssa-bond-track-progress")).toBe("72.4%");
    expect(container.querySelectorAll('.abyssa-status-panel__bond-scale i[data-state="complete"]')).toHaveLength(3);
    expect(container.querySelectorAll('.abyssa-status-panel__bond-scale i[data-state="current"]')).toHaveLength(1);

    expect(screen.getByText("两对成型时")).toBeInTheDocument();
    expect(container.querySelector("del")).toBeNull();
    expect(container.querySelector('[data-pact-icon="skill"]')).not.toBeNull();
    expect(container.querySelector('[data-pact-icon="trigger"]')).not.toBeNull();
    expect(container.querySelector('[data-pact-icon="authority"]')).not.toBeNull();
    expect(screen.queryByText("旧约已封存")).not.toBeInTheDocument();
    expect(screen.queryByText("随机抽取目标强制捆缚")).not.toBeInTheDocument();
    expect(screen.queryByText(/阶段 III 重签/)).not.toBeInTheDocument();
    expect(screen.getByText(/捆住一枚敌方意图延迟一回合/)).toBeInTheDocument();
    expect(screen.getByText("BIOGRAPHY")).toBeInTheDocument();
    /* 语录已整体移除(太占地方,概要页空间紧张):契约字段、9 条内容、
       样式令牌全部清掉。这条守着它别再回来。 */
    expect(container.querySelector(".abyssa-status-panel__quote")).toBeNull();
  });

  /* 页签过去只改 aria-selected 不换内容(四页渲染同一个面板)。
     这条钉住「真的分流了」。 */
  it("swaps panel content between the three tabs", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(container.querySelector(".abyssa-status-panel")).not.toBeNull();

    await user.click(screen.getByRole("tab", { name: "骰装" }));
    expect(container.querySelector(".abyssa-status-panel")).toBeNull();
    expect(container.querySelector(".abyssa-dice")).not.toBeNull();

    await user.click(screen.getByRole("tab", { name: "记事" }));
    expect(container.querySelector(".abyssa-dice")).toBeNull();
    expect(container.querySelector(".abyssa-chronicle")).not.toBeNull();

    await user.click(screen.getByRole("tab", { name: "概要" }));
    expect(container.querySelector(".abyssa-status-panel")).not.toBeNull();
  });

  /* 记事页:样稿三人有时间线,其余为占位。
     摘要读数由 App 给成字符串(面板不推导),所以在这里验。 */
  it("renders the chronicle timeline with derived summary readings", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("tab", { name: "记事" }));

    /* 蕾诺尔:羁绊 Lv.3、私约 II(取自 profiles.ts)。
       只在摘要区里找 —— 条目徽标上也会出现 "Lv.3",全局查会撞车。 */
    expect(container.querySelector(".abyssa-chronicle__list")).not.toBeNull();
    const summary = container.querySelector(".abyssa-chronicle__summary")!;
    expect(summary.textContent).toContain("Lv.3");
    expect(summary.textContent).toContain("II");
    expect(container.querySelector('[data-placeholder="true"]')).toBeNull();
    expect(
      container.querySelectorAll(".abyssa-chronicle__chapter").length
    ).toBeGreaterThan(0);

    // 未录入记事的角色落到占位,而不是渲染一条假年表。
    await user.click(screen.getByRole("button", { name: /诺玛/ }));
    expect(container.querySelector('[data-placeholder="true"]')).not.toBeNull();
    expect(container.querySelector(".abyssa-chronicle__entry")).toBeNull();
  });

  /* 默认落在蕾诺尔 —— 本期两副完整骰装之一。 */
  it("renders the authored die on the dice tab and a placeholder otherwise", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("tab", { name: "骰装" }));
    expect(screen.getByLabelText("命骰六面")).toBeInTheDocument();
    expect(container.querySelector('[data-placeholder="true"]')).toBeNull();
    for (const die of container.querySelectorAll<HTMLElement>(
      ".expedition-flat-die-frame"
    )) {
      expect(die.style.getPropertyValue("--expedition-die-theme-color")).toBe(
        "var(--abyssa-teal)"
      );
    }

    // 尤斯缇丝已有骰装,改用尚未编入远征的诺玛验证占位态。
    await user.click(screen.getByRole("button", { name: /诺玛/ }));
    expect(container.querySelector('[data-placeholder="true"]')).not.toBeNull();
    expect(screen.getByText("未编入远征")).toBeInTheDocument();
  });
});
