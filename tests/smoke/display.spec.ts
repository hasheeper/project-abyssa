import { expect, test } from "@playwright/test";

test("fullscreen enters, exits, and stays synchronized across settings categories", async ({ page }, info) => {
  await page.goto("/#/settings");
  await page.getByRole("tab", { name: "Display", exact: true }).click();
  const fullscreen = page.getByRole("switch", { name: "全屏模式", exact: true });
  await expect(fullscreen).toHaveText("进入全屏");
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute("aria-checked", "true");
  await expect(fullscreen).toHaveText("退出全屏");
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await page.getByRole("tab", { name: "About", exact: true }).click();
  await page.getByRole("tab", { name: "Display", exact: true }).click();
  await expect(fullscreen).toHaveText("退出全屏");
  await page.keyboard.press("Escape");
  await expect(fullscreen).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("dialog", { name: "系统设置" })).toBeVisible();
  await fullscreen.click();
  await expect(fullscreen).toHaveText("退出全屏");
  await fullscreen.click();
  await expect(fullscreen).toHaveText("进入全屏");
  await page.screenshot({ path: info.outputPath("desktop-settings.png") });
  await page.getByRole("button", { name: "返回菜单", exact: true }).click();
  await expect(page).toHaveURL(/#\/title$/);
  await expect(page.getByRole("button", { name: "新的开始", exact: true })).toBeVisible();
});

test("browser selection is disabled while authored game feedback and editable text survive", async ({ page }) => {
  await page.goto("/#/settings");
  const scene = page.getByRole("tab", { name: "Scene", exact: true });
  await expect(scene).toHaveAttribute("aria-selected", "true");
  const heading = page.locator(".system-scene__heading");
  await heading.dblclick();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  expect(await heading.evaluate(node => getComputedStyle(node).userSelect)).toBe("none");
  await scene.click();
  expect(await scene.evaluate(node => getComputedStyle(node).outlineStyle)).toBe("none");
  await scene.press("ArrowRight");
  const display = page.getByRole("tab", { name: "Display", exact: true });
  expect(await display.evaluate(node => getComputedStyle(node).outlineStyle)).toBe("solid");
  await page.getByRole("tab", { name: "Model", exact: true }).click();
  const input = page.getByLabel("公共 API Key", { exact: true });
  await input.fill("synthetic-selection-test");
  await input.press("ControlOrMeta+A");
  expect(await input.evaluate(node => {
    const field = node as HTMLInputElement;
    return { editable: getComputedStyle(field).userSelect, length: (field.selectionEnd ?? 0) - (field.selectionStart ?? 0) };
  })).toEqual({ editable: "text", length: "synthetic-selection-test".length });
});

test("touch phones must rotate to landscape and can return to portrait safely", async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/#/settings`);
    await expect(page.getByText("请旋转至横屏", { exact: true })).toBeVisible();
    await expect(page.locator("#root")).toHaveAttribute("inert", "");
    await page.screenshot({ path: info.outputPath("phone-portrait.png") });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByText("请旋转至横屏", { exact: true })).toHaveCount(0);
    await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
    await page.getByRole("tab", { name: "Display", exact: true }).click();
    await expect(page.getByRole("switch", { name: "全屏模式", exact: true })).toBeVisible();
    const stage = await page.locator(".abyssa-stage").boundingBox();
    expect(stage?.width).toBe(844); expect(stage?.height).toBe(390);
    await page.screenshot({ path: info.outputPath("phone-landscape.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText("请旋转至横屏", { exact: true })).toBeVisible();
    await expect(page.locator("#root")).toHaveAttribute("inert", "");
  } finally { await context.close(); }
});
