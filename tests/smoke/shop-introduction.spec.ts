import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import { observeArtifacts } from "./helpers";

let archive: string;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const outfile = resolve(projectRoot, "dist/reports/shop-introduction/browser-fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["src/game-application/testing/shop-foundation-fixture.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022"});
  const {playShopTutorial} = await import(pathToFileURL(outfile).href);
  const {f} = await playShopTutorial("tutorial", 16);
  const exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  archive = exported.archive;
});
test.use({viewport: {width: 1280, height: 720}});

async function saved(page: Page): Promise<D5GameRecord> {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const id = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    const open = indexedDB.open("abyssa-game-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, read = db.transaction("saves", "readonly").objectStore("saves").get(id);
      read.onsuccess = () => {resolve(read.result); db.close();};
      read.onerror = () => {reject(read.error); db.close();};
    };
  }));
}
async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 30_000});
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready");
  if (await page.locator(".scene-sequence").count()) await expect(page.locator(".scene-sequence")).toHaveAttribute("data-phase", "idle");
  if (await page.locator(".new-shop").count()) {
    await expect(page.locator(".new-shop")).toHaveAttribute("data-shop-intro", "ready");
    await expect(page.locator(".new-shop__ledger")).toHaveCSS("width", "744px");
    await expect(page.locator(".new-shop__counter-plane")).toHaveCSS("position", "absolute");
  }
}
async function load(page: Page) {
  page.setDefaultTimeout(15_000);
  await page.goto("/");
  await page.getByRole("button", {name: "记录", exact: true}).click();
  await page.getByRole("button", {name: "档案管理", exact: true}).click();
  await page.getByRole("button", {name: "导入档案", exact: true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: "shop-first-visit.json", mimeType: "application/json", buffer: Buffer.from(archive)});
  await expect(page).toHaveURL(/#\/menu/, {timeout: 30_000}); await ready(page);
}

test("first SHOP entry plays AVG, resumes after leaving, and finishes at the requested counter mode", async ({page}, info) => {
  test.setTimeout(120_000);
  const errors = await observeArtifacts(page);
  await page.emulateMedia({reducedMotion: "no-preference"});
  await load(page);
  const original = await saved(page);
  await page.getByRole("button", {name: "商店 · 前往守望者杂货铺", exact: true}).dblclick();
  await expect(page).toHaveURL(/#\/shop/);
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-phase", "arrival", {timeout: 30_000});
  await expect(page.locator(".scene-sequence__arrival .scene-arrival")).toHaveCSS("opacity", "1");
  await page.screenshot({path: info.outputPath("arrival-1280.png")});
  await ready(page);
  const reading = page.getByRole("main", {name: "柜台后的招呼"});
  await expect(reading).toHaveAttribute("data-frame-id", "shop.first-visit.0");
  await expect(page.getByRole("tab", {name: "购买", exact: true})).toHaveCount(0);
  await expect(page.locator(".abyssa-stage__canvas")).toHaveCount(1);
  await expect(page.locator('.rp-adv__actor[data-character="tibby"]')).toHaveAttribute("data-expression", "b");
  await expect(reading).toHaveAttribute("data-state", "idle");
  await page.screenshot({path: info.outputPath("greeting-1280.png")});
  await page.getByRole("button", {name: "下一句", exact: true}).click();
  await expect(reading).toHaveAttribute("data-frame-id", "shop.first-visit.1");
  await expect(page.locator('.rp-adv__actor[data-character="tibby"]')).toHaveAttribute("data-expression", "i");
  await ready(page);
  expect((await saved(page)).snapshot.campaign.shopIntroduction).toEqual({step: 1, status: "pending"});
  await page.reload(); await ready(page);
  await expect(reading).toHaveAttribute("data-frame-id", "shop.first-visit.1");
  await expect(page.locator(".scene-sequence__arrival")).toHaveCount(0);
  await page.getByRole("button", {name: "返回洋馆", exact: true}).click();
  await expect(page).toHaveURL(/#\/mansion/); await ready(page);
  const query = new URLSearchParams({save: original.head.saveId, epoch: original.head.epoch, mode: "appraise"});
  await page.goto(`/abyssa/#/shop?${query}`); await ready(page);
  await expect(reading).toHaveAttribute("data-frame-id", "shop.first-visit.1");
  for (let step = 1; step <= 3; step++) {
    await expect(reading).toHaveAttribute("data-frame-id", `shop.first-visit.${step}`);
    await expect(reading).toHaveAttribute("data-state", "idle");
    if (step === 2) {
      await page.setViewportSize({width: 1600, height: 900});
      await page.screenshot({path: info.outputPath("trade-introduction-1600.png")});
    }
    if (step === 3) {
      await page.setViewportSize({width: 1280, height: 720});
      await page.screenshot({path: info.outputPath("appraisal-introduction-1280.png")});
    }
    await page.getByRole("button", {name: step === 3 ? "看看柜台" : "下一句", exact: true}).click();
  }
  await ready(page);
  await expect(page.getByRole("tab", {name: "鉴定", exact: true})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("持有 1 件", {exact: true})).toBeVisible();
  await expect(page.locator(".abyssa-stage__canvas")).toHaveCount(1);
  await expect(page.locator(".new-shop")).toHaveAttribute("data-entry-profile", "handoff");
  const after = await saved(page);
  expect(after.snapshot.campaign.shopIntroduction).toEqual({step: 3, status: "viewed"});
  expect(after.snapshot.campaign.funds).toEqual(original.snapshot.campaign.funds);
  expect(after.snapshot.campaign.loot).toEqual(original.snapshot.campaign.loot);
  await page.screenshot({path: info.outputPath("counter-handoff-1280.png")});
  await page.reload(); await ready(page);
  await expect(reading).toHaveCount(0);
  await expect(page.locator(".new-shop")).toHaveAttribute("data-entry-profile", "standard");
  expect(await saved(page)).toEqual(after);
  expect(errors).toEqual([]);
});

test("skipping the first visit is durable and returning to the menu preserves dialogue geometry", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await load(page);
  const dialogueStyle = () => page.locator(".menu-dial__dialogue").evaluate(node => {
    const style = getComputedStyle(node), copy = getComputedStyle(node.querySelector(".abyssa-dialogue__content")!);
    return {height: style.height, minHeight: style.minHeight, width: style.width, padding: copy.padding};
  });
  const before = await dialogueStyle();
  await expect(page.locator(".menu-dial__dialogue")).toHaveCSS("min-height", "158px");
  await page.locator(".menu-dial__dialogue").screenshot({path: info.outputPath("menu-dialogue-before.png")});
  await page.getByRole("button", {name: "商店 · 前往守望者杂货铺", exact: true}).dblclick(); await ready(page);
  await page.getByRole("button", {name: "跳过本段对白", exact: true}).click(); await ready(page);
  await expect(page.getByRole("tab", {name: "购买", exact: true})).toBeVisible();
  await expect(page.locator(".new-shop")).toHaveAttribute("data-entry-profile", "handoff");
  const after = await saved(page);
  expect(after.snapshot.campaign.shopIntroduction).toEqual({step: 3, status: "skipped"});
  // Keep the same document alive: a reload would hide lazy route CSS leaks.
  await page.getByRole("link", {name: "返回菜单", exact: true}).click();
  await expect(page).toHaveURL(/#\/menu/); await ready(page);
  const returned = await dialogueStyle();
  await info.attach("menu-dialogue-geometry", {body: JSON.stringify({before, returned}, null, 2), contentType: "application/json"});
  expect(returned).toEqual(before);
  await page.locator(".menu-dial__dialogue").screenshot({path: info.outputPath("menu-dialogue-after.png")});
  await page.getByRole("button", {name: "商店 · 前往守望者杂货铺", exact: true}).dblclick(); await ready(page);
  await page.reload(); await ready(page);
  await expect(page.getByRole("main", {name: "柜台后的招呼"})).toHaveCount(0);
  await expect(page.locator(".new-shop")).toHaveAttribute("data-entry-profile", "standard");
  expect(await saved(page)).toEqual(after);
  expect(errors).toEqual([]);
});
