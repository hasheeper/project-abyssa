import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import { observeArtifacts } from "./helpers";

let archives: Record<string, string>;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const outfile = resolve(projectRoot, "dist/reports/shop-foundation/browser-fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["src/game-application/testing/shop-foundation-fixture.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022"});
  const {playShopTutorial, shopFixture} = await import(pathToFileURL(outfile).href);
  const {checkpoints} = await playShopTutorial("tutorial", 14);
  archives = {};
  for (const id of ["firstGold", "bossLoot", "claimed", "event", "layer3Complete"]) {
    const f = shopFixture(checkpoints[id]);
    const result = await f.runtime.application.exportSave(f.saveId);
    if (!result.ok) throw Error(JSON.stringify(result));
    archives[id] = result.archive;
  }
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
    await expect(page.locator(".new-shop-stock__label")).toHaveText("物品");
  }
  if (await page.locator(".shop-loot__object").count()) await expect(page.locator(".shop-loot__object")).toHaveCSS("opacity", "1");
}
async function load(page: Page, id: string) {
  await page.goto("/");
  await page.getByRole("button", {name: "记录", exact: true}).click();
  await page.getByRole("button", {name: "档案管理", exact: true}).click();
  await page.getByRole("button", {name: "导入档案", exact: true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: `shop-${id}.json`, mimeType: "application/json", buffer: Buffer.from(archives[id])});
  await expect(page).toHaveURL(/#\/(menu|battle|mansion)/, {timeout: 30_000});
  await ready(page);
}

test("first layer banks its gold and really advances to the second layer", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await load(page, "firstGold");
  await page.getByRole("button", {name: "跳过本段对白"}).click();
  await ready(page);
  // One contextual gain stays visible; the ledger owns the detailed accounting.
  const gold = page.getByLabel("金币收获");
  await expect(gold).toBeVisible();
  await expect(gold).toHaveText("+4");
  await expect(gold).toHaveAccessibleDescription("本层入袋 4 G");
  await expect(page.getByLabel("当前第 1 层")).toBeVisible();
  expect((await saved(page)).snapshot.campaign.funds.party).toBe(0);
  await page.getByRole("button", {name: "收起操作指引", exact: true}).click();
  await page.getByRole("button", {name: "远征账本", exact: true}).click();
  await expect(page.getByLabel("收益倍率明细")).toContainText("本场拾取 2 G");
  await expect(page.getByLabel("收益倍率明细")).toContainText("第 1 层已结算，入袋 4 G");
  await page.getByRole("button", {name: "收起账本", exact: true}).click();
  await page.screenshot({path: info.outputPath("first-gold-1280.png")});
  await page.locator(".battle-companion__instrument").screenshot({path: info.outputPath("compact-gold.png")});
  await page.reload(); await ready(page);
  await expect(gold).toHaveText("+4");
  await page.getByRole("button", {name: "继续前进", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("当前第 2 层")).toBeVisible();
  await expect(gold).toHaveCount(0);
  const record = await saved(page);
  expect(record.snapshot.run?.kind === "expedition" && record.snapshot.run.state.run).toMatchObject({layer: 2, room: 0, bankedGold: 4});
  await page.screenshot({path: info.outputPath("layer2-1280.png")});
  expect(errors).toEqual([]);
});

test("second-layer event settles before entering the third layer", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await load(page, "event");
  await expect(page.getByLabel("当前第 2 层")).toBeVisible();
  const observation = page.locator('.abyssa-tutorial[data-observation="true"]');
  if (await observation.count()) await observation.locator(".abyssa-tutorial__next").click();
  const norma = page.locator('[data-tutorial-anchor="battle.member:norma"]');
  await norma.focus(); await norma.press("Enter");
  await page.getByRole("button", {name: "ROLL", exact: true}).press("Enter");
  await ready(page);
  await page.getByRole("button", {name: "确认结果", exact: true}).press("Enter");
  await ready(page);
  await page.getByRole("button", {name: "继续前进", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("当前第 3 层")).toBeVisible();
  const record = await saved(page);
  expect(record.snapshot.run?.kind === "expedition" && record.snapshot.run.state.run).toMatchObject({layer: 3, room: 0, bankedGold: 9, settledLayers: [1, 2]});
  await page.screenshot({path: info.outputPath("layer3-1280.png")});
  await page.reload(); await ready(page);
  await expect(page.getByLabel("当前第 3 层")).toBeVisible();
  expect(errors).toEqual([]);
});

test("third layer settles and the Boss begins on the fourth layer", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await load(page, "layer3Complete");
  await page.getByRole("button", {name: "跳过本段对白"}).click();
  await page.getByRole("button", {name: "守住出口", exact: true}).click();
  await ready(page);
  await expect(page.getByLabel("当前第 3 层")).toBeVisible();
  await expect(page.getByLabel("金币收获")).toHaveText("+20");
  await expect(page.getByLabel("金币收获")).toHaveAccessibleDescription("本层入袋 20 G");
  await page.getByRole("button", {name: "继续前进", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("当前第 4 层")).toBeVisible();
  const record = await saved(page);
  expect(record.snapshot.run?.kind === "expedition" && record.snapshot.run.state.run).toMatchObject({layer: 4, room: 0, bankedGold: 29, settledLayers: [1, 2, 3]});
  await page.screenshot({path: info.outputPath("layer4-1280.png")});
  await page.reload(); await ready(page);
  await expect(page.getByLabel("当前第 4 层")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Boss pickup, return claim, fixed appraisal, optional retention, sale and supply preparation", async ({page}, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({reducedMotion: "no-preference"});
  const errors = await observeArtifacts(page);
  await load(page, "bossLoot");
  await expect(page.getByRole("heading", {name: "结着盐壳的铜环"})).toBeVisible();
  await expect(page.getByLabel("骰子区域")).toHaveCount(0);
  await expect(page.getByLabel("远征读数")).toHaveCount(0);
  const pickup = await saved(page);
  expect(pickup.contentRef.contentVersion).toBe(14);
  expect(pickup.snapshot.run?.kind === "expedition" && pickup.snapshot.run.state.run.layer).toBe(4);
  expect(pickup.snapshot.campaign.loot).toEqual([]);
  await page.screenshot({path: info.outputPath("boss-pickup-1280.png")});
  await page.setViewportSize({width: 1600, height: 900});
  await page.screenshot({path: info.outputPath("boss-pickup-1600.png")});
  await page.setViewportSize({width: 1280, height: 720});
  await page.reload(); await ready(page);
  await expect(page.getByRole("heading", {name: "结着盐壳的铜环"})).toBeVisible();
  expect(await saved(page)).toEqual(pickup);
  await page.getByRole("button", {name: "收好，继续"}).press("Enter");
  await ready(page);
  expect(await saved(page)).toEqual(pickup);
  // Keep the existing S3-5/S4-1 chapter ending; the pickup adds no story transaction.
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", {name: "跳过本段对白"}).click();
    await ready(page);
  }
  await expect(page.getByLabel("本次带回物品")).toContainText("结着盐壳的铜环");
  await expect(page.getByLabel("本次结算")).toHaveText("+49 G");
  await expect(page.getByLabel("骰子区域")).toHaveCount(0);
  await expect(page.getByLabel("远征读数")).toHaveCount(0);
  await page.screenshot({path: info.outputPath("claim-1280.png")});
  await page.getByRole("button", {name: "领取并返回洋馆", exact: true}).dblclick();
  await expect(page).toHaveURL(/#\/mansion/); await ready(page);
  expect((await saved(page)).snapshot.campaign.loot).toHaveLength(1);
  expect((await saved(page)).snapshot.campaign.funds.party).toBe(49);
  await page.getByRole("button", {name: "日志", exact: true}).click();
  await expect(page.getByRole("dialog", {name: "日志"})).toContainText("待鉴定的收获");
  await page.screenshot({path: info.outputPath("appraisal-entry-1280.png")});
  await page.getByRole("link", {name: "去杂货铺鉴定"}).click();
  await expect(page).toHaveURL(/mode=appraise/); await ready(page);
  await expect(page.getByRole("tab", {name: "鉴定", exact: true})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("listbox", {name: "待鉴定与已鉴定物品"})).toBeVisible();
  await expect(page.getByRole("button", {name: "鉴定", exact: true})).toBeEnabled();
  await page.screenshot({path: info.outputPath("appraisal-list-1280.png")});
  await page.setViewportSize({width: 1600, height: 900});
  await page.screenshot({path: info.outputPath("appraisal-list-1600.png")});
  await page.setViewportSize({width: 1280, height: 720});
  await page.getByRole("option", {name: "结着盐壳的铜环"}).click(); await ready(page);
  await expect(page.getByRole("heading", {name: "结着盐壳的铜环"})).toBeVisible();
  await page.screenshot({path: info.outputPath("unidentified-1280.png")});
  await page.setViewportSize({width: 1600, height: 900});
  await page.screenshot({path: info.outputPath("unidentified-1600.png")});
  await page.setViewportSize({width: 1280, height: 720});
  await page.getByRole("button", {name: "鉴定", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("小队金币余额 47")).toBeVisible();
  await expect(page.getByRole("heading", {name: "旧船灯的平衡环"})).toBeVisible();
  await expect(page.locator(".new-shop__merchant button")).toHaveCount(0);
  await expect(page.locator(".new-shop-detail").getByRole("button", {name: "继续鉴定", exact: true})).toBeVisible();
  await expect(page.getByRole("navigation", {name: "商品翻页"})).toHaveCount(0);
  await page.screenshot({path: info.outputPath("appraisal-reading-1280.png")});
  for (let i = 0; i < 2; i++) {
    await expect(page.locator(".new-shop__speech")).toHaveAttribute("data-typing", "false");
    await page.getByRole("button", {name: /继续鉴定/}).click();
  }
  await expect(page.locator(".new-shop__merchant")).toContainText("盐壳不算重量");
  await expect(page.locator(".new-shop__speech")).toHaveAttribute("data-typing", "false");
  await expect(page.locator(".new-shop-detail .new-shop__action")).toHaveAccessibleName("收好");
  await page.screenshot({path: info.outputPath("appraised-1280.png")});
  await page.getByRole("button", {name: "收好", exact: true}).click();
  const kept = await saved(page);
  await page.reload(); await ready(page);
  await expect(page.getByRole("option", {name: "旧船灯的平衡环"})).toContainText("已鉴定");
  expect(await saved(page)).toEqual(kept);
  await page.getByRole("tab", {name: "出售", exact: true}).click();
  await expect(page.getByRole("listbox", {name: "可出售物品"})).toBeVisible();
  await page.screenshot({path: info.outputPath("sale-list-1280.png")});
  await page.getByRole("option", {name: /旧船灯的平衡环/}).click(); await ready(page);
  await expect(page.getByRole("listbox", {name: "可出售物品"})).toBeVisible();
  await expect(page.getByRole("option", {name: /旧船灯的平衡环/})).toHaveAttribute("aria-selected", "true");
  expect(await saved(page)).toEqual(kept);
  await page.getByRole("option", {name: /旧船灯的平衡环/}).press("Enter"); await ready(page);
  await page.getByRole("button", {name: "出售", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("小队金币余额 55")).toBeVisible();
  expect((await saved(page)).snapshot.campaign.loot).toEqual([]);
  await page.reload(); await ready(page);
  await page.getByRole("button", {name: "鉴定记录", exact: true}).click();
  await expect(page.getByRole("region", {name: "鉴定记录", exact: true})).toBeVisible();
  await page.screenshot({path: info.outputPath("appraisal-records-1280.png")});
  await page.getByRole("button", {name: /旧船灯的平衡环/}).click();
  await ready(page);
  await expect(page.locator(".new-shop__speech")).toHaveAttribute("data-typing", "false");
  await page.getByRole("button", {name: /继续鉴定/}).click();
  await expect(page.locator(".new-shop__merchant")).toContainText("你拿回来的只有架子");
  expect((await saved(page)).snapshot.campaign.funds.party).toBe(55);
  await page.screenshot({path: info.outputPath("sold-recall-1280.png")});
  await page.getByRole("tab", {name: "购买", exact: true}).click();
  await page.getByRole("option", {name: /圣水/}).click();
  await page.getByRole("button", {name: "购买", exact: true}).press("Enter");
  await ready(page);
  await expect(page.getByLabel("小队金币余额 52")).toBeVisible();
  await page.screenshot({path: info.outputPath("purchased-1280.png")});
  await page.getByRole("link", {name: "洋馆", exact: true}).click();
  await ready(page);
  await page.getByRole("button", {name: "整备", exact: true}).click();
  const preparation = page.getByRole("dialog", {name: "整备"});
  await preparation.getByRole("button", {name: "查看圣水详情", exact: true}).click();
  await preparation.getByRole("button", {name: "加入行囊", exact: true}).click();
  await expect(preparation.getByRole("button", {name: /行囊第 .* 格：圣水/})).toBeVisible();
  await page.screenshot({path: info.outputPath("prepared-1280.png")});
  expect(errors).toEqual([]);
});
