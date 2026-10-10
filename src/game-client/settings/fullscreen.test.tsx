import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { setFullscreenEnabled } from "../../shared/display/fullscreen";

const define = (target: object, key: string, value: unknown) => Object.defineProperty(target, key, { configurable: true, value, writable: true });
const show = () => render(<SettingsPanel initialTab="display" onBack={vi.fn()} />);
const toggle = () => screen.getByRole("switch", { name: "全屏模式" });

beforeEach(() => {
  define(document, "fullscreenElement", null);
  define(document, "fullscreenEnabled", true);
  define(document, "webkitFullscreenElement", null);
  define(document.documentElement, "requestFullscreen", undefined);
  define(document.documentElement, "webkitRequestFullscreen", undefined);
  define(document, "exitFullscreen", vi.fn(async () => {
    define(document, "fullscreenElement", null);
    define(document, "webkitFullscreenElement", null);
    document.dispatchEvent(new Event("fullscreenchange"));
  }));
  define(document, "webkitExitFullscreen", vi.fn(async () => {
    define(document, "webkitFullscreenElement", null);
    document.dispatchEvent(new Event("webkitfullscreenchange"));
  }));
});
afterEach(async () => { await act(() => setFullscreenEnabled(false)); cleanup(); vi.restoreAllMocks(); });

describe("browser fullscreen settings", () => {
  it("requests the whole document and tracks browser-initiated exit", async () => {
    const request = vi.fn(async function (this: Element) {
      define(document, "fullscreenElement", this);
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    define(document.documentElement, "requestFullscreen", request);
    show();
    fireEvent.click(toggle());
    // The native call must happen in the click's synchronous user activation.
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.contexts[0]).toBe(document.documentElement);
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "true"));
    act(() => {
      define(document, "fullscreenElement", null);
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(toggle()).toHaveAttribute("aria-checked", "false");
  });

  it("does not close settings when Escape exits display mode", async () => {
    const close = vi.fn();
    show();
    const container = document.createElement("div");
    container.addEventListener("keydown", close);
    document.body.append(container);
    try {
      fireEvent.click(toggle());
      await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "true"));
      fireEvent.keyDown(container, { key: "Escape" });
      await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "false"));
      expect(close).not.toHaveBeenCalled();
    } finally { container.remove(); }
  });

  it("retains display mode after settings unmount and exposes an honest iPhone fallback", async () => {
    const first = show();
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "true"));
    expect(document.documentElement).toHaveAttribute("data-abyssa-immersive");
    expect(screen.getByText(/此浏览器无法隐藏地址栏/)).toBeVisible();
    first.unmount();
    show();
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "false"));
    expect(document.documentElement).not.toHaveAttribute("data-abyssa-immersive");
  });

  it("supports Safari's prefixed fullscreen API", async () => {
    const request = vi.fn(async function (this: Element) {
      define(document, "webkitFullscreenElement", this);
      document.dispatchEvent(new Event("webkitfullscreenchange"));
    });
    define(document.documentElement, "webkitRequestFullscreen", request);
    show(); fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "true"));
    expect(request).toHaveBeenCalledOnce();
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-checked", "false"));
    expect((document as Document & { webkitExitFullscreen: () => void }).webkitExitFullscreen).toHaveBeenCalledOnce();
    expect(document.exitFullscreen).not.toHaveBeenCalled();
  });

  it("keeps the switch off and reports a rejected request", async () => {
    define(document.documentElement, "requestFullscreen", vi.fn().mockRejectedValue(new Error("denied")));
    show(); fireEvent.click(toggle());
    await waitFor(() => expect(screen.getByText(/浏览器未允许进入全屏/)).toBeVisible());
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(toggle()).toBeEnabled();
  });
});
