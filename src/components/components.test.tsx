import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App as DemoApp } from "../demo/App";
import { demoCharacters } from "../demo/data";
import { CharacterSelector } from "./CharacterSelector";
import { CharacterPortraitSelector } from "./CharacterPortraitSelector";
import { CharacterStatusScreen } from "./CharacterStatusScreen";
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

    expect(patterns).toHaveLength(23);
    patterns.forEach((pattern) => {
      expect(pattern.querySelectorAll('[data-layer="outer"]')).toHaveLength(5);
      expect(pattern.querySelectorAll('[data-layer="inner"]')).toHaveLength(5);
      expect(pattern.querySelectorAll('[data-diamond="center"]')).toHaveLength(1);
      expect(pattern.querySelectorAll('[data-diamond^="top"], [data-diamond^="bottom"]')).toHaveLength(4);
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
    expect(container.querySelector("pattern[data-watermark]")).not.toBeInTheDocument();
  });

  it("allows each component watermark to adjust size and opacity or be disabled", () => {
    const { container } = render(
      <>
        <RpgFrame watermark={{ size: 72, outerOpacity: 0.24, innerOpacity: 0.12 }}>Frame</RpgFrame>
        <RpgHexButton watermark={false}>No watermark</RpgHexButton>
      </>
    );

    const pattern = container.querySelector('pattern[data-watermark="double-diamond"]');
    expect(pattern).toHaveAttribute("width", "72");
    expect(pattern?.querySelector('[data-layer="outer"]')).toHaveAttribute("opacity", "0.24");
    expect(pattern?.querySelector('[data-layer="inner"]')).toHaveAttribute("opacity", "0.12");
    expect(container.querySelector(".abyssa-hex-button pattern[data-watermark]")).not.toBeInTheDocument();
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
    const { container } = render(
      <RpgDiamondNodeTrack
        items={[
          { id: "a", label: "节点 A", displayLabel: "02" },
          { id: "b", label: "节点 B", displayLabel: "03" }
        ]}
        defaultValue="a"
        onValueChange={onValueChange}
        orientation="vertical"
        selectedVariant="teal"
      />
    );
    expect(container.querySelector(".abyssa-diamond-track")).toHaveAttribute(
      "data-orientation",
      "vertical"
    );
    expect(screen.getByRole("button", { name: "节点 A" })).toHaveTextContent("02");
    fireEvent.click(screen.getByRole("button", { name: "节点 B" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button", { name: "节点 B" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "节点 B" })).toHaveAttribute("data-variant", "teal");
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
            traits: [{
              name: "我的平静",
              description: "完整能力说明",
              iconUrl: "/trait.svg"
            }],
            record: "人物资料",
            quote: "角色台词"
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
    expect(container.querySelectorAll(".abyssa-status-panel__lower-section")).toHaveLength(2);
    expect(container.querySelectorAll(".abyssa-status-panel__trait-icon")).toHaveLength(1);
    expect(container.querySelector(".abyssa-status-panel__trait-glyph")).toHaveStyle({
      maskImage: 'url("/trait.svg")'
    });
    expect(container.querySelector(".abyssa-status-panel__trait-tooltip")).toHaveTextContent("完整能力说明");
    expect(container.querySelector(".abyssa-status-panel__quote")).toBeInTheDocument();
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
    const { container } = render(
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
    expect(container.querySelector("pattern[data-watermark]")).not.toBeInTheDocument();
  });

  it("provides the complete non-user character archive roster", () => {
    expect(demoCharacters.map(({ id, number }) => ({ id, number }))).toEqual([
      { id: "eustice", number: "00" },
      { id: "elora", number: "01" },
      { id: "kororo", number: "02" },
      { id: "norma", number: "03" },
      { id: "abyssa", number: "04" },
      { id: "marietta", number: "05" },
      { id: "alvitr", number: "06" },
      { id: "lenore", number: "07" },
      { id: "vivienne", number: "08" }
    ]);

    demoCharacters.forEach((character) => {
      expect(character.portraitUrl).toMatch(/\.png$/);
      expect(character.portraitAlt).toBe(`${character.name}角色立绘`);
      expect(character.thumbnailUrl).toMatch(/\.png$/);
      expect(character.thumbnailAlt).toBe(`${character.name}头像`);
      expect(character.status.fields).toHaveLength(4);
      expect(character.status.stats).toHaveLength(6);
      expect(character.status.traits).toHaveLength(2);
      character.status.traits?.forEach((trait) => {
        expect(trait.iconUrl).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?.*)?)/);
      });
    });
    expect(demoCharacters.find((character) => character.id === "abyssa")?.outfits).toHaveLength(2);
  });

  it("centers the portrait carousel without scrolling the page and skips disabled items", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <CharacterPortraitSelector
        items={[
          { id: "zero", label: "角色零", number: "00" },
          { id: "disabled", label: "禁用角色", number: "01", disabled: true },
          { id: "two", label: "角色二", number: "02" }
        ]}
        defaultValue="disabled"
        onValueChange={onValueChange}
      />
    );
    const viewport = container.querySelector(
      ".abyssa-character-portrait-selector__viewport"
    ) as HTMLDivElement;
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 50, writable: true },
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 100, right: 300, width: 200 } as DOMRect)
      }
    });
    const secondCharacter = screen.getByRole("button", { name: "角色二" });
    Object.defineProperty(secondCharacter, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 350, right: 410, width: 60 } as DOMRect)
    });

    expect(screen.getByRole("button", { name: "角色零" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "禁用角色" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("button", { name: "上一个角色" })).toHaveAttribute(
      "data-shape",
      "diamond"
    );
    expect(screen.getByRole("button", { name: "下一个角色" })).toHaveAttribute(
      "data-shape",
      "diamond"
    );
    expect(screen.getByRole("button", { name: "角色零" })).toHaveAttribute(
      "data-shape",
      "square"
    );
    expect(
      container.querySelector(".abyssa-character-portrait-selector__ribbon-art")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一个角色" }));
    expect(onValueChange).toHaveBeenLastCalledWith("two");
    expect(screen.getByRole("button", { name: "角色二" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 230, behavior: "smooth" });

    fireEvent.keyDown(screen.getByRole("group", { name: "角色选择" }), {
      key: "ArrowRight"
    });
    expect(onValueChange).toHaveBeenLastCalledWith("zero");
  });

  it("renders outfits, internal tabs and the centered character portrait selector", () => {
    const onSelectedIdChange = vi.fn();
    const onActiveMenuIdChange = vi.fn();
    const { container } = render(
      <CharacterStatusScreen
        characters={demoCharacters}
        defaultSelectedId="abyssa"
        onSelectedIdChange={onSelectedIdChange}
        onActiveMenuIdChange={onActiveMenuIdChange}
      />
    );

    const outfitSelector = screen.getByRole("group", { name: "换装选择" });
    const outfitButtons = Array.from(outfitSelector.querySelectorAll("button"));
    expect(outfitButtons.map((button) => button.textContent)).toEqual(["00", "01"]);
    expect(outfitSelector).toHaveAttribute("data-orientation", "vertical");

    const characterSelector = screen.getByRole("group", { name: "角色头像选择" });
    const themedShell = container.querySelector(
      ".abyssa-character-screen__shell"
    ) as HTMLElement;
    expect(themedShell).not.toContainElement(characterSelector);
    const characterButtons = Array.from(
      characterSelector.querySelectorAll(".abyssa-character-portrait-selector__item")
    );
    expect(characterButtons).toHaveLength(9);
    expect(container.querySelectorAll("[data-frame-edge]")).toHaveLength(4);
    expect(characterButtons.map((button) => button.textContent?.trim())).toEqual([
      "00", "01", "02", "03", "04", "05", "06", "07", "08"
    ]);
    expect(screen.queryByRole("button", { name: "凯尔" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "艾比希斯·贝尔泽兰" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "艾比希斯·贝尔泽兰" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("img", { name: "艾比希斯·贝尔泽兰头像" })).toHaveAttribute(
      "src",
      demoCharacters.find((character) => character.id === "abyssa")!.thumbnailUrl
    );
    expect(screen.getByRole("img", { name: "艾比希斯·贝尔泽兰原生质睡衣立绘" })).toHaveAttribute(
      "src",
      demoCharacters.find((character) => character.id === "abyssa")!.outfits![0]!.portraitUrl
    );
    expect(screen.getByText("原生的样子")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "哥特礼服" }));
    expect(screen.getByRole("img", { name: "艾比希斯·贝尔泽兰哥特礼服立绘" })).toHaveAttribute(
      "src",
      demoCharacters.find((character) => character.id === "abyssa")!.outfits![1]!.portraitUrl
    );
    expect(screen.getByText("礼服的样子")).toBeInTheDocument();

    const tablist = screen.getByRole("tablist", { name: "角色档案分类" });
    expect(tablist.querySelectorAll('[role="tab"]')).toHaveLength(4);
    const summaryTab = screen.getByRole("tab", { name: "概要" });
    expect(summaryTab).toHaveAttribute("aria-selected", "true");
    expect(summaryTab).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(summaryTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "装备" })).toHaveFocus();
    fireEvent.click(screen.getByRole("tab", { name: "装备" }));
    expect(onActiveMenuIdChange).toHaveBeenCalledWith("equipment");
    expect(screen.getByRole("tab", { name: "装备" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("状态：安定")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "角色状态菜单" })).not.toBeInTheDocument();

    expect(container.querySelector(".abyssa-status-panel__title-accent")).toHaveTextContent("无");
    expect(container.querySelector(".abyssa-status-panel__title-root")).toHaveTextContent("幼");
    expect(container.querySelector(".abyssa-status-panel__affiliation")).toHaveAttribute(
      "data-tone",
      "demon-lord"
    );
    expect(container.querySelector(".abyssa-status-panel__affiliation")).toHaveAttribute(
      "aria-label",
      "DEMON LORD"
    );
    const characterScreen = container.querySelector(".abyssa-character-screen") as HTMLElement;
    expect(characterScreen).toHaveAttribute(
      "data-skin",
      "demon-lord"
    );
    expect(
      characterScreen.style.getPropertyValue("--abyssa-character-corner-image-theme")
    ).toContain("frame-corner-symmetric-red.png");
    const topOrnaments = Array.from(
      container.querySelectorAll<HTMLImageElement>(".abyssa-character-screen__top-ornament")
    );
    expect(topOrnaments).toHaveLength(2);
    expect(topOrnaments[0]).toHaveAttribute("data-tone", "demon-lord");
    expect(topOrnaments[1]?.getAttribute("src")).toBe(topOrnaments[0]?.getAttribute("src"));
    expect(topOrnaments[0]).toHaveAttribute("aria-hidden", "true");
    expect(topOrnaments[1]).toHaveClass("abyssa-character-screen__top-ornament--right");
    expect(screen.getByRole("button", { name: "艾比希斯·贝尔泽兰" })).toHaveAttribute(
      "data-tone",
      "demon-lord"
    );
    expect(screen.getByRole("button", { name: "尤斯缇丝·格里芬" })).toHaveAttribute(
      "data-tone",
      "hero-party"
    );
    expect(screen.getByRole("button", { name: "薇薇安·桑格温" })).toHaveAttribute(
      "data-tone",
      "demon-cadre"
    );

    expect(screen.queryByRole("group", { name: "阵营界面预览" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "薇薇安·桑格温" }));

    expect(onSelectedIdChange).toHaveBeenCalledWith("vivienne");
    expect(screen.getByRole("button", { name: "薇薇安·桑格温" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("img", { name: "薇薇安·桑格温角色立绘" })).toHaveAttribute(
      "src",
      demoCharacters.find((character) => character.id === "vivienne")!.portraitUrl
    );
    expect(screen.queryByText("状态：交涉")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "血宴女爵" })).toBeInTheDocument();
    expect(screen.getByText("社交的样子")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-status-panel__affiliation")).toHaveAttribute(
      "data-tone",
      "demon-cadre"
    );
    expect(container.querySelector(".abyssa-status-panel__affiliation")).toHaveAttribute(
      "aria-label",
      "DEMON LORD'S CADRE"
    );
    expect(characterScreen).toHaveAttribute(
      "data-skin",
      "demon-cadre"
    );
    expect(
      characterScreen.style.getPropertyValue("--abyssa-character-corner-image-theme")
    ).toContain("frame-corner-symmetric.png");
    expect(topOrnaments[0]).toHaveAttribute("data-tone", "demon-cadre");
    expect(topOrnaments[1]?.getAttribute("src")).toBe(topOrnaments[0]?.getAttribute("src"));
    expect(screen.queryByRole("group", { name: "换装选择" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一个角色" }));
    expect(screen.getByRole("button", { name: "尤斯缇丝·格里芬" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "上一个角色" }));
    expect(screen.getByRole("button", { name: "薇薇安·桑格温" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "艾比希斯·贝尔泽兰" }));
    expect(screen.getByRole("button", { name: "哥特礼服" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "艾比希斯·贝尔泽兰哥特礼服立绘" })).toBeInTheDocument();
  });

  it("allows the component preview sidebar to collapse and reopen", () => {
    const { container } = render(<DemoApp />);
    const shell = container.querySelector(".demo-shell");

    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(shell).not.toHaveAttribute("data-sidebar-collapsed");
  });
});
