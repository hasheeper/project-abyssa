import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SceneLayer } from "./SceneLayer";
import { UiModal } from "../shared/ui/motion/UiModal";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";
import { topmostModal } from "../shared/ui/primitives/useModalPresentation";

afterEach(cleanup);
it("puts a nested portal above its opener and returns input after it exits", async () => {
  const parent = vi.fn(), child = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return <SceneLayer active><UiModal open title="结算" onClose={parent}>
      <button onClick={parent}>结算操作</button>
      <SceneLayer active={open}><UiModal open={open} title="连接设置" onClose={() => setOpen(false)}>
        <button onClick={child}>连接操作</button>
      </UiModal></SceneLayer>
    </UiModal></SceneLayer>;
  }
  render(<UiMotionProvider preference="reduced"><Harness/></UiMotionProvider>);
  const settings = screen.getByRole("dialog", { name: "连接设置" }).closest<HTMLElement>("[data-ui-modal-present]")!;
  expect(topmostModal()).toBe(settings);
  expect(settings.closest(".game-system-layer")).toHaveStyle({ zIndex: "1001" });
  fireEvent.click(screen.getByRole("button", { name: "连接操作" }));
  fireEvent.click(screen.getByRole("button", { name: "结算操作" }));
  expect(child).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("button", { name: "连接操作" }), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "连接设置" })).toBeNull());
  expect(topmostModal()?.querySelector('[aria-label="结算"]')).toBe(screen.getByRole("dialog", { name: "结算" }));
  fireEvent.click(screen.getByRole("button", { name: "结算操作" }));
  expect(parent).toHaveBeenCalledOnce();
});
