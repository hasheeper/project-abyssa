import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MansionTimeLoading } from "./MansionTimeLoading";
import { SceneTransition } from "../../shared/transition/SceneTransition";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

afterEach(cleanup);

it("labels a weather-only preview without implying that time advanced",()=>{
  const {baseElement: container}=render(<MansionTimeLoading phase="day" fromPhase="day" day={2} weather="rain" step="work" state="loading" message="正在准备雨天景致"/>);
  expect(screen.getByRole("status",{name:"洋馆天气加载"})).toBeInTheDocument();
  expect(screen.getByRole("heading",{name:"雨天"})).toBeInTheDocument();
  expect(screen.queryByRole("list",{name:"当日时序"})).toBeNull();
  expect(container.querySelector(".mansion-time-loading__weather")).not.toBeNull();
  expect(container.querySelector(".mansion-time-loading__clock")).toBeNull();
});

it("keeps the night-to-dawn hand moving forward and shares controller timings", () => {
  render(<MansionTimeLoading phase="dawn" fromPhase="night" day={2} step="cover" state="loading" message="正在确认时段"/>);
  const cover = screen.getByRole("status",{name:"洋馆时段加载"});
  expect(cover).toHaveAttribute("data-step","cover");
  expect(cover.style.getPropertyValue("--time-hand-from")).toBe("270deg");
  expect(cover.style.getPropertyValue("--time-hand-to")).toBe("360deg");
  expect(cover.style.getPropertyValue("--time-cover-duration")).toBe("420ms");
  expect(cover.style.getPropertyValue("--time-reveal-duration")).toBe("660ms");
});

it("exposes paused motion under a closed route curtain without disabling error recovery", () => {
  render(<MansionTimeLoading phase="night" fromPhase="dusk" day={1} step="error" state="error" motionPaused message="" error="请重试读取" onRetry={()=>{}}/>);
  expect(screen.getByRole("alert")).toHaveAttribute("data-motion-paused","true");
  expect(screen.getByRole("button",{name:"重试读取"})).toBeEnabled();
});

it.each([
  ["dawn", "晨光将至", 0], ["day", "白昼渐明", 1],
  ["dusk", "暮色渐沉", 2], ["night", "夜幕降临", 3]
] as const)("uses shared non-interactive facets and a themed frame for %s", (phase, title, index) => {
  const {baseElement: container} = render(<MansionTimeLoading phase={phase} fromPhase="dawn" day={2} step="work" state="loading" message="正在准备洋馆景致"/>);
  const cover = screen.getByRole("status", {name: "洋馆时段加载"});
  expect(cover).toHaveClass("abyssa-theme");
  expect(cover).toHaveAttribute("data-density", "compact");
  expect(cover).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("heading", {name: title})).toBeInTheDocument();
  const marks = within(screen.getByRole("list", {name: "当日时序"})).getAllByRole("listitem");
  expect(marks).toHaveLength(4);
  expect(marks[index]).toHaveAttribute("aria-current", "time");
  expect(container.querySelectorAll('.abyssa-facet-diamond[data-state="elapsed"]')).toHaveLength(index);
  expect(container.querySelectorAll('.abyssa-facet-diamond[data-state="current"]')).toHaveLength(1);
  expect(container.querySelectorAll(".abyssa-frame")).toHaveLength(1);
  expect(container.querySelector("canvas, img, .mansion-time-loading__orbit")).toBeNull();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("keeps the instrument mounted as the readiness step and status change", () => {
  const props = {phase: "night", fromPhase: "dusk", day: 3, state: "loading"} as const;
  const {baseElement: container, rerender} = render(<MansionTimeLoading {...props} step="work" message="正在确认时段"/>);
  const frame = container.querySelector(".abyssa-frame"), emblem = container.querySelector(".mansion-time-loading__clock");
  const roll = container.querySelector(".mansion-time-loading__symbol-roll");
  expect(screen.getByRole("status",{name:"洋馆时段加载"})).not.toHaveAttribute("data-time-started");
  rerender(<MansionTimeLoading {...props} step="paint" message="正在准备洋馆景致"/>);
  expect(screen.getByRole("status",{name:"洋馆时段加载"})).toHaveAttribute("data-time-started");
  expect(container.querySelector(".abyssa-frame")).toBe(frame);
  expect(container.querySelector(".mansion-time-loading__symbol-roll")).toBe(roll);
  expect(container.querySelector(".mansion-time-loading__clock")).toBe(emblem);
  expect(container.querySelector(".mansion-time-loading__symbol-roll")).toBe(roll);
  rerender(<MansionTimeLoading {...props} step="reveal" message="景致已就绪"/>);
  expect(container.querySelector(".abyssa-frame")).toBe(frame);
  expect(screen.getByText("景致已就绪")).toBeInTheDocument();
});

it("uses the route loading material outside Stage and keeps the existing six-plane route spinner", () => {
  const {container} = render(<div className="abyssa-stage__canvas" style={{transform:"scale(.5)"}}>
    <MansionTimeLoading phase="night" fromPhase="dusk" day={2} step="paint" state="loading" message="正在准备洋馆景致"/>
    <SceneTransition phase="closed"/>
  </div>);
  const passage = screen.getByRole("status",{name:"洋馆时段加载"});
  expect(passage.parentElement).toBe(document.body);
  expect(container.querySelector(".mansion-time-loading")).toBeNull();
  expect(passage).toHaveClass("scene-loading-surface");
  expect(passage.querySelector(".abyssa-frame")).toHaveClass("scene-loading-plaque");
  expect(container.querySelector(".scene-transition__plaque")).toHaveClass("scene-loading-plaque");
  expect(container.querySelectorAll(".scene-transition__spinner > [data-plane]")).toHaveLength(6);
});

it("waits for visible prepared scenery before starting the clock, and preserves reduced motion through the portal", () => {
  const props = {phase:"dawn",fromPhase:"night",day:2,state:"loading",message:"正在准备洋馆景致"} as const;
  const mounted = render(<UiMotionProvider preference="reduced"><MansionTimeLoading {...props} step="paint" motionPaused/></UiMotionProvider>);
  const passage = screen.getByRole("status",{name:"洋馆时段加载"});
  expect(passage).toHaveAttribute("data-ui-motion","reduced");
  expect(passage).not.toHaveAttribute("data-time-started");
  mounted.rerender(<UiMotionProvider preference="reduced"><MansionTimeLoading {...props} step="paint"/></UiMotionProvider>);
  expect(passage).toHaveAttribute("data-time-started");
});

it("hides the portalled curtain while story owns the screen without replacing its instrument", () => {
  const props = {phase:"night",fromPhase:"dusk",day:2,step:"paint",state:"loading",message:"正在准备洋馆景致"} as const;
  const {rerender} = render(<MansionTimeLoading {...props} suspended/>);
  const passage = document.querySelector(".mansion-time-loading")!;
  const clock = passage.querySelector(".mansion-time-loading__clock");
  expect(passage).toHaveAttribute("hidden");
  expect(passage).toHaveAttribute("data-motion-paused");
  expect(passage).not.toHaveAttribute("data-time-started");
  expect(screen.queryByRole("status",{name:"洋馆时段加载"})).toBeNull();
  rerender(<MansionTimeLoading {...props}/>);
  expect(screen.getByRole("status",{name:"洋馆时段加载"})).toBe(passage);
  expect(passage).not.toHaveAttribute("hidden");
  expect(passage).toHaveAttribute("data-time-started");
  expect(passage.querySelector(".mansion-time-loading__clock")).toBe(clock);
});

it.each([["dawn", "day"], ["day", "dusk"], ["dusk", "night"], ["night", "dawn"]] as const)(
  "rolls %s upward into %s inside a local SVG viewport", (fromPhase, phase) => {
    const {baseElement: container} = render(<MansionTimeLoading phase={phase} fromPhase={fromPhase} day={2} step="cover" state="loading" message="正在确认时段"/>);
    const viewport = container.querySelector(".mansion-time-loading__symbol-window");
    expect(viewport).toHaveAttribute("data-direction", "up");
    expect(viewport).toHaveAttribute("overflow", "hidden");
    expect(Array.from(viewport!.querySelectorAll("[data-symbol]"), node => node.getAttribute("data-symbol"))).toEqual([fromPhase, phase]);
    expect(viewport!.querySelector(`[data-symbol="${phase}"]`)?.parentElement).toHaveAttribute("transform", "translate(0 88)");
  }
);

it("does not invent a time change on initial entry into the same phase", () => {
  const {baseElement: container} = render(<MansionTimeLoading phase="night" fromPhase="night" day={2} step="work" state="loading" message="正在准备洋馆景致"/>);
  expect(container.querySelector(".mansion-time-loading__symbol-roll")).toBeNull();
  expect(container.querySelectorAll('[data-symbol="night"]')).toHaveLength(1);
});

it("keeps shared recovery controls usable and preserves menu navigation semantics", () => {
  const onRetry = vi.fn();
  const {baseElement: container} = render(<MansionTimeLoading phase="night" fromPhase="dusk" day={2} step="error" state="error"
    message="" error="景致暂未准备完成" onRetry={onRetry} menuHref="#/menu?save=test"/>);
  const retry = screen.getByRole("button", {name: "重试读取"});
  const menu = screen.getByRole("link", {name: "返回菜单"});
  expect(screen.getByRole("alert")).toHaveAttribute("aria-busy", "false");
  expect(retry).toHaveClass("scene-loading-action");
  expect(menu).toHaveClass("scene-loading-action");
  expect(menu).toHaveAttribute("href", "#/menu?save=test");
  expect(retry.closest("[inert]")).toBeNull();
  expect(menu.querySelector("button")).toBeNull();
  fireEvent.click(retry);
  expect(onRetry).toHaveBeenCalledOnce();
  const ids = Array.from(container.querySelectorAll("[id]"), node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
});
