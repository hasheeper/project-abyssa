import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import { observeArtifacts } from "./helpers";

let archive: string;
test.beforeAll(async () => {
  const generator = resolve(projectRoot, "dist/reports/tutorial/fixture-generator.mjs");
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/game-client/testing/manor.ts"], outfile: generator,
    bundle: true, format: "esm", platform: "node", target: "es2022",
  });
  const { manorClientFixture } = await import(pathToFileURL(generator).href);
  const fixture = await manorClientFixture(19, 4);
  try {
    const result = await fixture.runtime.application.exportSave("manor-save");
    if (!result.ok) throw new Error(result.error.message);
    archive = result.archive;
  } finally {
    fixture.session.dispose();
  }
});

async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 60_000 });
  await expect(page.locator(".abyssa-expedition")).toHaveAttribute("aria-busy", "false");
}

async function step(page: Page, id: string) {
  const host = page.locator(".abyssa-tutorial[data-visible]");
  await expect(host).toHaveAttribute("data-step", `battle.basics.${id}`);
  // Capture stable animation frames, not the first transparent frame after mounting.
  await expect(host.locator(".abyssa-tutorial__card")).toHaveCSS("opacity", "1");
}

const target = (page: Page) => page.locator('[data-tutorial-anchor][aria-describedby*="tutorial-copy-"]');
const layout = (page: Page) => page.locator(".abyssa-expedition-frame,.abyssa-expedition-dice-panel,.battle-companion")
  .evaluateAll(nodes => nodes.map(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  }));

async function expectClearGeometry(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const card = document.querySelector(".abyssa-tutorial__card")!.getBoundingClientRect();
    const target = document.querySelector('[data-tutorial-anchor][aria-describedby*="tutorial-copy-"]')!.getBoundingClientRect();
    const focus = document.querySelector(".abyssa-tutorial__outline")!.getBoundingClientRect();
    const overlaps = (rect: DOMRect) => card.left < rect.right && card.right > rect.left && card.top < rect.bottom && card.bottom > rect.top;
    const controls = [...document.querySelectorAll<HTMLElement>("[data-tutorial-anchor]")].filter(node => {
      const id = node.dataset.tutorialAnchor!;
      return /battle\.(die|health|enemy-health|intent):/.test(id) || ["battle.roll", "battle.reroll", "battle.end-turn"].includes(id);
    });
    return {
      inViewport: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight,
      aligned: Math.abs(focus.left - (target.left - 6)) < 1 && Math.abs(focus.top - (target.top - 6)) < 1,
      blocked: controls.filter(node => overlaps(node.getBoundingClientRect())).map(node => node.dataset.tutorialAnchor),
    };
  })).toEqual({ inViewport: true, aligned: true, blocked: [] });
}

for (const prefix of ["/", "/abyssa/"]) {
  test(`shared tutorial follows real battle controls without layout shifts under ${prefix}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = await observeArtifacts(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(prefix);
    await page.getByRole("button", { name: "记录", exact: true }).click({ timeout: 60_000 });
    await page.getByRole("button", { name: "档案管理", exact: true }).click();
    await page.getByRole("button", { name: "导入档案", exact: true }).click();
    await page.getByLabel("导入格式").selectOption("application");
    await page.getByLabel("导入存档", { exact: true }).setInputFiles({
      name: "tutorial-fixture.json", mimeType: "application/json", buffer: Buffer.from(archive),
    });
    await expect(page).toHaveURL(/#\/battle/, { timeout: 60_000 });
    await ready(page);
    const before = await layout(page);
    await page.getByRole("button", { name: "操作指引", exact: true }).click();
    await step(page, "intent");
    expect(await layout(page)).toEqual(before);
    await expectClearGeometry(page);
    await page.screenshot({ path: info.outputPath("intent.png") });
    await page.getByRole("button", { name: "明白了", exact: true }).click();
    await step(page, "roll");
    await expectClearGeometry(page);
    await page.getByRole("button", { name: "ROLL", exact: true }).click();
    await ready(page);
    await step(page, "fix");
    await expectClearGeometry(page);
    await page.screenshot({ path: info.outputPath("fix.png") });
    await target(page).click();
    await ready(page);
    await step(page, "actor");
    await target(page).click();
    await step(page, "attack");

    await page.getByRole("button", { name: "远征账本", exact: true }).click();
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await step(page, "attack");
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await step(page, "attack");

    for (const [width, height] of [[1280, 720], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await expectClearGeometry(page);
      await page.screenshot({ path: info.outputPath(`target-${width}.png`) });
    }
    await target(page).click();
    await ready(page);
    await step(page, "end");
    await page.getByRole("button", { name: "撤回：上一步操作", exact: true }).click();
    await ready(page);
    await step(page, "actor");
    await page.getByRole("button", { name: "打开道具坞", exact: true }).click();
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
    await page.getByRole("button", { name: "返回行动", exact: true }).click();
    await step(page, "actor");
    await page.getByRole("button", { name: "关闭操作指引", exact: true }).click();
    await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
    await page.reload();
    await ready(page);
    await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
