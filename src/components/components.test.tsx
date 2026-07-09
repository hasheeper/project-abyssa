import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterSelector } from "./CharacterSelector";
import { Nameplate } from "./Nameplate";
import { RibbonButton } from "./RibbonButton";
import { RpgHeader } from "./RpgHeader";
import { RpgHexButton } from "./RpgHexButton";
import { RpgSquarePanel } from "./RpgSquarePanel";
import { StatusPanel } from "./StatusPanel";
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
    expect(container.querySelector(".abyssa-ribbon-button__art")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid meet"
    );
    const ids = Array.from(container.querySelectorAll("clipPath")).map((node) => node.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("renders the exact RPG header variants with collision-free SVG ids", () => {
    const { container } = render(
      <>
        <RpgHeader label="Header A" />
        <RpgHeader label="Header B" variant="teal" />
      </>
    );

    expect(screen.getByRole("img", { name: "Header A" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Header B" })).toBeInTheDocument();
    const ids = Array.from(container.querySelectorAll("clipPath")).map(
      (node) => node.id
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("renders hex buttons at the source aspect ratio with unique SVG ids", () => {
    const { container } = render(
      <>
        <RpgHexButton>Load Game</RpgHexButton>
        <RpgHexButton variant="dark">New Game</RpgHexButton>
      </>
    );

    expect(screen.getByRole("button", { name: "Load Game" })).toBeEnabled();
    expect(container.querySelector(".abyssa-hex-button__art")).toHaveAttribute(
      "viewBox",
      "0 0 920 120"
    );
    const ids = Array.from(container.querySelectorAll("clipPath")).map(
      (node) => node.id
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps the simple square panel separate from the ornamented RPG panel", () => {
    const { container } = render(
      <RpgSquarePanel number="04" variant="teal" aria-label="小面板 04" />
    );

    expect(screen.getByRole("button", { name: "小面板 04" })).toBeEnabled();
    expect(container.querySelector(".abyssa-square-panel svg")).toHaveAttribute(
      "viewBox",
      "0 0 116 116"
    );
    expect(container.querySelector(".abyssa-panel-tile")).not.toBeInTheDocument();
  });

  it("renders the layered reference nameplate and bilingual status labels", () => {
    const { container } = render(
      <>
        <Nameplate
          name="艾比希斯·贝尔泽兰"
          secondaryName="ABYSSA BEELZERAN"
        />
        <StatusPanel
          data={{
            title: "当代魔王",
            subtitle: "THE VESSEL OF CHAOS",
            state: "状态：安定",
            stats: [
              {
                label: "生命",
                secondaryLabel: "LIFE",
                value: "EX",
                accent: true
              }
            ],
            traits: [{ name: "我的平静" }],
            record: "人物资料"
          }}
        />
      </>
    );

    expect(container.querySelector(".abyssa-nameplate")).toHaveAttribute(
      "data-variant",
      "dark"
    );
    expect(container.querySelector(".abyssa-nameplate__middle")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-nameplate__inner")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-nameplate__content")).toBeInTheDocument();
    expect(container.querySelectorAll(".abyssa-status-panel__corner")).toHaveLength(4);
    expect(container.querySelectorAll(".abyssa-status-panel__rivet")).toHaveLength(4);
    expect(screen.getByText("LIFE")).toBeInTheDocument();
    expect(screen.getByText("ARCHIVE RECORD")).toBeInTheDocument();
    expect(screen.getByText("INHERENT TRAITS")).toBeInTheDocument();
    expect(screen.getByText("BIOGRAPHY")).toBeInTheDocument();
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
