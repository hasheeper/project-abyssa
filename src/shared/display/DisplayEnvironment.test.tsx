import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayEnvironment } from "./DisplayEnvironment";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("game display environment", () => {
  it("blocks the game in mobile portrait and restores it on landscape, with one nested host", () => {
    let portrait = true;
    const changes = new Set<() => void>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() { return query.includes("orientation") && portrait; },
      addEventListener: (_event: string, listener: () => void) => changes.add(listener),
      removeEventListener: (_event: string, listener: () => void) => changes.delete(listener),
    }));
    const root = document.createElement("div"); root.id = "root"; document.body.append(root);
    try {
      render(<DisplayEnvironment><DisplayEnvironment><button>游戏按钮</button></DisplayEnvironment></DisplayEnvironment>, { container: root });
      expect(screen.getAllByText("请旋转至横屏")).toHaveLength(1);
      expect(root.inert).toBe(true);
      act(() => { portrait = false; changes.forEach(listener => listener()); });
      expect(screen.queryByText("请旋转至横屏")).toBeNull();
      expect(root.inert).toBeFalsy();
    } finally { cleanup(); root.remove(); }
  });

  it("prevents native image/link drags and preserves custom game drag interactions", () => {
    render(<DisplayEnvironment><div className="abyssa-stage"><img alt="角色" /><a href="#test">链接</a><div draggable="true">自定义拖动</div></div></DisplayEnvironment>);
    expect(fireEvent.dragStart(screen.getByRole("img", { name: "角色" }))).toBe(false);
    expect(fireEvent.dragStart(screen.getByRole("link"))).toBe(false);
    expect(fireEvent.dragStart(screen.getByText("自定义拖动"))).toBe(true);
  });

  it("only suppresses automatic browser outlines after pointer input", () => {
    render(<DisplayEnvironment><div className="abyssa-stage"><button style={{ outlineStyle: "auto" }}>浏览器框</button><button style={{ outlineStyle: "solid" }}>游戏框</button></div></DisplayEnvironment>);
    const browser = screen.getByRole("button", { name: "浏览器框" }), game = screen.getByRole("button", { name: "游戏框" });
    fireEvent.pointerDown(browser); fireEvent.focusIn(browser);
    expect(browser).toHaveAttribute("data-native-pointer-focus");
    fireEvent.focusOut(browser); fireEvent.pointerDown(game); fireEvent.focusIn(game);
    expect(game).not.toHaveAttribute("data-native-pointer-focus");
    fireEvent.pointerDown(browser); fireEvent.focusIn(browser); fireEvent.keyDown(browser, { key: "Tab" });
    expect(browser).not.toHaveAttribute("data-native-pointer-focus");
  });
});
