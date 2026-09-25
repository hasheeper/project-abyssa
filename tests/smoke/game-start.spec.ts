import { expect, test, type Page } from "@playwright/test";
import type { D5GameRecord } from "../../src/game-application";
import { observeArtifacts } from "./helpers";
import { depart, ready } from "./playable-helpers";
import { confirmNewGame, prepareNewGame } from "./new-game-helpers";
import handbook from "../../src/content/presentation/tutorial/handbook.json" with {type: "json"};

async function saves(page: Page): Promise<D5GameRecord[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("abyssa-game-v1");
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
  const dialog = page.getByRole("dialog", {name: "新的开始"});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("textbox")).toBeEnabled();
  expect(await saves(page)).toEqual([]);
  for (const width of [1280, 1600, 1920]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(0); expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThan(width);
    expect(bounds.y + bounds.height).toBeLessThan(width * 9 / 16);
    await page.screenshot({path: info.outputPath(`start-dialog-${width}.png`)});
  }
  await page.getByRole("button", {name: /下一步/}).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(begin).toBeFocused();
  expect(await saves(page)).toEqual([]);
});

test("opening uses library controls and a continuous blackout without explanatory filler", async ({page}, info) => {
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).openingFrames = new Promise(resolve => {
      document.addEventListener("click", () => {
        const frames: {black: number; panel: number}[] = [], start = performance.now();
        function sample() {
          const black = document.querySelector(".new-game-opening__black"), panel = document.querySelector(".new-game-opening__panel");
          if (black && panel) frames.push({black: Number(getComputedStyle(black).opacity), panel: Number(getComputedStyle(panel).opacity)});
          if (performance.now() - start < 1300) requestAnimationFrame(sample); else resolve(frames);
        }
        requestAnimationFrame(sample);
      }, {once: true});
    });
  });
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  const input = page.getByRole("textbox"), dialog = page.getByRole("dialog", {name: "新的开始"});
  await expect(input).toBeEnabled();
  const frames = await page.evaluate(() => (window as any).openingFrames) as {black: number; panel: number}[];
  expect(frames.filter(f => f.black > .02 && f.black < .98).length).toBeGreaterThan(2);
  expect(frames.filter(f => f.panel > .02 && f.panel < .98).length).toBeGreaterThan(2);
  expect(frames.every(f => f.panel < .01 || f.black > .99)).toBe(true);
  await info.attach("opening-frames", {body: JSON.stringify(frames), contentType: "application/json"});
  await expect(dialog.locator(".scene-loading-plaque")).toHaveCount(1);
  await expect(dialog.locator(".scene-loading-title")).toContainText("角色姓名");
  await expect(dialog.locator(".scene-loading-plaque")).toHaveCSS("background-color", "rgba(6, 11, 12, 0.96)");
  await expect(dialog.locator(".abyssa-notched-pill, .abyssa-ribbon-button")).toHaveCount(0);
  const actions = dialog.locator('.new-game-opening__footer .abyssa-shape-button[data-shape="chamfer"]');
  await expect(actions).toHaveCount(2);
  await expect(actions.first()).toHaveCSS("width", "136px");
  await expect(actions.first().locator(".abyssa-shape-button__content")).toHaveCSS("font-size", "16px");
  const nameBounds = (await dialog.boundingBox())!;
  expect(nameBounds.width).toBe(520);
  expect(nameBounds.height).toBeLessThan(250);
  await expect(dialog).not.toContainText("不影响");
  await expect(dialog).not.toContainText("1—12");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await input.fill("林恩");
  await page.screenshot({path: info.outputPath("opening-name.png")});
  await page.getByRole("button", {name: "下一步", exact: true}).click();
  await expect(dialog.getByRole("radio")).toHaveCount(5);
  await expect(dialog.locator(".new-game-opening__body")).toHaveCSS("height", "306px");
  await page.getByRole("radio", {name: /序章/}).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", {name: "洋馆的清晨"})).toHaveAttribute("aria-checked", "true");
  await page.screenshot({path: info.outputPath("opening-start.png")});
  await page.getByRole("button", {name: "下一步", exact: true}).click();
  await expect(dialog).toContainText("林恩");
  await expect(dialog.locator(".new-game-opening__body")).toHaveCSS("height", "132px");
  await expect(dialog.locator(".new-game-opening__identity dd")).toHaveCSS("font-size", "27px");
  const details = await dialog.locator(".new-game-opening__summary > div").evaluateAll(nodes => nodes.map(node => {
    const {x, y, width, height} = node.getBoundingClientRect(); return {x, y, width, height};
  }));
  expect(details[0].width).toBeGreaterThan(details[1].width);
  expect(details[1].y).toBe(details[2].y);
  expect(details[1].x + details[1].width).toBeLessThan(details[2].x);
  expect(details[0].y + details[0].height).toBeLessThan(details[1].y);
  await page.screenshot({path: info.outputPath("opening-confirm.png")});
  const confirmBounds = (await dialog.boundingBox())!;
  await page.screenshot({path: info.outputPath("opening-confirm-detail.png"), clip: {
    x: confirmBounds.x - 8, y: confirmBounds.y - 8, width: confirmBounds.width + 16, height: confirmBounds.height + 16,
  }});
  for (const viewport of [{width: 1920, height: 900}, {width: 1280, height: 1024}]) {
    await page.setViewportSize(viewport);
    await expect(dialog).toBeInViewport({ratio: 1});
    await expect(page.locator(".abyssa-stage")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    // A scaled fixed canvas must not move when focus/scrollIntoView requests a scroll.
    expect(await page.locator(".abyssa-stage").evaluate(stage => {
      stage.scrollLeft = stage.scrollWidth;
      return stage.scrollLeft;
    })).toBe(0);
    await page.screenshot({path: info.outputPath(`opening-cover-${viewport.width}.png`)});
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", {name: "开始位置"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("林恩");
  // The compact hierarchy must also fit the longest supported name and start label.
  const longName = "长夜微光星河远行归途之歌";
  await input.fill(longName);
  await page.getByRole("button", {name: "下一步", exact: true}).click();
  await page.getByRole("radio", {name: "战斗与探索教学", exact: true}).click();
  await page.getByRole("button", {name: "下一步", exact: true}).click();
  await expect(dialog.locator(".new-game-opening__body")).toHaveCSS("height", "132px");
  await expect(dialog.locator(".new-game-opening__identity dd")).toHaveText(longName);
  const fits = await dialog.locator(".new-game-opening__summary").evaluate(summary => {
    const body = summary.closest(".new-game-opening__body")!.getBoundingClientRect();
    return [...summary.querySelectorAll("dd")].every(value => {
      const rect = value.getBoundingClientRect();
      return value.scrollWidth <= value.clientWidth && rect.top >= body.top && rect.left >= body.left && rect.bottom <= body.bottom && rect.right <= body.right;
    });
  });
  expect(fits).toBe(true);
  await page.screenshot({path: info.outputPath("opening-confirm-long-name.png")});
  const layout = await dialog.evaluate(panel => {
    if (!(panel instanceof HTMLElement)) throw new Error("Expected an HTML opening panel");
    const ancestors = []; let node: HTMLElement | null = panel;
    while (node) {
      const {x, y, width, height} = node.getBoundingClientRect();
      ancestors.push({className: node.className, x, y, width, height, scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop, scrollWidth: node.scrollWidth, overflow: getComputedStyle(node).overflow});
      node = node.parentElement;
    }
    return ancestors;
  });
  await info.attach("opening-layout", {body: JSON.stringify(layout, null, 2), contentType: "application/json"});
  expect(Math.abs(layout[0].x + layout[0].width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  expect(layout.find(node => node.className === "abyssa-stage")?.scrollLeft).toBe(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue(longName);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await saves(page)).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

for (const [label, startAt, route] of [
  ["序章", "prologue", "prologue"], ["洋馆的清晨", "first-morning", "mansion"],
  ["战斗与探索教学", "tutorial", "battle"], ["自由行动", "hub", "menu"],
] as const) test(`start ${startAt} survives reload and Continue without fake settlement`, async ({page}, info) => {
  test.setTimeout(90_000);
  const failures = await observeArtifacts(page);
  await page.goto("/abyssa/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await prepareNewGame(page, label, "林恩");
  expect(await saves(page)).toEqual([]);
  await page.screenshot({path: info.outputPath("opening-confirm.png")});
  await page.getByRole("button", {name: /开始游戏/}).dblclick();
  await expect(page).toHaveURL(new RegExp(`#/${route}\\?`), {timeout: 30_000}); await ready(page);
  if (startAt === "tutorial") await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene-id", "tutorial:S3-1", {timeout: 30000});
  const [record] = await saves(page);
  expect(record.contentRef.contentVersion).toBe(16);
  expect(record.snapshot.campaign.playerName).toBe("林恩");
  expect(record.facts.filter(f => f.kind === "progression" && f.payload.type === "game-start-selected")).toHaveLength(1);
  expect(record.snapshot.campaign.settlements).toEqual([]);
  expect(record.snapshot.campaign.funds.party).toBe(startAt === "hub" ? 49 : 0);
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
  await expect(page.getByRole("dialog", {name: "新的开始"})).toHaveCount(0);
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

test("debug skip keeps the normal first SHOP performance and the tutorial rewards", async ({page}, info) => {
  test.setTimeout(90_000);
  const errors = await observeArtifacts(page);
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  const input = page.getByRole("textbox", {name: "请输入角色姓名"});
  await expect(input).toBeEnabled(); await input.fill("林恩");
  await page.getByRole("button", {name: "下一步", exact: true}).click();
  await page.getByText("调试入口", {exact: true}).click();
  const debug = page.getByRole("button", {name: "商店初见调试", exact: true});
  await expect(debug).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(page.locator(".new-game-opening__body")).toHaveCSS("height", "384px");
  await page.screenshot({path: info.outputPath("debug-start-1280.png")});
  await debug.click();
  await expect(page.getByRole("dialog", {name: "新的开始"})).toContainText("商店初见调试");
  expect(await saves(page)).toEqual([]);
  await page.getByRole("button", {name: "上一步", exact: true}).click();
  await expect(page.getByRole("radio", {name: "自由行动", exact: true})).toHaveAttribute("aria-checked", "false");
  await expect(debug).toBeVisible();
  await debug.click();
  await page.getByRole("button", {name: "开始游戏", exact: true}).click();
  await expect(page).toHaveURL(/#\/menu\?/, {timeout: 30_000}); await ready(page);
  await expect(page.locator(".menu-starting-rewards").getByRole("status")).toContainText("教程奖励已获得");
  const [before] = await saves(page);
  expect(before.snapshot.campaign.tutorial).toEqual({status: "exempt", reason: "player-skipped"});
  expect(before.snapshot.campaign.shopIntroduction).toEqual({step: 0, status: "pending"});
  expect(before.snapshot.campaign.funds.party).toBe(49);
  expect(before.snapshot.campaign.settlements).toEqual([]);
  expect(before.snapshot.campaign.loot).toHaveLength(1);
  expect(before.snapshot.run).toBeNull();
  await page.getByRole("button", {name: "商店 · 前往守望者杂货铺", exact: true}).dblclick();
  await expect(page).toHaveURL(/#\/shop/); await ready(page);
  const scene = page.locator(".scene-sequence"), reading = page.getByRole("main", {name: "柜台后的招呼"});
  await expect(scene).toHaveAttribute("data-scene-id", "story.shop.first-visit");
  await expect(scene).toHaveAttribute("data-phase", "idle");
  await expect(page.locator('.rp-adv__actor[data-character="tibby"]')).toBeVisible();
  for (let step = 0; step <= 3; step++) {
    await expect(reading).toHaveAttribute("data-frame-id", `shop.first-visit.${step}`);
    await expect(reading).toHaveAttribute("data-state", "idle");
    if (step === 0) await page.screenshot({path: info.outputPath("debug-shop-greeting-1280.png")});
    await page.getByRole("button", {name: step === 3 ? "看看柜台" : "下一句", exact: true}).click();
  }
  await expect(scene).toHaveAttribute("data-phase", "idle");
  await expect(page.locator(".shop-counter-page")).toHaveAttribute("data-shop-intro", "ready");
  await expect(page.getByRole("tab", {name: "购买", exact: true})).toBeVisible();
  const [after] = await saves(page);
  expect(after.snapshot.campaign.shopIntroduction).toEqual({step: 3, status: "viewed"});
  expect(after.snapshot.campaign.funds).toEqual(before.snapshot.campaign.funds);
  expect(after.snapshot.campaign.loot).toEqual(before.snapshot.campaign.loot);
  await page.reload(); await ready(page);
  await expect(reading).toHaveCount(0);
  await expect(page.getByRole("tab", {name: "购买", exact: true})).toBeVisible();
  expect(await saves(page)).toEqual([after]);
  expect(errors).toEqual([]);
});

test("skipping tutorial shows the starter rewards once and supports appraisal and sale", async ({page}, info) => {
  test.setTimeout(90_000);
  const failures = await observeArtifacts(page);
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await confirmNewGame(page, "自由行动", "林恩");
  await expect(page).toHaveURL(/#\/menu\?/, {timeout: 30_000});
  await ready(page);
  const feedback = page.locator(".menu-starting-rewards");
  await expect(feedback.getByRole("status")).toContainText("教程奖励已获得", {timeout: 15_000});
  await expect(feedback.locator(".scene-feedback__rewards > li")).toHaveCount(4);
  await expect(feedback.locator(".scene-feedback__quantity")).toHaveText(["×3", "×2", "×1"]);
  for (const width of [1280, 1600]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    await expect(feedback.locator(".scene-feedback__result")).toBeInViewport({ratio: .999});
    const rewardBox = (await feedback.boundingBox())!, settings = (await page.getByRole("button", {name: "设置", exact: true}).boundingBox())!;
    expect(rewardBox.y).toBeGreaterThan(settings.y + settings.height);
    await page.screenshot({path: info.outputPath(`starter-rewards-${width}.png`)});
  }
  const record = (await saves(page))[0];
  expect(record.snapshot.campaign.funds).toEqual({public: 0, party: 49, crystals: 0});
  expect(record.snapshot.campaign.shopIntroduction).toEqual({step: 0, status: "exempt"});
  expect(record.snapshot.campaign.loot).toHaveLength(1);
  expect(record.snapshot.campaign.supplies.map(s => s.charges)).toEqual([3, 2]);
  await page.reload(); await ready(page);
  await expect(page.locator(".menu-entry")).toHaveAttribute("data-menu-intro", "ready");
  await expect(page.locator(".menu-starting-rewards .scene-feedback__result")).toHaveCount(0);
  expect((await saves(page))[0]).toEqual(record);

  const query = new URLSearchParams({save: record.head.saveId, epoch: record.head.epoch, mode: "appraise"});
  await page.goto(`/abyssa/#/shop?${query}`); await ready(page);
  await expect(page.getByRole("main", {name: "柜台后的招呼"})).toHaveCount(0);
  await expect(page.locator(".shop-counter-page")).toHaveAttribute("data-shop-intro", "ready");
  await expect(page.getByRole("list", {name: "待鉴定物品"})).toBeVisible();
  await expect(page.getByLabel("持有 1 件", {exact: true})).toBeVisible();
  await expect(page.getByText("待鉴定物品 · 1", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-counter__columns")).toContainText("鉴定费");
  await expect(page.getByLabel("远古晶石余额 0")).toBeVisible();
  const speech = page.locator(".shop-merchant-dialogue");
  const tibby = page.getByRole("img", {name: "缇比·奥雷利亚", exact: true});
  await expect(tibby).toHaveAttribute("data-expression", "i");
  await expect(speech).toHaveAttribute("data-typing", "false");
  expect(await tibby.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  for (const width of [1280, 1600]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    await page.screenshot({path: info.outputPath(`appraisal-quantity-${width}.png`)});
  }
  await page.getByRole("tab", {name: "购买", exact: true}).click();
  await expect(page.getByRole("listbox", {name: "商品列表"}).getByRole("option")).toHaveCount(5);
  await expect(page.getByText("在售物资 · 5", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-counter__columns")).toContainText("持有 / 上限");
  await expect(page.locator(".shop-counter__columns")).toContainText("单价");
  await expect(tibby).toHaveAttribute("data-expression", "b");
  await expect(speech).toHaveAttribute("data-typing", "false");
  for (const width of [1280, 1600]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    await page.screenshot({path: info.outputPath(`buy-counter-${width}.png`)});
  }
  await page.getByRole("tab", {name: "鉴定", exact: true}).click();
  await page.getByRole("button", {name: "查看结着盐壳的铜环详情"}).click();
  await expect(page.getByText("持有 ×1", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-loot__object")).toHaveCSS("opacity", "1");
  await expect(tibby).toHaveAttribute("data-expression", "m");
  await expect(speech).toHaveAttribute("data-typing", "false");
  await page.screenshot({path: info.outputPath("appraisal-detail-1600.png")});
  await page.getByRole("button", {name: "鉴 定"}).click();
  await expect(page.getByLabel("小队金币余额 47")).toBeVisible();
  for (const [index, expression] of ["l", "i", "b"].entries()) {
    await expect(tibby).toHaveAttribute("data-expression", expression);
    await expect(speech).toHaveAttribute("data-typing", "false");
    await page.screenshot({path: info.outputPath(`appraisal-line-${index + 1}-1600.png`)});
    if (index < 2) await page.getByRole("button", {name: "继续听", exact: true}).click();
  }
  await page.getByRole("button", {name: "再听一遍", exact: true}).click();
  await expect(tibby).toHaveAttribute("data-expression", "l");
  await expect(page.getByLabel("小队金币余额 47")).toBeVisible();
  await page.getByRole("tab", {name: "出售", exact: true}).click();
  await expect(page.getByRole("listbox", {name: "可出售物品"})).toBeVisible();
  await expect(page.getByText("可售物品 · 1", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-counter__columns")).toContainText("持有");
  await expect(page.locator(".shop-counter__columns")).toContainText("单价");
  await expect(page.getByLabel("出售数量")).toHaveText("1");
  await expect(page.getByRole("button", {name: "返回列表"})).toHaveCount(0);
  await expect(tibby).toHaveAttribute("data-expression", "l");
  await expect(speech).toHaveAttribute("data-typing", "false");
  for (const width of [1280, 1600]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    await expect(page.locator(".shop-counter__description")).toHaveCSS("opacity", "1");
    await page.screenshot({path: info.outputPath(`sale-counter-${width}.png`)});
  }
  await page.getByRole("option", {name: /旧船灯的平衡环/}).click();
  await page.getByRole("button", {name: "出 售"}).click();
  await expect(page.getByLabel("小队金币余额 55")).toBeVisible();
  const tradeFeedback = page.locator(".shop-counter-feedback");
  await expect(tradeFeedback.getByRole("status")).toContainText("已出售旧船灯的平衡环，收入 8 金币");
  await expect(page.getByRole("heading", {name: "暂无可出售物品", exact: true})).toBeFocused();
  await expect(page.locator(".shop-counter__detail-frame")).toHaveCount(0);
  await expect(tibby).toHaveAttribute("data-expression", "c");
  await expect(speech).toHaveAttribute("data-typing", "false");
  await page.screenshot({path: info.outputPath("sale-dialogue-1600.png")});
  await page.setViewportSize({width: 1280, height: 720});
  await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", "0.8");
  await page.screenshot({path: info.outputPath("sale-empty-1280.png")});
  const sold = (await saves(page))[0];
  expect(sold.snapshot.campaign.loot).toEqual([]);
  expect(sold.snapshot.campaign.startReward).toEqual(record.snapshot.campaign.startReward);
  await page.reload(); await ready(page);
  expect((await saves(page))[0]).toEqual(sold);
  await expect(page.locator(".shop-counter-page")).toHaveAttribute("data-shop-intro", "ready");
  await expect(speech).toHaveAttribute("data-typing", "false");
  await expect(page.getByText("待鉴定物品 · 0", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-counter__columns")).toContainText("鉴定费");
  for (const width of [1280, 1600]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    await page.screenshot({path: info.outputPath(`appraisal-history-${width}.png`)});
    await page.getByRole("button", {name: "鉴定记录", exact: true}).click();
    await page.screenshot({path: info.outputPath(`appraisal-history-open-${width}.png`)});
    await page.keyboard.press("Escape");
  }
  await page.getByRole("tab", {name: "出售", exact: true}).click();
  await expect(page.getByText("可售物品 · 0", {exact: true})).toBeVisible();
  await expect(page.locator(".shop-counter__columns")).toContainText("单价");
  await page.getByRole("tab", {name: "购买", exact: true}).click();
  await page.getByRole("option", {name: /圣水/}).click();
  await page.getByRole("button", {name: "购 买"}).click();
  await expect(page.getByLabel("小队金币余额 52")).toBeVisible();
  await expect(tibby).toHaveAttribute("data-expression", "c");
  await expect(tradeFeedback.getByRole("status")).toContainText("获得道具，圣水 ×1");
  await expect(page.locator(".shop-counter__notice")).not.toBeVisible();
  await page.getByRole("option", {name: /护符/}).click();
  await page.getByRole("button", {name: "增加数量", exact: true}).click();
  await page.getByRole("button", {name: "购 买", exact: true}).click();
  await expect(page.getByLabel("小队金币余额 44")).toBeVisible();
  await page.getByRole("option", {name: /保养工具/}).click();
  await page.getByRole("button", {name: "购 买", exact: true}).click();
  await expect(page.getByLabel("小队金币余额 38")).toBeVisible();
  await expect(tradeFeedback.getByRole("status")).toHaveText(["获得道具，圣水 ×1", "获得道具，护符 ×2", "获得道具，保养工具 ×1"]);
  const acquisitions = tradeFeedback.locator(".scene-feedback__reward");
  await expect(acquisitions).toHaveCount(3);
  await expect(acquisitions.locator(".scene-feedback__quantity")).toHaveText(["×1", "×2", "×1"]);
  for (const width of [1600, 1280]) {
    await page.setViewportSize({width, height: width * 9 / 16});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    const boxes = await acquisitions.evaluateAll(nodes => nodes.map(node => {
      const {x, y, width, height} = node.getBoundingClientRect(); return {x, y, width, height};
    }));
    for (const [index, box] of boxes.entries()) {
      expect(box.x).toBeGreaterThan(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (index > 0) expect(box.y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height);
    }
    await page.screenshot({path: info.outputPath(`purchase-feedback-${width}.png`)});
  }
  await expect(tradeFeedback.locator(".scene-feedback__presentation")).toHaveCount(0, {timeout: 8000});
  expect((await saves(page))[0].snapshot.campaign.supplies.find(item => item.definitionId === "item.holy-water")?.charges).toBe(1);
  expect((await saves(page))[0].snapshot.campaign.supplies.find(item => item.definitionId === "item.ward")?.charges).toBe(2);
  expect(failures).toEqual([]);
});

test("failed new-game write remains in the dialog and retry creates only one save", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await page.evaluate(() => {
    (window as any).originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("Full disk", "QuotaExceededError"); };
  });
  await confirmNewGame(page, "自由行动", "林恩");
  await expect(page.getByRole("status")).toContainText("存储空间不足");
  await expect(page.getByRole("dialog", {name: "新的开始"})).toBeVisible();
  expect(await saves(page)).toEqual([]);
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).originalPut; });
  await page.getByRole("button", {name: /重试创建/}).click();
  await expect(page).toHaveURL(/#\/menu\?/, {timeout: 30_000}); await ready(page);
  expect(await saves(page)).toHaveLength(1);
});

test("tutorial overview is a five-chapter handbook with annotated detail figures and no save writes", async ({page}, info) => {
  test.setTimeout(120000);
  const failures = await observeArtifacts(page);
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await confirmNewGame(page, "战斗与探索教学");
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
