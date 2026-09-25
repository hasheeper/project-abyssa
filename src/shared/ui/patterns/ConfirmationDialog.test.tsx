import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../motion/UiMotionProvider";
import { ConfirmationDialog } from "./ConfirmationDialog";

beforeEach(() => { vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const copy = { title: "覆盖这份档案？", description: "原有进度将被当前进度替换。" };

it("starts on cancel, describes the consequence and keeps both choices in the focus loop", async () => {
  const cancel = vi.fn(), confirm = vi.fn(), user = userEvent.setup();
  render(<ConfirmationDialog open {...copy} onCancel={cancel} onConfirm={confirm} />);
  const dialog = screen.getByRole("dialog", { name: copy.title });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAccessibleDescription(copy.description);
  const cancelButton = screen.getByRole("button", { name: "取消" });
  const confirmButton = screen.getByRole("button", { name: "确认" });
  expect(cancelButton).toHaveFocus();
  expect(cancelButton).toHaveAttribute("type", "button");
  expect(confirmButton.querySelector(".abyssa-shape-button__content")).toHaveTextContent("确认");
  expect(confirmButton.querySelector("svg text")).toBeNull();
  await user.tab({ shift: true }); expect(confirmButton).toHaveFocus();
  await user.tab(); expect(cancelButton).toHaveFocus();
  await user.keyboard("{Enter}"); expect(cancel).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});

it("only explicit confirmation executes, with no backdrop dismissal or host keyboard leak", async () => {
  const cancel = vi.fn(), confirm = vi.fn(), background = vi.fn(), user = userEvent.setup();
  render(<div onKeyDown={background}>
    <button onClick={background}>背景操作</button>
    <ConfirmationDialog open {...copy} tone="danger" confirmLabel="删除档案" onCancel={cancel} onConfirm={confirm} />
  </div>);
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector(".confirmation-dialog__surface")).toHaveAttribute("data-tone", "danger");
  fireEvent.mouseDown(dialog.parentElement!);
  fireEvent.click(screen.getByRole("button", { name: "背景操作" }));
  expect(cancel).not.toHaveBeenCalled(); expect(background).not.toHaveBeenCalled();
  await user.tab(); await user.keyboard("{Enter}");
  expect(confirm).toHaveBeenCalledOnce(); expect(background).not.toHaveBeenCalled();
  expect(dialog).toBeInTheDocument(); // Controlled; callback is not an automatic close.
  fireEvent.keyDown(document.activeElement!, { key: "Escape" }); expect(cancel).toHaveBeenCalledOnce();
});

it("blocks duplicate confirmation and cancellation while busy without dropping focus", async () => {
  const confirm = vi.fn(), cancel = vi.fn(), user = userEvent.setup();
  function Example() {
    const [busy, setBusy] = useState(false);
    return <ConfirmationDialog open {...copy} busy={busy} onCancel={cancel} onConfirm={() => { setBusy(true); confirm(); }} />;
  }
  render(<Example />);
  await user.click(screen.getByRole("button", { name: "确认" }));
  const pending = screen.getByRole("button", { name: "处理中…" });
  expect(pending).toHaveFocus(); expect(pending).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("status")).toHaveTextContent("处理中…");
  expect(screen.getByRole("dialog").querySelector("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  await user.click(pending); await user.keyboard("{Enter}{Escape}");
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(confirm).toHaveBeenCalledOnce(); expect(cancel).not.toHaveBeenCalled();
});

it("retains the fading surface, blocks exit clicks, restores source focus, and reopens safely", async () => {
  const confirm = vi.fn(), background = vi.fn();
  function Example() {
    const [open, setOpen] = useState(false);
    return <UiMotionProvider preference="reduced"><div>
      <button onClick={() => { background(); setOpen(true); }}>打开确认</button>
      <ConfirmationDialog open={open} {...copy} onCancel={() => setOpen(false)} onConfirm={confirm} />
    </div></UiMotionProvider>;
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "打开确认" });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog"), execute = screen.getByRole("button", { name: "确认" });
  await waitFor(() => expect(dialog.parentElement!.querySelector(".abyssa-modal__scrim")).toHaveStyle({ opacity: "1" }));
  expect(dialog).toHaveStyle({ translate: "0px 0px" });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(dialog.parentElement).toHaveAttribute("data-open", "false");
  expect(execute.closest("[inert]")).not.toBeNull();
  fireEvent.click(execute); fireEvent.click(trigger);
  expect(confirm).not.toHaveBeenCalled(); expect(background).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
});

it("can recover from busy in place and keeps raw-looking description as text", () => {
  const confirm = vi.fn(), cancel = vi.fn();
  const view = (busy: boolean) => <ConfirmationDialog open title="继续操作？" description={'<script>not executable</script>\n请检查档案。'} busy={busy} onCancel={cancel} onConfirm={confirm} />;
  const { rerender, container } = render(view(true));
  const dialog = screen.getByRole("dialog");
  expect(container.querySelector("script")).toBeNull();
  rerender(view(false));
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole("button", { name: "确认" }));
  expect(confirm).toHaveBeenCalledOnce();
});
