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
  const outfile = resolve(projectRoot, "dist/reports/economy-b/browser-fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["src/game-application/testing/shop-foundation-fixture.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022"});
  const {shopFixture, playShopTutorial} = await import(pathToFileURL(outfile).href);
  const hub = shopFixture();
  await hub.runtime.application.createNewGame({saveId: hub.saveId, epoch: "copper", clientRequestId: "new", startAt: "hub"});
  const {checkpoints} = await playShopTutorial("tutorial", 17);
  archives = {};
  for (const [id, fixture] of Object.entries({hub, claim: shopFixture(checkpoints.claimable)})) {
    const result = await fixture.runtime.application.exportSave(fixture.saveId);
    if (!result.ok) throw Error(JSON.stringify(result));
    archives[id] = result.archive;
  }
});
test.use({viewport: {width: 1600, height: 900}});

async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 30_000});
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready");
  if (await page.locator(".new-shop").count()) await expect(page.locator(".new-shop")).toHaveAttribute("data-shop-intro", "ready");
}
async function load(page: Page, id: string) {
  await page.goto("/");
  await page.getByRole("button", {name: "记录", exact: true}).click();
  await page.getByRole("button", {name: "档案管理", exact: true}).click();
  await page.getByRole("button", {name: "导入档案", exact: true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: `copper-${id}.json`, mimeType: "application/json", buffer: Buffer.from(archives[id])});
  await expect(page).toHaveURL(/#\/(menu|battle)/, {timeout: 30_000});
  await ready(page);
}
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

test("copper shop uses its real quantities, quotes and once-only appraisal across reload", async ({page}, info) => {
  test.setTimeout(120_000);
  const errors = await observeArtifacts(page);
  await load(page, "hub");
  await page.getByRole("button", {name: "商店 · 前往守望者杂货铺", exact: true}).dblclick();
  await ready(page);
  await expect(page.getByLabel("小队资金余额 4,400 G")).toBeVisible();
  await expect(page.getByRole("option", {name: "护符"})).toContainText("400");
  await expect(page.getByRole("option", {name: "护符"}).getByLabel("持有 0，上限 2")).toBeVisible();
  await page.screenshot({path: info.outputPath("buy-1600.png")});
  await page.locator(".new-shop__balances").screenshot({path: info.outputPath("currency-icons.png")});
  const geometry = await page.evaluate(() => {
    const icons = [...document.querySelectorAll(".new-shop__balances .abyssa-currency-amount i")].map(node => {
      const r = node.getBoundingClientRect(); return {width: r.width, height: r.height};
    });
    const font = (selector: string) => getComputedStyle(document.querySelector(selector)!).fontSize;
    return {icons, owned: font(".new-shop-stock__owned"), price: font(".new-shop-stock__price"), nowrap: getComputedStyle(document.querySelector(".new-shop__balances .abyssa-currency-amount")!).whiteSpace};
  });
  await info.attach("currency-geometry", {body: JSON.stringify(geometry), contentType: "application/json"});
  expect(Math.abs(geometry.icons[0].width - geometry.icons[1].width)).toBeLessThan(.1);
  expect(geometry.owned).toBe(geometry.price);
  expect(geometry.nowrap).toBe("nowrap");
  await page.getByRole("button", {name: "购买", exact: true}).click(); await ready(page);
  await expect(page.getByLabel("小队资金余额 4,000 G")).toBeVisible();
  await page.getByRole("tab", {name: "出售", exact: true}).click();
  await expect(page.getByRole("option")).toHaveCount(4);
  await page.getByRole("option", {name: "旧十字币", exact: true}).click();
  await expect(page.getByLabel("持有 12 件")).toBeVisible();
  await expect(page.getByRole("option", {name: "旧十字币"})).toContainText("1,800");
  await expect(page.getByRole("region", {name: "物品详情"})).toContainText("1,802");
  await page.screenshot({path: info.outputPath("sale-1600.png")});
  await page.setViewportSize({width: 1280, height: 720});
  await page.screenshot({path: info.outputPath("sale-1280.png")});
  const price = page.getByRole("option", {name: "旧十字币"}).locator(".new-shop-stock__price");
  expect(await price.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole("button", {name: "出售", exact: true}).click(); await ready(page);
  await expect(page.getByLabel("小队资金余额 5,802 G")).toBeVisible();
  await expect(page.getByRole("option", {name: "烛火钱木牌"})).toHaveCount(0);
  await page.getByRole("option", {name: "干黑面包"}).click();
  await expect(page.getByRole("button", {name: "拒收", exact: true})).toBeDisabled();
  await page.getByRole("tab", {name: "鉴定", exact: true}).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByText("本次免费", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "鉴定", exact: true}).click(); await ready(page);
  await expect(page.getByRole("heading", {name: "黯秘银结界钉"})).toBeVisible();
  await expect(page.getByLabel("小队资金余额 5,802 G")).toBeVisible();
  for (let step = 0; step < 3; step++) {
    await expect(page.locator(".new-shop__speech")).toHaveAttribute("data-typing", "false");
    await page.getByRole("button", {name: step === 2 ? "收好" : "继续鉴定", exact: true}).click();
  }
  await page.screenshot({path: info.outputPath("appraised-1280.png")});
  const before = await saved(page);
  await page.reload(); await ready(page);
  expect(await saved(page)).toEqual(before);
  expect(before.snapshot.campaign.funds.party).toBe(5802);
  expect(before.snapshot.campaign.loot!.map(item => item.definitionId)).toEqual(["loot.tutorial.barrier-nail", "loot.tutorial.black-bread"]);
  expect(errors).toEqual([]);
});

test("tutorial return shows all four lots and settles exactly 4400 G", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await page.setViewportSize({width: 1280, height: 720});
  await load(page, "claim");
  await expect(page.getByLabel("本次结算")).toHaveText("+4,400 G");
  await expect(page.getByLabel("本次带回物品")).toHaveText(["旧十字币 ×12", "发黑的金属钉 ×1", "烛火钱木牌 ×1", "干黑面包 ×1"]);
  await expect(page.getByRole("button", {name: "领取并返回洋馆", exact: true})).toBeInViewport();
  await page.screenshot({path: info.outputPath("tutorial-return-1280.png")});
  await page.getByRole("button", {name: "领取并返回洋馆", exact: true}).click(); await ready(page);
  const record = await saved(page);
  expect(record.snapshot.campaign.funds.party).toBe(4400);
  expect(record.snapshot.campaign.loot).toHaveLength(4);
  await page.reload(); await ready(page);
  expect((await saved(page)).snapshot.campaign.funds.party).toBe(4400);
  expect(errors).toEqual([]);
});
