import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "./fixture-build";
import { projectRoot } from "../../config/paths.mjs";
import type { homeSettlementArchive } from "./fixtures/airp-home-settlement";
import { decodeStoredRecord } from "../../src/game-application/save-codec";
import type { D5GameRecord } from "../../src/game-application";

let fixture: Awaited<ReturnType<typeof homeSettlementArchive>>;
test.beforeAll(async () => {
  test.setTimeout(120000);
  const outfile = resolve(projectRoot, "dist/reports/airp-home/fixture.mjs");
  await build({ absWorkingDir: projectRoot, entryPoints: ["tests/smoke/fixtures/airp-home-settlement.ts"], outfile,
    bundle: true, platform: "node", format: "esm", target: "es2022",
    define: { "import.meta.env.DEV": "false", "import.meta.env.BASE_URL": '"/"' },
    loader: { ".jpg": "file", ".jpeg": "file", ".png": "file", ".webp": "file", ".svg": "file", ".css": "empty" } });
  fixture = await (await import(pathToFileURL(outfile).href)).homeSettlementArchive();
});
async function currentRecord(page: Page) {
  const stored = await page.evaluate(saveId => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("abyssa-game-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, read = db.transaction("saves", "readonly").objectStore("saves").get(saveId);
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }), fixture.saveId);
  const record = decodeStoredRecord<D5GameRecord>(stored);
  if (!record) throw Error("Synthetic save not found");
  return record;
}
async function importHomeArchive(page: Page, archive: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "home.json", mimeType: "application/json", buffer: Buffer.from(archive) });
  await expect(page).toHaveURL(/#\/(menu|mansion)\?/, { timeout: 30000 });
  await page.goto(`/index.html#/mansion?save=${encodeURIComponent(fixture.saveId)}&epoch=${encodeURIComponent(fixture.epoch)}`);
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready", { timeout: 30000 });
}
test("stalled home settlement collapses, survives navigation, cancels and recovers with facts only", async ({ page }, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [], posts: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  await importHomeArchive(page, fixture.archive);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const before = await currentRecord(page), cue = () => page.getByRole("button", { name: new RegExp(fixture.title + ".*查看进度") });
  await page.getByRole("button", { name: "收起", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".mansion-scene-resident")).toHaveAttribute("data-suspended", "false");
  expect(await currentRecord(page)).toEqual(before);
  await cue().click();
  await page.getByRole("button", { name: "连接设置", exact: true }).click();
  await page.getByRole("tab", { name: "Model", exact: true }).click();
  await page.getByLabel("导入测试配置").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
    version: 1, connection: { baseUrl: "https://settlement.invalid/v1", apiKey: "fake-settlement-key" },
    models: { planning: { model: "fixture" }, writing: { model: "fixture" }, updater: { model: "fixture", timeoutMs: 300000 } },
  })) });
  await expect(page.getByLabel("公共 API Key", { exact: true })).toHaveValue("fake-settlement-key");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  let release!: () => void;
  const stalled = new Promise<void>(resolve => { release = resolve; });
  await page.route("https://settlement.invalid/v1/chat/completions", async route => { await stalled; await route.abort().catch(() => {}); });
  try {
    await page.getByRole("button", { name: "结算并查看结果", exact: true }).click();
    await expect.poll(() => posts.length).toBe(1);
    await page.getByRole("button", { name: "收起", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "展开菜单", exact: true }).click();
    await page.getByRole("link", { name: "返回菜单", exact: true }).click();
    await expect(page).toHaveURL(/#\/menu\?/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await cue().click();
    // The current page hosts the same background driver; reopening stays here.
    await expect(page).toHaveURL(/#\/menu\?/);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("button", { name: "停止请求", exact: true }).click();
    const fallback = page.getByRole("button", { name: "仅记程序事实并继续（不评估关系与叙事状态）", exact: true });
    await expect(fallback).toBeEnabled();
    const cancelled = await currentRecord(page);
    expect(cancelled.airpGame!.settlement.jobs[0].attempts[0]).toMatchObject({ error: "cancelled", outcomeUnknown: true });
    expect(cancelled.airpGame!.settlement.memories).toEqual([]);
    await page.screenshot({ path: info.outputPath("cancelled-home-settlement.png") });
    await fallback.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await currentRecord(page)).airpGame!.settlement.jobs[0]).toMatchObject({ status: "applied", mode: "program-only" });
    await page.getByRole("button", { name: "府邸 · 回到守望者之崖洋馆", exact: true }).click();
    await expect(page.getByText("洋馆 · 阶段反馈", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(posts).toEqual(["https://settlement.invalid/v1/chat/completions"]);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test("saved running settlement recovers after reload without issuing another model request", async ({ page }, info) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  const posts: string[] = [], errors: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await importHomeArchive(page, fixture.interruptedArchive);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "标记中断后重试", exact: true }).click();
  const fallback = page.getByRole("button", { name: "仅记程序事实并继续（不评估关系与叙事状态）", exact: true });
  await expect(fallback).toBeEnabled();
  const interrupted = await currentRecord(page);
  expect(interrupted.airpGame!.settlement.jobs[0].attempts[0]).toMatchObject({ error: "interrupted", outcomeUnknown: true });
  await fallback.click();
  await expect(page.getByText("洋馆 · 阶段反馈", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect((await currentRecord(page)).airpGame!.settlement.jobs[0]).toMatchObject({ status: "applied", mode: "program-only" });
  await page.screenshot({ path: info.outputPath("recovered-interrupted-settlement.png") });
  expect(posts).toEqual([]); expect(errors).toEqual([]);
});
