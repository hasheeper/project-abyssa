import { test, expect, type Page } from "@playwright/test";
import { ready, openSortie } from "./playable-helpers";

type IntroFrame = { time: number; wood: number; y: number; map: number; party: number; entry: number; veil: number };
type MapWindow = Window & { mapEntrance?: Promise<IntroFrame[]>; panelSamples?: Promise<{ opacity: number; x: number; y: number }[]> };

async function menu(page: Page, reduced = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "新的开始", exact: true }).click();
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.getByRole("button", { name: "跳过教程", exact: true }).click();
  await expect(page).toHaveURL(/#\/menu\?/); await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
}
async function map(page: Page) {
  await openSortie(page);
  await expect(page).toHaveURL(/#\/map\?/); await ready(page);
  await expect(page.locator(".abyssa-map-loading")).toHaveCount(0);
}
async function settled(page: Page) { await expect(page.locator(".map-board")).toHaveAttribute("data-map-intro", "ready"); }
async function record(page: Page) {
  await page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      const root = document.querySelector('.map-board[data-map-intro="playing"]');
      if (!root || seen.has(root)) return;
      seen.add(root);
      const nodes = [root, ...[".abyssa-map-scene", ".abyssa-sortie-stage__slots", ".map-supply-entry"].map(selector => root.querySelector(selector)!)];
      (window as MapWindow).mapEntrance = new Promise(resolve => {
        const frames: IntroFrame[] = [], start = performance.now();
        const tick = (time: number) => {
          const css = nodes.map(node => getComputedStyle(node));
          const veil = document.querySelector(".scene-transition__veil");
          frames.push({ time: time - start, wood: Number(css[0].opacity), y: parseFloat(css[0].translate.split(" ")[1]) || 0,
            map: Number(css[1].opacity), party: Number(css[2].opacity), entry: Number(css[3].opacity), veil: veil ? Number(getComputedStyle(veil).opacity) : 0 });
          if (time - start < 1560) requestAnimationFrame(tick); else resolve(frames);
        };
        requestAnimationFrame(tick);
      });
    }).observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ["data-map-intro"] });
  });
}

test("map paper stage has visible layered frames on arrival, refresh and return", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await record(page); await menu(page); await map(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath("paper-spring-midflight.png") });
  const check = async (label: string) => {
    await settled(page);
    const frames = (await page.evaluate(() => (window as MapWindow).mapEntrance))!;
    await info.attach(label, { body: JSON.stringify(frames), contentType: "application/json" });
    expect(frames.length).toBeGreaterThan(20);
    expect(frames.filter(frame => frame.y > -33 && frame.y < -1).length).toBeGreaterThan(8);
    expect(frames.find(frame => frame.y >= -17)!.time).toBeGreaterThan(220);
    expect(frames.find(frame => frame.y >= -3.4)!.time).toBeGreaterThan(450);
    expect(Math.max(...frames.map(frame => frame.veil))).toBeLessThan(.01);
    const half = (key: "wood" | "map" | "party" | "entry") => frames.find(frame => frame[key] > .5)!.time;
    expect(half("wood")).toBeLessThan(half("map"));
    expect(half("map")).toBeLessThan(half("party"));
    expect(half("party")).toBeLessThan(half("entry"));
    expect(await page.locator(".abyssa-map-canvas").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("url(");
  };
  await check("arrival");
  await page.reload(); await ready(page); await check("refresh");
  await page.getByRole("link", { name: "返回菜单", exact: true }).click(); await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
  await map(page); await check("return");
  await page.screenshot({ path: info.outputPath("map-settled.png") });
  expect(errors).toEqual([]);
});

for (const width of [1600, 1280]) test(`map supplies fit the frame and retain the quest at ${width}px`, async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: width === 1600 ? 900 : 800 });
  await menu(page); await map(page); await settled(page);
  const canvas = page.locator(".abyssa-map-scene canvas"), bounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: bounds.width * .48, y: bounds.height * .495 } });
  await expect(page.locator(".abyssa-map-viewport")).toHaveAttribute("data-mode", "pop");
  await page.getByRole("button", { name: /出征行囊/ }).click();
  const panel = page.getByRole("region", { name: "出征行囊", exact: true });
  await expect(panel).toBeVisible();
  await expect(page.locator('.map-panel-layer[data-exiting]')).toHaveCount(0);
  await expect(page.locator(".abyssa-sortie-stage")).toHaveAttribute("inert", "");
  const geometry = await panel.evaluate(el => {
    const viewport = document.querySelector(".abyssa-map-viewport")!.getBoundingClientRect(), r = el.getBoundingClientRect();
    const k = document.querySelector(".abyssa-stage__canvas")!.getBoundingClientRect().width / 1600;
    const outside = Array.from(el.querySelectorAll("button")).some(button => {
      const b = button.getBoundingClientRect(); return b.left < r.left || b.right > r.right + 1 || b.top < r.top || b.bottom > r.bottom + 1;
    });
    return { x: (r.left - viewport.left) / k, width: r.width / k, outside,
      fits: r.left > viewport.left && r.right < viewport.right && r.top > viewport.top && r.bottom < viewport.bottom };
  });
  expect(geometry.fits).toBe(true); expect(geometry.outside).toBe(false); expect(geometry.width).toBeCloseTo(901, 0);
  // Compact commands may stretch their middle ribbon, never the end diamonds.
  const diamonds = await page.locator(".map-command__gem").evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { width: r.width, height: r.height };
  }));
  expect(diamonds.length).toBe(6);
  for (const diamond of diamonds) { expect(diamond.width).toBeGreaterThan(10); expect(diamond.width).toBeCloseTo(diamond.height, 2); }
  await panel.getByRole("button", { name: "查看补给：护符" }).click();
  await expect(panel.getByRole("button", { name: "加入行囊" })).toBeDisabled();
  await panel.getByRole("button", { name: "查看补给：食物" }).click();
  await panel.getByRole("button", { name: "移出行囊" }).click();
  await expect(panel.getByRole("button", { name: "加入行囊" })).toBeEnabled();
  await panel.getByRole("button", { name: "加入行囊" }).click();
  await page.screenshot({ path: info.outputPath("supplies.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator(".abyssa-map-viewport")).toHaveAttribute("data-mode", "pop");
  await expect(page.getByRole("button", { name: /出征行囊/ })).toBeFocused();
  await expect(page.getByRole("complementary", { name: /委托/ })).toBeVisible();
  await page.getByRole("button", { name: "调整队伍", exact: true }).click();
  await expect(page.getByRole("region", { name: "出战名单" })).toBeVisible();
  await page.getByRole("button", { name: "完成编队", exact: true }).click();
  await expect(page.locator(".abyssa-map-viewport")).toHaveAttribute("data-mode", "pop");
});

for (const manual of [false, true]) test(`map respects ${manual ? "manual" : "system"} motion reduction`, async ({ page }) => {
  if (manual) await page.addInitScript(() => localStorage.setItem("abyssa:ui-motion:v1", "reduced"));
  await menu(page, !manual); await map(page); await settled(page);
  await expect(page.locator(".abyssa-map-page")).toHaveAttribute("data-map-reduced", "true");
  expect(await page.locator(".map-board").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
  await page.getByRole("button", { name: /出征行囊/ }).click();
  await expect(page.locator('.map-panel-layer[data-panel="loadout"]')).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "完成整备", exact: true }).click();
  await expect(page.getByRole("region", { name: "出征行囊", exact: true })).toHaveCount(0);
});
