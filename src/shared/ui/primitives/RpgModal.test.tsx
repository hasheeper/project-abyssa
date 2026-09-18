import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { RpgModal } from "./RpgModal";
import { UiMotionProvider } from "../motion/UiMotionProvider";

afterEach(() => {cleanup();vi.restoreAllMocks();});


it("opts manor boards into separate scrim/panel tracks without remounting on content updates", async () => {
  const presented = vi.fn();
  const view = (open: boolean, text: string) => <RpgModal open={open} title="日志" signboard="日志"
    motionPreset="manor" onClose={() => {}} onPresentChange={presented}>{text}</RpgModal>;
  const {rerender} = render(view(true, "旧记录"));
  const panel = screen.getByRole("dialog"), root = panel.parentElement!;
  expect(root).toHaveAttribute("data-ui-motion-preset", "manor");
  expect(root.querySelector(".abyssa-modal__scrim")).not.toBeNull();
  expect(root.style.opacity).toBe("");
  expect(panel.querySelector(".abyssa-modal__signboard")).not.toBeNull();
  await waitFor(() => expect(panel.style.willChange).toBe("auto"));
  rerender(view(true, "新记录"));
  expect(screen.getByRole("dialog")).toBe(panel);
  expect(panel).toHaveStyle({opacity: "1", translate: "0px 0px"});
  rerender(view(false, "新记录"));
  expect(panel).toBeInTheDocument();
  expect(presented.mock.calls).toEqual([[true]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(presented.mock.calls).toEqual([[true], [false]]);
});

it("keeps manor early-close/reopen continuity and reduced-motion exit input ownership", async () => {
  const view = (open: boolean, reduced = false) => <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <RpgModal open={open} title="仓库" motionPreset="manor" onClose={() => {}}><input defaultValue="保留"/></RpgModal>
  </UiMotionProvider>;
  const {rerender} = render(view(true));
  const panel = screen.getByRole("dialog");
  rerender(view(false)); rerender(view(true));
  expect(screen.getByRole("dialog")).toBe(panel);
  expect(screen.getByRole("textbox")).toHaveValue("保留");
  rerender(view(false, true));
  await waitFor(() => expect(panel).toHaveStyle({translate:"0px 0px"}));
  expect(panel.querySelector("input")?.closest("[inert]")).not.toBeNull();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("takes focus in the opening commit so Escape works before the first animation frame", () => {
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  const close = vi.fn();
  // One focusable child isolates same-commit focus from the default close button.
  const view = (open: boolean) => <><button>来源</button><RpgModal open={open} title="回看" closable={false} onClose={close}><button>阅读</button></RpgModal></>;
  const {rerender} = render(view(false));
  screen.getByText("来源").focus(); rerender(view(true));
  expect(screen.getByText("阅读")).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, {key:"Escape"});
  expect(close).toHaveBeenCalledOnce();
});

it("retains the exit, blocks business and background input, then restores focus", async () => {
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  const action = vi.fn(), background = vi.fn(), presented = vi.fn();
  const view = (open: boolean) => <><button onClick={background}>入口</button>
    <RpgModal open={open} title="测试" onClose={() => {}} onPresentChange={presented}>
      <button onClick={action}>执行</button>
    </RpgModal></>;
  const { rerender } = render(view(false));
  const trigger = screen.getByText("入口"); trigger.focus();
  rerender(view(true));
  const dialog = screen.getByRole("dialog"), execute = screen.getByText("执行");
  await waitFor(() => expect(dialog.parentElement).toHaveStyle({ opacity: "1" }));
  fireEvent.click(execute); expect(action).toHaveBeenCalledOnce();
  rerender(view(false));
  expect(dialog).toBeInTheDocument();
  expect(dialog).toHaveFocus();
  expect(dialog.parentElement).toHaveAttribute("data-open", "false");
  expect(execute.closest("[inert]")).not.toBeNull();
  fireEvent.click(execute); fireEvent.click(trigger); fireEvent.keyDown(trigger, { key: "Enter" });
  expect(action).toHaveBeenCalledOnce(); expect(background).not.toHaveBeenCalled();
  expect(presented.mock.calls).toEqual([[true]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(presented.mock.calls).toEqual([[true], [false]]);
  fireEvent.click(trigger); expect(background).toHaveBeenCalledOnce();
});

it("reopens the same instance during exit without stale cleanup or loss of source focus", async () => {
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  const presented = vi.fn();
  const view = (open: boolean) => <StrictMode><button>入口</button>
    <RpgModal open={open} title="测试" onClose={() => {}} onPresentChange={presented}><input defaultValue="保留"/></RpgModal>
  </StrictMode>;
  const { rerender } = render(view(false));
  const trigger = screen.getByText("入口"); trigger.focus();
  rerender(view(true));
  const dialog = screen.getByRole("dialog"), input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "不重置" } });
  rerender(view(false)); rerender(view(true));
  await waitFor(() => expect(dialog.parentElement).toHaveStyle({ opacity: "1" }));
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(input).toHaveValue("不重置");
  expect(input.closest("[inert]")).toBeNull();
  expect(presented.mock.lastCall).toEqual([true]);
  rerender(view(false));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("removes spatial movement when preference changes during exit and still completes", async () => {
  const view = (open: boolean, reduced: boolean) => <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <RpgModal open={open} title="测试" onClose={() => {}}>正文</RpgModal>
  </UiMotionProvider>;
  const { rerender } = render(view(true, false));
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(dialog.parentElement).toHaveStyle({ opacity: "1" }));
  rerender(view(false, false)); rerender(view(false, true));
  await waitFor(() => expect(dialog).toHaveStyle({ translate: "0px 0px" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("uses a surviving host fallback when the trigger was removed and releases listeners on route removal", async () => {
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  const view = (open: boolean, source: boolean) => <>{source && <button>来源</button>}<button>安全落点</button>
    <RpgModal open={open} title="测试" onClose={() => {}}>正文</RpgModal></>;
  const { rerender, unmount } = render(view(false, true));
  screen.getByText("来源").focus(); rerender(view(true, true));
  rerender(view(false, false));
  await waitFor(() => expect(screen.getByText("安全落点")).toHaveFocus());
  rerender(view(true, false)); unmount();
  const handler = vi.fn(); window.addEventListener("keydown", handler);
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(handler).toHaveBeenCalledOnce();
  window.removeEventListener("keydown", handler);
});

it("opts into a slim exterior plate without changing the default or adding an internal title", () => {
  const {rerender} = render(<RpgModal open title="日志" signboard="日志" header={null} signboardVariant="slim" onClose={() => {}}>正文</RpgModal>);
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector(".abyssa-modal__signboard")).toHaveAttribute("data-variant","slim");
  expect(dialog.querySelector(".abyssa-frame")).not.toContainElement(dialog.querySelector(".abyssa-modal__signboard"));
  expect(dialog.querySelector(".abyssa-modal__head")).toBeNull();
  rerender(<RpgModal open title="日志" signboard="日志" onClose={() => {}}>正文</RpgModal>);
  expect(dialog.querySelector(".abyssa-modal__signboard")).toHaveAttribute("data-variant","default");
});

it("loops over native disclosure headings without including disabled or roving-tab endpoints", () => {
  // jsdom has no layout; browser coverage verifies the same visible Tab order.
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  render(<RpgModal open title="记事" onClose={() => {}}>
    <button>查看近况</button>
    <details><summary>旧记录</summary></details>
    <button tabIndex={-1}>未选分页</button>
    <button disabled tabIndex={0}>不可用操作</button>
    <div inert><button>背景操作</button></div>
  </RpgModal>);
  const close = screen.getByRole("button",{name:"关闭记事"}), last = screen.getByText("旧记录");
  last.focus(); fireEvent.keyDown(last,{key:"Tab"});
  expect(close).toHaveFocus();
  fireEvent.keyDown(close,{key:"Tab",shiftKey:true});
  expect(last).toHaveFocus();
});

it("keeps external navigation inside the dialog focus boundary and can omit its inner header", () => {
  vi.spyOn(HTMLElement.prototype,"offsetParent","get").mockReturnValue(document.body);
  render(<RpgModal open title="记事" header={null} navigation={<nav><button>归来记录</button></nav>} onClose={() => {}}>
    <button>查看账目</button>
  </RpgModal>);
  const dialog = screen.getByRole("dialog"), tab = screen.getByRole("button",{name:"归来记录"});
  const frame = dialog.querySelector(".abyssa-frame")!;
  expect(frame).not.toContainElement(tab);
  expect(dialog).toContainElement(tab);
  expect(dialog.querySelector(".abyssa-modal__head")).toBeNull();
  const close = screen.getByRole("button",{name:"关闭记事"}), last = screen.getByRole("button",{name:"查看账目"});
  last.focus(); fireEvent.keyDown(last,{key:"Tab"}); expect(close).toHaveFocus();
  fireEvent.keyDown(close,{key:"Tab",shiftKey:true}); expect(last).toHaveFocus();
});
