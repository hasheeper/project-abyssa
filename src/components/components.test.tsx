import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSelector } from "./CharacterSelector";
import { DiamondWatermark } from "./DiamondWatermark";
import { IconButton } from "./IconButton";
import { Nameplate } from "./Nameplate";
import { Progress } from "./Progress";
import { RibbonButton } from "./RibbonButton";
import { RpgBackButton } from "./RpgBackButton";
import { RpgCheckbox, RpgRadio } from "./RpgChoice";
import { RpgDialogue } from "./RpgDialogue";
import { RpgDiamondNode, RpgDiamondNodeTrack } from "./RpgDiamondNodeTrack";
import { RpgFrame } from "./RpgFrame";
import { RpgHeader } from "./RpgHeader";
import { RpgHexButton } from "./RpgHexButton";
import { RpgNotchButton } from "./RpgNotchButton";
import { RpgNotchedPillButton } from "./RpgNotchedPillButton";
import { RpgPanel } from "./RpgPanel";
import { RpgShapeButton } from "./RpgShapeButton";
import { RpgSquarePanel } from "./RpgSquarePanel";
import { RpgTab } from "./RpgTab";
import { RpgStatusNode } from "./RpgStatusNode";
import { StatusPanel } from "./StatusPanel";
import { Toggle } from "./Toggle";
import { VerticalIndicator } from "./VerticalIndicator";

afterEach(cleanup);

describe("Abyssa controls", () => {
  it("routes every component watermark through the shared double-diamond structure", () => {
    const { container } = render(
      <>
        <DiamondWatermark />
        <RibbonButton>Ribbon</RibbonButton>
        <RpgHexButton>Hex</RpgHexButton>
        <RpgHeader label="Header" />
        <RpgShapeButton label="Shape" />
        <RpgTab label="Tab" />
        <RpgBackButton />
        <IconButton label="Icon" />
        <VerticalIndicator label="Indicator" />
        <RpgNotchButton label="Notch" />
        <RpgNotchedPillButton label="Pill" />
        <RpgDiamondNode label="Node" />
        <RpgDialogue name="Abyssa" text="Dialogue" />
        <RpgPanel aria-label="Panel" />
        <RpgSquarePanel aria-label="Square panel" />
        <RpgStatusNode label="Status" />
        <RpgRadio label="Radio" />
        <RpgCheckbox label="Checkbox" />
        <RpgFrame>Frame</RpgFrame>
        <Toggle />
        <Progress value={40} />
        <Nameplate name="Name" />
        <StatusPanel data={{ title: "Status panel" }} />
      </>
    );

    const patterns = container.querySelectorAll(
      'pattern[data-watermark="double-diamond"]'
    );

    expect(patterns).toHaveLength(24);
    patterns.forEach((pattern) => {
      expect(pattern.querySelectorAll('[data-layer="outer"]')).toHaveLength(1);
      expect(pattern.querySelectorAll('[data-layer="inner"]')).toHaveLength(1);
    });
  });

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

  it("renders the new reference button geometries with collision-free SVG ids", () => {
    const { container } = render(
      <>
        <RpgShapeButton label="Circle" shape="circle" />
        <RpgShapeButton label="Pill" shape="pill" variant="teal" />
        <RpgTab label="Archive" variant="decorated" />
        <RpgBackButton />
        <IconButton label="关闭" icon="close" shape="diamond" />
      </>
    );

    expect(screen.getByRole("button", { name: "Circle" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(container.querySelector(".abyssa-back-button svg")).toHaveAttribute("viewBox", "0 0 190 190");
    expect(container.querySelector(".abyssa-icon-button__art")).toHaveAttribute("viewBox", "0 0 120 120");
    const ids = Array.from(container.querySelectorAll("pattern, clipPath")).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses native radio and checkbox behavior", () => {
    const onRadioChange = vi.fn();
    const onCheckboxChange = vi.fn();
    render(
      <>
        <RpgRadio name="theme" label="暗色主题" onCheckedChange={onRadioChange} />
        <RpgCheckbox label="启用选项" onCheckedChange={onCheckboxChange} />
      </>
    );

    fireEvent.click(screen.getByRole("radio", { name: "暗色主题" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "启用选项" }));
    expect(screen.getByRole("radio", { name: "暗色主题" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "启用选项" })).toBeChecked();
    expect(onRadioChange).toHaveBeenCalledWith(true);
    expect(onCheckboxChange).toHaveBeenCalledWith(true);
  });

  it("renders the vertical indicator at the reference viewBox", () => {
    const { container } = render(<VerticalIndicator variant="teal" label="步骤轴" />);
    expect(screen.getByRole("img", { name: "步骤轴" })).toBeInTheDocument();
    expect(container.querySelector(".abyssa-vertical-indicator svg")).toHaveAttribute("viewBox", "0 0 40 170");
  });

  it("renders the new dialogue and notched controls at their reference viewBoxes", () => {
    const { container } = render(
      <>
        <RpgDialogue name="Abyssa" text="Hello" />
        <RpgNotchButton />
        <RpgNotchedPillButton label="Auto" />
        <RpgStatusNode label="已确认" />
      </>
    );
    expect(screen.getByLabelText("Abyssa的对话")).toHaveTextContent("Hello");
    expect(container.querySelector(".abyssa-dialogue svg")).toHaveAttribute("viewBox", "0 0 1200 260");
    expect(container.querySelector(".abyssa-notch-button svg")).toHaveAttribute("viewBox", "0 0 120 120");
    expect(container.querySelector(".abyssa-notched-pill svg")).toHaveAttribute("viewBox", "0 0 190 48");
    expect(container.querySelector(".abyssa-status-node svg")).toHaveAttribute("viewBox", "0 0 86 54");
  });

  it("provides controlled native buttons for the diamond node track", () => {
    const onValueChange = vi.fn();
    render(<RpgDiamondNodeTrack items={[{ id: "a", label: "节点 A" }, { id: "b", label: "节点 B", variant: "teal" }]} defaultValue="a" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: "节点 B" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button", { name: "节点 B" })).toHaveAttribute("aria-pressed", "true");
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
