import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ABYSSA_LOGO_VIEW_BOXES, AbyssaLogo } from "./AbyssaLogo";
import { ABYSSA_LOGO_INTRO_SEQUENCE } from "./abyssaLogoIntro";

afterEach(cleanup);

describe("AbyssaLogo", () => {
  it("centres the tight crop on the authored x=512 construction axis", () => {
    const { container } = render(<AbyssaLogo crop="tight" />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "112 164 800 656");
  });

  it("uses the traced vector wordmark instead of font text", () => {
    const { container } = render(<AbyssaLogo />);
    const wordmark = container.querySelector('[data-logo-part="wordmark"] image');

    expect(wordmark?.getAttribute("href")).toMatch(/abyssa-wordmark\.svg$/);
    expect(screen.queryByText("ABYSSA")).not.toBeInTheDocument();
  });

  it("keeps the vector wordmark selectable as one editable part", () => {
    const onPartSelect = vi.fn();
    const { container } = render(<AbyssaLogo onPartSelect={onPartSelect} />);

    const wordmark = container.querySelector('[data-logo-part="wordmark"]')!;
    const hitArea = wordmark.querySelector("rect");
    const artwork = wordmark.querySelector("image");

    expect(hitArea).toHaveAttribute("height", "165");
    expect(artwork).toHaveAttribute("pointer-events", "none");
    fireEvent.click(hitArea!);
    expect(onPartSelect).toHaveBeenCalledWith("wordmark");
  });

  it("keeps selection metadata without painting over the artwork or its opacity", () => {
    const { container } = render(<AbyssaLogo selectedPart="stamp" />);
    const stamp = container.querySelector('[data-logo-part="stamp"]');

    expect(stamp).toHaveAttribute("data-selected", "true");
    expect(stamp).toHaveAttribute("opacity", "0.37");
    expect(container.querySelector("circle")).not.toBeInTheDocument();
  });

  it("clips away the font dot so the red diamond is the only question-mark dot", () => {
    const { container } = render(<AbyssaLogo />);
    const question = container.querySelector('[data-logo-part="questionMark"]')!;
    const hookClip = question.querySelector("g[clip-path]")?.getAttribute("clip-path");
    const clipId = hookClip?.match(/#(.+)\)/)?.[1];

    expect(clipId).toBeTruthy();
    expect(container.querySelector(`#${clipId} rect`)?.getAttribute("height")).toBe("130");
    expect(question.querySelector("path")?.getAttribute("d")).toBe("M76.5 164 94.5 184 76.5 204 58.5 184Z");
    expect(question.querySelector("path")?.getAttribute("transform")).toBe("translate(-4 -16)");
  });

  it("paints the dark plate by default so the standalone lockup is unchanged", () => {
    const { container } = render(<AbyssaLogo />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("data-background", "radial");
    expect(svg).toHaveAttribute("viewBox", "0 112 1024 760");

    // The plate is the first painted rect, ahead of every editable group.
    const plate = svg.querySelector(":scope > rect");
    expect(plate).toHaveAttribute("height", "760");
    expect(plate?.getAttribute("fill")).toMatch(/^url\(#abyssa-logo-background-/);
  });

  it("drops the plate and its gradient when compositing onto a scene", () => {
    const { container } = render(<AbyssaLogo background="none" />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("data-background", "none");
    expect(svg.querySelector(":scope > rect")).toBeNull();
    // No orphaned gradient: an unreferenced def would still ship in the payload.
    expect(svg.querySelector("radialGradient")).toBeNull();
    // The artwork itself must survive.
    expect(svg.querySelector('[data-logo-part="wordmark"] image')).toBeInTheDocument();
  });

  it("trims the view box to the artwork without moving any part", () => {
    const { container: full } = render(<AbyssaLogo />);
    const { container: tight } = render(<AbyssaLogo crop="tight" />);

    expect(tight.querySelector("svg")).toHaveAttribute("viewBox", ABYSSA_LOGO_VIEW_BOXES.tight);
    expect(tight.querySelector("svg")).toHaveAttribute("data-crop", "tight");

    // Cropping is a camera move only — part transforms are identical.
    for (const part of ["stamp", "divider", "wordmark"]) {
      const selector = `[data-logo-part="${part}"]`;
      expect(tight.querySelector(selector)?.getAttribute("transform")).toBe(
        full.querySelector(selector)?.getAttribute("transform")
      );
    }
  });

  it("keeps the shipped artwork inside the tight view box", () => {
    // Ink union of DEFAULT_ABYSSA_LOGO_LAYOUT, derived from the authored
    // geometry (stroke included). If a part is repositioned, this is the test
    // that should fail rather than the crop silently clipping the logo.
    const ink = { minX: 128.35, minY: 171.72, maxX: 911.65, maxY: 812.28 };
    const [x, y, width, height] = ABYSSA_LOGO_VIEW_BOXES.tight.split(" ").map(Number);

    expect(x).toBeLessThanOrEqual(ink.minX);
    expect(y).toBeLessThanOrEqual(ink.minY);
    expect(x + width).toBeGreaterThanOrEqual(ink.maxX);
    expect(y + height).toBeGreaterThanOrEqual(ink.maxY);

    // Worth cropping at all: it must be meaningfully tighter than `full`.
    const [, , fullWidth] = ABYSSA_LOGO_VIEW_BOXES.full.split(" ").map(Number);
    expect(width).toBeLessThan(fullWidth * 0.85);
  });
});

describe("AbyssaLogo intro", () => {
  it("stays completely static by default", () => {
    // logo-studio 与组件目录都不传 intro,必须保持原样。
    const { container } = render(<AbyssaLogo />);
    const svg = container.querySelector("svg")!;

    expect(svg.hasAttribute("data-intro")).toBe(false);
    for (const part of svg.querySelectorAll("[data-logo-part]")) {
      expect(part.hasAttribute("data-intro")).toBe(false);
      expect(part.getAttribute("style")).toBeNull();
    }
  });

  it("tags each part with its kind and cascading delay", () => {
    const { container } = render(<AbyssaLogo intro />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("data-intro", "true");

    const delays = ABYSSA_LOGO_INTRO_SEQUENCE.map((step) => {
      const node = svg.querySelector<SVGGElement>(`[data-logo-part="${step.part}"]`)!;
      expect(node).toHaveAttribute("data-intro", step.kind);
      return Number.parseFloat(node.style.animationDelay);
    });

    // 延迟必须递增,否则「逐个入场」会乱序。
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it("keeps the layout transform intact so parts do not fly off", () => {
    // 入场动画只加 CSS 变量与 data 标记,transform 属性必须一字不改。
    const { container: still } = render(<AbyssaLogo />);
    const { container: animated } = render(<AbyssaLogo intro />);

    for (const step of ABYSSA_LOGO_INTRO_SEQUENCE) {
      const selector = `[data-logo-part="${step.part}"]`;
      expect(animated.querySelector(selector)!.getAttribute("transform")).toBe(
        still.querySelector(selector)!.getAttribute("transform")
      );
    }
  });

  it("hands each part its own design opacity as the animation end value", () => {
    // stamp 的设计值是 0.37;若终值写死 1,背景图章会永久变亮。
    const { container } = render(<AbyssaLogo intro />);
    const stamp = container.querySelector<SVGGElement>('[data-logo-part="stamp"]')!;

    expect(stamp).toHaveAttribute("opacity", "0.37");
    expect(stamp.style.getPropertyValue("--abyssa-logo-part-opacity")).toBe("0.37");

    const titleTop = container.querySelector<SVGGElement>('[data-logo-part="titleTop"]')!;
    expect(titleTop.style.getPropertyValue("--abyssa-logo-part-opacity")).toBe("1");
  });

  it("still supports part selection while animating", () => {
    const onPartSelect = vi.fn();
    const { container } = render(<AbyssaLogo intro onPartSelect={onPartSelect} />);
    const divider = container.querySelector<SVGGElement>('[data-logo-part="divider"]')!;

    expect(divider.style.cursor).toBe("pointer");
    fireEvent.click(divider);
    expect(onPartSelect).toHaveBeenCalledWith("divider");
  });
});

describe("divider pieces", () => {
  it("splits the divider into a rule plus three gems", () => {
    const { container } = render(<AbyssaLogo intro />);
    const divider = container.querySelector('[data-logo-part="divider"]')!;

    expect(divider.querySelector('[data-divider-piece="rule"]')).toBeInTheDocument();
    for (const gem of ["gem-left", "gem-right", "gem-centre"]) {
      expect(divider.querySelector(`[data-divider-piece="${gem}"]`)).toBeInTheDocument();
    }
  });

  it("gives each gem its own local anchor for the pop compensation", () => {
    const { container } = render(<AbyssaLogo intro />);
    const anchors = ["gem-left", "gem-right", "gem-centre"].map((gem) =>
      container
        .querySelector<SVGGElement>(`[data-divider-piece="${gem}"]`)!
        .style.getPropertyValue("--abyssa-logo-gem-x")
    );

    // 三个锚点必须互不相同,否则三颗菱形会往同一处弹。
    expect(new Set(anchors).size).toBe(3);
    for (const anchor of anchors) expect(anchor).not.toBe("");
  });

  it("keeps the divider pieces present in the static lockup too", () => {
    // 拆分是结构改动,不是动画专属;静态渲染必须一样完整。
    const { container } = render(<AbyssaLogo />);
    const divider = container.querySelector('[data-logo-part="divider"]')!;

    expect(divider.querySelectorAll("[data-divider-piece]")).toHaveLength(4);
    // 但静态时不应带任何动画标记。
    expect(container.querySelector("svg")!.hasAttribute("data-intro")).toBe(false);
  });
});
