import { expect, it } from "vitest";
import { bindMenuHomeMotion, homeLayers } from "./menu-home-motion";
import { motionTokens } from "../../shared/ui/motion/presets";

it("only choreographs departing layers, preserves native layout and reverses deterministically", () => {
  const root = document.createElement("div");
  root.innerHTML = `<div class="menu-scenery"></div><nav class="menu-sidebar"></nav>
    <img class="menu-host__figure"><div class="menu-dial__dialogue"></div>
    <svg><g class="menu-dial__panel-entry" data-command="roster"></g></svg>
    <span class="menu-dial__content-entry" data-command="roster"></span>`;
  const figure = root.querySelector<HTMLElement>(".menu-host__figure")!;
  figure.style.transform = "translateY(12px)";
  const paint = bindMenuHomeMotion(root);
  paint(740);
  const midway = figure.style.cssText;
  expect(root.querySelector<HTMLElement>(".menu-dial__dialogue")!.style.opacity).toBe("0");
  expect(Number(figure.style.opacity)).toBeGreaterThan(.9);
  expect(figure.style.transform).toBe("translateY(12px)");
  for (const selector of [".menu-scenery", ".menu-sidebar"]) expect(root.querySelector(selector)!.getAttribute("style")).toBeNull();
  const svg = root.querySelector<SVGElement>("g")!, html = root.querySelector<HTMLElement>("span")!;
  expect(svg.style.opacity).toBe(html.style.opacity);
  expect(parseFloat(html.style.translate)).toBeCloseTo(parseFloat(svg.style.translate) * .875);
  paint(0); expect(figure.style.opacity).toBe("0");
  paint(740); expect(figure.style.cssText).toBe(midway);
  paint(motionTokens.menuSection.homeMs); expect(figure.style.opacity).toBe("1");
  expect(figure.style.scale).toBe("1");
  expect(Math.max(...homeLayers.map(layer => layer.start + layer.duration))).toBe(motionTokens.menuSection.homeMs);
});
