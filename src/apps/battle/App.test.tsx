import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("battle app skin integration", () => {
  it("keeps the stage background grade and battle frame on the same skin", () => {
    const { container } = render(<App />);
    const stage = container.querySelector<HTMLElement>(".abyssa-battle-stage")!;
    const board = screen.getByRole("main", { name: "裂隙远征战斗界面" });
    const switcher = screen.getByRole("button", { name: /切换战斗界面风格/ });
    const skins = ["timber", "hero-party", "demon-cadre", "demon-lord"] as const;

    for (const skin of skins) {
      expect(stage).toHaveClass(`abyssa-battle-stage--${skin}`);
      expect(board).toHaveAttribute("data-ui-skin", skin);
      fireEvent.click(switcher);
    }

    expect(stage).toHaveClass("abyssa-battle-stage--timber");
    expect(board).toHaveAttribute("data-ui-skin", "timber");
  });
});
