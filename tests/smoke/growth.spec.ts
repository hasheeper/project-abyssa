import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import { ready as baseReady } from "./playable-helpers";
import { observeArtifacts } from "./helpers";
import type { D5GameRecord } from "../../src/game-application/versions/d5-contracts";
import { growthStories, teamMilestoneStory } from "../../src/content/presentation/growth-stories";

const probe = resolve(projectRoot,"dist/reports/demo-d5-e/growth-probe.js");
const generator = resolve(projectRoot,"dist/reports/demo-d5-e/browser-generator.mjs");
const pendingKey = "abyssa:pending:v4:d5-d:epoch";
let records: Record<string,D5GameRecord>;
test.describe.configure({mode:"serial"});
// Existing shared font CSS is remote; keep navigation separate from interaction timeouts.
test.beforeEach(async ({page}) => {page.setDefaultNavigationTimeout(60000);});
test.beforeAll(async () => {
  test.setTimeout(360000);
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-runtime/testing/growth-browser.ts"],outfile:probe,bundle:true,format:"iife",globalName:"GrowthProbe",platform:"browser",target:"es2022"});
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-application/testing/d5-growth-fixture.ts"],outfile:generator,bundle:true,format:"esm",platform:"node",target:"es2022"});
  records = await (await import(pathToFileURL(generator).href)).playedGrowthFixtures();
});
async function ready(page:Page) {
  await expect(page.locator(".game-client-status").first()).toHaveAttribute("data-status","ready",{timeout:20000});
  await baseReady(page);
}
async function loadProbe(page:Page) {await page.addScriptTag({path:probe});}
async function inspect(page:Page) {await loadProbe(page);return page.evaluate(()=>(window as any).GrowthProbe.inspectGrowth());}
async function install(page:Page,record:D5GameRecord,prefix="/",destination="mansion.html") {
  await page.goto(prefix);await loadProbe(page);
  await page.evaluate(async ({json,key})=>{sessionStorage.removeItem(key);await (window as any).GrowthProbe.seedPlayed(JSON.parse(json));},{json:JSON.stringify(record),key:pendingKey});
  await page.goto(`${prefix}${destination}?save=d5-d&epoch=epoch${destination==="character-status.html" ? "&character=eustice&tab=dice" : ""}`);
  await ready(page);
}
async function frame(page:Page,text:string) {
  await expect(page.locator(".abyssa-dialogue__content")).toHaveText(text);
  const outer=(await page.locator(".rp-app").boundingBox())!;
  for(const selector of [".rp-adv__dialogue",".rp-app__bar"]) {
    const b=(await page.locator(selector).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(outer.x-1);expect(b.y).toBeGreaterThanOrEqual(outer.y-1);
    expect(b.x+b.width).toBeLessThanOrEqual(outer.x+outer.width+1);expect(b.y+b.height).toBeLessThanOrEqual(outer.y+outer.height+1);
  }
  await expect.poll(()=>page.locator(".rp-adv__actor img").evaluateAll(images=>images.length>0 && images.every(i=>(i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth>0))).toBe(true);
  await expect(page.locator(".abyssa-expedition-frame,.abyssa-novel")).toHaveCount(0);
  for(const icon of await page.locator(".rp-app__tool-icon").all())await expect(icon).not.toHaveCSS("mask-image","none");
}
async function openEquipment(page:Page) {
  await page.getByRole("group",{name:"装备槽"}).locator(".abyssa-dice__charm").last().getByRole("button").click();
  await page.getByRole("button",{name:"管理通用装备",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function finish(page:Page) {
  const confirm=page.getByRole("button",{name:"完成片段",exact:true});
  await expect(confirm).toBeEnabled();await confirm.click();await ready(page);
}

for(const [prefix,width,height] of [["/",1600,900],["/abyssa/",1280,720]] as const) {
  test(`growth, gift and equipment preserve the original surfaces under ${prefix}`,async({page},info)=>{
    test.setTimeout(180000);page.setDefaultTimeout(20000);await page.setViewportSize({width,height});
    const failures=await observeArtifacts(page);
    await install(page,records.home,prefix);
    await page.getByRole("button",{name:"谈起 · 把剑暂时放下",exact:true}).click();await ready(page);
    await page.getByRole("button",{name:"下一句",exact:true}).click();await ready(page);
    const cursor=(await inspect(page)).record.snapshot.campaign.stories.at(-1).step;
    expect(cursor).toBe(1);await page.reload();await ready(page);
    await frame(page,growthStories["event.growth.eustice.lv2"].lines[cursor].text);
    await page.screenshot({path:info.outputPath(`growth-adv-${width}.png`)});
    await page.getByRole("button",{name:"稍后继续",exact:true}).click();await ready(page);
    expect((await inspect(page)).record.snapshot.campaign.growthGrants).toHaveLength(0);
    await page.getByRole("button",{name:"继续 · 把剑暂时放下",exact:true}).click();await ready(page);
    expect((await inspect(page)).record.snapshot.campaign.stories.at(-1).step).toBe(cursor);
    await page.getByRole("button",{name:"跳至片段末句",exact:true}).click();await ready(page);
    expect((await inspect(page)).record.snapshot.campaign.growthGrants).toHaveLength(0);
    await finish(page);expect((await inspect(page)).record.snapshot.campaign.growthGrants).toHaveLength(1);
    await page.getByRole("button",{name:"谈起 · 把空着的那一手用起来",exact:true}).click();await ready(page);
    await page.getByRole("button",{name:"跳至片段末句",exact:true}).click();await ready(page);await finish(page);
    const gifted=(await inspect(page)).record;
    expect(gifted.snapshot.campaign.inventory).toHaveLength(2);
    expect(gifted.snapshot.campaign.inventory.every((i:any)=>i.location.kind==="inventory")).toBe(true);
    await page.getByRole("link",{name:"前往骰装",exact:true}).click();await ready(page);
    await openEquipment(page);await page.getByRole("button",{name:"装备备用短刃",exact:true}).click();
    await expect(page.getByRole("button",{name:"卸下备用短刃",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"转交艾洛拉",exact:true}).click();
    await expect(page.getByRole("button",{name:"从艾洛拉转交给尤斯缇丝",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"装备应急药囊",exact:true}).click();
    await expect(page.getByRole("button",{name:"卸下应急药囊",exact:true})).toBeEnabled();
    await expect(page.getByRole("button",{name:"从艾洛拉转交给尤斯缇丝",exact:true})).toBeDisabled();
    const modal=(await page.getByRole("dialog").boundingBox())!;
    expect(modal.y).toBeGreaterThanOrEqual(0);expect(modal.y+modal.height).toBeLessThanOrEqual(height);
    await page.screenshot({path:info.outputPath(`equipment-${width}.png`)});
    await page.getByRole("button",{name:"关闭尤斯缇丝 · 通用装备",exact:true}).click();
    const equipped=(await inspect(page)).record;
    expect(equipped.snapshot.campaign.inventory.map((i:any)=>i.instanceId)).toEqual(gifted.snapshot.campaign.inventory.map((i:any)=>i.instanceId));
    await expect(page.locator('.abyssa-dice__column[data-face="6"]')).toHaveAttribute("aria-label",/治疗 1/);
    await page.reload();await ready(page);
    await expect(page.locator('.abyssa-dice__column[data-face="6"]')).toHaveAttribute("aria-label",/治疗 1/);
    await page.getByRole("tab",{name:"概要",exact:true}).click();
    await expect(page.locator(".abyssa-status-panel__bond-node")).toHaveCount(5);
    await expect(page.locator(".abyssa-status-panel__pact-stage-inset")).toHaveCount(3);
    await page.screenshot({path:info.outputPath(`growth-character-${width}.png`)});
    await page.getByRole("tab",{name:"记事",exact:true}).click();
    await expect(page.getByText("把剑暂时放下",{exact:true})).toBeVisible();
    await page.goto(`${prefix}map.html?save=d5-d&epoch=epoch`);await ready(page);
    await expect(page.locator(".abyssa-map-loading")).toHaveCount(0,{timeout:30000});
    await page.getByRole("button",{name:"查看出战队伍并编队"}).click();
    await page.locator('.abyssa-sortie-poster[data-member="eustice"]').hover();
    await expect(page.locator('.abyssa-sortie-info__dice [title*="第 6 面"]')).toHaveAttribute("title",/治疗 1/);
    await page.screenshot({path:info.outputPath(`growth-map-${width}.png`)});
    expect((await inspect(page)).record.head).toEqual(equipped.head);expect(failures).toEqual([]);
  });
}
test("the second Lv.3 grants Kael once; recap is read only",async({page})=>{
  test.setTimeout(60000);
  await install(page,records["pending:event.growth.elora.lv3"]);
  await finish(page);await expect(page.getByRole("main",{name:"这边交给我",exact:true})).toBeVisible();
  const after=(await inspect(page)).record;expect(after.snapshot.campaign.teamMilestone).not.toBeNull();
  await page.getByRole("button",{name:"结束回顾",exact:true}).last().click();
  await expect(page.getByRole("status").filter({hasText:teamMilestoneStory.resultText})).toBeVisible();
  await page.getByText("成长与整备记录",{exact:true}).click();
  await page.getByRole("button",{name:"回顾「这边交给我」",exact:true}).click();
  await page.getByRole("button",{name:"结束回顾",exact:true}).last().click();
  expect((await inspect(page)).record.head).toEqual(after.head);
});
test("archive equipment restores lost receipts and preserves unrelated pending commands and frozen runs",async({page})=>{
  test.setTimeout(90000);await install(page,records.preTransfer,"/","character-status.html");
  const blade=records.preTransfer.snapshot.campaign.inventory.find(i=>i.definitionId==="equipment.spare-blade")!;
  await loadProbe(page);await page.evaluate(id=>(window as any).GrowthProbe.lostReceipt({type:"transfer-equipment",instanceId:id,fromOwnerId:"elora",toOwnerId:"kororo"}),blade.instanceId);
  await page.reload();await ready(page);
  await expect.poll(()=>page.evaluate(key=>sessionStorage.getItem(key),pendingKey)).toBeNull();
  const recovered=(await inspect(page)).record;
  expect(recovered.head.revision).toBe(records.preTransfer.head.revision+1);
  expect(recovered.snapshot.campaign.inventory.find((i:any)=>i.instanceId===blade.instanceId).location.ownerId).toBe("kororo");
  for(const checkpoint of [records.memory,records["growth-first:departure"]]) {
    await install(page,checkpoint,"/","character-status.html");
    const pending=JSON.stringify({protocolVersion:4,saveId:"d5-d",expectedHead:checkpoint.head,clientRequestId:"unrelated-story",command:{type:"complete-story",sessionId:"unrelated"}});
    await page.evaluate(({key,pending})=>sessionStorage.setItem(key,pending),{key:pendingKey,pending});
    await page.reload();await ready(page);
    await page.getByRole("group",{name:"装备槽"}).locator(".abyssa-dice__charm").last().getByRole("button").click();
    await expect(page.getByRole("button",{name:"出征期间配置已冻结",exact:true})).toBeDisabled();
    expect(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey)).toBe(pending);
    expect((await inspect(page)).record).toEqual(checkpoint);
  }
});
