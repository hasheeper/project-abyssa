import { expect, test, type Page } from "@playwright/test";
import { build } from "./fixture-build";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { memoryJournalArchive } from "./fixtures/memory-journal";

let fixture: Awaited<ReturnType<typeof memoryJournalArchive>>;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const outfile = resolve(projectRoot, "dist/reports/memory-journal/fixture.mjs");
  await build({ absWorkingDir: projectRoot, entryPoints: ["tests/smoke/fixtures/memory-journal.ts"], outfile,
    bundle: true, platform: "node", format: "esm", target: "es2022",
    define: { "import.meta.env.DEV": "false", "import.meta.env.BASE_URL": '"/"' },
    loader: { ".jpg": "file", ".jpeg": "file", ".png": "file", ".webp": "file", ".svg": "file", ".css": "empty" } });
  fixture = await (await import(pathToFileURL(outfile).href)).memoryJournalArchive();
});
async function savedRecord(page: Page) {
  return page.evaluate(saveId => new Promise<string>((resolve, reject) => {
    const open = indexedDB.open("abyssa-game-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, read = db.transaction("saves", "readonly").objectStore("saves").get(saveId);
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(JSON.stringify(read.result)); };
    };
  }), fixture.saveId);
}

test("formal AIRP memory survives reload and replays without changing the save or calling a model", async ({ page }, info) => {
  test.setTimeout(90_000);
  const posts: string[] = [], errors: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "memory-journal.json", mimeType: "application/json", buffer: Buffer.from(fixture.archive) });
  // Restoring an active expedition correctly resumes its battle. The recorded
  // node is already settled; browsing must not advance the rest of this run.
  await expect(page).toHaveURL(/#\/battle\?/, { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 30_000 });
  await page.goto(`/index.html#/menu?save=${encodeURIComponent(fixture.saveId)}&epoch=${encodeURIComponent(fixture.epoch)}`);
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 30_000 });
  const before = await savedRecord(page);
  await page.getByRole("button", { name: "记忆", exact: true }).click();
  const entry = page.getByRole("button", { name: `阅读：${fixture.title}`, exact: true });
  await expect(entry).toBeVisible(); await entry.click();
  await expect(page.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
  await expect(page.locator(".memory-reader__summary")).toHaveText(fixture.summary!);
  await expect(page.getByRole("list", { name: "参与者" }).locator("li")).toHaveCount(4);
  await page.getByRole("button", { name: "展开原文", exact: true }).click();
  await expect(page.locator(".memory-reader")).toContainText(fixture.firstLine);
  await page.screenshot({ path: info.outputPath("airp-memory-detail.png") });
  await page.getByRole("button", { name: "回想场景", exact: true }).click();
  await expect(page.getByRole("region", { name: `场景回想：${fixture.title}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "结束回想", exact: true }).click();
  await expect(page.locator(".memory-replay")).toHaveCount(0);
  await page.getByRole("button", { name: "返回目录", exact: true }).click();
  await expect(entry).toBeVisible();
  expect(await savedRecord(page)).toBe(before);
  await page.reload();
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 30_000 });
  await page.getByRole("button", { name: "记忆", exact: true }).click();
  await expect(entry).toBeVisible();
  expect(await savedRecord(page)).toBe(before);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
});
