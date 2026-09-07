import { clientFixture } from "../../game-client/testing/helpers";
let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock("../../game-runtime/browser", () => ({ createBrowserGameRuntime: () => fixture.runtime }));
beforeEach(async () => { fixture = await clientFixture({ start: false }); localStorage.clear(); });
afterEach(() => fixture.session.dispose());
async function mountTitle() { let view!: ReturnType<typeof render>; await act(async () => { view = render(<TitlePage />); }); return view; }
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitlePage } from "./TitlePage";
import { TITLE_CG_FRAMES } from "./titleCg";
import { TITLE_COMMANDS } from "./titleCommands";
import { TITLE_FIELD_CENTRE_X, TITLE_FIELD_CENTRE_Y } from "./titleGeometry";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("TitlePage", () => {
  it("mounts the emblem without the opaque plate that would hide the backdrop", async () => {
    const { container } = await mountTitle();
    const emblem = container.querySelector(".abyssa-logo")!;

    // 这两个属性是本屏能成立的前提:默认底板会盖掉整个背景场。
    expect(emblem).toHaveAttribute("data-background", "none");
    expect(emblem).toHaveAttribute("data-crop", "tight");
    expect(emblem.querySelector(":scope > rect")).toBeNull();

    // 背景场必须在,且不吃点击。
    expect(container.querySelector(".title-backdrop")).toBeInTheDocument();
  });

  it("wraps the screen in AbyssaProvider so reduced-motion applies", async () => {
    // tokens.css 的 prefers-reduced-motion 规则挂在 `.abyssa-theme` 上。
    // 少了它,背景场的无限自转会无视系统设置 —— 这是无障碍问题,不是样式偏好。
    const { container } = await mountTitle();
    const theme = container.querySelector(".abyssa-theme");

    expect(theme).toBeInTheDocument();
    expect(theme).toHaveClass("title-app");
    expect(theme!.querySelector(".title-backdrop")).toBeInTheDocument();
  });

  it("shares the logo-centred field origin through the common ancestor", async () => {
    const { container } = await mountTitle();
    const app = container.querySelector<HTMLElement>(".title-app")!;

    // SVG 法阵与它下方的透光层都是这个节点的后代,继承同一个 Logo 中心原点。
    expect(app.style.getPropertyValue("--title-field-origin")).toBe(
      `${TITLE_FIELD_CENTRE_X}px ${TITLE_FIELD_CENTRE_Y}px`
    );
  });

  it("keeps rotation shells free of a transform attribute", async () => {
    // SVG 的 transform 属性就是 CSS transform 属性:壳上若已有 translate,
    // keyframe 会把它覆盖掉,图案整体飞走。壳必须是干净的。
    const { container } = await mountTitle();
    const shells = container.querySelectorAll(".title-backdrop__spin");

    expect(shells.length).toBeGreaterThan(0);
    for (const shell of shells) {
      expect(shell.hasAttribute("transform")).toBe(false);
    }
  });

  it("does not rotate the mask or the wash", async () => {
    // 径向衰减一转就会露出 mask 的矩形边界。
    const { container } = await mountTitle();

    expect(container.querySelector(".title-backdrop__wash")).not.toHaveClass("title-backdrop__spin");
    const field = container.querySelector(".title-backdrop__field")!;
    expect(field).not.toHaveClass("title-backdrop__spin");
    expect(field.getAttribute("mask")).toMatch(/^url\(#title-field-mask-/);
  });

  it("mounts one CG carousel per side, desynced and mirrored", async () => {
    const { container } = await mountTitle();
    const panels = container.querySelectorAll(".title-cg");

    expect(panels).toHaveLength(2);
    expect(container.querySelector('.title-cg[data-side="left"]')).toBeInTheDocument();
    expect(container.querySelector('.title-cg[data-side="right"]')).toBeInTheDocument();

    // CG 是气氛层,不承担信息,必须对辅助技术隐藏。
    for (const panel of panels) {
      expect(panel).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps all CG frames mounted so the crossfade has something to fade to", async () => {
    // 换 src 会先闪空白;交叉淡入要求两张同时在场。
    const { container } = await mountTitle();
    const left = container.querySelector('.title-cg[data-side="left"]')!;
    const frames = left.querySelectorAll(".title-cg__frame");

    expect(frames.length).toBe(TITLE_CG_FRAMES.length);
    expect(left.querySelectorAll(".title-cg__frame[data-active]")).toHaveLength(1);

    for (const frame of frames) {
      // 首帧要参与转场的资源等待,不能 lazy。
      expect(frame).toHaveAttribute("loading", "eager");
      expect(frame).toHaveAttribute("alt", "");
    }
  });

  it("starts the two sides on different frames", async () => {
    const { container } = await mountTitle();
    const activeSrc = (side: string) =>
      container
        .querySelector(`.title-cg[data-side="${side}"] .title-cg__frame[data-active]`)
        ?.getAttribute("src");

    expect(activeSrc("left")).not.toBe(activeSrc("right"));
  });

  it("defaults to the crimson skin that matches the CG art", async () => {
    const { container } = await mountTitle();

    expect(container.querySelector(".title-app")).toHaveAttribute("data-theme", "crimson");
  });

  it("switches skins without touching the geometry", async () => {
    const user = userEvent.setup();
    const { container } = await mountTitle();
    const app = container.querySelector(".title-app")!;
    const emblem = container.querySelector(".title-emblem")!;
    const before = emblem.className;

    await user.click(screen.getByRole("button", { name: "青幽" }));
    expect(app).toHaveAttribute("data-theme", "verdigris");

    await user.click(screen.getByRole("button", { name: "黑金" }));
    expect(app).toHaveAttribute("data-theme", "black-gold");

    // 皮肤只改颜色令牌:构图类名不许因换肤而变化。
    expect(emblem.className).toBe(before);
  });

  it("marks the active skin for assistive tech", async () => {
    const user = userEvent.setup();
    await mountTitle();

    const crimson = screen.getByRole("button", { name: "猩红" });
    expect(crimson).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "青幽" }));
    expect(crimson).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "青幽" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the footer text out of the centred stack", async () => {
    // 提示行必须在 .title-footer 里,不能是 .title-stack 的兄弟绝对定位元素 ——
    // 那正是它压在第四个键上的原因。
    const { container } = await mountTitle();
    const footer = container.querySelector(".title-footer")!;
    const stack = container.querySelector(".title-stack")!;

    expect(footer).toBeInTheDocument();
    expect(footer.querySelector(".title-hint")).toBeInTheDocument();
    expect(footer.querySelector(".title-imprint")).toBeInTheDocument();
    expect(stack.querySelector(".title-hint")).toBeNull();
  });

  it("renders every command as a real button", async () => {
    await mountTitle();

    for (const command of TITLE_COMMANDS) {
      expect(screen.getByRole("button", { name: command.label })).toBeEnabled();
    }
  });

  it("explains unwired entries instead of silently doing nothing", async () => {
    const user = userEvent.setup();
    await mountTitle();

    await user.click(screen.getByRole("button", { name: "设定" }));

    expect(screen.getByRole("status")).toHaveTextContent("设定界面尚未接入");
  });

  it("hands off to the hub through the shared blackout rather than a raw href", async () => {
    const user = userEvent.setup();
    await mountTitle();

    await user.click(screen.getByRole("button", { name: "继续游戏" }));

    // 黑幕期间必须锁输入,否则连点会发出两次导航。
    expect(document.documentElement).toHaveAttribute("data-scene-transition", "closing");
    for (const command of TITLE_COMMANDS) {
      expect(screen.getByRole("button", { name: command.label })).toBeDisabled();
    }
  });

  it("opens the archive with a valid saved campaign", async () => {
    const user = userEvent.setup(); await mountTitle();
    await user.click(screen.getByRole("button", { name: "记录" }));
    expect(screen.getByRole("dialog", { name: "游戏档案" })).toHaveTextContent("档案 save");
    expect(screen.getByRole("button", { name: "导出存档" })).toBeEnabled();
  });

});

describe("title command wiring", () => {
  it("marks exactly one command as the accent", async () => {
    // 强调项多于一个就等于没有强调。
    const accents = TITLE_COMMANDS.filter((command) => command.variant === "teal");
    expect(accents).toHaveLength(1);
    expect(accents[0].id).toBe("begin");
  });

  it("gives every unwired command a pending explanation", async () => {
    for (const command of TITLE_COMMANDS) {
      expect(command.pending.length).toBeGreaterThan(0);
    }
  });

  it("uses unique ids and labels", async () => {
    expect(new Set(TITLE_COMMANDS.map((c) => c.id)).size).toBe(TITLE_COMMANDS.length);
    expect(new Set(TITLE_COMMANDS.map((c) => c.label)).size).toBe(TITLE_COMMANDS.length);
  });
});

// jsdom 不实现布局,所以构图正确性由 titleGeometry.test.ts 的算术断言守。

describe("title shade layer", () => {
  it("sits between the CG and the backdrop", async () => {
    // 层序错了会把描边图案一起糊掉:黑幕必须在 CG 之上、背景场之下。
    const { container } = await mountTitle();
    const app = container.querySelector(".title-app")!;
    const children = Array.from(app.children);

    const cgIndexes = children
      .map((el, index) => (el.classList.contains("title-cg") ? index : -1))
      .filter((index) => index >= 0);
    const lastCg = Math.max(...cgIndexes);
    expect(cgIndexes).toHaveLength(2);
    const shade = children.findIndex((el) => el.classList.contains("title-shade"));
    const backdrop = children.findIndex((el) => el.classList.contains("title-backdrop"));

    expect(lastCg).toBeGreaterThanOrEqual(0);
    expect(shade).toBeGreaterThan(lastCg);
    expect(backdrop).toBeGreaterThan(shade);
  });

  it("is decorative only", async () => {
    const { container } = await mountTitle();
    expect(container.querySelector(".title-shade")).toHaveAttribute("aria-hidden", "true");
  });
});
