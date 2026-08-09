import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DiceHeader } from "./DiceHeader";

describe("DiceHeader", () => {
  afterEach(cleanup);

  it("uses the component-library RpgHeader without a bitmap top decoration", () => {
    const { container } = render(<DiceHeader />);
    expect(screen.getByRole("img", { name: "Light & Shadow Dice，明暗骰" }).closest("header")).toHaveClass("abyssa-rpg-header");
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
