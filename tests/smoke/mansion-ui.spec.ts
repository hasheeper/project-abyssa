import { expect, test, type Locator, type Page } from "@playwright/test";
import { confirmNewGame } from "./new-game-helpers";

async function savedRecord(page: Page) {
  const saveId = new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("save");
  return page.evaluate(id => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open("abyssa-game-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, read = db.transaction("saves", "readonly").objectStore("saves").get(id!);
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(JSON.stringify(read.result)); };
    };
  }), saveId);
}
async function fitsViewport(page: Page, panel: Locator) {
  const rect = (await panel.boundingBox())!, size = page.viewportSize()!;
  expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.y).toBeGreaterThanOrEqual(-1);
  expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1);
}

test("current mansion room tabs and warehouse, journal, preparation stay usable without changing the save", async ({ page }, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(20000);
  const posts: string[] = [], errors: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "新的开始", exact: true }).click();
  await confirmNewGame(page, "自由行动");
  await expect(page).toHaveURL(/#\/menu\?/);
  const query = new URL(page.url()).hash.split("?")[1];
  await page.goto(`/index.html#/mansion?${query}`);
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready", { timeout: 30000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 15000 });
  await page.getByRole("button", { name: "查看厨房", exact: true }).click();
  const room = page.getByRole("dialog", { name: "厨房", exact: true });
  await expect(room.getByRole("tab")).toHaveCount(3);
  await room.getByRole("tab", { name: "概况", exact: true }).click();
  await expect(room.getByRole("heading", { name: "房间职能", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(room.getByRole("tab", { selected: true })).toHaveText("运作");
  await page.keyboard.press("ArrowRight");
  await expect(room.getByRole("tab", { selected: true })).toHaveText("工程");
  await expect(room.getByRole("heading", { name: "公款", exact: true })).toBeVisible();
  await fitsViewport(page, room);
  await page.screenshot({ path: info.outputPath("mansion-room-works.png") });
  await room.getByRole("button", { name: "关闭房间详情", exact: true }).click();
  await expect(room).toHaveCount(0);
  const before = await savedRecord(page);

  await page.getByRole("button", { name: "仓库", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "领地库存", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^查看食物详情/ }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("region", { name: "药水详情", exact: true })).toBeVisible();
  await fitsViewport(page, page.locator(".resource-inventory-panel"));
  await page.screenshot({ path: info.outputPath("mansion-warehouse.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "日志", exact: true }).click();
  const journal = page.getByRole("dialog", { name: "日志", exact: true });
  await expect(journal.getByRole("tablist", { name: "日志分组", exact: true })).toBeVisible();
  await journal.getByRole("button", { name: "查看记录：今日安排", exact: true }).click();
  await expect(journal.locator(".journal-dock").getByRole("button", { name: "查看今日安排", exact: true })).toBeVisible();
  await fitsViewport(page, journal);
  await page.screenshot({ path: info.outputPath("mansion-journal.png") });
  await journal.getByRole("tab", { name: /^尚未开放/ }).click();
  const locked = journal.getByRole("navigation", { name: "日志条目", exact: true }).getByRole("button").first();
  await locked.click();
  const selectedName = await journal.getByRole("article").getAttribute("aria-label");
  await expect(journal.getByRole("heading", { name: "开放条件", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "日志", exact: true }).click();
  await expect(journal.getByRole("article")).toHaveAttribute("aria-label", selectedName!);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "整备", exact: true }).click();
  const preparation = page.getByRole("dialog", { name: "整备", exact: true });
  await preparation.getByRole("button", { name: "查看食物详情", exact: true }).click();
  await preparation.getByRole("button", { name: /^(加入行囊|移出行囊)$/ }).click();
  await expect(preparation.locator(".journal-dock").getByRole("link", { name: "出征编队", exact: true })).toBeVisible();
  await fitsViewport(page, preparation);
  await page.screenshot({ path: info.outputPath("mansion-preparation.png") });
  await page.setViewportSize({ width: 1200, height: 675 });
  await expect.poll(async () => (await preparation.boundingBox())!.width).toBeLessThan(1200);
  await fitsViewport(page, preparation);
  await page.screenshot({ path: info.outputPath("mansion-preparation-scaled.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await savedRecord(page)).toBe(before);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
});
