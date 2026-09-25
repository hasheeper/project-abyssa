import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import replayIcon from "../../../assets/icons/anticlockwise-rotation.svg";
import { ReadingControls, type ReadingControlsProps } from "./ReadingControls";
import { ReadingTool } from "./ReadingTool";

afterEach(cleanup);
const controls = (): ReadingControlsProps => ({
  layout: "adv", reading: false, reviewing: false, auto: false, skipping: false,
  canReplay: true, canPlay: true, canSkip: true, sceneIndex: 0, sceneTotal: 1,
  location: "洋馆", label: "下一句", onLayout: vi.fn(), onLog: vi.fn(), onReplay: vi.fn(),
  onAuto: vi.fn(), onSkip: vi.fn(), onScene: vi.fn(), onNext: vi.fn(),
});

it("keeps the shared diamond texture decorative and SVG definitions unique across readers", () => {
  const {container} = render(<><ReadingControls {...controls()}/><ReadingControls {...controls()}/></>);
  const textures = container.querySelectorAll(".rp-app__bar-watermark");
  expect(textures).toHaveLength(2);
  textures.forEach(texture => {
    expect(texture).toHaveAttribute("aria-hidden", "true");
    expect(texture).toHaveAttribute("focusable", "false");
    expect(texture.querySelector('pattern[data-watermark="double-diamond"]')).toBeInTheDocument();
    expect(texture.querySelector("pattern")).toHaveAttribute("patternTransform", "translate(0 2)");
    expect(texture.querySelectorAll('[data-layer="outer"]')).toHaveLength(5);
    expect(texture.querySelectorAll('[data-layer="inner"]')).toHaveLength(5);
    expect(texture.querySelector("button, a, [tabindex]")).toBeNull();
  });
  const ids = [...container.querySelectorAll("pattern")].map(pattern => pattern.id);
  expect(new Set(ids).size).toBe(2);
  expect(screen.getAllByRole("navigation", {name:"演出控制"})).toHaveLength(2);
});

it("gives BACK a distinct glyph while retaining REPLAY, CLOSE and their existing actions", () => {
  const back = vi.fn(), close = vi.fn(), props = controls();
  const view = render(<ReadingControls {...props} actions={<>
    <ReadingTool caption="BACK" label="返回洋馆" glyph="back" onClick={back}/>
    <ReadingTool caption="CLOSE" label="关闭场景" glyph="close" onClick={close}/>
  </>}/>);
  const tools = screen.getByRole("navigation", {name:"演出控制"});
  expect([...tools.querySelectorAll(".rp-app__cell-label")].map(label => label.textContent))
    .toEqual(["NVL", "REPLAY", "LOG", "AUTO", "SKIP", "BACK", "CLOSE"]);
  const backButton = within(tools).getByRole("button", {name:"返回洋馆"});
  expect(backButton.querySelector('[data-glyph="back"] svg')).toBeInTheDocument();
  expect(within(tools).getByRole("button", {name:"从头重播"}).querySelector("i")!.style.maskImage).toContain(replayIcon);
  expect(within(tools).getByRole("button", {name:"关闭场景"}).querySelector('[data-glyph="close"]')).toBeInTheDocument();
  fireEvent.click(backButton); expect(back).toHaveBeenCalledOnce(); expect(props.onReplay).not.toHaveBeenCalled();
  fireEvent.click(within(tools).getByRole("button", {name:"从头重播"})); expect(props.onReplay).toHaveBeenCalledOnce();
  view.rerender(<ReadingControls {...props} disabled actions={<ReadingTool caption="BACK" label="返回洋馆" glyph="back" onClick={back}/>}/>);
  expect(screen.getByRole("button", {name:"返回洋馆"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name:"返回洋馆"})); expect(back).toHaveBeenCalledOnce();
});
