import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { projectRoot } from "../../config/paths.mjs";
import { ready } from "./playable-helpers";
import type { inspectManor } from "../../src/game-runtime/testing/manor-browser";
const probe = resolve(
  projectRoot,
  "dist/reports/demo-d3/implementation/manor-probe.js",
);
test.beforeAll(async () => {
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/game-runtime/testing/manor-browser.ts"],
    outfile: probe,
    bundle: true,
    format: "iife",
    globalName: "ManorProbe",
    platform: "browser",
    target: "es2022",
  });
});
for (const prefix of ["/", "/abyssa/"])
  test(`manor content keeps approved battle layout and saved dice under ${prefix}`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.goto(prefix);
    await page
      .getByRole("button", { name: "新的开始", exact: true })
      .dblclick();
    await expect(page).toHaveURL(/#\/menu/);
    await ready(page);
    const sortie = page.getByRole("button", { name: "出征 · 编队并进入副本", exact: true });
    await sortie.click();
    await expect(sortie).toHaveAttribute("aria-pressed", "true");
    await sortie.click();
    await expect(page).toHaveURL(/#\/map/, {timeout: 15_000});
    await ready(page);
    await expect(page.locator(".abyssa-map-loading")).toHaveCount(0);
    const canvas = page.locator(".abyssa-map-scene canvas"),
      bounds = (await canvas.boundingBox())!;
    await canvas.click({
      position: { x: bounds.width * 0.48, y: bounds.height * 0.495 },
    });
    await page.getByRole("button", { name: "出发", exact: true }).click();
    await expect(page).toHaveURL(/#\/battle/);
    await ready(page);
    await expect(
      page.getByRole("main", { name: "克雷格旧庄园战斗界面" }),
    ).toBeVisible();
    await expect(page.getByText("候席客", { exact: true })).toHaveCount(3);
    await expect(
      page.locator(".abyssa-expedition-party-card__skills"),
    ).toHaveCount(5);
    await expect(
      page.locator(".abyssa-expedition-party-nameplate"),
    ).toHaveCount(5);
    await expect(page.locator(".abyssa-expedition-undo")).toHaveCount(1);
    const frame = (await page
      .locator(".abyssa-expedition-frame")
      .boundingBox())!;
    expect(frame.y).toBeGreaterThan(0);
    expect(frame.y + frame.height).toBeLessThan(900);
    await page.getByRole("button", { name: "ROLL", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "END TURN", exact: true }),
    ).toBeEnabled();
    await page.locator(".expedition-die").first().click();
    await ready(page);
    await page.getByRole("button", { name: "REROLL", exact: true }).click();
    await expect(page.locator(".expedition-die").first()).not.toHaveAttribute(
      "data-rolling",
    );
    await expect(
      page.getByRole("button", { name: "END TURN", exact: true }),
    ).toBeEnabled();
    const inspect = async (): Promise<
      Awaited<ReturnType<typeof inspectManor>>
    > => {
      if (!(await page.evaluate(() => !!(window as any).ManorProbe)))
        await page.addScriptTag({ path: probe });
      return page.evaluate(() =>
        (window as any).ManorProbe.inspectManor(
          new URLSearchParams(location.hash.split("?")[1] ?? location.search).get("save"),
        ),
      );
    };
    const before = await inspect();
    expect(before.record.schemaVersion).toBe(4);
    expect(before.record.contentRef.contentVersion).toBe(3);
    await page.reload();
    await ready(page);
    expect((await inspect()).record.head).toEqual(before.record.head);
    await expect(page.locator(".expedition-die[data-rolling]")).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath("manor-original-layout.png"),
    });
  });
