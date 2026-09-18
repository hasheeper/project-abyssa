import { expect, test, type Page } from "@playwright/test";
import type { D5GameRecord } from "../../src/game-application";
import { observeArtifacts } from "./helpers";
import { depart, ready } from "./playable-helpers";
import handbook from "../../src/content/presentation/tutorial/handbook.json" with {type: "json"};

async function saves(page: Page): Promise<D5GameRecord[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("abyssa-game-v1", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, get = db.transaction("saves", "readonly").objectStore("saves").getAll();
      get.onsuccess = () => { resolve(get.result); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  }));
}

test("new game opens a themed, keyboard-accessible start dialog before any save or prologue", async ({page}, info) => {
  await page.goto("/");
  const begin = page.getByRole("button", {name: "新的开始", exact: true});
  await begin.dblclick();
  const dialog = page.getByRole("dialog", {name: "选择旅程起点"});
  await expect(dialog).toBeVisible();
  expect(await saves(page)).toEqual([]);
  for (const width of [1280, 1600, 1920]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(0); expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThan(width);
    expect(bounds.y + bounds.height).toBeLessThan(width * 9 / 16);
    await page.screenshot({path: info.outputPath(`start-dialog-${width}.png`)});
  }
  await page.getByRole("button", {name: "跳过教程", exact: true}).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", {name: "关闭选择旅程起点"})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(begin).toBeFocused();
  expect(await saves(page)).toEqual([]);
});

for (const [label, startAt, route] of [
  ["完整开始", "prologue", "prologue"], ["跳过序章", "first-morning", "mansion"],
  ["跳过第一章（抵达教程）", "tutorial", "battle"], ["跳过教程", "hub", "menu"],
] as const) test(`start ${startAt} survives reload and Continue without fake settlement`, async ({page}, info) => {
  test.setTimeout(90_000);
  const failures = await observeArtifacts(page);
  await page.goto("/abyssa/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await page.getByRole("button", {name: label, exact: true}).dblclick();
  await expect(page).toHaveURL(new RegExp(`#/${route}\\?`), {timeout: 30_000}); await ready(page);
  if (startAt === "tutorial") await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene-id", "tutorial:S3-1", {timeout: 30000});
  const [record] = await saves(page);
  expect(record.contentRef.contentVersion).toBe(12);
  expect(record.facts.filter(f => f.kind === "progression" && f.payload.type === "game-start-selected")).toHaveLength(1);
  expect(record.snapshot.campaign.settlements).toEqual([]);
  expect(record.snapshot.campaign.funds.party).toBe(0);
  expect(record.snapshot.campaign.opening?.choices).toEqual([]);
  if (startAt === "tutorial") {
    if (record.snapshot.run?.kind !== "expedition") throw Error("tutorial run missing");
    expect(record.snapshot.run.state.tutorial).toMatchObject({stage: "story", story: {id: "S3-1", step: 0}, guide: {cursor: 0}});
    await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toHaveCount(0);
  } else expect(record.snapshot.run).toBeNull();
  if (startAt === "hub") expect(record.snapshot.campaign.tutorial).toEqual({status: "exempt", reason: "player-skipped"});
  await page.screenshot({path: info.outputPath(`${startAt}.png`)});
  await page.reload(); await ready(page);
  expect((await saves(page))[0].head.saveId).toBe(record.head.saveId);
  await page.goto("/abyssa/");
  await page.getByRole("button", {name: "继续游戏", exact: true}).click();
  await expect(page).toHaveURL(new RegExp(`#/${route}\\?`), {timeout: 30_000}); await ready(page);
  await expect(page.getByRole("dialog", {name: "选择旅程起点"})).toHaveCount(0);
  expect(await saves(page)).toHaveLength(1);
  if (startAt === "tutorial") {
    expect((await saves(page))[0]).toEqual(record);
    await page.getByRole("button", {name: "跳过本段对白", exact: true}).click();
    await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
    expect((await saves(page))[0]).toEqual(record);
    await page.reload(); await ready(page);
    await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
    await page.getByRole("button", {name: "返回标题", exact: true}).click();
    await page.getByRole("button", {name: "继续游戏", exact: true}).click();
    await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
    expect((await saves(page))[0]).toEqual(record);
    await page.getByRole("button", {name: "开始战斗", exact: true}).dblclick();
    await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene", "battle", {timeout: 30000}); await ready(page);
    const started = (await saves(page))[0];
    expect(started.head.revision).toBe(record.head.revision + 1);
    await page.reload(); await ready(page);
    await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toHaveCount(0);
    expect((await saves(page))[0]).toEqual(started);
  }
  if (startAt === "hub") await depart(page, 5, 30_000, true);
  expect(failures).toEqual([]);
});

test("failed new-game write remains in the dialog and retry creates only one save", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await page.evaluate(() => {
    (window as any).originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("Full disk", "QuotaExceededError"); };
  });
  await page.getByRole("button", {name: "跳过教程", exact: true}).click();
  await expect(page.getByRole("status")).toContainText("存储空间不足");
  await expect(page.getByRole("dialog", {name: "选择旅程起点"})).toBeVisible();
  expect(await saves(page)).toEqual([]);
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).originalPut; });
  await page.getByRole("button", {name: "跳过教程", exact: true}).click();
  await expect(page).toHaveURL(/#\/menu\?/, {timeout: 30_000}); await ready(page);
  expect(await saves(page)).toHaveLength(1);
});

test("tutorial overview is a five-chapter handbook with annotated detail figures and no save writes", async ({page}, info) => {
  test.setTimeout(120000);
  const failures = await observeArtifacts(page);
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await page.getByRole("button", {name: "跳过第一章（抵达教程）", exact: true}).click();
  await expect(page).toHaveURL(/#\/battle\?/, {timeout: 30000}); await ready(page);
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene-id", "tutorial:S3-1", {timeout: 30000});
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toHaveCount(0);
  await page.getByRole("button", {name: "跳过本段对白", exact: true}).click();
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
  const [before] = await saves(page), overview = page.getByRole("main", {name: "战斗与探索规则总览"});
  await expect(overview.getByRole("status")).toHaveCount(0);
  await expect(overview).not.toContainText("查阅不会");
  await expect(overview).not.toContainText("不必一口气");
  await expect(overview.locator(".handbook")).toHaveAttribute("data-chapter", "battle");
  await expect(overview.locator(".handbook")).toHaveAttribute("data-section", "interface");
  expect(await overview.locator(".handbook__chapter > button").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label"))))
    .toEqual(["战斗与地牢", "骰子", "倍率机制", "其他机制", "角色词条"]);
  await expect(overview.getByRole("navigation").getByRole("button", {name: "事件机制：专长直通＋点数保底", exact: true})).toHaveCount(0);
  await expect(overview.getByRole("navigation").getByRole("button", {name: "敌方意图与单条格挡", exact: true})).toHaveCount(0);
  await expect(overview.getByRole("list", {name: "战斗与地牢小节"}).getByRole("button")).toHaveCount(4);
  await expect(overview.locator(".handbook__key-rules li")).toHaveCount(0);
  expect(handbook.chapters.reduce((n, c) => n + c.sections.length, 0)).toBe(13);
  await expect(overview.getByRole("article")).not.toContainText("退潮岩窟路线");
  if (before.snapshot.run?.kind !== "expedition") throw Error("tutorial run missing");
  expect(before.snapshot.run.state.tutorial).toMatchObject({stage: "story", story: {id: "S3-1", step: 0}});
  await expect(overview.locator(".handbook__interface-regions p").first()).toHaveCSS("color", "rgb(194, 203, 203)");
  await expect(overview.locator(".handbook__heading > p")).toHaveCSS("color", "rgb(194, 203, 203)");
  await expect(overview.locator(".handbook__interface-map .handbook__mark")).toHaveCount(6);
  await expect(overview.getByRole("list", {name: "界面区域说明"}).getByRole("listitem")).toHaveCount(6);
  await expect.poll(() => overview.locator(".handbook__interface-map img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 1600)).toBe(true);
  for (const width of [1280, 1600, 1920]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    // Stage updates its scale on resize; measure after that update has rendered.
    await expect.poll(async () => {
      const frame = await overview.boundingBox();
      return !!frame && frame.x > 0 && frame.y > 0 &&
        frame.x + frame.width < width && frame.y + frame.height < width * 9 / 16;
    }).toBe(true);
    // Scaled Stage bounds can yield a sub-pixel IntersectionObserver ratio below 1.
    await expect(overview.locator(".handbook__scope")).toBeInViewport({ratio: .999});
    await expect(overview.getByRole("heading", {name: "界面与操作", exact: true})).toBeInViewport({ratio: .999});
    for (const label of ["返回标题", "开始战斗"]) {
      const button = overview.getByRole("button", {name: label, exact: true});
      const bounds = (await button.boundingBox())!;
      const text = (await button.locator("text").boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(48 * width / 1600);
      expect(text.height).toBeGreaterThanOrEqual(16 * width / 1600);
    }
    await page.screenshot({path: info.outputPath(`overview-${width}.png`)});
  }
  await page.setViewportSize({width: 1600, height: 900});
  await expect(overview.getByRole("list", {name: "怎样完成一轮操作 · 操作顺序"}).getByRole("listitem")).toHaveCount(5);
  for (const [index, step] of (await overview.locator(".handbook__walkthrough > li").all()).entries()) {
    await step.scrollIntoViewIfNeeded();
    await expect(step.getByRole("heading")).toBeInViewport({ratio: .999});
    await page.screenshot({path: info.outputPath(`interface-step-${index + 1}.png`)});
  }
  const controls = overview.locator(".handbook__interface-controls svg");
  await expect(controls).toHaveAttribute("viewBox", "325 784 680 68");
  expect((await controls.boundingBox())!.width).toBeGreaterThan(680);
  await overview.locator(".handbook__interface-controls").screenshot({path: info.outputPath("interface-operation-detail.png")});
  expect((await saves(page))[0]).toEqual(before);
  await overview.getByRole("button", {name: "远征流程", exact: true}).click();
  await expect(overview.locator(".handbook__steps > li")).toHaveCount(5);
  await page.screenshot({path: info.outputPath("expedition-flow-start.png")});
  for (const [index, step] of (await overview.locator(".handbook__steps > li").all()).entries()) {
    await step.scrollIntoViewIfNeeded();
    await expect(step.getByRole("heading")).toBeInViewport({ratio: .999});
    await page.screenshot({path: info.outputPath(`expedition-step-${index + 1}.png`)});
  }
  await expect(overview.locator(".handbook__table td").first()).toHaveCSS("color", "rgb(194, 203, 203)");
  await overview.getByRole("table").screenshot({path: info.outputPath("expedition-four-scales.png")});
  await overview.getByRole("article").evaluate(node => {node.scrollTop = node.scrollHeight;});
  await expect(overview.getByRole("rowheader", {name: "一趟（Run）"})).toBeInViewport();
  await overview.locator(".handbook__contents").screenshot({path: info.outputPath("handbook-chapter-order.png")});
  await overview.getByRole("button", {name: "骰子", exact: true}).click();
  await expect(overview.getByRole("table")).toHaveCount(0);
  await expect(overview.getByRole("region", {name: "实战区"})).toBeVisible();
  await expect(overview.getByRole("region", {name: "结算区"})).toBeVisible();
  expect(await overview.locator(".handbook__reading-group p").first().evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(overview.locator(".handbook__note")).toBeInViewport({ratio: .999});
  await expect(overview.getByRole("button", {name: "倍率机制 →", exact: true})).toBeInViewport({ratio: .999});
  await overview.locator(".handbook__anatomy-layout").screenshot({path: info.outputPath("die-reading-detail.png")});
  await expect(overview.getByRole("navigation").getByRole("button", {name: "牌型机制：回合末自动凑牌", exact: true})).toHaveCount(0);
  await overview.getByRole("button", {name: "倍率机制 →", exact: true}).click();
  await expect(overview.locator(".handbook")).toHaveAttribute("data-chapter", "rewards");
  await expect(overview.locator(".handbook")).toHaveAttribute("data-section", "patterns");
  await expect(overview.getByRole("table").locator("tbody tr")).toHaveCount(10);
  await expect(overview.getByRole("table").getByRole("columnheader")).toHaveCount(3);
  await expect(overview.getByRole("columnheader", {name: "基础加成"})).toBeVisible();
  await overview.getByRole("button", {name: "总倍率与金币结算", exact: true}).click();
  await expect(overview.locator(".handbook")).toHaveAttribute("data-chapter", "rewards");
  await expect(overview.locator(".handbook")).toHaveAttribute("data-section", "factors");
  expect((await saves(page))[0]).toEqual(before);
  for (const chapter of handbook.chapters) {
    await page.getByRole("button", {name: chapter.title, exact: true}).click();
    await expect(page.locator(".handbook")).toHaveAttribute("data-chapter", chapter.id);
    if (chapter.id === "other") await expect(page.locator(".handbook")).toHaveAttribute("data-section", "event");
    await expect(overview.locator(".handbook__scope")).toBeInViewport({ratio: .999});
    await page.screenshot({path: info.outputPath(`handbook-${chapter.id}.png`)});
    for (const section of chapter.sections) {
      await page.getByRole("button", {name: section.title, exact: true}).click();
      await expect(page.getByRole("heading", {name: section.title, exact: true})).toBeVisible();
      const article = page.getByRole("article");
      expect(await article.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await expect(page.locator(".handbook__page-footer")).toContainText(section.practice);
      for (const img of await article.locator("img").all()) {
        const isMap = chapter.id === "battle" && section.id === "interface";
        await expect.poll(() => img.evaluate((node: HTMLImageElement, map) => node.complete && node.naturalWidth > 0 && (map ? node.naturalWidth === 1600 : node.naturalWidth <= 710), isMap)).toBe(true);
      }
      if (chapter.id === "battle" && section.id === "round") {
        await expect(article.locator(".handbook__timeline li")).toHaveCount(5);
        await article.locator(".handbook__timeline").screenshot({path: info.outputPath("round-timeline.png")});
        await article.getByRole("table").screenshot({path: info.outputPath("round-five-phases.png")});
        const undo = article.getByRole("region", {name: "撤回范围"});
        await undo.screenshot({path: info.outputPath("round-undo-boundaries.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(undo.locator(".handbook__key-rules li").last()).toBeInViewport();
        await expect(undo.locator(".handbook__note")).toHaveCount(0);
        expect(await undo.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      if (chapter.id === "battle" && section.id === "survival") {
        await expect(article.locator(".handbook__key-rules li")).toHaveCount(4);
        await expect(article.getByRole("table")).toHaveCount(0);
        await page.screenshot({path: info.outputPath("handbook-survival.png")});
        await article.locator(".handbook__key-rules").screenshot({path: info.outputPath("survival-core-rules.png")});
      }
      if (chapter.id === "dice" && section.id === "actions") {
        const power = article.locator(".handbook__explanation");
        await expect(power.locator("[data-power]")).toHaveCount(5);
        for (const crop of await power.locator(".handbook__power-crop").all()) {
          const frame = (await crop.boundingBox())!, mark = (await crop.locator("[data-power]").boundingBox())!;
          expect(mark.x).toBeGreaterThan(frame.x + 1);
          expect(mark.y).toBeGreaterThan(frame.y + 1);
          expect(mark.x + mark.width).toBeLessThan(frame.x + frame.width - 1);
          expect(mark.y + mark.height).toBeLessThan(frame.y + frame.height - 1);
        }
        await power.screenshot({path: info.outputPath("die-power-detail.png")});
        const actions = article.locator(".handbook__figure--die-actions");
        await expect(actions.locator("[data-action]")).toHaveCount(6);
        const blank = actions.locator('[data-action="blank"]');
        await expect(blank).not.toHaveAttribute("data-asleep");
        expect(await blank.evaluate(node => getComputedStyle(node).getPropertyValue("--expedition-die-stamp-icon"))).toContain("data:image/svg+xml");
        await actions.screenshot({path: info.outputPath("die-actions-detail.png")});
        await blank.screenshot({path: info.outputPath("blank-cross-detail.png")});
        await article.getByRole("table").screenshot({path: info.outputPath("die-action-table.png")});
      }
      if (chapter.id === "dice" && section.id === "marks") {
        await expect(article.getByRole("table")).toHaveCount(0);
        await expect(article.locator("figcaption")).toHaveCount(0);
        for (const [id, marker, minimum] of [["die-fates", ".expedition-flat-die-frame__suit-fate", 60], ["die-suits", ".expedition-flat-die-frame__suit-fate", 60], ["die-seals", ".expedition-flat-die-frame__seal", 30]] as const) {
          const figure = article.locator(`.handbook__figure--${id}`);
          await figure.scrollIntoViewIfNeeded();
          for (const crop of await figure.locator(".handbook__fate-crop, .handbook__seal-crop").all()) {
            const frame = (await crop.boundingBox())!, mark = (await crop.locator(marker).boundingBox())!;
            expect(mark.width).toBeGreaterThanOrEqual(minimum);
            expect(mark.height).toBeGreaterThanOrEqual(minimum);
            expect(mark.x).toBeGreaterThan(frame.x + 1);
            expect(mark.y).toBeGreaterThan(frame.y + 1);
            expect(mark.x + mark.width).toBeLessThan(frame.x + frame.width - 1);
            expect(mark.y + mark.height).toBeLessThan(frame.y + frame.height - 1);
          }
          await figure.screenshot({path: info.outputPath(`${id}-detail.png`)});
        }
        await article.evaluate(node => {node.scrollTop = 0;});
        for (const figure of await article.locator(".handbook__topic--illustrated > .handbook__figure").all()) await expect(figure).toBeInViewport({ratio: .999});
        await page.screenshot({path: info.outputPath("handbook-marks-top.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("button", {name: "倍率机制 →", exact: true})).toBeInViewport();
        await expect(article).not.toContainText(/大地共鸣|主／副花色|有效骰|散骰|避坑/);
        await page.screenshot({path: info.outputPath("handbook-marks-bottom.png")});
      }
      if (chapter.id === "dice" && section.id === "turn") {
        await expect(overview.getByRole("list", {name: "骰子小节"}).getByRole("button")).toHaveCount(4);
        await expect(article.locator(".handbook__timeline li")).toHaveCount(4);
        await expect(article.locator(".handbook__steps > li")).toHaveCount(5);
        await page.screenshot({path: info.outputPath("handbook-action-procedure.png")});
        await article.locator(".handbook__steps").screenshot({path: info.outputPath("action-procedure-detail.png")});
        await expect(article.getByRole("table").getByRole("columnheader")).toHaveCount(4);
        await expect(article.getByRole("table").getByRole("rowheader")).toHaveCount(6);
        await article.getByRole("table").screenshot({path: info.outputPath("dice-state-table.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("rowheader", {name: "力竭（生命 0）"})).toBeInViewport();
        await page.screenshot({path: info.outputPath("handbook-action-states.png")});
      }
      if (chapter.id === "other" && section.id === "use") {
        await expect(overview.getByRole("list", {name: "其他机制小节"}).getByRole("button")).toHaveCount(2);
        await expect(article.getByRole("table")).toHaveCount(1);
        await expect(article.getByRole("rowheader")).toHaveCount(7);
        await expect(article.getByRole("columnheader")).toHaveText(["道具", "效果", "使用条件"]);
        await expect(article).not.toContainText(/免费|付费|配给|充能|容量|单价|归还|[0-9]+G/);
        await expect(article.locator("tbody th i")).toHaveCount(7);
        await expect(article.locator("h3, .handbook__note")).toHaveCount(0);
        const icons = await article.locator("tbody th i").evaluateAll(nodes => nodes.map(n => getComputedStyle(n).maskImage));
        expect(icons.every(icon => icon !== "none" && icon.includes("url("))).toBe(true);
        await page.screenshot({path: info.outputPath("handbook-supplies-top.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("rowheader", {name: "卦签"})).toBeInViewport();
        await page.screenshot({path: info.outputPath("handbook-supplies-bottom.png")});
      }
      if (chapter.id === "other" && section.id === "event") {
        await expect(article).toContainText("多人配合");
        await expect(article).toContainText("每人贡献一枚骰面");
        await expect(article).not.toContainText(/选择一名存活队员|治疗、昂贵治疗|至少 4 点/);
        await expect(article.locator(".handbook__mark, .handbook__legend")).toHaveCount(0);
        await page.screenshot({path: info.outputPath("handbook-event-top.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("region", {name: "三种最终结果"}).getByRole("listitem").last()).toBeInViewport();
        await expect(article).not.toContainText(/对不对口|够不够大|动作完全对口|过关|暴力破拆|怎么派人/);
        await page.screenshot({path: info.outputPath("handbook-event-bottom.png")});
      }
      if (chapter.id === "rewards" && section.id === "factors") {
        await expect(overview.getByRole("list", {name: "倍率机制小节"}).getByRole("button")).toHaveCount(2);
        await expect(article.getByRole("table")).toHaveCount(2);
        await page.screenshot({path: info.outputPath("handbook-factors-top.png")});
        const payout = article.getByRole("table", {name: "散金 → 入袋 → 钱包 · 规则表"});
        await payout.screenshot({path: info.outputPath("settlement-outcomes.png")});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("figure", {name: handbook.figures["hand-detail"].caption})).toBeInViewport();
        await page.screenshot({path: info.outputPath("handbook-factors-bottom.png")});
      }
      if (chapter.id === "characters") {
        await expect(overview.getByRole("list", {name: "角色词条小节"}).getByRole("button")).toHaveCount(1);
        await expect(article.getByRole("table")).toHaveCount(1);
        await expect(article.getByRole("rowheader", {name: "编队效果"})).toBeVisible();
        await expect(article).not.toContainText(/共鸣|后续开放|勇者|玛丽埃塔|尤斯缇丝|艾洛拉|柯萝萝|诺玛/);
        await page.screenshot({path: info.outputPath(`handbook-characters-${section.id}-top.png`)});
        await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
        await expect(article.getByRole("table").last().getByRole("rowheader").last()).toBeInViewport();
        await page.screenshot({path: info.outputPath(`handbook-characters-${section.id}-bottom.png`)});
      }
      if ("table" in section) {
        await expect(article.getByRole("table").locator("tbody tr")).toHaveCount(10);
        await expect(article.getByRole("table").getByRole("columnheader")).toHaveCount(3);
        await expect(article.locator(".handbook__key-rules > li")).toHaveCount(3);
        await expect(article.locator(".handbook__formula, .handbook__note, .handbook__references")).toHaveCount(0);
        await page.screenshot({path: info.outputPath(`handbook-${chapter.id}-${section.id}-top.png`)});
        await article.locator(".handbook__key-rules").screenshot({path: info.outputPath("hand-pattern-rules.png")});
      }
      await article.evaluate(node => {node.scrollTop = node.scrollHeight;});
      if ("note" in section) await expect(article.locator(".handbook__note")).toBeInViewport();
      expect((await saves(page))[0]).toEqual(before);
      if (section.id === "factors" || section.id === "covenants" || section.id === "use" || section.id === "patterns")
        await page.screenshot({path: info.outputPath(`handbook-${chapter.id}-${section.id}.png`)});
    }
  }
  expect((await saves(page))[0]).toEqual(before);
  // The new overview remains visible during a failed write and preserves its exact intent.
  await page.evaluate(() => {
    (window as any).originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {throw new DOMException("Full disk", "QuotaExceededError");};
  });
  await page.getByRole("button", {name: "开始战斗", exact: true}).click();
  await expect(overview.getByRole("status")).toContainText("存储空间不足");
  expect((await saves(page))[0]).toEqual(before);
  await page.evaluate(() => {IDBObjectStore.prototype.put = (window as any).originalPut;});
  await page.getByRole("button", {name: "重试开始", exact: true}).click();
  await expect(overview).toHaveCount(0);
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene", "battle", {timeout: 30000}); await ready(page);
  expect((await saves(page))[0].head.revision).toBe(before.head.revision + 1);
  expect(failures).toEqual([]);
});
