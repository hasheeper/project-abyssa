import { test, expect, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import manuscript from "../../src/content/presentation/scenes/tide-cave-chapter-one.json" with {type:"json"};
import { observeArtifacts } from "./helpers";
import { depart } from "./playable-helpers";

let archives: Record<string,string>;
test.beforeAll(async () => {
  test.setTimeout(180000);
  const outfile = resolve(projectRoot,"dist/reports/chapter-one/smoke-fixture.mjs");
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-client/testing/chapter-one.ts"],outfile,bundle:true,format:"esm",platform:"node",target:"es2022"});
  const fixture = await (await import(pathToFileURL(outfile).href)).chapterOneFixtures();
  archives = fixture.archives;
  expect(fixture.record.contentRef.contentVersion).toBe(12);
});

async function saved(page: Page): Promise<D5GameRecord> {
  return page.evaluate(async () => new Promise<any>((resolve,reject) => {
    const id = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    const open = indexedDB.open("abyssa-game-v1",1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, read = db.transaction("saves","readonly").objectStore("saves").get(id);
      read.onsuccess = () => {resolve(read.result);db.close();};
      read.onerror = () => {reject(read.error);db.close();};
    };
  }));
}
function run(record: D5GameRecord) {
  if (record.snapshot.run?.kind !== "expedition") throw Error("Expected tutorial expedition");
  return record.snapshot.run.state;
}
async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition",/.+/,{timeout:30000});
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status","ready");
  if (await page.locator(".scene-sequence").count()) await expect(page.locator(".scene-sequence")).toHaveAttribute("data-phase","idle");
}
async function load(page: Page, id: string) {
  await page.goto("/");
  await page.getByRole("button",{name:"记录",exact:true}).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档",{exact:true}).setInputFiles({name:`chapter-${id}.json`,mimeType:"application/json",buffer:Buffer.from(archives[id])});
  await expect(page).toHaveURL(id === "home" ? /#\/menu/ : /#\/(battle|mansion)/,{timeout:30000});
  await ready(page);
  if (id === "home") {
    await page.getByRole("button",{name:"府邸 · 回到守望者之崖洋馆",exact:true}).click();
    await expect(page).toHaveURL(/#\/mansion/,{timeout:30000});
    await ready(page);
  }
}
const frames = (id: string) => manuscript.nodes.filter(n => n.kind === "beat" && n.sectionId === id).flatMap(n => n.frames ?? []);
// Computed SVG paint and text colors are rgb(); check readability separately
// from the intentionally quiet contrast between structural surfaces.
function colorContrast(a: string, b: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n => {
      const value = n / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const [lighter,darker] = [luminance(a),luminance(b)].sort((x,y) => y-x);
  return (lighter+.05)/(darker+.05);
}

async function inventoryGridLayout(dialog: Locator, scale: number) {
  const layout = await dialog.evaluate(root => {
    const cells = [...root.querySelectorAll('[data-area="sandbox"] .resource-inventory__items > li')].map(cell => {
      const box = cell.getBoundingClientRect(), slot = cell.querySelector(".abyssa-item-slot")!.getBoundingClientRect();
      const name = cell.querySelector(".resource-inventory__name")!.getBoundingClientRect();
      return {x: box.x, y: box.y, height: box.height, slotY: slot.y, slotBottom: slot.bottom, nameY: name.y, nameHeight: name.height, nameBottom: name.bottom};
    });
    return {cells, footerY: root.querySelector(".resource-inventory__footer")!.getBoundingClientRect().y};
  });
  expect(layout.cells).toHaveLength(14);
  for (const cell of layout.cells) {
    expect(cell.height).toBeCloseTo(121 * scale, 1);
    expect(cell.nameHeight).toBeCloseTo(18 * scale, 1);
    expect(cell.nameY - cell.slotBottom).toBeCloseTo(11 * scale, 1);
  }
  expect(layout.cells[7].slotY - layout.cells[0].slotY).toBeCloseTo(135 * scale, 1);
  const bottomGap = layout.footerY - layout.cells[13].nameBottom;
  expect(bottomGap).toBeGreaterThanOrEqual(24 * scale);
  expect(bottomGap).toBeLessThanOrEqual(40 * scale);
  return layout;
}

async function reveal(page: Page, frame: {id:string;text:string}) {
  await expect(page.locator(".rp-app")).toHaveAttribute("data-frame-id",frame.id);
  const button = page.getByRole("button",{name:"显示全文",exact:true});
  if (await button.count()) await button.click();
  await expect(page.locator(".abyssa-dialogue__content")).toHaveText(frame.text.replaceAll("{{user}}","你"));
  await expect(page.locator(".abyssa-dialogue__content")).not.toContainText(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
  expect(await page.locator(".abyssa-dialogue__content").evaluate(n => n.scrollHeight <= n.clientHeight + 1 && n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  const background = frame.id.startsWith("S4-") ? "mansion-first-morning"
    : frame.id.startsWith("S3-1.") || frame.id.startsWith("S3-2.screen.1") || frame.id.startsWith("S3-5.screen.3.page.") ? "bg.tide-reef.shore"
    : frame.id.startsWith("S3-2.") || frame.id.startsWith("S3-3.") || frame.id === "S3-5.screen.3" ? "tidecall-grotto"
    : "bg.tide-reef.cargo";
  await expect(page.locator(".rp-adv__bg")).toHaveCSS("background-image", new RegExp(background.replaceAll(".", "\\.")));
}

async function expectBattleScenery(page: Page, background: string, location: string) {
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene","battle");
  await ready(page);
  await expect(page.locator(".abyssa-expedition")).toHaveAttribute("aria-busy","false");
  for (const selector of [".abyssa-expedition-enemies", ".abyssa-expedition-scene", ".battle-story-shell"]) {
    await expect.poll(() => page.locator(selector).evaluate(node => {
      const style = getComputedStyle(node);
      return `${style.backgroundImage} ${style.getPropertyValue("--manor-scene-image")}`;
    })).toContain(background);
  }
  await expect(page.locator(".abyssa-expedition-frame__header")).toContainText(location);
}

for (const [id,background,location] of [
  ["battle-1","bg.tide-reef.shore","雾滩·岩窟洞口"],
  ["battle-2","tidecall-grotto","退潮岩窟·洞内石阶"],
  ["event","tidecall-grotto","退潮岩窟·洞内石阶"],
  ["battle-3","tidecall-grotto","退潮岩窟·洞内石阶"],
  ["battle-4","bg.tide-reef.cargo","退潮岩窟·上层货台"],
]) test(`${id} scenery matches the story on entry and reload`, async ({page},info) => {
  test.setTimeout(60000);
  const errors = await observeArtifacts(page);
  await load(page,id);
  await expectBattleScenery(page,background,location);
  await page.screenshot({path:info.outputPath(`${id}.png`)});
  const before = await saved(page);
  await page.reload(); await ready(page);
  await expectBattleScenery(page,background,location);
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

for (const [id,background,location] of [
  ["S3-2","tidecall-grotto","退潮岩窟·洞内石阶"],
  ["S3-4","bg.tide-reef.cargo","退潮岩窟·上层货台"],
]) test(`${id} keeps AVG scenery through Continue into the next battle`, async ({page},info) => {
  test.setTimeout(60000);
  const errors = await observeArtifacts(page);
  await load(page,id);
  const source = frames(id);
  for (let i = 0; i < source.length; i++) {
    await reveal(page,source[i]);
    if (i < source.length - 1) await page.getByRole("button",{name:"下一句",exact:true}).click();
  }
  await expect(page.locator(".rp-adv__bg")).toHaveCSS("background-image",new RegExp(background.replaceAll(".","\\.")));
  await page.screenshot({path:info.outputPath(`${id}-avg.png`)});
  await page.getByRole("button",{name:id === "S3-4" ? "守住出口" : "继续",exact:true}).click();
  await expectBattleScenery(page,background,location);
  await page.screenshot({path:info.outputPath(`${id}-continue.png`)});
  await page.getByRole("button",{name:"继续前进",exact:true}).click();
  await expect.poll(async () => run(await saved(page)).node).toBe("battle");
  await expectBattleScenery(page,background,location);
  await page.screenshot({path:info.outputPath(`${id}-battle.png`)});
  const before = await saved(page);
  await page.reload(); await ready(page);
  await expectBattleScenery(page,background,location);
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("final-edition S3-1 restores its cursor, Chinese-only frames and offstage thoughts", async ({page},info) => {
  test.setTimeout(60000);
  const errors = await observeArtifacts(page);
  await load(page,"S3-1");
  const source = frames("S3-1");
  for (let i = 0; i < source.length; i++) {
    await reveal(page,source[i]);
    await expect(page.locator(".actor-performance__aside")).toHaveCount(0);
    await expect(page.locator('.rp-adv__actor[data-character="kael"]')).toHaveCount(0);
    if (i === 2) {
      const before = await saved(page);
      await page.reload(); await ready(page); await reveal(page,source[i]);
      expect(await saved(page)).toEqual(before);
    }
    if (i === 1) await page.screenshot({path:info.outputPath("norma-chinese.png")});
    await page.getByRole("button",{name:i === source.length - 1 ? "玩法总览" : "下一句",exact:true}).click();
  }
  await expect(page.getByRole("heading",{name:"战斗与探索规则总览"})).toBeVisible();
  expect(errors).toEqual([]);
});

test("Norma handles the real E1 roll and reload does not draw again", async ({page},info) => {
  test.setTimeout(60000);
  const errors = await observeArtifacts(page);
  await load(page,"event");
  const observation = page.locator('.abyssa-tutorial[data-observation="true"]');
  if (await observation.count()) await observation.locator(".abyssa-tutorial__next").click();
  const before = await saved(page);
  await expect(page.locator('.abyssa-tutorial[data-visible="true"]')).toContainText("诺玛");
  const norma = page.locator('[data-tutorial-anchor="battle.member:norma"]');
  await norma.press("Enter");
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button",{name:"ROLL",exact:true}).click();
  await expect(page.getByRole("button",{name:"确认结果",exact:true})).toBeEnabled({timeout:15000});
  const after = await saved(page);
  expect(run(after).run.eventResults).toMatchObject([{actorId:"norma",faceId:"face.norma.01",method:"strong",cost:0,reward:0}]);
  expect(run(after).run.eventRng).toMatchObject({seed:7,cursor:1});
  expect(run(after).run.party).toEqual(run(before).run.party);
  expect(run(after).run.supplies).toEqual(run(before).run.supplies);
  await page.screenshot({path:info.outputPath("norma-event.png")});
  await page.reload(); await ready(page);
  expect(run(await saved(page)).run.eventRng).toEqual(run(after).run.eventRng);
  await page.getByRole("button",{name:"确认结果",exact:true}).click(); await ready(page);
  expect(run(await saved(page)).run.eventRng.cursor).toBe(1);
  expect(errors).toEqual([]);
});

for (const id of ["S3-2","S3-3","S3-4","S3-5"]) test(`${id} preserves every Chinese-only frame within the shared stage`, async ({page},info) => {
  test.setTimeout(60000);
  const errors = await observeArtifacts(page);
  await load(page,id);
  const source = frames(id);
  for (let i = 0; i < source.length; i++) {
    await reveal(page,source[i]);
    if (i === 0 || ["S3-2.screen.2", "S3-5.screen.3", "S3-5.screen.3.page.1"].includes(source[i].id)) {
      await page.screenshot({path:info.outputPath(`${source[i].id}-background.png`)});
    }
    if (["S3-2.screen.2", "S3-5.screen.3.page.1"].includes(source[i].id)) {
      const before = await saved(page);
      await page.reload(); await ready(page); await reveal(page,source[i]);
      expect(await saved(page)).toEqual(before);
    }
    await expect(page.locator(".actor-performance__aside")).toHaveCount(0);
    await expect(page.locator('.rp-adv__actor[data-character="kael"]')).toHaveCount(0);
    if (i < source.length - 1) await page.getByRole("button",{name:"下一句",exact:true}).click();
  }
  await page.screenshot({path:info.outputPath(`${id}-last-frame.png`)});
  expect(errors).toEqual([]);
});

for (const id of ["S3-2","S3-5"]) test(`${id} changes scenery only behind black and blocks rapid reading input`, async ({page},info) => {
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  const errors = await observeArtifacts(page);
  await load(page,id);
  const before = await saved(page), source = frames(id);
  const boundaries = ["S3-2.screen.2", "S3-5.screen.3", "S3-5.screen.3.page.1"];
  for (let i = 0; i < source.length; i++) {
    await reveal(page,source[i]);
    if (i === source.length - 1) break;
    const incoming = source[i + 1];
    if (!boundaries.includes(incoming.id)) {
      await page.getByRole("button",{name:"下一句",exact:true}).click();
      await expect(page.locator(".scene-sequence__curtain")).toHaveCount(0);
      continue;
    }
    await page.screenshot({path:info.outputPath(`${incoming.id}-before.png`)});
    const sampling = page.evaluate(() => new Promise<{phase:string;frame:string;background:string;opacity:number;inert:boolean;locked:boolean}[]>(resolve => {
      const root = document.querySelector<HTMLElement>(".scene-sequence")!;
      const samples: {phase:string;frame:string;background:string;opacity:number;inert:boolean;locked:boolean}[] = [];
      const started = performance.now();
      const sample = () => {
        const curtain = root.querySelector(".scene-sequence__curtain");
        const phase = root.dataset.phase!;
        const next = root.querySelector<HTMLButtonElement>(".rp-app__cue")!;
        const skip = root.querySelector<HTMLButtonElement>('[aria-label="跳过本段对白"]')!;
        samples.push({phase, frame:root.querySelector<HTMLElement>(".rp-app")!.dataset.frameId!,
          background:getComputedStyle(root.querySelector(".rp-adv__bg")!).backgroundImage,
          opacity:curtain ? Number(getComputedStyle(curtain).opacity) : 0,
          inert:root.querySelector<HTMLElement>(".scene-sequence__frame")!.inert, locked:next.disabled && skip.disabled});
        if (phase !== "idle") {
          // The disabled rail, stage click and keyboard must all leave the incoming cursor alone.
          next.click(); skip.click();
          const stage = root.querySelector<HTMLElement>(".rp-app__stage")!;
          stage.click(); stage.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
        }
        if ((phase !== "idle" || samples.length === 1) && performance.now() - started < 5000) requestAnimationFrame(sample);
        else resolve(samples);
      };
      root.querySelector<HTMLButtonElement>(".rp-app__cue")!.click();
      requestAnimationFrame(sample);
    }));
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".scene-sequence")?.dataset.phase === "covered", undefined, {polling:"raf"});
    await page.screenshot({path:info.outputPath(`${incoming.id}-black.png`)});
    const samples = await sampling;
    await info.attach(`${incoming.id}-curtain-samples`,{body:JSON.stringify(samples,null,2),contentType:"application/json"});
    expect([...new Set(samples.map(frame => frame.phase))]).toEqual(["cover","covered","uncover","idle"]);
    for (const frame of samples) {
      expect(frame.frame).toBe(frame.phase === "cover" ? source[i].id : incoming.id);
      if (frame.phase !== "idle") expect(frame.inert && frame.locked).toBe(true);
      if (frame.phase === "covered") expect(frame.opacity).toBe(1);
    }
    const firstChanged = samples.findIndex(frame => frame.frame === incoming.id);
    expect(samples[firstChanged]).toMatchObject({phase:"covered",opacity:1});
    expect(samples[firstChanged].background).not.toBe(samples[0].background);
    expect(samples.filter(frame => frame.phase === "cover").every(frame => frame.background === samples[0].background)).toBe(true);
    expect(samples.some(frame => frame.phase === "cover" && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
    expect(samples.some(frame => frame.phase === "uncover" && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
    await expect(page.locator(".scene-sequence__curtain")).toHaveCount(0);
    await reveal(page,incoming);
    await page.screenshot({path:info.outputPath(`${incoming.id}-after.png`)});
  }
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("S4-1 ends the chapter, claims once and hands off to the unobstructed journal", async ({page},info) => {
  test.setTimeout(90000);
  const errors = await observeArtifacts(page);
  await load(page,"S4-1");
  const source = frames("S4-1");
  for (let i = 0; i < source.length; i++) {
    await reveal(page,source[i]);
    if (i === source.length - 1) await page.screenshot({path:info.outputPath("blanket-ending.png")});
    await page.getByRole("button",{name:i === source.length - 1 ? "完成阅读" : "下一句",exact:true}).click();
  }
  await expect(page.getByRole("button",{name:"领取并返回洋馆",exact:true})).toBeEnabled();
  expect(run(await saved(page)).tutorial!.readStoryIds).toEqual(["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1"]);
  await page.getByRole("button",{name:"领取并返回洋馆",exact:true}).dblclick();
  await expect(page).toHaveURL(/#\/mansion/); await ready(page);
  await expect(page.locator(".mansion-app")).toHaveAttribute("data-presentation","ready");
  await expect(page.getByRole("dialog",{name:"日志"})).toHaveCount(0);
  await expect(page.locator(".mansion-world-art")).toHaveCount(1);
  await expect(page.locator(".mansion-app canvas")).toHaveCount(0);
  const home = await saved(page);
  expect(home.snapshot.campaign.funds.party).toBe(44);
  expect(home.snapshot.campaign.settlements).toHaveLength(1);
  const trigger = page.getByRole("button",{name:"日志",exact:true});
  await trigger.click();
  await expect(page.locator(".mansion-viewport")).toHaveAttribute("inert","");
  await expect(page.getByRole("dialog",{name:"日志"})).toContainText("古籍与旧毛毯");
  await expect(page.getByTestId("journal-expedition-gold")).toHaveText("36 G");
  await expect(page.getByTestId("journal-credit-quest")).toHaveText("8 G");
  await expect(page.getByTestId("journal-total-gold")).toHaveText("44 G");
  await page.screenshot({path:info.outputPath("return-journal.png")});
  await page.locator(".journal-browser__reader").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button",{name:"关闭日志"})).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".journal-browser__reader")).toBeFocused();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  const preparationTrigger = page.getByRole("button",{name:"整备",exact:true});
  await preparationTrigger.click();
  await expect(page.getByRole("dialog",{name:"整备"})).toBeVisible();
  await expect(page.getByTestId("campaign-funds").getByRole("img", {name: "小队金币 44"})).toBeVisible();
  await page.keyboard.press("Escape"); await expect(preparationTrigger).toBeFocused();
  await page.reload(); await ready(page);
  expect((await saved(page)).snapshot.campaign).toEqual(home.snapshot.campaign);
  await page.setViewportSize({width:800,height:450});
  await trigger.click();
  const bounds = (await page.getByRole("dialog",{name:"日志"}).boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(450);
  await page.screenshot({path:info.outputPath("journal-small-stage.png")});
  expect(errors).toEqual([]);
});

test("journal and preparation use independent right-rail seals and original modal chrome at both stage sizes", async ({page}, info) => {
  test.setTimeout(90000);
  const errors = await observeArtifacts(page);
  await load(page,"home");
  await expect(page.locator(".mansion-app")).toHaveAttribute("data-presentation","ready");
  const before = await saved(page);
  for (const [width,height] of [[1600,900],[800,450]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator(".mansion-stage-canvas")).toHaveCSS("--abyssa-stage-scale",String(width/1600));
    const rail = page.getByRole("navigation",{name:"洋馆功能"});
    const buttons = rail.getByRole("button");
    await expect(buttons).toHaveCount(3);
    const boxes = [];
    for (const name of ["仓库","日志","整备"]) {
      const button = rail.getByRole("button",{name,exact:true});
      const box = (await button.boundingBox())!, icon = (await button.locator("img").boundingBox())!;
      boxes.push(box);
      expect(box.x).toBeGreaterThan(width*.9);
      expect(Math.abs(icon.x+icon.width/2-box.x-box.width/2)).toBeLessThan(.6);
      expect(Math.abs(icon.y+icon.height/2-box.y-box.height/2)).toBeLessThan(.6);
      expect(await button.locator("img").evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth>0)).toBe(true);
      await expect(button.locator("svg")).toHaveAttribute("viewBox","0 0 56 56");
      await expect(button).toHaveCSS("height","56px");
    }
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y+boxes[0].height);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y+boxes[1].height);
    const ledger = (await page.locator(".mansion-ledger").boundingBox())!;
    expect(boxes[0].y).toBeGreaterThan(ledger.y+ledger.height);
    await expect(page.locator(".campaign-journal-entry")).toHaveCount(0);
    let sharedBounds: {x: number; y: number; width: number; height: number} | undefined;
    let sharedTitleBounds: {centerX: number; y: number; height: number} | undefined;
    let sharedCloseBounds: typeof sharedBounds;
    for (const name of ["仓库","日志","整备"]) {
      const trigger = rail.getByRole("button",{name,exact:true});
      await trigger.click();
      const dialog = page.getByRole("dialog",{name:name === "仓库" ? "领地库存" : name,exact:true});
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(page.locator(".mansion-viewport")).toHaveAttribute("inert","");
      await expect(page.locator(".mansion-corner--phase")).toHaveAttribute("inert","");
      await expect(page.locator(".mansion-utility-rail")).toHaveAttribute("inert","");
      await expect(dialog.getByRole("tablist")).toHaveCount(0);
      await expect(dialog.locator(".abyssa-modal__close > svg")).toHaveCount(1);
      await expect(dialog.locator(".abyssa-modal__signboard")).toHaveCount(1);
      await expect(dialog.locator(".abyssa-modal__signboard")).toHaveAttribute("data-variant","slim");
      await expect(dialog.locator(".abyssa-nameplate__content")).toHaveCSS("min-height","40px");
      await expect(dialog.locator(".abyssa-nameplate__content strong")).toHaveCSS("color","rgb(238, 227, 199)");
      expect(await dialog.locator(":scope > .abyssa-frame").evaluate(node => getComputedStyle(node,"::before").backgroundColor)).toBe("rgba(19, 26, 27, 0.97)");
      expect(await page.locator(".mansion-app").evaluate(node => getComputedStyle(node).getPropertyValue("--abyssa-text").trim())).toBe("#edf0f0");
      const box = (await dialog.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(height);
      expect(box.width).toBeCloseTo(1080 * width / 1600, 1);
      expect(box.height).toBeCloseTo(620 * width / 1600, 1);
      sharedBounds ??= box;
      expect(box).toEqual(sharedBounds);
      const titleBounds = (await dialog.locator(".abyssa-modal__signboard").boundingBox())!;
      const closeBounds = (await dialog.locator(".abyssa-modal__close").boundingBox())!;
      const titleAnchor = {centerX: titleBounds.x + titleBounds.width / 2, y: titleBounds.y, height: titleBounds.height};
      sharedTitleBounds ??= titleAnchor;
      sharedCloseBounds ??= closeBounds;
      expect(titleAnchor).toEqual(sharedTitleBounds);
      expect(closeBounds).toEqual(sharedCloseBounds);
      const body = dialog.locator(":scope > .abyssa-frame > .abyssa-frame__content > .abyssa-modal__body");
      const bodySize = await body.evaluate(node => ({width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight}));
      expect(bodySize.scrollWidth, `${name} body width`).toBeLessThanOrEqual(bodySize.width + 1);
      // Text ink can exceed its line box; the content and footer layout boxes
      // must still fit inside the shared shell without clipping or stretching it.
      const bodyBounds = (await body.boundingBox())!;
      for (const child of await body.locator(":scope > *").all()) {
        const childBounds = (await child.boundingBox())!;
        expect(childBounds.y + childBounds.height, `${name} content bottom`).toBeLessThanOrEqual(bodyBounds.y + bodyBounds.height + 1);
      }
      if (name === "日志") {
        await dialog.getByRole("button",{name:"查看记录：岩窟货物已追回",exact:true}).click();
        await expect(dialog.getByRole("article",{name:"岩窟货物已追回",exact:true})).toBeVisible();
        await expect(dialog.getByRole("navigation",{name:"日志条目",exact:true})).toBeVisible();
        await expect(dialog.getByRole("region",{name:"出征补给整备"})).toHaveCount(0);
        await expect(page.getByTestId("journal-total-gold")).toHaveText("44 G");
        await expect(dialog.locator('.journal-browser__entries button[aria-current="true"]')).toHaveCSS("border-left-color","rgb(185, 162, 113)");
        await expect(page.getByTestId("journal-total-gold")).toHaveCSS("color","rgb(224, 198, 127)");
        const record = dialog.getByRole("region",{name:"远征归来",exact:true});
        await expect(record.getByText("已结算",{exact:true})).toHaveCount(1);
        await expect(record.locator("header .campaign-journal__depth")).toHaveText("最深抵达 第 1 层");
        const layout = await record.evaluate(node => {
          const rect = (selector: string) => {
            const box = node.querySelector(selector)!.getBoundingClientRect();
            return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,width:box.width};
          };
          return {heading:rect(".journal-record__heading"), title:rect("h3"), depth:rect(".campaign-journal__depth"),
            notes:rect(".campaign-journal__return-notes"), receipt:rect(".campaign-journal__settlement"),
            amounts:[...node.querySelectorAll(".campaign-journal__amount")].map(amount => {
              const value = amount.querySelector("span")!.getBoundingClientRect(), unit = amount.querySelector("small")!.getBoundingClientRect();
              return {valueRight:value.right,unitX:unit.x,unitWidth:unit.width};
            })};
        });
        const scale = width/1600;
        expect(layout.receipt.x).toBeCloseTo(layout.heading.x,1);
        expect(layout.receipt.right).toBeCloseTo(layout.heading.right,1);
        expect(layout.notes.x).toBeCloseTo(layout.heading.x,1);
        expect(layout.depth.right).toBeCloseTo(layout.heading.right,1);
        expect(layout.depth.x-layout.title.right).toBeGreaterThanOrEqual(24*scale-.1);
        expect(layout.notes.y-layout.heading.bottom).toBeCloseTo(24*scale,1);
        expect(layout.receipt.y-layout.notes.bottom).toBeCloseTo(24*scale,1);
        for (const amount of layout.amounts) {
          expect(amount.valueRight).toBeCloseTo(layout.amounts[0].valueRight,1);
          expect(amount.unitX).toBeCloseTo(layout.amounts[0].unitX,1);
          expect(amount.unitWidth).toBeCloseTo(12*scale,1);
        }
        await page.screenshot({path:info.outputPath(`journal-reading-${width}.png`)});
        const content = dialog.locator(".campaign-journal__page");
        await expect(content.locator(".abyssa-frame")).toHaveCount(0);
        await expect(dialog.getByRole("article")).toHaveCount(1);
        expect(await content.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
        const index = dialog.getByRole("navigation",{name:"日志条目",exact:true});
        await expect(index).toHaveClass(/manor-utility__inset/);
        await expect(index).toHaveCSS("background-color", "rgba(6, 11, 12, 0.52)");
        await expect(index.locator(":scope > .journal-browser__entries")).toHaveCount(1);
        await expect(index.getByRole("heading")).toHaveCount(0);
        await expect(index.locator("section")).toHaveCount(0);
        const rows = await index.locator("button[data-journal-entry]").evaluateAll(nodes => nodes.map(node => {
          const rect = node.getBoundingClientRect(), icon = node.querySelector("img")!.getBoundingClientRect();
          const title = node.querySelector("strong")!, meta = node.querySelector("small")!;
          return {x:rect.x, y:rect.y, width:rect.width, height:rect.height, iconX:icon.x,
            iconCenter:icon.y+icon.height/2-rect.y, titleX:title.getBoundingClientRect().x,
            metaX:meta.getBoundingClientRect().x, titleY:title.getBoundingClientRect().y-rect.y,
            titleSize:getComputedStyle(title).fontSize, metaSize:getComputedStyle(meta).fontSize,
            fits:title.scrollWidth<=title.clientWidth+1 && meta.scrollWidth<=meta.clientWidth+1,
            locked:node.hasAttribute("data-locked")};
        }));
        expect(rows.some(row=>row.locked)).toBe(true);
        expect(rows.some(row=>!row.locked)).toBe(true);
        for (const [i,row] of rows.entries()) {
          const scale = width/1600;
          expect(row.height).toBeCloseTo(76*scale,1);
          expect(row.x).toBeCloseTo(rows[0].x,1);
          expect(row.width).toBeCloseTo(rows[0].width,1);
          expect(row.iconX).toBeCloseTo(rows[0].iconX,1);
          expect(row.iconCenter).toBeCloseTo(row.height/2,1);
          expect(row.titleX).toBeCloseTo(rows[0].titleX,1);
          expect(row.metaX).toBeCloseTo(row.titleX,1);
          expect(row.titleY).toBeCloseTo(rows[0].titleY,1);
          expect(row.titleSize).toBe("17px"); expect(row.metaSize).toBe("12px");
          expect(row.fits).toBe(true);
          if (i) expect(row.y-rows[i-1].y-rows[i-1].height).toBeCloseTo(4*scale,1);
        }
        await dialog.getByRole("button",{name:"查看记录：停下来的钟声",exact:true}).click();
        await expect(dialog.getByText("完成庄园首通及家宴落幕后开放。",{exact:true})).toBeVisible();
        await expect(index.locator('button[data-locked][aria-current="true"]')).toHaveCSS("height","76px");
        await page.screenshot({path:info.outputPath(`journal-locked-${width}.png`)});
      }
      if (name === "整备") {
        const content = dialog.locator(".campaign-journal__page");
        await expect(content).toHaveCSS("height", "556px");
        await expect(dialog.getByRole("heading",{name:"同伴近况"})).toHaveCount(0);
        await expect(content.locator(".journal-surface")).toHaveCount(0);
        await expect(content.locator(".abyssa-item-slot[data-rarity]")).toHaveCount(0);
        await expect(content.locator(".abyssa-item-slot__badge")).toHaveCount(0);
        for (const slot of await content.locator(".abyssa-item-slot").all()) await expect(slot).toHaveAttribute("data-tone", "interface");
        const inset = content.locator(".departure-preparation__inventory.manor-utility__inset");
        await expect(content.locator(".manor-utility__inset")).toHaveCount(1);
        await expect(inset.locator(".departure-preparation__group")).toHaveCount(2);
        await expect(inset).toHaveCSS("border-top-width", "1px");
        await expect(inset).toHaveCSS("background-color", "rgba(6, 11, 12, 0.52)");
        const groups = await inset.locator(".departure-preparation__group").all();
        const upperGroup = (await groups[0].boundingBox())!, lowerGroup = (await groups[1].boundingBox())!;
        expect(lowerGroup.y - upperGroup.y - upperGroup.height).toBeCloseTo(48 * width / 1600, 1);
        for (const group of await content.locator(".departure-preparation__group").all()) {
          await expect(group).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
          await expect(group).toHaveCSS("box-shadow", "none");
        }
        for (const art of await content.locator(".departure-preparation__item-art:has(.abyssa-item-count)").all()) {
          const slot = (await art.locator(".abyssa-item-slot").boundingBox())!, badge = (await art.locator(".abyssa-item-count").boundingBox())!;
          expect(badge.x + badge.width - slot.x - slot.width).toBeCloseTo(5 * width / 1600, 1);
          expect(badge.y + badge.height - slot.y - slot.height).toBeCloseTo(5 * width / 1600, 1);
        }
        const carryNames = content.locator(".departure-preparation__loadout .departure-preparation__item-name");
        await expect(carryNames).toHaveCount(6);
        const nameBoxes = await carryNames.evaluateAll(nodes => nodes.map(node => {
          const box = node.getBoundingClientRect(); return {y: box.y, height: box.height};
        }));
        for (const box of nameBoxes) expect(box).toEqual(nameBoxes[0]);
        for (const label of await content.locator(".departure-preparation__item-name").all()) await expect(label).toHaveCSS("border-bottom-width", "0px");
        await expect(content.locator(".departure-preparation__catalogue .departure-preparation__item-name")).toHaveCount(0);
        const slotRows = [];
        for (const rowClass of ["departure-preparation__loadout", "departure-preparation__catalogue"]) {
          const slots = await content.locator(`.${rowClass} .abyssa-item-slot`).evaluateAll(nodes => nodes.map(node => {
            const box = node.getBoundingClientRect(); return {x: box.x, y: box.y, right: box.right, bottom: box.bottom};
          }));
          for (let i = 1; i < slots.length; i++) {
            expect(slots[i].y).toBeCloseTo(slots[0].y, 1);
            expect(slots[i].x - slots[i - 1].right).toBeCloseTo(slots[1].x - slots[0].right, 1);
          }
          slotRows.push(slots);
        }
        expect(slotRows[0][0].x).toBeCloseTo(slotRows[1][0].x, 1);
        expect(slotRows[0].at(-1)!.right).toBeCloseTo(slotRows[1].at(-1)!.right, 1);
        const insetBounds = (await inset.boundingBox())!;
        const stockClearance = (insetBounds.y + insetBounds.height - slotRows[1][0].bottom) / (width / 1600);
        expect(stockClearance).toBeGreaterThanOrEqual(24);
        expect(stockClearance).toBeLessThanOrEqual(44);
        const mainBounds = (await content.locator(".departure-preparation__main").boundingBox())!;
        expect(insetBounds.width / mainBounds.width).toBeGreaterThan(.74);
        await expect(content.locator(".departure-preparation__detail")).toHaveCSS("width", "224px");
        expect(insetBounds.y).toBeCloseTo(mainBounds.y, 1);
        const footerTop = (await content.locator(".departure-preparation__footer").boundingBox())!.y;
        const footerClearance = (footerTop - insetBounds.y - insetBounds.height) / (width / 1600);
        expect(footerClearance).toBeGreaterThanOrEqual(24);
        expect(footerClearance).toBeLessThanOrEqual(40);
        expect(slotRows[0][0].x - insetBounds.x).toBeGreaterThanOrEqual(24 * width / 1600);
        expect(insetBounds.x + insetBounds.width - slotRows[1].at(-1)!.right).toBeGreaterThanOrEqual(24 * width / 1600);
        await page.screenshot({path:info.outputPath(`preparation-overview-${width}.png`)});
        const carry = (await content.locator(".departure-preparation__loadout .abyssa-item-slot").first().boundingBox())!;
        const stock = (await content.locator(".departure-preparation__catalogue .abyssa-item-slot").first().boundingBox())!;
        expect(carry.width).toBeCloseTo(108 * width / 1600, 1);
        expect(stock.width).toBeCloseTo(80 * width / 1600, 1);
        expect(carry.width/stock.width).toBeGreaterThan(1.3);
        const stableAction = await content.getByRole("complementary",{name:"补给详情"}).getByRole("button").boundingBox();
        for (const item of ["食物","药水","护符","圣水","保养工具","幸运符","卦签"]) {
          await content.getByRole("button",{name:`查看${item}详情`}).click();
          const detail = content.getByRole("complementary",{name:"补给详情"});
          await expect(detail).toHaveCSS("border-left-width", "0px");
          const detailBox = (await detail.boundingBox())!, nameBox = (await detail.getByRole("heading",{name:item,exact:true}).boundingBox())!;
          expect(nameBox.x+nameBox.width).toBeLessThanOrEqual(detailBox.x+detailBox.width);
          const actionBox = (await detail.getByRole("button").boundingBox())!;
          expect(actionBox).toEqual(stableAction);
          expect(actionBox.y+actionBox.height).toBeLessThanOrEqual(detailBox.y+detailBox.height);
          expect(await content.evaluate(n=>n.scrollWidth<=n.clientWidth+1 && n.scrollHeight<=n.clientHeight+1)).toBe(true);
        }
        const actions = content.getByRole("navigation",{name:"整备操作"}).getByRole("link");
        await expect(actions).toHaveCount(3);
        const primary = actions.last();
        expect(await primary.evaluate(node => getComputedStyle(node).getPropertyValue("--abyssa-notched-middle").trim())).toBe("#88784f");
        await expect(content.getByRole("navigation", {name: "整备操作"}).locator(".journal-action__art")).toHaveCount(1);
        await expect(primary.locator(".journal-action__art svg")).toHaveAttribute("viewBox", "0 0 190 48");
        await expect(primary.locator("svg text")).toHaveCount(0);
        // Enter keyboard modality before checking :focus-visible styling.
        await page.keyboard.press("Tab");
        for (const action of await content.locator(".departure-preparation__aux-link").all()) {
          await expect(action.locator("svg")).toHaveCount(0);
          await expect(action).toHaveCSS("height","40px");
          await expect(action).toHaveCSS("border-top-width", "0px");
          await expect(action.locator("i")).not.toHaveCSS("mask-image", "none");
          expect(colorContrast(await action.evaluate(node => getComputedStyle(node).color), "rgb(19, 26, 27)")).toBeGreaterThanOrEqual(4.5);
          await action.focus();
          await expect(action).toHaveCSS("outline-style", "solid");
        }
        expect(stableAction!.width / (width / 1600)).toBeCloseTo(144, 1);
        const balances = content.getByTestId("campaign-funds").getByRole("img");
        await expect(balances).toHaveCount(3);
        for (const balance of await balances.all()) {
          const hint = balance.locator(".departure-preparation__balance-hint");
          await expect(hint).toBeHidden();
          await balance.focus();
          await expect(hint).toBeVisible();
          await primary.focus();
          await expect(hint).toBeHidden();
          await balance.hover();
          await expect(hint).toBeVisible();
          await primary.hover();
          await expect(hint).toBeHidden();
        }
        await expect(content.getByTestId("campaign-funds").locator('i[data-icon="custom"]')).not.toHaveCSS("mask-image", "none");
        await content.getByRole("heading", {name: "出征行囊"}).click();
        const contentBox = (await content.boundingBox())!, footer = (await content.locator(".departure-preparation__footer").boundingBox())!;
        expect(footer.y+footer.height).toBeLessThanOrEqual(contentBox.y+contentBox.height+1);
      }
      if (name === "仓库") {
        const overview = dialog.locator(".resource-inventory__overview");
        await expect(dialog.locator(".resource-inventory__detail")).toHaveCount(0);
        await expect(dialog.locator(".resource-inventory__column")).toHaveCount(0);
        await expect(dialog.getByRole("gridcell")).toHaveCount(0);
        await expect(dialog.locator("[data-resource-item]")).toHaveCount(7);
        await expect(dialog.getByRole("heading", {name: "常备补给", exact: true})).toBeVisible();
        await expect(dialog.getByRole("heading", {name: "物品库存", exact: true})).toBeVisible();
        await expect(dialog.getByRole("heading", {name: /^(装备|材料|文书)$/})).toHaveCount(0);
        await expect(dialog.locator('[data-area="fixed"] [data-resource-item]')).toHaveCount(7);
        await expect(dialog.locator('[data-area="sandbox"] [data-resource-item]')).toHaveCount(0);
        await expect(dialog.getByText("尚未存放其他物品", {exact: true})).toHaveCount(0);
        await expect(dialog.locator('[data-area="fixed"] .resource-inventory__name')).toHaveCount(0);
        await expect(dialog.locator('[data-area="fixed"] [data-rarity]')).toHaveCount(0);
        await expect(dialog.locator(".resource-inventory__quantity")).toHaveCount(0);
        const pager = dialog.getByRole("navigation", {name: "物品库存分页"});
        await expect(pager.getByRole("status")).toHaveText("1 / 1");
        await expect(pager.getByRole("button", {name: "上一页"})).toBeDisabled();
        await expect(pager.getByRole("button", {name: "下一页"})).toBeDisabled();
        const sockets = dialog.locator('[data-area="sandbox"] [data-placeholder] .abyssa-item-slot[data-empty]');
        await expect(sockets).toHaveCount(14);
        for (const socket of await sockets.all()) await expect(socket).toBeVisible();
        await inventoryGridLayout(dialog, width / 1600);
        expect(await dialog.locator('[data-area="sandbox"] .resource-inventory__contents').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
        expect(await overview.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
        const tiles = dialog.locator(".resource-inventory__item.abyssa-item-slot");
        await expect(tiles).toHaveCount(7);
        for (const tile of await tiles.all()) {
          await expect(tile.locator("[data-layer]")).toHaveCount(6);
          await expect(tile).toHaveCSS("width", "92px");
          await expect(tile).toHaveAttribute("data-tone", "interface");
          expect(await tile.evaluate(node => getComputedStyle(node).getPropertyValue("--item-rarity").trim())).not.toBe("#875126");
          await expect(tile.locator("img")).toHaveCount(0);
          const socket = (await tile.boundingBox())!, icon = (await tile.locator('[data-layer="glyph"]').boundingBox())!;
          expect(icon.x + icon.width / 2).toBeCloseTo(socket.x + socket.width / 2, 1);
          expect(icon.y + icon.height / 2).toBeCloseTo(socket.y + socket.height / 2, 1);
          const badge = (await tile.locator("..").locator(".resource-inventory__badge").boundingBox())!;
          expect(badge.x + badge.width - socket.x - socket.width).toBeCloseTo(5 * width / 1600, 1);
          expect(badge.y + badge.height - socket.y - socket.height).toBeCloseTo(5 * width / 1600, 1);
          expect(await tile.locator('[data-layer="glyph"]').evaluate(async node => {
            const url = getComputedStyle(node).maskImage.match(/url\("?(.+?)"?\)/)?.[1];
            if (!url) return false;
            const image = new Image(); image.src = url; await image.decode(); return image.naturalWidth > 0;
          })).toBe(true);
        }
        const row = await tiles.evaluateAll(nodes => nodes.map(node => {
          const rect = node.getBoundingClientRect(); return {x: rect.x, y: rect.y};
        }));
        for (let i = 1; i < row.length; i++) {
          expect(row[i].y).toBeCloseTo(row[0].y, 1);
          expect(row[i].x - row[i - 1].x).toBeCloseTo(row[1].x - row[0].x, 1);
        }
        await page.screenshot({path: info.outputPath(`stock-overview-${width}.png`)});
        for (const [id, item, effect] of [["item.food", "食物", "恢复 1 点生命"], ["item.potion", "药水", "恢复 2 点生命"], ["item.lucky-charm", "幸运符", "增加一次重掷"]]) {
          const quantity = before.snapshot.campaign.supplies.find(supply => supply.definitionId === id)?.charges ?? 0;
          const tile = dialog.getByRole("button", {name: `查看${item}详情，${quantity}份`, exact: true});
          await tile.click();
          const detail = dialog.getByRole("region", {name: `${item}详情`, exact: true});
          await expect(detail).toBeVisible();
          await expect(detail.getByRole("heading", {name: item, exact: true})).toBeVisible();
          await expect(detail.getByText(effect, {exact: true})).toBeVisible();
          await expect(detail.getByRole("button")).toHaveCount(1);
          const root = (await dialog.locator(".resource-inventory").boundingBox())!, detailBox = (await detail.boundingBox())!;
          const close = detail.getByRole("button", {name: "收起物品详情"});
          await expect(close).toHaveCSS("position", "absolute");
          await expect(close).toHaveCSS("width", "28px");
          const closeBox = (await close.boundingBox())!, titleBox = (await detail.getByRole("heading").boundingBox())!;
          expect(closeBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
          expect(closeBox.y - detailBox.y).toBeCloseTo(9 * width / 1600, 1);
          // Unused space below the provision row should be used first.
          for (const resource of await dialog.locator(".resource-inventory__items > li:not([data-placeholder])").all()) {
            const resourceBox = (await resource.boundingBox())!;
            const overlapWidth = Math.max(0, Math.min(detailBox.x + detailBox.width, resourceBox.x + resourceBox.width) - Math.max(detailBox.x, resourceBox.x));
            const overlapHeight = Math.max(0, Math.min(detailBox.y + detailBox.height, resourceBox.y + resourceBox.height) - Math.max(detailBox.y, resourceBox.y));
            expect(overlapWidth * overlapHeight).toBe(0);
          }
          expect(detailBox.x).toBeGreaterThanOrEqual(root.x - 1);
          expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(root.x + root.width + 1);
          expect(detailBox.y).toBeGreaterThanOrEqual(root.y - 1);
          expect(detailBox.y + detailBox.height).toBeLessThanOrEqual(root.y + root.height + 1);
          if (item === "药水") await page.screenshot({path: info.outputPath(`stock-detail-${width}.png`)});
          await page.keyboard.press("Escape");
          await expect(detail).toHaveCount(0);
          await expect(dialog).toBeVisible();
          await expect(tile).toBeFocused();
        }
      }
      if (name !== "日志") await page.screenshot({path:info.outputPath(`utility-${name}-${width}.png`)});
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(page.locator(".mansion-viewport")).not.toHaveAttribute("inert","");
    }
  }
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("resource inventory paginates populated sandbox pages with corner counts at both stage sizes", async ({page}, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = await build({
    absWorkingDir: projectRoot, entryPoints: ["tests/smoke/fixtures/resource-inventory.tsx"],
    outfile: "dist/reports/resource-inventory-fixture.js", bundle: true, write: false,
    format: "iife", platform: "browser", target: "es2022", jsx: "automatic",
    define: {"process.env.NODE_ENV": '"production"'}, loader: {".svg": "base64"},
  });
  await page.goto("about:blank");
  await page.setContent('<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{background:#101616}</style><div id="root"></div>');
  await page.addStyleTag({content: fixture.outputFiles.find(file => file.path.endsWith(".css"))!.text});
  await page.addScriptTag({content: fixture.outputFiles.find(file => file.path.endsWith(".js"))!.text});
  const dialog = page.getByRole("dialog", {name: "领地库存"});
  const pager = dialog.getByRole("navigation", {name: "物品库存分页"});
  // SVG masks must survive the fixture bundle's data URL encoding too.
  await expect(dialog.locator('[data-layer="glyph"]').first()).not.toHaveCSS("mask-image", "none");
  for (const [width, height] of [[1600, 900], [800, 450]]) {
    await page.setViewportSize({width, height});
    await expect(page.locator(".abyssa-stage__canvas")).toHaveCSS("--abyssa-stage-scale", String(width / 1600));
    const fixed = await dialog.locator('[data-area="fixed"]').boundingBox();
    const fullLayout = await inventoryGridLayout(dialog, width / 1600);
    for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
      await expect(pager.getByRole("status")).toHaveText(`${pageIndex + 1} / 3`);
      const inventory = dialog.locator('[data-area="sandbox"]');
      await expect(inventory.locator(".resource-inventory__items > li")).toHaveCount(14);
      await expect(inventory.locator("[data-resource-item]")).toHaveCount(pageIndex === 2 ? 3 : 14);
      const content = inventory.locator(".resource-inventory__contents");
      expect(await content.evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      expect(await dialog.locator('[data-area="fixed"]').boundingBox()).toEqual(fixed);
      expect(await inventoryGridLayout(dialog, width / 1600)).toEqual(fullLayout);
      for (const tile of await inventory.locator(".resource-inventory__art").all()) {
        const slot = (await tile.locator(".abyssa-item-slot").boundingBox())!, badge = (await tile.locator(".resource-inventory__badge").boundingBox())!;
        expect(badge.x + badge.width - slot.x - slot.width).toBeCloseTo(5 * width / 1600, 1);
        expect(badge.y + badge.height - slot.y - slot.height).toBeCloseTo(5 * width / 1600, 1);
      }
      await page.screenshot({path: info.outputPath(`stock-populated-page-${pageIndex + 1}-${width}.png`)});
      if (pageIndex < 2) {
        await pager.getByRole("button", {name: "下一页"}).click();
        await expect(inventory.locator("[data-resource-item]").first()).toBeFocused();
      }
    }
    await expect(pager.getByRole("button", {name: "下一页"})).toBeDisabled();
    await page.keyboard.press("PageUp");
    await expect(pager.getByRole("status")).toHaveText("2 / 3");
    await pager.getByRole("button", {name: "上一页"}).click();
    await expect(pager.getByRole("status")).toHaveText("1 / 3");
    // Empty rows must reserve exactly the same name baseline and footer gap as
    // populated rows, including partial rows on either side of the 7-item edge.
    for (const count of [0, 1, 7, 8, 14]) {
      await page.evaluate(value => window.dispatchEvent(new CustomEvent("resource-inventory-fixture-count", {detail: value})), count);
      await expect(dialog.locator('[data-area="sandbox"] [data-resource-item]')).toHaveCount(count);
      await expect(pager.getByRole("status")).toHaveText("1 / 1");
      expect(await inventoryGridLayout(dialog, width / 1600)).toEqual(fullLayout);
      if (!count) await page.screenshot({path: info.outputPath(`stock-empty-${width}.png`)});
    }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("resource-inventory-fixture-count", {detail: 31})));
    await expect(pager.getByRole("status")).toHaveText("1 / 3");
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
  }
  expect(errors).toEqual([]);
});

test("journal loadout inspects unavailable supplies and carries its exact choice into a real departure", async ({page},info) => {
  test.setTimeout(120000);
  const errors = await observeArtifacts(page);
  await load(page,"home");
  await expect(page.locator(".mansion-app")).toHaveAttribute("data-presentation","ready");
  const homeUrl = page.url(), before = await saved(page);
  await page.getByRole("button",{name:"整备",exact:true}).click();
  const detail = page.getByRole("complementary",{name:"补给详情"});
  await expect(detail).toContainText("当前库存3 份");
  await expect(detail).toContainText("出征携带4 份");
  await page.getByRole("button",{name:"查看护符详情"}).click();
  await expect(detail).toContainText("抵挡 2 点攻击伤害");
  await expect(page.getByRole("button",{name:"加入行囊"})).toBeDisabled();
  await page.screenshot({path:info.outputPath("preparation-no-stock.png")});
  await page.getByRole("button",{name:"查看食物详情"}).click();
  await page.getByRole("button",{name:"移出行囊"}).click();
  await expect(page.getByLabel("已选 1 种，最多 6 种")).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("link",{name:"出征编队",exact:true}).click();
  await expect(page).toHaveURL(/#\/map/,{timeout:30000}); await ready(page);
  await page.locator(".map-loadout summary").click();
  await expect(page.getByRole("checkbox",{name:/^食物/})).not.toBeChecked();
  await expect(page.getByRole("checkbox",{name:/^药水/})).toBeChecked();
  await page.reload(); await ready(page);
  await page.locator(".map-loadout summary").click();
  await expect(page.getByRole("checkbox",{name:/^食物/})).not.toBeChecked();
  await expect(page.getByRole("checkbox",{name:/^药水/})).toBeChecked();
  expect(await saved(page)).toEqual(before);
  await page.goto(homeUrl); await ready(page);
  await expect(page.locator(".mansion-app")).toHaveAttribute("data-presentation","ready");
  await page.getByRole("button",{name:"整备",exact:true}).click();
  await expect(page.getByLabel("已选 1 种，最多 6 种")).toBeVisible();
  await depart(page,5,30000,true);
  const after = await saved(page);
  expect(run(after).run.supplies.map(item=>item.definitionId)).toEqual(["item.potion"]);
  expect(run(after).run.supplies[0].charges).toBe(2);
  expect(after.snapshot.campaign.supplies.find(item=>item.definitionId === "item.food")?.charges).toBe(3);
  expect(after.snapshot.campaign.funds).toEqual(before.snapshot.campaign.funds);
  expect(errors).toEqual([]);
});
