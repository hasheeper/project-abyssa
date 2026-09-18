import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MansionMapArt } from "./MansionMapArt";
import type { MansionArtwork } from "./mansion-assets";

afterEach(cleanup);
function artwork(phase: MansionArtwork["phase"]): MansionArtwork {
  const image = document.createElement("img");
  image.className = "mansion-world-art";
  image.dataset.phase = phase;
  return {image, phase, kind: "layers", dispose: vi.fn()};
}

it("mounts the exact prepared image, without creating a new decoder or visible canvas", () => {
  const ready = artwork("night");
  const view = render(<MansionMapArt artwork={ready}/>);
  expect(view.container.querySelector("img")).toBe(ready.image);
  expect(view.container.querySelector("canvas")).toBeNull();
  view.rerender(<MansionMapArt artwork={ready}/>);
  expect(view.container.querySelectorAll("img")).toHaveLength(1);
  expect(view.container.querySelector("img")).toBe(ready.image);
});

it("atomically replaces the completed scenery and detaches it on unmount", () => {
  const night = artwork("night"), dawn = artwork("dawn");
  const view = render(<MansionMapArt artwork={night}/>);
  view.rerender(<MansionMapArt artwork={dawn}/>);
  expect(night.image.isConnected).toBe(false);
  expect(view.container.querySelectorAll("img")).toHaveLength(1);
  expect(view.container.querySelector("img")).toBe(dawn.image);
  // Resource lifetime belongs to the presentation, not a leaf layout effect.
  expect(night.dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(dawn.image.isConnected).toBe(false);
});

it("attaches only the prepared sky overlay and removes its listeners on replacement",()=>{
  const ready=artwork("day"),unmount=vi.fn();
  ready.sky={element:document.createElementNS("http://www.w3.org/2000/svg","svg"),mount:vi.fn(()=>unmount),dispose:vi.fn()};
  const view=render(<MansionMapArt artwork={ready}/>);
  expect(view.container.querySelector("img")).toBe(ready.image);
  expect(view.container.querySelector("svg")).toBe(ready.sky.element);
  expect(view.container.querySelector("canvas")).toBeNull();
  expect(ready.sky.mount).toHaveBeenCalledOnce();
  view.rerender(<MansionMapArt artwork={artwork("dusk")}/>);
  expect(unmount).toHaveBeenCalledOnce();expect(ready.sky.element.isConnected).toBe(false);
  expect(ready.sky.dispose).not.toHaveBeenCalled();
});
