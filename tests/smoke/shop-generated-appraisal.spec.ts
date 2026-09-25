import {test, expect} from "@playwright/test";
import {build} from "esbuild";
import {dirname, resolve} from "node:path";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {projectRoot} from "../../config/paths.mjs";
import type {appraisalArchive} from "./fixtures/gm-appraisal";

let fixture: Awaited<ReturnType<typeof appraisalArchive>>;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const outfile = resolve(projectRoot, "dist/reports/gm-appraisal/fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["tests/smoke/fixtures/gm-appraisal.ts"], outfile, bundle: true, platform: "node", format: "esm", target: "es2022",
    plugins: [{name: "appraisal-raw", setup(b) {
      b.onResolve({filter: /\?raw$/}, a => ({path: resolve(dirname(a.importer), a.path.slice(0, -4)), namespace: "raw"}));
      b.onLoad({filter: /.*/, namespace: "raw"}, async a => ({contents: await readFile(a.path, "utf8"), loader: "text"}));
    }}]});
  fixture = await (await import(pathToFileURL(outfile).href)).appraisalArchive();
});
test.use({viewport: {width: 1280, height: 720}});

test("generated appraisal uses the shop's small dialogue, survives reload and sells the exact item", async ({page}, info) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  page.on("request", request => {if (/chat\/completions|\/responses(?:\?|$)/.test(request.url())) requests.push(request.url());});
  await page.goto("/");
  await page.getByRole("button", {name: "记录", exact: true}).click();
  await page.getByRole("button", {name: "档案管理", exact: true}).click();
  await page.getByRole("button", {name: "导入档案", exact: true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: "appraisal.json", mimeType: "application/json", buffer: Buffer.from(fixture.archive)});
  await expect(page).toHaveURL(/#\/menu/, {timeout: 30_000});
  await page.goto("/abyssa/#/shop?save=formal-airp&epoch=epoch%3A1&mode=appraise");
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 30_000});
  await expect(page.locator(".new-shop")).toHaveAttribute("data-shop-intro", "ready", {timeout: 15_000});
  await page.getByRole("option", {name: fixture.copy.unknownName, exact: true}).click();
  const dialogue = page.getByLabel("缇比的对话");
  await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.selectUnknown.text);
  await expect(page.getByRole("heading", {name: fixture.copy.name, exact: true})).toHaveCount(0);
  // These deliberately unclassifiable fixture names use the catalog's neutral fallback.
  const glyph = page.locator('.new-shop-detail [data-layer="glyph"]');
  await expect(glyph).toHaveCSS("mask-image", /swap-bag[^/]*\.svg/);
  const iconUrl = (await glyph.evaluate(el => getComputedStyle(el).maskImage)).match(/^url\("?([^"\)]+)"?\)$/)?.[1];
  expect(iconUrl).toBeTruthy();
  const iconResponse = await page.request.get(iconUrl!);
  expect(iconResponse.ok()).toBe(true);
  expect(await iconResponse.text()).toContain("<svg");
  await page.getByRole("button", {name: "鉴定", exact: true}).click();
  await expect(page.getByRole("heading", {name: fixture.copy.name, exact: true})).toBeVisible({timeout: 15_000});
  await expect(glyph).toHaveCSS("mask-image", /swap-bag[^/]*\.svg/);
  await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.appraisal[0].text);
  await expect(page.locator(".story-reading, .rp-adv")).toHaveCount(0);
  await page.screenshot({path: info.outputPath("generated-small-dialogue-1280.png")});
  await page.getByRole("button", {name: "继续鉴定", exact: true}).click();
  await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.appraisal[1].text);
  await page.getByRole("button", {name: "收好", exact: true}).click();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 30_000});
  await expect(page.locator(".new-shop")).toHaveAttribute("data-shop-intro", "ready", {timeout: 15_000});
  await page.getByRole("option", {name: fixture.copy.name, exact: true}).click(); await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.selectKnown.text);
  await page.getByRole("button", {name: "去出售", exact: true}).click();
  await page.getByRole("button", {name: "出售", exact: true}).click();
  await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.sold.text);
  await expect(page.getByRole("option", {name: fixture.copy.name, exact: true})).toHaveCount(0);
  await page.getByRole("tab", {name: "鉴定", exact: true}).click();
  await page.getByRole("button", {name: "鉴定记录", exact: true}).click();
  await page.getByRole("region", {name: "鉴定记录", exact: true}).getByRole("button", {name: fixture.copy.name, exact: true}).click();
  await dialogue.click();
  await expect(dialogue).toContainText(fixture.copy.appraisal[0].text);
  await expect(page.locator(".story-reading, .rp-adv")).toHaveCount(0);
  expect(requests).toEqual([]);
});
