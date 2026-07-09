import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterSelector } from "./CharacterSelector";
import { RibbonButton } from "./RibbonButton";
import { Toggle } from "./Toggle";

describe("Abyssa controls", () => {
  it("uses native button semantics and unique SVG definition ids", () => {
    const { container } = render(
      <>
        <RibbonButton>Start</RibbonButton>
        <RibbonButton>Load</RibbonButton>
      </>
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    const ids = Array.from(container.querySelectorAll("clipPath")).map((node) => node.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("updates an uncontrolled toggle and reports its state", () => {
    const onCheckedChange = vi.fn();
    render(<Toggle onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reports character selection changes", () => {
    const onValueChange = vi.fn();
    render(
      <CharacterSelector
        items={[
          { id: "one", number: "01", label: "角色一" },
          { id: "two", number: "02", label: "角色二" }
        ]}
        defaultValue="one"
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "角色二" }));
    expect(onValueChange).toHaveBeenCalledWith("two");
    expect(screen.getByRole("button", { name: "角色二" })).toHaveAttribute("aria-pressed", "true");
  });
});
