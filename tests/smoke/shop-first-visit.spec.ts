import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import { decodeStoredRecord } from "../../src/game-application/save-codec";

let archives: Record<string, string>;
test.beforeAll(async () => {
  const outfile = resolve(projectRoot, "dist/reports/shop-first-visit/fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["tests/smoke/fixtures/shop-first-visit.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022",
    plugins: [{name: "raw-fixture-documents", setup(builder) {
      builder.onResolve({filter: /\?raw$/}, args => ({path: resolve(dirname(args.importer), args.path.slice(0, -4)), namespace: "fixture-raw"}));
      builder.onLoad({filter: /.*/, namespace: "fixture-raw"}, async args => ({contents: await readFile(args.path, "utf8"), loader: "text"}));
    }}]});
  archives = await (await import(pathToFileURL(outfile).href)).shopVisitArchives();
});
test.use({viewport: {width: 1280, height: 720}});
async function saved(page: Page): Promise<D5GameRecord> {
  const raw = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open("abyssa-game-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction("saves", "readonly").objectStore("saves").get("shop-tutorial");
      request.onsuccess = () => {resolve(request.result); db.close();};
      request.onerror = () => {reject(request.error); db.close();};
    };
  }));
  return decodeStoredRecord<D5GameRecord>(raw)!;
}
async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/);
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready");
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-phase", "idle");
  if (await page.locator(".new-shop").count()) await expect(page.locator(".new-shop")).toHaveAttribute("data-shop-intro", "ready");
}
async function load(page: Page, key: string) {
  await page.goto("/");
  await page.getByRole("button", {name: "记录", exact: true}).click();
  await page.getByRole("button", {name: "档案管理", exact: true}).click();
  await page.getByRole("button", {name: "导入档案", exact: true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: "shop-visit.json", mimeType: "application/json", buffer: Buffer.from(archives[key])});
  await expect(page).toHaveURL(/#\/menu/);
  await page.goto("/abyssa/#/shop?save=shop-tutorial&epoch=visit-browser");
  await ready(page);
}
async function next(page: Page) {
  await ready(page);
  const reading = page.locator(".story-reading");
  await expect(reading).toHaveAttribute("data-state", "idle", {timeout: 15_000});
  await page.locator(".rp-app__bar").getByRole("button", {name: /^(下一句|查看出售清单|看看补给|返回枢纽)$/}).click();
}

test("silent narration stays dim through saved advances, while Tibby's speech remains highlighted", async ({page}, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await load(page, "blanket");
  await page.evaluate(() => {
    const actor = document.querySelector('.rp-adv__actor[data-character="tibby"]');
    const probe = {running:true,samples:[] as {frame:string; active:string|null; stable:boolean}[]};
    Object.assign(window,{shopLightingProbe:probe});
    const sample = () => {
      if (!probe.running) return;
      const current = document.querySelector('.rp-adv__actor[data-character="tibby"]');
      probe.samples.push({frame:document.querySelector<HTMLElement>(".story-reading")?.dataset.frameId??"",active:current?.getAttribute("data-active")??null,stable:current===actor});
      requestAnimationFrame(sample);
    }; sample();
  });
  const actor = page.locator('.rp-adv__actor[data-character="tibby"]');
  for (let step=11; step<=15; step++) {
    await next(page);
    await expect(page.locator(".story-reading")).toHaveAttribute("data-frame-id",`shop.visit.arrival.${step}`);
    await expect(actor).toHaveAttribute("data-active",[11,13,15].includes(step)?"true":"false");
    if (step===14) {
      await expect(page.locator(".story-reading")).toHaveAttribute("data-state","idle");
      await expect.poll(() => actor.evaluate(node => getComputedStyle(node).opacity)).toBe("0.92");
      await page.screenshot({path:info.outputPath("narration-dim-1280.png")});
    }
  }
  await expect(page.locator(".story-reading")).toHaveAttribute("data-state","idle");
  await expect.poll(() => actor.evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  const samples = await page.evaluate(() => {
    const probe=(window as unknown as {shopLightingProbe:{running:boolean;samples:{frame:string;active:string|null;stable:boolean}[]}}).shopLightingProbe;
    probe.running=false; return probe.samples;
  });
  expect(samples.length).toBeGreaterThan(20);
  expect(samples.filter(sample => !sample.stable || sample.active !== ([11,13,15].includes(Number(sample.frame.split(".").at(-1)))?"true":"false"))).toEqual([]);
  await page.screenshot({path:info.outputPath("speech-highlighted-1280.png")});
});

test("preserves first-act dialogue and resumes the exact Chinese frame after reload", async ({page}, info) => {
  await load(page, "blanket");
  const reading = page.locator(".story-reading");
  await expect(reading).toHaveAttribute("data-frame-id", "shop.visit.arrival.10");
  await expect(reading).toHaveAttribute("data-state", "idle");
  await expect(reading).toContainText("毯子拿回去了。");
  await expect(reading).not.toContainText(/[\u3040-\u30ff]/);
  await page.screenshot({path: info.outputPath("blanket-1280.png")});
  await next(page); await page.reload(); await ready(page);
  await expect(reading).toHaveAttribute("data-frame-id", "shop.visit.arrival.11");
  await expect(reading).toHaveAttribute("data-state", "idle");
  await page.screenshot({path: info.outputPath("long-line-1280.png")});
});

test("appraisal uses the real free quote and hands back to AVG once", async ({page}, info) => {
  await load(page, "appraisal");
  const before = await saved(page);
  await expect(page.getByRole("heading", {name: "锈蚀黑钉"})).toBeVisible();
  await expect(page.locator(".new-shop-detail del")).toHaveText("300 G");
  await expect(page.locator(".new-shop-detail__total")).toContainText("落货查验");
  await page.screenshot({path: info.outputPath("free-appraisal-1280.png")});
  await page.getByRole("button", {name: "鉴定", exact: true}).click();
  await ready(page);
  await expect(page.locator(".story-reading")).toHaveAttribute("data-frame-id", "shop.visit.valuation.0");
  expect((await saved(page)).snapshot.campaign.funds.party).toBe(before.snapshot.campaign.funds.party);
  await page.reload(); await ready(page);
  expect((await saved(page)).snapshot.campaign.lootTrades?.filter(trade => trade.kind === "appraise")).toHaveLength(1);
});

for (const choice of ["A", "B"] as const) test(`branch ${choice} sells the selected basket, buys optionally, and leaves through AVG`, async ({page}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await load(page, "choice");
  const before = await saved(page), base = before.snapshot.campaign.funds.party;
  await expect(page.locator(".story-reading")).toHaveAttribute("data-state", "idle");
  await page.getByRole("button", {name: new RegExp(choice === "A" ? "留在店里" : "带回去")}).click();
  for (let step = 0; step < (choice === "A" ? 2 : 3); step++) {await expect.poll(async () => (await saved(page)).snapshot.campaign.shopVisit?.step).toBe(step); await next(page);}
  await ready(page);
  const basket = page.getByRole("region", {name: "确认出售清单"});
  await expect(basket.getByRole("listitem")).toHaveCount(choice === "A" ? 3 : 2);
  await expect(basket).toContainText("旧十字币 ×11");
  const confirm = basket.getByRole("button", {name: "确认卖出", exact: true});
  await expect(confirm).toBeInViewport({ratio: 1});
  const frameBounds = await page.locator(".new-shop-detail-frame").boundingBox();
  const confirmBounds = await confirm.boundingBox();
  expect(confirmBounds!.y + confirmBounds!.height).toBeLessThanOrEqual(frameBounds!.y + frameBounds!.height);
  await expect(basket.locator(".shop-visit-sale__total")).toBeInViewport({ratio: 1});
  await page.screenshot({path: info.outputPath(`basket-${choice}-1280.png`)});
  await page.reload(); await ready(page);
  await page.getByRole("button", {name: "确认卖出", exact: true}).click();
  await expect.poll(async () => (await saved(page)).snapshot.campaign.funds.party).toBe(base + (choice === "A" ? 2202 : 1802));
  for (let step = 0; step < 5; step++) {await expect.poll(async () => (await saved(page)).snapshot.campaign.shopVisit?.step).toBe(step); await next(page);}
  await ready(page);
  await expect(page.getByRole("option")).toHaveCount(5);
  if (choice === "B") {
    await page.getByRole("option", {name: "护符", exact: true}).click();
    await page.getByRole("button", {name: "购买", exact: true}).click();
    await expect.poll(async () => (await saved(page)).snapshot.campaign.funds.party).toBe(base + 1802 - 400);
  }
  await page.screenshot({path: info.outputPath(`supplies-${choice}-1280.png`)});
  await page.getByRole("button", {name: "结束购买", exact: true}).click();
  for (let step = 0; step < 8; step++) {await expect.poll(async () => (await saved(page)).snapshot.campaign.shopVisit?.step).toBe(step); await next(page);}
  await expect(page).toHaveURL(/#\/mansion/);
  const after = (await saved(page)).snapshot.campaign;
  expect(after.shopVisit?.status).toBe("completed");
  expect(after.loot?.some(item => item.definitionId.endsWith("barrier-nail"))).toBe(choice === "B");
  expect(errors).toEqual([]);
});
