import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MenuPage } from "./MenuPage";

afterEach(cleanup);

describe("MenuPage", () => {
  it("exposes the four hub destinations and the six archive entries", () => {
    render(<MenuPage />);

    // 四角命令盘:府邸 / 仓库 / 商店 / 出征。
    const dial = screen.getByRole("navigation", { name: "主菜单" });
    expect(within(dial).getAllByRole("button")).toHaveLength(4);
    for (const label of ["府邸", "仓库", "商店", "出征"]) {
      expect(within(dial).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    for (const displayLabel of ["MANOR", "STORAGE", "SHOP", "SORTIE"]) {
      expect(within(dial).getByText(displayLabel)).toBeInTheDocument();
    }
    // 左侧栏六项。
    const rail = screen.getByRole("navigation", { name: "档案与设置" });
    expect(within(rail).getAllByRole("button")).toHaveLength(6);
    expect(rail.querySelector(".abyssa-vertical-indicator")).toBeNull();
    for (const label of ["图鉴", "角色", "记忆", "回顾", "成就", "设置"]) {
      expect(within(rail).getByRole("button", { name: label })).toBeInTheDocument();
      expect(within(rail).getByText(label)).toBeInTheDocument();
    }
  });

  it("shows day, phase and all three resources inside shared RPG frames", () => {
    const { container } = render(<MenuPage />);

    expect(screen.getByLabelText("第 12 天")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "当前相位 昏" })).toBeInTheDocument();
    // 三笔资源各自可读,金额走 CurrencyAmount 的 toLocaleString。
    expect(screen.getByLabelText("维稳公款 12800")).toBeInTheDocument();
    expect(screen.getByLabelText("小队资金 1450")).toBeInTheDocument();
    expect(screen.getByLabelText("远古晶石 8")).toBeInTheDocument();
    expect(screen.getByLabelText("时间与相位")).toHaveAttribute("data-side", "left");
    expect(screen.getByLabelText("持有资源")).toHaveAttribute("data-side", "right");
    expect(container.querySelectorAll(".menu-topbar .menu-hud-frame__art")).toHaveLength(2);
    expect(container.querySelectorAll(".menu-topbar .menu-hud-frame__outer")).toHaveLength(1);
    expect(container.querySelector(".menu-topbar .menu-hud-frame__funds-corner-edge")).not.toBeNull();
  });

  it("moves the dial selection without rendering a redundant hint line", async () => {
    const user = userEvent.setup();
    render(<MenuPage />);

    // 默认选中府邸。
    expect(screen.getByRole("button", { name: /府邸/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /出征/ }));

    expect(screen.getByRole("button", { name: /出征/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /府邸/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("编队并进入副本")).not.toBeInTheDocument();
  });

  /* 破窗设计的契约:立绘本身不被画框或名牌包住，切换入口放在左下控制台。 */
  it("renders the portrait without an inline frame and keeps switching in the scene console", () => {
    const { container } = render(<MenuPage />);

    const host = container.querySelector(".menu-app__host");
    expect(host).not.toBeNull();
    expect(host?.querySelector(".abyssa-frame")).toBeNull();
    expect(host?.querySelector(".abyssa-nameplate")).toBeNull();
    expect(host?.querySelector(".menu-host__figure")).not.toBeNull();
    const characterSwitch = screen.getByRole("button", { name: /切换角色，当前艾比希斯，5\/9/ });
    expect(host).not.toContainElement(characterSwitch);
    expect(screen.getByRole("button", { name: /切换背景，当前月下长廊，1\/1/ })).toBeInTheDocument();
  });

  it("cycles the resident character from the bottom-left console", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    await user.click(screen.getByRole("button", { name: /切换角色，当前艾比希斯，5\/9/ }));

    expect(screen.getByRole("button", { name: /切换角色，当前玛丽埃塔/ })).toBeInTheDocument();
    expect(container.querySelector<HTMLImageElement>(".menu-host__figure")?.alt).toContain("玛丽埃塔");
  });

  /* 「角色」是左栏唯一接了目标页的条目:第一次点只选中说话,
     再点一次才拉黑幕跳 character-status.html。 */
  it("opens the character archive when the roster entry is confirmed", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    const roster = screen.getByRole("button", { name: "角色" });
    await user.click(roster);

    // 第一次:只选中并说话,黑幕不动。台词走打字机,得等它敲完。
    expect(roster).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("想看谁的档案？")).toBeInTheDocument();
    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "idle");

    await user.click(roster);

    // 第二次:黑幕闭合并报出目的地。
    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "closing");
    expect(screen.getByText("角色档案")).toBeInTheDocument();
    expect(screen.getByText("正在翻阅")).toBeInTheDocument();
  });

  /* 没有目标页的条目仍是纯占位:点两次也不许拉黑幕。 */
  it("keeps unwired archive entries inert on repeated clicks", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    const codex = screen.getByRole("button", { name: "图鉴" });
    await user.click(codex);
    await user.click(codex);

    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("places the host dialogue below the command dial instead of over the portrait", () => {
    const { container } = render(<MenuPage />);

    const dialogue = screen.getByRole("region", { name: /的对话/ });
    expect(container.querySelector(".menu-app__dial")).toContainElement(dialogue);
    expect(container.querySelector(".menu-app__host")).not.toContainElement(dialogue);
    expect(dialogue).toHaveAttribute("data-nameplate", "true");
    expect(within(dialogue).getByText("艾比希斯")).toBeInTheDocument();
    expect(within(dialogue).getByText("ABYSSA BEELZERAN")).toBeInTheDocument();
    expect(container.querySelector(".menu-app__dial-hint")).toBeNull();
  });
});
