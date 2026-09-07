import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import { ready as baseReady } from "./playable-helpers";
import type { D5GameRecord } from "../../src/game-application/versions/d5-contracts";
import { mariettaMemoryScript } from "../../src/content/presentation/marietta-memory";
const probe = resolve(projectRoot,"dist/reports/demo-d5-d/memory-probe.js");
const generator = resolve(projectRoot,"dist/reports/demo-d5-d/fixture-generator.mjs");
let records: Record<string,D5GameRecord>;
async function ready(page: Page) {
  await expect(page.locator('.game-client-status')).toHaveAttribute('data-status','ready',{timeout:20000});
  await baseReady(page);
}
test.describe.configure({mode:"serial"});
test.beforeAll(async () => {
  test.setTimeout(240000);
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-runtime/testing/memory-browser.ts"],outfile:probe,bundle:true,format:"iife",globalName:"MemoryProbe",platform:"browser",target:"es2022"});
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-application/testing/d5-browser-fixture.ts"],outfile:generator,bundle:true,format:"esm",platform:"node",target:"es2022"});
  records = await (await import(pathToFileURL(generator).href)).playedMemoryFixtures();
});
async function loadProbe(page: Page) {await page.addScriptTag({path:probe});}
async function install(page: Page, record: D5GameRecord, prefix = "/") {
  await page.goto(prefix); await loadProbe(page);
  await page.evaluate(json => (window as any).MemoryProbe.seedPlayed(JSON.parse(json)),JSON.stringify(record));
  const m = record.snapshot.campaign.memory!;
  await page.goto(`${prefix}battle.html?save=${record.head.saveId}&epoch=${record.head.epoch}&memory=${m.id}&attempt=${m.attempt}`);
  await ready(page);
}
async function inspect(page: Page) {await loadProbe(page);return page.evaluate(() => (window as any).MemoryProbe.inspectMemory());}
async function expectStoryInsideFrame(page: Page, text: string) {
  await expect(page.locator(".abyssa-dialogue__content")).toHaveText(text);
  const frame = (await page.locator(".rp-app").boundingBox())!;
  for (const selector of [".rp-adv__dialogue", ".rp-app__bar"]) {
    const bounds = (await page.locator(selector).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(frame.x - 1);
    expect(bounds.y).toBeGreaterThanOrEqual(frame.y - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  await expect.poll(() => page.locator(".rp-adv__actor img").evaluateAll(images => images.length > 0 && images.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator(".rp-adv__dialogue")).toHaveCSS("position", "absolute");
  await expect(page.locator(".abyssa-expedition-frame")).toHaveCount(0);
  await expect(page.locator(".abyssa-novel")).toHaveCount(0);
}

for (const [prefix,width,height] of [["/",1600,900],["/abyssa/",1280,720]] as const) {
  test(`memory uses the approved surface and restores narrative/results under ${prefix}`, async ({page},info) => {
    test.setTimeout(180000); page.setDefaultTimeout(15000); await page.setViewportSize({width,height});
    await install(page,records.intro,prefix);
    await page.getByRole("button",{name:"下一句",exact:true}).click(); await ready(page);
    const cursor = (await inspect(page)).record.snapshot.campaign.memory.step;
    expect(cursor).toBe(1);
    await page.reload(); await ready(page);
    expect((await inspect(page)).record.snapshot.campaign.memory.step).toBe(cursor);
    await expectStoryInsideFrame(page, mariettaMemoryScript["present-intro"][cursor].text);
    await page.screenshot({path:info.outputPath(`memory-intro-${width}.png`)});
    for (let i=0;i<3;i++) {
      if(i===2) {
        await expectStoryInsideFrame(page,mariettaMemoryScript.teaching[0].text);
        await page.screenshot({path:info.outputPath(`memory-teaching-${width}.png`)});
        await page.getByRole("button",{name:"回忆战规则",exact:true}).click();
        await expect(page.getByText("初阵：玛—侍偶A—侍偶B—侍偶C",{exact:true})).toBeVisible();
        await page.getByRole("button",{name:"关闭回忆战规则",exact:true}).click();
      }
      await page.getByRole("button",{name:"跳过本段对白",exact:true}).click();await ready(page);
    }
    await expect(page.getByRole("main",{name:"玛丽埃塔回忆战斗界面"})).toBeVisible();
    await expect(page.getByLabel("侍偶护域 · 1",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"回忆战记录与补给",exact:true}).click();
    await expect(page.getByText("玛丽埃塔：规矩是我立的。",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"收起账本",exact:true}).click();
    expect(await page.locator(".abyssa-expedition-enemies").evaluate(e => getComputedStyle(e).backgroundImage)).not.toContain("url(");
    expect(await page.locator(".abyssa-expedition-party-nameplate").count()).toBe(5);
    const frame = (await page.locator(".abyssa-expedition-frame").boundingBox())!;
    expect(frame.y).toBeGreaterThanOrEqual(0);expect(frame.y+frame.height).toBeLessThanOrEqual(height);
    await page.screenshot({path:info.outputPath(`memory-battle-${width}.png`)});
    await page.getByRole("button",{name:"ROLL",exact:true}).click();
    await expect(page.getByRole("button",{name:"END TURN",exact:true})).toBeEnabled();
    await page.locator(".expedition-die").first().click();
    await expect(page.getByRole("button",{name:"REROLL",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"REROLL",exact:true}).click();
    await expect(page.locator(".expedition-die").first()).not.toHaveAttribute("data-rolling");
    await expect(page.getByRole("button",{name:"END TURN",exact:true})).toBeEnabled();
    const before = await inspect(page);
    const enemyIds = before.journey.battle.enemies.map((e:any)=>e.id);
    await page.getByRole("button",{name:"END TURN",exact:true}).click();
    await expect(page.getByRole("button",{name:"ROLL",exact:true})).toBeEnabled({timeout:15000});
    await expect(page.getByLabel("侍偶护域 · 2",{exact:true})).toBeVisible();
    const after = await inspect(page);
    expect(after.journey.battle.encounter.formation).not.toEqual(before.journey.battle.encounter.formation);
    expect(after.journey.battle.enemies.map((e:any)=>e.id).sort()).toEqual(enemyIds.sort());
    await page.reload();await ready(page);
    expect((await inspect(page)).record.head).toEqual(after.record.head);
    await expect(page.locator(".expedition-die[data-rolling]")).toHaveCount(0);
    await page.getByRole("button",{name:"回忆战记录与补给",exact:true}).click();
    await page.getByRole("button",{name:"暂离回忆",exact:true}).click();
    await expect(page).toHaveURL(/mansion.html/,{timeout:20000});await ready(page);
    expect((await inspect(page)).record.snapshot.campaign.funds).toEqual(records.memory.snapshot.campaign.funds);

    await install(page,records.failed,prefix);
    await page.getByRole("button",{name:"重新挑战",exact:true}).click();
    await expect(page).toHaveURL(/attempt=2/,{timeout:20000});await ready(page);
    await expect(page.getByRole("button",{name:"回忆战规则",exact:true})).toBeVisible();
    await page.goto(`${prefix}battle.html?save=d5-d&epoch=epoch&memory=${records.failed.snapshot.campaign.memory!.id}&attempt=1`);await ready(page);
    await expect(page.getByText("这条回忆链接已失效，请从洋馆恢复当前章节。",{exact:true})).toBeVisible();

    await install(page,records.returnPending,prefix);
    await expectStoryInsideFrame(page, mariettaMemoryScript["return-pending"].at(-1)!.text);
    await page.screenshot({path:info.outputPath(`memory-return-${width}.png`)});
    if (prefix === "/") {await page.getByRole("button",{name:"确认同行",exact:true}).click();await expect(page).toHaveURL(/mansion.html/,{timeout:20000});}
    else {await loadProbe(page);await page.evaluate(() => (window as any).MemoryProbe.claimWithLostReceipt());await page.reload();}
    await ready(page);
    expect(await page.evaluate(()=>sessionStorage.getItem("abyssa:pending:v4:d5-d:epoch"))).toBeNull();
    const unlocked = (await inspect(page)).record;
    expect(unlocked.snapshot.campaign.availableCharacterIds.filter((id:string)=>id==="marietta")).toHaveLength(1);
    expect(unlocked.snapshot.campaign.funds).toEqual(records.firstClear.snapshot.campaign.funds);
    const revision = unlocked.head.revision;
    await page.reload();await ready(page);
    if(prefix === "/") {await page.getByRole("link",{name:"回顾回忆与同行",exact:true}).click();await ready(page);}
    await page.getByRole("button",{name:"回顾当下对话",exact:true}).click();
    await page.getByRole("button",{name:"结束回顾",exact:true}).last().click();await ready(page);
    expect((await inspect(page)).record.head.revision).toBe(revision);
  });
}
test("D5 result survives IndexedDB connection loss, replay and a stale competing claim",async ({page}) => {
  test.setTimeout(90000); await page.goto("/"); await loadProbe(page);
  const r = await page.evaluate(json => (window as any).MemoryProbe.storageClaim(JSON.parse(json)),JSON.stringify(records.returnPending));
  expect(r.committed.ok).toBe(true);expect(r.replay).toMatchObject({ok:true,replayed:true});
  expect(r.stale).toMatchObject({ok:false,error:{code:"conflict"}});
  expect(r.reopened.ok).toBe(true);
  expect(r.reopened.record.snapshot.campaign.chapterClaim).not.toBeNull();
  expect(r.reopened.record.head.revision).toBe(records.returnPending.head.revision+1);
});
