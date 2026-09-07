import { clientFixture } from "../../game-client/testing/helpers";
let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock("../../game-client/react", async importOriginal => {
  const original = await importOriginal<typeof import("../../game-client/react")>();
  return { ...original, GameProvider: ({ children }: { children: React.ReactNode }) => <original.GameSessionScope session={fixture.session}>{children}</original.GameSessionScope> };
});
beforeEach(async () => { fixture = await clientFixture(); });
afterEach(() => fixture.session.dispose());
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneTransitionProvider } from "../../shared/transition";
import { App } from "./App";

afterEach(cleanup);

describe("battle app skin integration", () => {
  it("keeps the stage background grade and battle frame on the same skin", () => {
    const { container } = render(<SceneTransitionProvider><App /></SceneTransitionProvider>);
    const stage = container.querySelector<HTMLElement>(".abyssa-battle-stage")!;
    const board = screen.getByRole("main", { name: "裂隙远征战斗界面" });
    const switcher = screen.getByRole("button", { name: /切换战斗界面风格/ });
    const skins = ["timber", "hero-party", "demon-cadre", "demon-lord", "old-manor"] as const;

    for (const skin of skins) {
      expect(stage).toHaveClass(`abyssa-battle-stage--${skin}`);
      expect(board).toHaveAttribute("data-ui-skin", skin);
      fireEvent.click(switcher);
    }

    expect(stage).toHaveClass("abyssa-battle-stage--timber");
    expect(board).toHaveAttribute("data-ui-skin", "timber");
  });
});
