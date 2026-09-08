import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { projectRoot } from "../../config/paths.mjs";
import {
  buildProbe,
  startLegacy,
  depart,
  openSortie,
  inspectPage,
  ready,
} from "./playable-helpers";
import { observeArtifacts } from "./helpers";
import type { DemoGameRecord } from "../../src/game-application";
import type { CharacterArchiveView } from "../../src/game-runtime/character-views";
type HarnessState = { record: DemoGameRecord; view: CharacterArchiveView };

const directory = resolve(
  projectRoot,
  "dist/reports/demo-d2/implementation/harness",
);
const bundle = resolve(directory, "harness.js");
test.use({ trace: "on" });
test.beforeAll(async () => {
  await buildProbe();
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/apps/character-status/testing/browser-harness.tsx"],
    outfile: bundle,
    bundle: true,
    format: "iife",
    globalName: "AbyssaArchiveTest",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    publicPath: "/d2-harness/",
    assetNames: "assets/[name]-[hash]",
    loader: { ".png": "file", ".webp": "file", ".jpg": "file", ".svg": "file" },
  });
});
async function fixture(page: Page, level: 1 | 2 | 3) {
  const manifest = JSON.parse(await readFile(resolve(projectRoot,"dist/game/.vite/manifest.json"),"utf8"));
  const styles = new Set<string>();
  function collect(key: string) {
    for (const dependency of manifest[key].imports ?? []) collect(dependency);
    for (const css of manifest[key].css ?? []) styles.add(css);
  }
  collect("index.html"); collect("src/apps/character-status/route.tsx");
  const html = `<!doctype html><html class="abyssa-stage-root" data-game-page="character-status"><head>${[...styles].map(path=>`<link rel="stylesheet" href="/${path}">`).join("")}</head><body><div id="root"></div></body></html>`;
  await page.route("**/d2-test.html*", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.route("**/d2-harness/**", (route) =>
    route.fulfill({
      path: resolve(
        directory,
        new URL(route.request().url()).pathname.slice("/d2-harness/".length),
      ),
    }),
  );
  await page.goto("/d2-test.html");
  await page.addScriptTag({ path: bundle });
  const result: HarnessState = await page.evaluate(
    (level) => (window as any).AbyssaArchiveTest.mount(level),
    level,
  );
  await ready(page);
  return result;
}
async function inspectFixture(page: Page): Promise<HarnessState> {
  return page.evaluate(() => (window as any).AbyssaArchiveTest.inspect());
}

test("character page uses the real archive and returns to menu/map/battle without a commit", async ({
  page,
  context,
}, info) => {
  test.setTimeout(150_000);
  const failures = await observeArtifacts(page);
  await startLegacy(page);
  const original = (await inspectPage(page)).record;
  await page.getByRole("button", { name: "角色", exact: true }).click();
  await page.getByRole("button", { name: "角色", exact: true }).click();
  await expect(page).toHaveURL(/#\/character-status\?save=/);
  await ready(page);
  await expect(page.getByText("静谧之楔")).toBeVisible();
  await page.getByRole("button", { name: /尤斯缇丝/ }).click();
  await expect(page.locator(".abyssa-status-panel__bond-node")).toHaveCount(5);
  await expect(
    page.locator(".abyssa-status-panel__pact-stage-inset"),
  ).toHaveCount(3);
  await page.screenshot({
    path: info.outputPath("legacy-relationship-restored.png"),
  });
  await page.getByRole("tab", { name: "骰装" }).click();
  await expect(page.locator(".abyssa-dice__column")).toHaveCount(6);
  await page.screenshot({ path: info.outputPath("legacy-eustice-dice.png") });
  await page.reload();
  await ready(page);
  expect((await inspectPage(page)).record).toEqual(original);
  await page.getByRole("link", { name: "返回菜单" }).click();
  await ready(page);
  await openSortie(page);
  await ready(page);
  await expect(page.locator(".abyssa-map-loading")).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "查看出战队伍并编队" }).click();
  await page.locator('.abyssa-sortie-poster[data-member="eustice"]').hover();
  await page.getByRole("link", { name: /查看.*档案/ }).click();
  await ready(page);
  await expect(page).toHaveURL(/character=eustice/);
  await page.getByRole("link", { name: "返回地图" }).click();
  await ready(page);
  await page.getByRole("link", { name: "返回菜单", exact: true }).click();
  await ready(page);
  await depart(page, 3);
  const battleUrl = page.url(),
    battle = (await inspectPage(page)).record;
  await page.getByRole("link", { name: /查看尤斯缇丝.*档案/ }).click();
  await ready(page);
  await expect(page.getByText("本趟成员", { exact: true })).toBeVisible();
  const pendingKey = `abyssa:pending:v1:${battle.head.saveId}:${battle.head.epoch}`;
  const pending = JSON.stringify({
    protocolVersion: 1,
    saveId: battle.head.saveId,
    expectedHead: battle.head,
    clientRequestId: "d2-pending-roll",
    command: {
      type: "battle-command",
      expeditionId: battle.snapshot.expedition!.id,
      command: { type: "roll-dice" },
    },
  });
  await page.evaluate(
    ({ pendingKey, pending }) => sessionStorage.setItem(pendingKey, pending),
    { pendingKey, pending },
  );
  await page.reload();
  await ready(page);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), pendingKey),
  ).toBe(pending);
  expect((await inspectPage(page)).record).toEqual(battle);
  await page.evaluate((key) => sessionStorage.removeItem(key), pendingKey);
  await page.getByRole("tab", { name: "记事" }).click();
  await expect(page.getByText("踏上远征", { exact: true })).toHaveCount(0);
  await expect(page.getByText("尚无重要记事。", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("legacy-history.png") });
  expect((await inspectPage(page)).record).toEqual(battle);
  // Real execution in a second tab invalidates the reader without a second commit.
  const writer = await context.newPage();
  await writer.goto(battleUrl);
  await ready(writer);
  await writer.getByRole("button", { name: "ROLL", exact: true }).click();
  await ready(writer);
  const committed = (await inspectPage(writer)).record;
  await page.bringToFront();
  await expect(page.locator(".game-client-status")).toHaveAttribute(
    "data-revision",
    String(committed.head.revision),
  );
  expect((await inspectPage(page)).record).toEqual(committed);
  await page.getByRole("link", { name: "返回战斗" }).click();
  await ready(page);
  expect((await inspectPage(page)).record).toEqual(committed);
  await writer.close();
  expect(failures).toEqual([]);
});

for (const level of [1, 2, 3] as const)
  test(`rules2 Lv.${level}: six characters, 36 faces and read-only slots`, async ({
    page,
  }, info) => {
    const { record, view } = await fixture(page, level);
    await page.getByRole("button", { name: /尤斯缇丝/ }).click();
    await expect(page.locator(".abyssa-status-panel__bond-node")).toHaveCount(
      5,
    );
    await expect(
      page.locator(".abyssa-status-panel__pact-stage-inset"),
    ).toHaveCount(3);
    await page.screenshot({
      path: info.outputPath(`level-${level}-summary.png`),
    });
    await page.getByRole("tab", { name: "骰装" }).click();
    for (const ch of view.characters) {
      await page
        .locator(
          `.abyssa-character-portrait-selector__item[data-character-id="${ch.id}"]`,
        )
        .click();
      await expect(page.locator(".abyssa-dice__column")).toHaveCount(6);
      if (ch.version !== 2) throw new Error("Expected rules2");
      for (const face of ch.faces) {
        const button = page.locator(
          `.abyssa-dice__column[data-face="${face.slot}"]`,
        );
        await expect(button).toHaveAttribute("data-fate", face.fate);
        await expect(button).toHaveAttribute(
          "aria-label",
          new RegExp(
            `命数 ${face.pip.kind === "wild" ? "万能" : face.pip.value}，`,
          ),
        );
        await button.click();
        await expect(page.locator(".abyssa-dice__inspector")).toContainText(
          face.pip.kind === "wild"
            ? "万能 · 无原生点数"
            : `自然点 ${face.pip.value}`,
        );
      }
      await expect(
        page
          .getByRole("group", { name: "装备槽" })
          .locator(".abyssa-dice__charm"),
      ).toHaveCount(3);
    }
    await page.locator('.abyssa-dice__column[data-face="6"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".abyssa-dice__inspector")).toContainText(
      "绞杀红线",
    );
    await page.screenshot({
      path: info.outputPath(`level-${level}-marietta-dice.png`),
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({
      path: info.outputPath(`level-${level}-marietta-720.png`),
    });
    await page.getByRole("tab", { name: "记事" }).click();
    await expect(page.getByText("暂无可记录的冒险经历。")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`level-${level}-chronicle-720.png`),
    });
    expect((await inspectFixture(page)).record).toEqual(record);
  });

test("rules2 temporary rust refreshes the selected inspector; missing images and stale run links recover", async ({
  page,
}, info) => {
  await fixture(page, 1);
  await page.getByRole("tab", { name: "骰装" }).click();
  const current: HarnessState = await page.evaluate(() =>
    (window as any).AbyssaArchiveTest.rustParty(),
  );
  await expect(page.locator(".game-client-status")).toHaveAttribute(
    "data-revision",
    String(current.record.head.revision),
  );
  const member = current.record.snapshot.expedition!.run.party.find(
    (p) => p.temporaryRust.length,
  )!;
  await page
    .locator(
      `.abyssa-character-portrait-selector__item[data-character-id="${member.id}"]`,
    )
    .click();
  const index = member.config.faces.findIndex((f) =>
    member.temporaryRust.includes(f.id),
  );
  await page.locator(`.abyssa-dice__column[data-face="${index + 1}"]`).click();
  await expect(page.locator(".abyssa-dice__inspector")).toContainText(
    "本趟临时锈",
  );
  await page.screenshot({ path: info.outputPath("temporary-rust.png") });
  await page.route("**/portraits/**", (route) => route.abort());
  // Real failed image request on the active element, then change identity.
  await page
    .locator(".abyssa-character-screen__portrait img")
    .evaluate((img: HTMLImageElement) => {
      img.src = "/missing-portrait.png";
    });
  await expect(
    page.locator(".abyssa-character-screen__portrait img"),
  ).toHaveCount(0);
  await page
    .locator(
      '.abyssa-character-portrait-selector__item[data-character-id="norma"]',
    )
    .click();
  await expect(
    page.locator(".abyssa-character-screen__portrait img"),
  ).toBeVisible();
  await page.evaluate(() => {
    const url = new URL(location.href);
    const params = new URLSearchParams(url.hash.split("?")[1] ?? url.search);
    params.set("expedition", "obsolete");
    if (url.hash.startsWith("#/")) url.hash = url.hash.split("?")[0] + "?" + params; else url.search = params.toString();
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("alert")).toContainText(
    "这趟远征已结束或发生变化",
  );
  expect((await inspectFixture(page)).record).toEqual(current.record);
});

test("invalid save/epoch and unavailable content show recovery without a sample fallback", async ({
  page,
}) => {
  await startLegacy(page);
  const contentRef = (await inspectPage(page)).record.contentRef;
  const url = new URL(page.url());
  url.hash = url.hash.replace(/^#\/[^?]+/, "#/character-status");
  const validUrl = url.href;
  const params = new URLSearchParams(url.hash.split("?")[1] ?? url.search);
  params.set("epoch", "obsolete"); url.hash = url.hash.split("?")[0] + "?" + params;
  await page.goto(url.href);
  await expect(page.getByRole("alert")).toContainText("档案定位已失效");
  await expect(page.getByRole("link", { name: "选择档案" })).toBeVisible();
  await page.goto("/character-status.html?save=missing&epoch=missing");
  await expect(page.getByRole("alert")).toContainText("没有找到这份档案");
  await expect(page.locator(".abyssa-character-screen")).toHaveCount(0);
  // Corruption injection belongs to this isolated browser context only.
  for (const field of ["catalogId", "digest"] as const) {
    await page.evaluate(
      async ({ saveId, field, contentRef }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const r = indexedDB.open("abyssa-game-v1", 1);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("saves", "readwrite"),
            saves = tx.objectStore("saves"),
            request = saves.get(saveId);
          request.onsuccess = () => {
            const record = request.result;
            record.contentRef = {
              ...contentRef,
              [field]: field === "digest" ? "0".repeat(64) : "test.unavailable",
            };
            saves.put(record, saveId);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      },
      { saveId: new URLSearchParams(url.hash.split("?")[1] ?? url.search).get("save")!, field, contentRef },
    );
    await page.goto(validUrl);
    await expect(page.getByRole("alert")).toContainText("内容版本不可用");
    await expect(page.locator(".abyssa-character-screen")).toHaveCount(0);
  }
});

test("character idle, face inspection and cube drag keep the archive unchanged", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { record } = await fixture(page, 2);
  await page.getByRole("tab", { name: "骰装" }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (img) => img.decode().catch(() => {})),
    );
    (window as any).d2Tasks = [];
    const observer = new PerformanceObserver((list) =>
      (window as any).d2Tasks.push(
        ...list
          .getEntries()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    );
    observer.observe({ type: "longtask" });
    (window as any).d2Observer = observer;
    (window as any).d2Start = performance.now();
  });
  await page.waitForTimeout(2000);
  const idleEnd = await page.evaluate(() => performance.now());
  for (const id of [
    "eustice",
    "elora",
    "kororo",
    "norma",
    "marietta",
    "kael",
  ]) {
    await page
      .locator(
        `.abyssa-character-portrait-selector__item[data-character-id="${id}"]`,
      )
      .click();
    await page.locator('.abyssa-dice__column[data-face="6"]').click();
  }
  const cube = page.getByRole("img", {
    name: "六面命骰，可拖动或使用方向键旋转",
  });
  const before = await cube.getAttribute("data-rotation-y");
  const b = (await cube.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 50, b.y + b.height / 2 + 35, {
    steps: 30,
  });
  await page.mouse.up();
  await expect(cube).not.toHaveAttribute("data-rotation-y", before!);
  const metrics = await page.evaluate((idleEnd) => {
    (window as any).d2Observer.disconnect();
    const entries = (window as any).d2Tasks as {
      start: number;
      duration: number;
    }[];
    return {
      idleMs: idleEnd - (window as any).d2Start,
      interactionMs: performance.now() - idleEnd,
      idleLongTasks: entries.filter((e) => e.start < idleEnd),
      interactionLongTasks: entries.filter((e) => e.start >= idleEnd),
      viewport: { width: innerWidth, height: innerHeight },
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }, idleEnd);
  await writeFile(
    info.outputPath("performance.json"),
    JSON.stringify(metrics, null, 2),
  );
  await info.attach("performance", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect((await inspectFixture(page)).record).toEqual(record);
});
