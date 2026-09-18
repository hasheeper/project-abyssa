import { test, expect, type Locator, type Page } from "@playwright/test";
import { ready } from "./playable-helpers";

async function enterMenu(page: Page, motion: "reduce" | "no-preference" = "no-preference") {
  // This test owns menu motion, not the independent title Logo timeline.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "新的开始", exact: true }).click();
  await page.emulateMedia({ reducedMotion: motion });
  await page.getByRole("button", { name: "跳过教程", exact: true }).click();
  await expect(page).toHaveURL(/#\/menu\?/);
  await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
}

type MenuEntranceFrame = { time: number; portrait: number; hud: number; plates: number[]; dialogue: number };
type MenuSamplingWindow = Window & {
  menuEntrance?: Promise<MenuEntranceFrame[]>;
  menuEntranceCount?: number;
  menuEntranceStyles?: { name: string; duration: string; delay: string; easing: string }[];
};

type CharacterEntranceFrame = { time: number; wood: number; y: number; portrait: number; panel: number; controls: number; veil: number; tabOverlap: number };
type CharacterSamplingWindow = Window & {
  characterEntrance?: Promise<CharacterEntranceFrame[]>;
  characterEntranceStyles?: string[][];
};
async function installCharacterRecorder(page: Page) {
  await page.addInitScript(() => {
    const recorded = new WeakSet<Element>();
    new MutationObserver(() => {
      const root = document.querySelector('[data-character-intro="playing"]');
      if (!root || recorded.has(root)) return;
      recorded.add(root);
      const selectors = [".abyssa-character-screen", ".abyssa-character-screen__portrait > .abyssa-frame__content", ".abyssa-character-screen__details", ".abyssa-character-screen__character-selector"];
      const nodes = selectors.map(s => root.querySelector(s)!);
      const target = window as CharacterSamplingWindow;
      target.characterEntranceStyles = nodes.map(node => {
        const css = getComputedStyle(node);
        return [css.animationName, css.animationDuration, css.animationDelay, css.animationTimingFunction];
      });
      target.characterEntrance = new Promise(resolve => {
        const start = performance.now(), frames: CharacterEntranceFrame[] = [];
        function sample(time: number) {
          const css = nodes.map(node => getComputedStyle(node));
          const veil = document.querySelector(".scene-transition__veil");
          frames.push({ time: time - start, wood: Number(css[0].opacity),
            y: parseFloat(css[0].translate.split(" ")[1]) || 0,
            portrait: Number(css[1].opacity), panel: Number(css[2].opacity), controls: Number(css[3].opacity),
            veil: veil ? Number(getComputedStyle(veil).opacity) : 0,
            tabOverlap: root!.querySelector(".abyssa-character-screen__tabs")!.getBoundingClientRect().bottom - root!.querySelector(".abyssa-character-screen__tabpanel")!.getBoundingClientRect().top });
          if (time - start < 900) requestAnimationFrame(sample); else resolve(frames);
        }
        requestAnimationFrame(sample);
      });
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-character-intro"] });
  });
}
async function openCharacter(page: Page) {
  const button = page.getByRole("button", { name: "角色", exact: true });
  await button.click(); await button.click();
  await expect(page).toHaveURL(/#\/character-status\?/);
  await ready(page);
  await expect(page.locator("[data-character-intro]")).toHaveAttribute("data-character-intro", "ready");
}
async function characterGeometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".abyssa-stage__canvas")!.getBoundingClientRect(), k = stage.width / 1600;
    return [".abyssa-character-screen", ".abyssa-character-screen__header-row", ".abyssa-character-screen__shell", ".abyssa-character-screen__portrait", ".abyssa-character-screen__details", ".abyssa-character-screen__tabpanel", ".abyssa-character-screen__character-selector"]
      .map(selector => { const r = document.querySelector(selector)!.getBoundingClientRect(); return [(r.x - stage.x) / k, (r.y - stage.y) / k, r.width / k, r.height / k]; });
  });
}

test("character board layered entrance plays intermediate frames on arrival, refresh and return", async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await installCharacterRecorder(page);
  await enterMenu(page);
  await openCharacter(page);
  const styles = await page.evaluate(() => (window as CharacterSamplingWindow).characterEntranceStyles);
  const check = async (label: string) => {
    const frames = (await page.evaluate(() => (window as CharacterSamplingWindow).characterEntrance))!;
    await info.attach(`character-${label}`, { body: JSON.stringify(frames), contentType: "application/json" });
    expect(frames.length).toBeGreaterThan(15);
    expectIntermediate(frames.map(f => f.y), -34, 0);
    // Guard the perceived weight, not the CSS duration label: the material
    // must become visible while meaningful travel remains, with a long settle.
    expect(frames.find(f => f.y >= -17)!.time).toBeGreaterThan(220);
    expect(frames.find(f => f.y >= -3.4)!.time).toBeGreaterThan(450);
    expect(frames.some(f => f.wood > .5 && f.y < -20)).toBe(true);
    expect(Math.max(...frames.map(f => f.y))).toBeLessThanOrEqual(.01);
    expect(Math.max(...frames.map(f => f.veil))).toBeLessThan(.01);
    expect(Math.max(...frames.map(f => f.tabOverlap)) - Math.min(...frames.map(f => f.tabOverlap))).toBeLessThan(.01);
    for (const key of ["portrait", "panel", "controls"] as const) expectIntermediate(frames.map(f => f[key]), 0, 1);
    const visibleAt = (key: "wood" | "portrait" | "panel" | "controls") => frames.find(f => f[key] > .5)!.time;
    expect(visibleAt("wood")).toBeLessThan(visibleAt("portrait"));
    expect(visibleAt("portrait")).toBeLessThan(visibleAt("panel"));
    expect(visibleAt("panel")).toBeLessThan(visibleAt("controls"));
    expect(await page.evaluate(() => (window as CharacterSamplingWindow).characterEntranceStyles)).toEqual(styles);
  };
  await check("arrival");
  await page.reload(); await ready(page);
  await expect(page.locator("[data-character-intro]")).toHaveAttribute("data-character-intro", "ready");
  await check("refresh");
  await page.getByRole("link", { name: "返回菜单", exact: true }).click();
  await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
  await openCharacter(page);
  await check("return");
  await page.screenshot({ path: info.outputPath("character-settled.png") });
  expect(errors).toEqual([]);
});

for (const width of [1600, 1280]) {
  test(`character board fixed geometry and live content swaps at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1600 ? 900 : 800 });
    await enterMenu(page);
    await openCharacter(page);
    const original = await characterGeometry(page);
    // Measured from the pre-pilot build, normalized into 1600x900 Stage space.
    const baseline = [
      [253.129, 36.510, 1093.742, 855.781], [253.129, 36.510, 1093.742, 90.212],
      [253.129, 101.443, 1093.742, 684.387], [288.299, 151.822, 323.183, 574.125],
      [628.591, 129.009, 683.110, 614.047], [628.591, 167.090, 683.110, 575.966],
      [353.247, 801.039, 893.505, 91.252]
    ];
    original.forEach((box, i) => box.forEach((value, j) => expect(Math.abs(value - baseline[i][j])).toBeLessThan(.1)));
    const screenNode = await page.locator(".abyssa-character-screen").elementHandle();
    const shell = await page.locator(".abyssa-character-screen__shell").elementHandle();
    const frames = await sampleTransition(page, ".character-board__panel-content", () => page.getByRole("tab", { name: "骰装" }).click());
    expectIntermediate(frames.map(f => f.opacity), 0, 1);
    expectIntermediate(frames.map(f => f.y), 0, 10);
    await expect(page.locator(".character-board__panel-content")).toHaveCSS("opacity", "1");
    await expect(page.locator(".abyssa-dice__column")).toHaveCount(6);
    await expect(page.getByRole("tab", { name: "骰装" })).toBeFocused();
    const portrait = await sampleTransition(page, ".abyssa-character-screen__visual", () => page.getByRole("button", { name: /尤斯缇丝/ }).click());
    expectIntermediate(portrait.map(f => f.opacity), 0, 1);
    await expect(page.locator(".character-board__portrait-content")).toHaveAttribute("data-character-content", /^eustice:/);
    await expect(page.locator("[data-character-change]")).toHaveAttribute("data-character-change", "ready");
    // Fast keyboard tab changes keep the last choice and one live panel.
    await page.getByRole("tab", { name: "概要" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Home");
    await expect(page.locator(".character-board__panel-content")).toHaveAttribute("data-character-content", "eustice:summary");
    await expect(page.getByRole("tab", { name: "概要" })).toBeFocused();
    await expect(page.locator(".character-board__panel-content")).toHaveCSS("opacity", "1");
    await expect(page.locator(".abyssa-status-panel")).toHaveCount(1);
    const after = await characterGeometry(page);
    after.forEach((box, i) => box.forEach((value, j) => expect(Math.abs(value - original[i][j])).toBeLessThan(.1)));
    expect(await screenNode!.evaluate(node => node === document.querySelector(".abyssa-character-screen"))).toBe(true);
    expect(await shell!.evaluate(node => node === document.querySelector(".abyssa-character-screen__shell"))).toBe(true);
    expect(await page.evaluate(() => {
      const panel = document.querySelector(".abyssa-character-screen__tabpanel")!.getBoundingClientRect();
      const contents = document.querySelector(".abyssa-status-panel")!.getBoundingClientRect();
      const ids = [...document.querySelectorAll("[id]")].map(el => el.id);
      return { overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
        panelHeightDelta: Math.abs(panel.height - contents.height), duplicates: ids.length - new Set(ids).size };
    })).toEqual({ overflow: false, panelHeightDelta: 0, duplicates: 0 });
    await page.screenshot({ path: info.outputPath(`character-eustice-${width}.png`) });
  });
}

for (const manual of [false, true]) {
  test(`character board honors ${manual ? "manual" : "system"} reduced motion`, async ({ page }) => {
    if (manual) await page.addInitScript(() => localStorage.setItem("abyssa:ui-motion:v1", "reduced"));
    await enterMenu(page, manual ? "no-preference" : "reduce");
    await openCharacter(page);
    await expect(page.locator("[data-character-intro]")).toHaveAttribute("data-character-reduced", "true");
    await page.getByRole("tab", { name: "骰装" }).click();
    await expect(page.locator(".character-board__panel-content")).toHaveCSS("opacity", "1");
    await expect(page.locator(".abyssa-dice__column")).toHaveCount(6);
    await page.getByRole("button", { name: /尤斯缇丝/ }).click();
    await expect(page.locator("[data-character-displayed]")).toHaveAttribute("data-character-displayed", "eustice");
    await expect(page.locator("[data-character-change]")).toHaveAttribute("data-character-change", "ready");
    // The existing dice preview's independent cube spin isn't a board/tab
    // transition. It has its own system-reduction behavior and is unchanged.
    expect(await page.locator("[data-character-intro]").evaluate(el => el.getAnimations({ subtree: true })
      .filter(a => !(a instanceof CSSAnimation && a.animationName === "abyssa-dice-cube-spin")).map(a => ({
      name: a instanceof CSSAnimation ? a.animationName : a instanceof CSSTransition ? a.transitionProperty : "animation",
      target: (a.effect as KeyframeEffect)?.target instanceof Element ? ((a.effect as KeyframeEffect).target as Element).getAttribute("class") : null
    })))).toEqual([]);
  });
}

type CharacterChangeFrame = {
  time: number; displayed: string; phase: string; panelKey: string; portraitAlt: string; name: string;
  left: number; right: number; leftX: number; rightX: number; tabOffset: number; nameOffset: number;
  frameY: number; dockY: number; inner: number;
};
type CharacterChangeWindow = Window & { characterChangeFrames?: Promise<CharacterChangeFrame[]> };
test("character change links portrait/name and tabs/dossier with one commit and stable outer frame", async ({ page }, info) => {
  await enterMenu(page);
  await openCharacter(page);
  await page.getByRole("tab", { name: "骰装" }).click();
  await expect(page.locator(".character-board__panel-content")).toHaveCSS("opacity", "1");
  const tablist = await page.getByRole("tablist").elementHandle();
  const nameplate = await page.locator(".abyssa-character-screen__portrait-column > .abyssa-nameplate").elementHandle();
  await page.evaluate(() => {
    (window as CharacterChangeWindow).characterChangeFrames = new Promise(resolve => {
      document.addEventListener("click", () => {
        const start = performance.now(), frames: CharacterChangeFrame[] = [];
        const sample = (time: number) => {
          const root = document.querySelector<HTMLElement>("[data-character-change]")!;
          const left = root.querySelector(".abyssa-character-screen__visual")!, right = root.querySelector(".abyssa-character-screen__details")!;
          const name = root.querySelector(".abyssa-character-screen__portrait-column > .abyssa-nameplate")!;
          const tabs = root.querySelector(".abyssa-character-screen__tabs")!;
          const panel = root.querySelector<HTMLElement>(".character-board__panel-content")!;
          const leftCss = getComputedStyle(left), rightCss = getComputedStyle(right);
          frames.push({ time: time - start, displayed: root.dataset.characterDisplayed!, phase: root.dataset.characterChange!,
            panelKey: panel.dataset.characterContent!, portraitAlt: root.querySelector(".abyssa-character-screen__portrait img")?.getAttribute("alt") ?? "",
            name: name.textContent ?? "", left: Number(leftCss.opacity), right: Number(rightCss.opacity),
            leftX: parseFloat(leftCss.translate) || 0, rightX: parseFloat(rightCss.translate) || 0,
            tabOffset: tabs.getBoundingClientRect().x - right.getBoundingClientRect().x,
            nameOffset: name.getBoundingClientRect().x - left.getBoundingClientRect().x,
            frameY: root.querySelector(".abyssa-character-screen__shell")!.getBoundingClientRect().y,
            dockY: root.querySelector(".abyssa-character-screen__character-selector")!.getBoundingClientRect().y,
            inner: Number(getComputedStyle(panel).opacity) });
          if ((time - start < 700 || root.dataset.characterChange !== "ready") && time - start < 4000) requestAnimationFrame(sample);
          else resolve(frames);
        };
        requestAnimationFrame(sample);
      }, { once: true, capture: true });
    });
  });
  await page.getByRole("button", { name: /尤斯缇丝/ }).click();
  const frames = (await page.evaluate(() => (window as CharacterChangeWindow).characterChangeFrames))!;
  await info.attach("linked-character-frames", { body: JSON.stringify(frames), contentType: "application/json" });
  expectIntermediate(frames.map(f => f.left), 0, 1);
  expectIntermediate(frames.map(f => f.right), 0, 1);
  expectIntermediate(frames.map(f => f.leftX), -22, 0);
  expectIntermediate(frames.map(f => f.rightX), 18, 0);
  for (const key of ["tabOffset", "nameOffset", "frameY", "dockY"] as const)
    expect(Math.max(...frames.map(f => f[key])) - Math.min(...frames.map(f => f[key]))).toBeLessThan(.1);
  for (const frame of frames) {
    expect(frame.inner).toBe(1); // No second nested character fade.
    expect(frame.panelKey).toBe(`${frame.displayed}:dice`);
    if (frame.displayed === "eustice") {
      expect(frame.name).toContain("尤斯缇丝");
      expect(frame.portraitAlt).toContain("尤斯缇丝");
    } else expect(frame.name).toContain("你");
  }
  const entered = frames.filter(frame => frame.displayed === "eustice");
  expect(entered.find(frame => frame.left > .5)!.time).toBeLessThan(entered.find(frame => frame.right > .5)!.time);
  await expect(page.getByRole("tab", { name: "骰装" })).toHaveAttribute("aria-selected", "true");
  expect(await tablist!.evaluate(node => node === document.querySelector('[role="tablist"]'))).toBe(true);
  expect(await nameplate!.evaluate(node => node === document.querySelector(".abyssa-character-screen__portrait-column > .abyssa-nameplate"))).toBe(true);
  // A new selection may interrupt any beat, without queuing earlier choices.
  await page.getByRole("button", { name: /艾洛拉/ }).click();
  await page.getByRole("button", { name: /柯萝萝/ }).click();
  await page.getByRole("button", { name: /诺玛/ }).click();
  await expect(page.locator("[data-character-displayed]")).toHaveAttribute("data-character-displayed", "norma");
  await expect(page.locator("[data-character-change]")).toHaveAttribute("data-character-change", "ready");
  await expect(page.locator(".character-board__panel-content")).toHaveAttribute("data-character-content", "norma:dice");
  await expect(page.getByRole("tab", { name: "骰装" })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: info.outputPath("character-linked-switch.png") });
});

test("character board tabs animate anchored artwork and keep a permanent panel seat", async ({ page }, info) => {
  await enterMenu(page);
  await openCharacter(page);
  const tab = page.getByRole("tab", { name: "骰装" });
  const original = await tab.boundingBox();
  const hover = await sampleTransition(page, '.abyssa-rpg-tab[aria-label="骰装"] > svg', () => tab.hover(), "pointerover");
  expect(new Set(hover.map(f => f.scaleY.toFixed(3))).size).toBeGreaterThan(3);
  expect(hover.at(-1)!.scaleY).toBeCloseTo(.97, 3);
  expect(await tab.boundingBox()).toEqual(original);
  const selection = await sampleTransition(page, '.abyssa-rpg-tab[aria-label="骰装"] > svg > path', () => tab.click());
  expect(new Set(selection.map(f => f.fill)).size).toBeGreaterThan(3);
  await expect(tab).toHaveAttribute("aria-selected", "true");
  expect(await tab.boundingBox()).toEqual(original);
  await expect.poll(() => tab.locator("svg").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m22)).toBe(1);
  const seat = await page.locator('[role="tabpanel"]').evaluate(el => {
    const css = getComputedStyle(el, "::before");
    return { content: css.content, opacity: css.opacity, background: css.backgroundColor };
  });
  expect(seat.content).toBe('""');
  expect(seat.opacity).toBe("1");
  expect(seat.background).not.toBe("rgba(0, 0, 0, 0)");
  await page.mouse.down();
  await expect.poll(() => tab.locator("svg").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m22)).toBeCloseTo(.86, 3);
  expect(await tab.boundingBox()).toEqual(original);
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath("character-tabs-seated.png") });
});

type DialFeedbackFrame = { x: number; scale: number; textX: number; textScale: number; fill: string; surface: string; flash: number };
type DialSamplingWindow = Window & { dialFeedback?: Promise<DialFeedbackFrame[]> };
async function recordDialFeedback(page: Page, event: "pointerover" | "click", action: () => Promise<unknown>) {
  await page.evaluate(event => {
    (window as DialSamplingWindow).dialFeedback = new Promise(resolve => {
      const begin = (input: Event) => {
        if (!(input.target instanceof Element) || !input.target.matches('.menu-dial__button[data-command="storage"]')) return;
        document.removeEventListener(event, begin, true);
        const start = performance.now(), frames: DialFeedbackFrame[] = [];
        function sample(time: number) {
          const panel = document.querySelector('.menu-dial__panel[data-command="storage"]')!;
          const css = getComputedStyle(panel), matrix = new DOMMatrixReadOnly(css.transform);
          const text = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.menu-dial__content-motion[data-command="storage"]')!).transform);
          const flash = panel.querySelector(".menu-dial__response");
          frames.push({ x: matrix.m41, scale: matrix.m11, textX: text.m41, textScale: text.m11,
            fill: getComputedStyle(panel.querySelector(".menu-dial__panel-fill")!).fill,
            surface: css.getPropertyValue("--menu-cmd-fill").trim(), flash: flash ? Number(getComputedStyle(flash).opacity) : 0 });
          if (time - start < 650) requestAnimationFrame(sample); else resolve(frames);
        }
        requestAnimationFrame(sample);
      };
      document.addEventListener(event, begin, true);
    });
  }, event);
  await action();
  return (await page.evaluate(() => (window as DialSamplingWindow).dialFeedback))!;
}

test("menu dial feedback animates the real plates with stable input and synchronized labels", async ({ page }, info) => {
  await enterMenu(page);
  const storage = page.getByRole("button", { name: /仓库 ·/ });
  const panel = page.locator('.menu-dial__panel[data-command="storage"]');
  const relativeHit = () => storage.evaluate(el => {
    const button = el.getBoundingClientRect(), dial = el.closest(".menu-dial")!.getBoundingClientRect();
    return [button.x - dial.x, button.y - dial.y, button.width, button.height];
  });
  const beforeHit = await relativeHit();
  const hover = await recordDialFeedback(page, "pointerover", () => storage.hover());
  await info.attach("dial-hover-frames", { body: JSON.stringify(hover), contentType: "application/json" });
  expectIntermediate(hover.map(f => f.x), 0, -7);
  expect(new Set(hover.map(f => f.fill)).size).toBeGreaterThan(3);
  for (const frame of hover) {
    expect(frame.textX).toBeCloseTo(frame.x * .875, 2);
    expect(frame.textScale).toBeCloseTo(frame.scale, 3);
    expect(frame.fill).toBe(frame.surface);
  }
  await expect(storage).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /府邸 ·/ })).toHaveAttribute("aria-pressed", "true");
  const afterHit = await relativeHit();
  afterHit.forEach((value, i) => expect(value).toBeCloseTo(beforeHit[i], 1));
  await page.screenshot({ path: info.outputPath("menu-dial-hover.png") });
  await page.mouse.down();
  await expect.poll(() => panel.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11)).toBeLessThan(1);
  const selected = await recordDialFeedback(page, "click", () => page.mouse.up());
  await info.attach("dial-selection-frames", { body: JSON.stringify(selected), contentType: "application/json" });
  expect(new Set(selected.map(f => f.fill)).size).toBeGreaterThan(3);
  expectIntermediate(selected.map(f => f.flash), 0, .55);
  for (const frame of selected) expect(frame.fill).toBe(frame.surface);
  await expect(storage).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("menu-dial-selected-hover.png") });
  const confirmed = await recordDialFeedback(page, "click", () => storage.click());
  expectIntermediate(confirmed.map(f => f.flash), 0, 1);
  await expect(panel.locator(".menu-dial__response")).toHaveAttribute("data-kind", "confirm");
  await expect(panel.locator(".menu-dial__response")).toHaveCSS("opacity", "0");
  await page.mouse.move(800, 100);
  await expect(panel.locator(".menu-dial__panel-fill")).toHaveCSS("fill", "rgb(83, 127, 130)");
  await page.keyboard.press("Tab");
  const shop = page.getByRole("button", { name: /商店 ·/ });
  await expect(shop).toBeFocused();
  await expect(page.locator('.menu-dial__panel[data-command="shop"] .menu-dial__panel-focus')).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(shop).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/shop\?/);
  await expect(page.locator(".menu-entry")).toHaveCount(0);
});

test("menu dial feedback supports touch without sticky hover", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await enterMenu(page);
    const storage = page.getByRole("button", { name: /仓库 ·/ });
    await storage.tap();
    await expect(storage).toHaveAttribute("aria-pressed", "true");
    const panel = page.locator('.menu-dial__panel[data-command="storage"]');
    await expect(panel.locator(".menu-dial__panel-fill")).toHaveCSS("fill", "rgb(83, 127, 130)");
    expect(await panel.evaluate(el => getComputedStyle(el).getPropertyValue("--menu-feedback-distance").trim())).toBe("3.4");
    await storage.tap();
    await expect(panel.locator(".menu-dial__response")).toHaveAttribute("data-kind", "confirm");
    await expect(page.locator(".menu-entry")).not.toHaveAttribute("data-menu-looking");
  } finally { await context.close(); }
});

async function installMenuEntranceRecorder(page: Page) {
  await page.addInitScript(() => {
    const recorded = new WeakSet<Element>();
    const watch = new MutationObserver(() => {
      const root = document.querySelector('.menu-entry[data-menu-intro="playing"]');
      if (!root || recorded.has(root)) return;
      recorded.add(root);
      const target = window as MenuSamplingWindow;
      target.menuEntranceCount = (target.menuEntranceCount ?? 0) + 1;
      target.menuEntranceStyles = [...root.querySelectorAll(".menu-host__figure, .menu-topbar__hud-frame, .menu-dial__panel-entry, .menu-dial__content-entry, .menu-dial__dialogue")].map(el => {
        const css = getComputedStyle(el);
        return { name: css.animationName, duration: css.animationDuration, delay: css.animationDelay, easing: css.animationTimingFunction };
      });
      target.menuEntrance = new Promise(resolve => {
        const start = performance.now(), frames: MenuEntranceFrame[] = [];
        const opacity = (selector: string) => Number(getComputedStyle(root.querySelector(selector)!).opacity);
        function sample(time: number) {
          frames.push({ time: time - start,
            portrait: opacity(".menu-host__figure"), hud: opacity(".menu-topbar__hud-frame--time"),
            plates: ["estate", "storage", "shop", "sortie"].map(id => opacity(`.menu-dial__panel-entry[data-command="${id}"]`)),
            dialogue: opacity(".menu-dial__dialogue") });
          if (time - start < 1550) requestAnimationFrame(sample); else resolve(frames);
        }
        requestAnimationFrame(sample);
      });
    });
    watch.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-menu-intro"] });
  });
}

test("menu layered entrance has visible separate beats and intermediate frames", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await installMenuEntranceRecorder(page);
  await enterMenu(page);
  const frames = (await page.evaluate(() => (window as MenuSamplingWindow).menuEntrance))!;
  await info.attach("menu-layered-entrance-frames", { body: JSON.stringify(frames), contentType: "application/json" });
  expect(frames?.length).toBeGreaterThan(10);
  expectIntermediate(frames.map(f => f.portrait), 0, 1);
  expectIntermediate(frames.map(f => f.hud), 0, 1);
  for (let i = 0; i < 4; i++) expectIntermediate(frames.map(f => f.plates[i]), 0, 1);
  expectIntermediate(frames.map(f => f.dialogue), 0, 1);
  const visibleAt = (read: (frame: MenuEntranceFrame) => number) => frames.find(f => read(f) > .5)!.time;
  expect(visibleAt(f => f.portrait)).toBeLessThan(visibleAt(f => f.hud));
  expect(visibleAt(f => f.hud)).toBeLessThan(visibleAt(f => f.plates[0]));
  for (let i = 1; i < 4; i++) expect(visibleAt(f => f.plates[i - 1])).toBeLessThan(visibleAt(f => f.plates[i]));
  expect(visibleAt(f => f.plates[3])).toBeLessThan(visibleAt(f => f.dialogue));
  await page.screenshot({ path: info.outputPath("menu-neutral.png") });
  expect(errors).toEqual([]);
});

test("menu unified entrance matches refresh, in-game return and history return", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await installMenuEntranceRecorder(page);
  await enterMenu(page);
  const first = await page.evaluate(() => (window as MenuSamplingWindow).menuEntranceStyles);
  await page.reload();
  await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
  const refresh = await page.evaluate(() => (window as MenuSamplingWindow).menuEntranceStyles);
  expect(refresh).toEqual(first);
  expect(refresh?.filter(style => style.name === "menu-command-in")).toHaveLength(8);
  const checkFrames = async (label: string) => {
    const frames = (await page.evaluate(() => (window as MenuSamplingWindow).menuEntrance))!;
    await info.attach(`menu-entrance-${label}`, { body: JSON.stringify(frames), contentType: "application/json" });
    expectIntermediate(frames.map(frame => frame.portrait), 0, 1);
    expectIntermediate(frames.map(frame => frame.dialogue), 0, 1);
    for (let i = 0; i < 4; i++) expectIntermediate(frames.map(frame => frame.plates[i]), 0, 1);
  };
  await checkFrames("refresh");
  for (const [index, route] of ["in-game", "history"].entries()) {
    const shop = page.getByRole("button", { name: /商店 ·/ });
    await shop.click(); await shop.click();
    await expect(page).toHaveURL(/#\/shop\?/);
    await ready(page);
    if (route === "in-game") await page.getByRole("link", { name: "返回菜单", exact: true }).click();
    else await page.goBack();
    await expect(page).toHaveURL(/#\/menu\?/);
    await ready(page);
    await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
    expect(await page.evaluate(() => (window as MenuSamplingWindow).menuEntranceCount)).toBe(index + 2);
    expect(await page.evaluate(() => (window as MenuSamplingWindow).menuEntranceStyles)).toEqual(refresh);
    await checkFrames(route);
  }
  expect(errors).toEqual([]);
});

test("menu layered camera keeps depth, masking, scale and hit areas intact", async ({ page }, info) => {
  await enterMenu(page);
  const root = page.locator(".menu-entry");
  const layers = [".menu-scenery", ".menu-app__host", ".menu-app__dial", ".menu-sidebar", ".menu-topbar"];
  const transforms = () => page.evaluate(selectors => selectors.map(selector => {
    const css = getComputedStyle(document.querySelector(selector)!);
    const matrix = new DOMMatrixReadOnly(css.transform);
    return { x: matrix.m41, y: matrix.m42, scale: matrix.m11 };
  }), layers);
  const settle = () => expect(root).not.toHaveAttribute("data-menu-looking");
  const coverage = async () => {
    const canvas = (await root.boundingBox())!;
    const background = (await page.locator(".menu-scenery").boundingBox())!;
    const fade = (await page.locator(".menu-host__fade").boundingBox())!;
    expect(background.x).toBeLessThan(canvas.x);
    expect(background.y).toBeLessThan(canvas.y);
    expect(background.x + background.width).toBeGreaterThan(canvas.x + canvas.width);
    expect(background.y + background.height).toBeGreaterThan(canvas.y + canvas.height);
    expect(fade.x).toBeCloseTo(canvas.x, 1);
    expect(fade.width).toBeCloseTo(canvas.width, 1);
    expect(fade.y + fade.height).toBeCloseTo(canvas.y + canvas.height, 1);
  };
  await page.mouse.move(800, 450); await settle();
  // Record actual rAF positions, not merely the transform at its destination.
  const recording = page.evaluate(async () => {
    const values: number[] = [];
    await new Promise<void>(resolve => {
      document.addEventListener("pointermove", () => {
        const start = performance.now();
        const sample = (time: number) => {
          values.push(new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".menu-app__host")!).transform).m41);
          if (time - start < 1100) requestAnimationFrame(sample); else resolve();
        };
        requestAnimationFrame(sample);
      }, { once: true });
    });
    return values;
  });
  await page.mouse.move(1560, 870);
  const values = await recording;
  expectIntermediate(values, 0, -22.8);
  await info.attach("menu-camera-frames", { body: JSON.stringify(values), contentType: "application/json" });
  await settle();
  const moved = await transforms();
  expect(moved[0].x).toBeCloseTo(-9.5, 1);
  expect(moved[1].x).toBeCloseTo(-22.8, 1);
  expect(moved[2].x).toBeCloseTo(-5.7, 1);
  expect(moved[3].scale).toBeCloseTo(.94, 3);
  await coverage();
  await page.screenshot({ path: info.outputPath("menu-bottom-mask-pointer-bottom-right.png") });
  for (const [x, y] of [[40, 30], [1560, 30], [40, 870]]) {
    await page.mouse.move(x, y); await settle(); await coverage();
  }
  await page.screenshot({ path: info.outputPath("menu-bottom-mask-pointer-bottom-left.png") });
  await page.keyboard.press("Tab"); await settle();
  for (const layer of await transforms()) expect(layer.x).toBe(0);
  const normalizedLayout = () => page.evaluate(() => {
    const stage = document.querySelector(".menu-entry")!.getBoundingClientRect();
    const scale = stage.width / 1600;
    return [".menu-host__figure", ".menu-sidebar", ".menu-dial", ".menu-dial__dialogue"].map(selector => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return [(rect.x - stage.x) / scale, (rect.y - stage.y) / scale, rect.width / scale, rect.height / scale];
    }).flat();
  });
  const fullLayout = await normalizedLayout();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.mouse.move(640, 400); await settle();
  const scaledLayout = await normalizedLayout();
  scaledLayout.forEach((value, i) => expect(value).toBeCloseTo(fullLayout[i], 1));
  await page.mouse.move(1250, 740); await settle(); await coverage();
  await page.screenshot({ path: info.outputPath("menu-letterboxed-mask.png") });
  await page.getByRole("button", { name: /仓库 ·/ }).click();
  await expect(page.getByRole("button", { name: /仓库 ·/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "角色", exact: true }).click();
  await expect(page.getByRole("button", { name: "角色", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(640, 10); await settle();
  for (const layer of await transforms()) expect(layer.x).toBe(0);
});

for (const manual of [false, true]) {
  test(`menu layered motion respects ${manual ? "manual" : "system"} reduction`, async ({ page }) => {
    if (manual) await page.addInitScript(() => localStorage.setItem("abyssa:ui-motion:v1", "reduced"));
    await enterMenu(page, manual ? "no-preference" : "reduce");
    const root = page.locator(".menu-entry");
    await expect(root).toHaveAttribute("data-menu-reduced", "true");
    await page.mouse.move(1540, 840);
    await expect(root).not.toHaveAttribute("data-menu-looking");
    expect(await root.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(page.locator(".menu-host__figure")).toHaveCSS("opacity", "1");
    expect(await page.locator(".menu-app__host").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBe(0);
    await page.getByRole("button", { name: /出征 ·/ }).click();
    await expect(page.getByRole("button", { name: /出征 ·/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.menu-dial__panel[data-command="sortie"]')).toHaveCSS("transform", "none");
    await expect(page.locator(".menu-dial__response")).toHaveCSS("animation-name", "none");
  });
}

type RollbackFrame = { time: number; opacity: number; width: number; top: number; y: number; scaleY: number; fill: string };
type SamplingWindow = Window & { rollbackSample?: Promise<RollbackFrame[]>; menuIntroSample?: Promise<number[]> };

async function sampleTransition(page: Page, selector: string, action: () => Promise<unknown>, event: "click" | "pointerover" = "click") {
  await page.evaluate(({ selector, event }) => {
    (window as SamplingWindow).rollbackSample = new Promise(resolve => {
      const frames: RollbackFrame[] = [];
      let start = 0;
      const tick = (time: number) => {
        const node = document.querySelector(selector);
        if (node) {
          const css = getComputedStyle(node);
          frames.push({ time, opacity: Number(css.opacity), width: parseFloat(css.width), top: parseFloat(css.top), y: new DOMMatrixReadOnly(css.transform).m42, scaleY: new DOMMatrixReadOnly(css.transform).m22, fill: css.fill });
        }
        if (time - start < 1500) requestAnimationFrame(tick); else resolve(frames);
      };
      // Start with the actual DOM click, not before Playwright's hit-area wait.
      document.addEventListener(event, () => {
        start = performance.now();
        tick(start);
      }, { capture: true, once: true });
    });
  }, { selector, event });
  await action();
  const frames = (await page.evaluate(() => (window as SamplingWindow).rollbackSample))!;
  await test.info().attach(`frames-${selector}`, { body: JSON.stringify(frames), contentType: "application/json" });
  return frames;
}

function expectIntermediate(values: number[], from: number, to: number) {
  const low = Math.min(from, to), high = Math.max(from, to);
  const intermediate = values.filter(value => value > low + .02 && value < high - .02);
  // Protect actual in-between frames, not just CSS declarations or the final state.
  expect(new Set(intermediate.map(value => value.toFixed(3))).size).toBeGreaterThanOrEqual(3);
}

// Motion samples run serially: competing WebGL pages distort frame timing.
test.describe.configure({ mode: "default" });

test("title entries follow the original Logo clock in order, with immediate keyboard skip", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Record in the page before it mounts: a cold startup can finish an animation
  // between two remote assertions, even though the animation itself ran correctly.
  await page.addInitScript(() => {
    const events: { kind: string; index: number; delay: string; duration: string }[] = [];
    (window as Window & { titleEntryEvents?: typeof events }).titleEntryEvents = events;
    for (const kind of ["animationstart", "animationend"]) document.addEventListener(kind, raw => {
      const event = raw as AnimationEvent;
      if (event.animationName !== "title-command-enter" || !(event.target instanceof HTMLElement)) return;
      const css = getComputedStyle(event.target);
      events.push({ kind, index: Number(event.target.style.getPropertyValue("--title-entry-index")), delay: css.animationDelay, duration: css.animationDuration });
    }, true);
  });
  await page.goto("/");
  const menu = page.locator(".title-commands");
  const entryEvents = () => page.evaluate(() => (window as Window & {
    titleEntryEvents?: { kind: string; index: number; delay: string; duration: string }[];
  }).titleEntryEvents ?? []);
  await expect.poll(async () => (await entryEvents()).filter(event => event.kind === "animationend").map(event => event.index), { timeout: 40_000 }).toEqual([0, 1, 2, 3]);
  expect((await entryEvents()).filter(event => event.kind === "animationstart").map(({ index, delay, duration }) => ({ index, delay, duration })))
    .toEqual([4.02, 4.10, 4.18, 4.26].map((delay, index) => ({ index, delay: `${delay}s`, duration: "0.46s" })));
  await expect(menu).not.toHaveAttribute("data-intro");
  await page.screenshot({ path: info.outputPath("title-after-logo.png") });
  await page.reload();
  // The initial resource curtain owns input until the title is ready.
  await expect(menu.locator(".title-commands__item").first()).toBeEnabled({ timeout: 30_000 });
  await expect(menu).toHaveAttribute("data-intro", "true");
  await page.keyboard.press("Tab");
  await expect(menu).not.toHaveAttribute("data-intro");
  await expect(menu.getByRole("button", { name: "继续游戏" })).toBeFocused();
});

// This protects ordinary UI, not the independent Logo intro, CG crossfades,
// route/resource curtains, weather or authored performances.
async function expectNoLocalKeyframes(root: Locator, allowed: string[] = []) {
  expect(await root.evaluate(element => element.getAnimations({ subtree: true })
    .filter(animation => animation instanceof CSSAnimation)
    .map(animation => (animation as CSSAnimation).animationName)).then(names => names.filter(name => !allowed.includes(name)))).toEqual([]);
}

async function expectTitleFeedback(page: Page, reduced: boolean) {
  const menu = page.locator(".title-commands");
  const begin = page.getByRole("button", { name: "新的开始", exact: true });
  await expect(menu).toHaveAttribute("data-ui-motion", reduced ? "reduced" : "full");
  await begin.hover();
  await expect(begin).toHaveAttribute("data-highlighted", "true");
  const surface = begin.locator(".title-commands__surface");
  await expect.poll(() => surface.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11))
    .toBeCloseTo(reduced ? 1 : 1.018, 3);
  for (const gem of await menu.locator(".title-commands__gem").all()) {
    await expect(gem).toHaveCSS("animation-name", reduced ? "none" : "title-gem-float");
  }
  for (const cursor of await menu.locator(".title-commands__cursor").all()) {
    await expect.poll(() => cursor.evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42
      - parseFloat(getComputedStyle(el).getPropertyValue("--title-cursor-y"))))).toBeLessThan(.01);
  }
  await page.mouse.down();
  await expect.poll(() => surface.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBe(reduced ? 0 : 1.5);
  await expect(begin).toHaveCSS("transform", "none");
  await page.mouse.move(2, 2); await page.mouse.up();
}

async function expectSurfaceSettled(dialog: Locator) {
  await expect(dialog.locator("..")).toHaveCSS("opacity", "1");
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el).translate
    .split(" ").every(part => parseFloat(part) === 0))).toBe(true);
  await expect(dialog).toHaveCSS("transform", "none");
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  for (const width of [1600, 1280]) {
    test(`protected title: ${reducedMotion}, ${width}px Stage`, async ({ page }, info) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      const begin = page.getByRole("button", { name: "新的开始", exact: true });
      await expect(begin).toBeEnabled({ timeout: 30_000 });
      await expect(page.locator(".title-emblem .abyssa-logo")).toHaveAttribute("data-intro", "true");
      await expectNoLocalKeyframes(page.locator(".title-commands"), reducedMotion === "reduce" ? [] : ["title-command-enter", "title-cursor-enter", "title-command-sheen", "title-gem-float"]);
      await expectNoLocalKeyframes(page.locator(".title-backdrop"));
      // Intro translates the row wrapper and temporarily changes offsetParent.
      // Compare steady-state hit areas, not coordinates from different parents.
      await expect(page.locator(".title-commands")).not.toHaveAttribute("data-intro", { timeout: 10_000 });
      const targets = await page.locator(".title-commands__item").evaluateAll(elements =>
        elements.map(element => { const el = element as HTMLElement; return [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]; }));
      const sceneBounds = (await page.locator(".title-scene").boundingBox())!;
      await page.mouse.move(sceneBounds.x + sceneBounds.width - 5, sceneBounds.y + 5);
      await expect(page.locator(".title-scene")).not.toHaveAttribute("data-looking");
      const lookX = await page.locator(".title-scene").evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--title-look-x")));
      if (reducedMotion === "reduce") expect(lookX).toBe(0);
      else expect(lookX).toBeGreaterThan(.8);
      for (const [selector, depth] of [['.title-cg-layer[data-side="left"]', -24], ['.title-cg-layer[data-side="right"]', -20], ['.title-backdrop', -8]] as const) {
        expect(await page.locator(selector).evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41))
          .toBeCloseTo(depth * lookX, 2);
      }
      await expect(page.locator('.title-cg[data-side="right"]')).toHaveCSS("scale", "-1 1");
      await page.keyboard.press("End");
      await expect(page.getByRole("button", { name: "设定", exact: true })).toBeFocused();
      await page.keyboard.press("Home");
      await expect(page.getByRole("button", { name: "继续游戏", exact: true })).toBeFocused();
      expect(await page.locator(".title-commands__item").evaluateAll(elements =>
        elements.map(element => { const el = element as HTMLElement; return [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]; }))).toEqual(targets);
      await begin.hover();
      await expect(begin).toHaveAttribute("data-highlighted", "true");
      // The legacy global reduced-motion fallback gives even static nodes a
      // 0.01ms transition. Observe the selected position, not a pre-paint frame.
      await expect.poll(() => page.locator(".title-commands__cursor").first().evaluate(element => {
        const style = getComputedStyle(element);
        return Math.abs(new DOMMatrixReadOnly(style.transform).m42 - parseFloat(style.getPropertyValue("--title-cursor-y"))) < 0.01;
      })).toBe(true);
      await expect(page.locator(".title-commands__gem")).toHaveCount(2);
      await expectTitleFeedback(page, reducedMotion === "reduce");
      await expect(begin).toHaveAttribute("data-highlighted", "true");
      await expect(begin.locator(".title-commands__finish")).toHaveCount(1);
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowDown");
      await expect(begin.locator(".title-commands__edge")).toHaveCSS("opacity", "1");
      await page.screenshot({ path: info.outputPath("title-static.png") });

      // Repeated open/close must not retain a hidden panel or an input lock.
      for (let i = 0; i < 2; i++) {
        await begin.click();
        const dialog = page.getByRole("dialog", { name: "选择旅程起点" });
        await expect(dialog).toBeVisible();
        await expectSurfaceSettled(dialog);
        await expect.poll(() => page.locator(".title-scene").evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--title-look-x")))).toBe(0);
        await expectNoLocalKeyframes(dialog);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(begin).toBeFocused();
      }
      expect(errors).toEqual([]);
    });
  }
}

test("UI motion preference persists across routes and reload and follows live system changes", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#/settings");
  await page.getByRole("tab", { name: "Display" }).click();
  const toggle = page.getByRole("switch", { name: "减弱界面动效（关闭时跟随系统）" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page.locator(".settings-app")).toHaveAttribute("data-ui-motion", "reduced");
  await page.screenshot({ path: info.outputPath("settings-motion.png") });
  await page.goto("/");
  await expectTitleFeedback(page, true);
  await page.mouse.move(1200, 100);
  await expect.poll(() => page.locator(".title-scene").evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--title-look-x")))).toBe(0);
  await page.getByRole("button", { name: "新的开始", exact: true }).click();
  await expect(page.locator(".abyssa-modal")).toHaveAttribute("data-ui-motion", "reduced");
  await page.reload();
  await page.getByRole("button", { name: "新的开始", exact: true }).click();
  await expect(page.locator(".abyssa-modal")).toHaveAttribute("data-ui-motion", "reduced");
  // Route removal must release the old modal's input capture.
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "恢复默认设置" }).click();
  await expect(page.locator(".settings-app")).toHaveAttribute("data-ui-motion", "full");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".settings-app")).toHaveAttribute("data-ui-motion", "reduced");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".settings-app")).toHaveAttribute("data-ui-motion", "full");
  expect(await page.evaluate(() => localStorage.getItem("abyssa:ui-motion:v1"))).toBe("system");
});

test("protected title supports touch activation without duplicate commands", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "新的开始", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "选择旅程起点" })).toHaveCount(1);
    await page.getByRole("button", { name: "关闭选择旅程起点", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "新的开始", exact: true })).toBeFocused();
    await expect(page.locator(".title-commands__gem")).toHaveCount(2);
  } finally { await context.close(); }
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`restored page transitions have intermediate frames: ${reducedMotion}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      document.addEventListener("animationstart", event => {
        if (!(event.target instanceof Element) || !event.target.matches(".menu-host__figure")) return;
        const node = event.target;
        (window as SamplingWindow).menuIntroSample = new Promise(resolve => {
          const values: number[] = [], start = performance.now();
          const tick = (time: number) => {
            values.push(Number(getComputedStyle(node).opacity));
            if (time - start < 750) requestAnimationFrame(tick); else resolve(values);
          };
          requestAnimationFrame(tick);
        });
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "新的开始", exact: true }).click();
    await page.getByRole("button", { name: "跳过教程", exact: true }).click();
    await expect(page).toHaveURL(/#\/menu\?/);
    await ready(page);
    await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
    if (reducedMotion === "no-preference") {
      const values = (await page.evaluate(() => (window as SamplingWindow).menuIntroSample)) ?? [];
      await info.attach("menu-intro-opacity", { body: JSON.stringify(values), contentType: "application/json" });
      expectIntermediate(values, 0, 1);
    }
    await expect(page.locator(".menu-dial__dialogue")).toContainText("……今天也没什么大事吧？那就好。");
    await page.screenshot({ path: info.outputPath("menu-restored.png") });
    await page.getByRole("button", { name: /仓库 ·/ }).click();
    const manor = page.getByRole("button", { name: "府邸 · 回到守望者之崖洋馆", exact: true });
    await manor.click(); await manor.click();
    await expect(page).toHaveURL(/#\/mansion\?/);
    await ready(page);
    const room = page.locator(".mansion-room-drawer");
    const roomFrames = await sampleTransition(page, ".mansion-room-drawer", () => page.getByRole("button", { name: "查看大厅", exact: true }).click());
    await expect(room).toHaveCSS("opacity", "1");
    if (reducedMotion === "no-preference") expectIntermediate(roomFrames.map(f => f.opacity), 0, 1);
    await page.screenshot({ path: info.outputPath("mansion-restored.png") });
    await room.getByRole("button", { name: "关闭房间详情" }).click();
    await expect(room).toHaveCount(0);
    const railFrames = await sampleTransition(page, ".game-menu", () => page.getByRole("button", { name: "展开菜单", exact: true }).click());
    await expect(page.locator(".game-menu")).toHaveCSS("width", "194px");
    if (reducedMotion === "no-preference") expectIntermediate(railFrames.map(f => f.width), 58, 194);
    await page.getByRole("link", { name: "出征编队", exact: true }).click();
    await expect(page).toHaveURL(/#\/map\?/);
    await ready(page);
    await expect(page.locator(".abyssa-map-loading")).toHaveCount(0);
    const partyFrames = await sampleTransition(page, ".abyssa-sortie-stage", () => page.getByRole("button", { name: "查看出战队伍并编队" }).click());
    if (reducedMotion === "no-preference") expectIntermediate(partyFrames.map(f => f.top), partyFrames[0].top, partyFrames.at(-1)!.top);
    await expect(page.locator(".abyssa-map-viewport")).toHaveAttribute("data-mode", "team");
    await page.screenshot({ path: info.outputPath("map-restored.png") });
    await page.getByRole("button", { name: "完成编队", exact: true }).click();
    await expect(page.locator(".abyssa-sortie-stage")).toHaveCSS("top", "577px");
    const canvas = page.locator(".abyssa-map-scene canvas"), bounds = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: bounds.width * .48, y: bounds.height * .495 } });
    await page.getByRole("button", { name: "出发", exact: true }).click();
    await expect(page).toHaveURL(/#\/battle\?/);
    await ready(page);
    await expect(page.locator(".action-dock")).toBeVisible();
    const trayFrames = await sampleTransition(page, ".action-dock__alternate", () => page.locator(".action-dock__switch").click());
    await expect(page.locator(".action-dock__alternate")).toHaveCSS("opacity", "1");
    if (reducedMotion === "no-preference") expectIntermediate(trayFrames.map(f => f.y), 22, 0);
    await page.locator(".action-dock__switch").click();
    const ledgerFrames = await sampleTransition(page, ".battle-ledger-drawer__travel", () => page.getByRole("button", { name: "远征账本", exact: true }).click());
    if (reducedMotion === "no-preference") expectIntermediate(ledgerFrames.map(f => f.y), ledgerFrames[0].y, 0);
    await expect(page.locator(".battle-ledger-drawer")).toHaveAttribute("data-open", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator(".battle-ledger-drawer")).not.toHaveAttribute("data-open");
    await expect(page.getByRole("button", { name: "远征账本", exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath("battle-restored.png") });
    expect(errors).toEqual([]);
  });
}
