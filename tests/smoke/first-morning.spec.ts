import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import { observeArtifacts } from "./helpers";

const archives = new Map<string,string>();
test.beforeAll(async () => {
  const outfile = resolve(projectRoot,"dist/reports/first-morning/runtime-fixture.mjs");
  await build({absWorkingDir:projectRoot,stdin:{contents:
    'export {createPlayerRuntime} from "./src/game-runtime/player-runtime"; export {MemoryGameDatabase,MemoryGameStore} from "./src/game-infrastructure/storage/memory";',
    resolveDir:projectRoot,loader:"ts"},outfile,bundle:true,format:"esm",platform:"node",target:"es2022"});
  const {createPlayerRuntime,MemoryGameDatabase,MemoryGameStore} = await import(pathToFileURL(outfile).href);
  for (const blanket of ["A","C"]) {
    let sequence=0;
    const saveId=`morning-copy-${blanket}`;
    const runtime=createPlayerRuntime(new MemoryGameStore(new MemoryGameDatabase()),{newId:()=>`morning-${++sequence}`,newSeed:()=>19,close(){}});
    const created=await runtime.application.create({...runtime.defaultCreation,saveId,epoch:"copy",clientRequestId:`create-${blanket}`});
    if (!created.ok) throw Error(created.error.message);
    const send=async(command:unknown)=> {
      const current=await runtime.application.open(saveId);
      if (!current.ok) throw Error(current.error.message);
      const result=await runtime.application.dispatch({protocolVersion:4,saveId,expectedHead:current.record.head,clientRequestId:`copy-${++sequence}`,command});
      if (!result.ok) throw Error(result.error.message);
    };
    await send({type:"complete-prologue",shotId:"A1-01",choice:"skip"});
    for (let step=0;step<=119;step++) {
      if ([6,56,86,106,115,119].includes(step)) {
        const exported=await runtime.application.exportSave(saveId);
        if (!exported.ok) throw Error(exported.error.message);
        archives.set(`${blanket}:${step}`,exported.archive);
      }
      const choice=step===58?blanket:step===96?"B":[6,24,42].includes(step)?"A":"continue";
      await send({type:"advance-opening",step,choice});
    }
  }
});

async function load(page:Page,key:string) {
  await page.goto("/");
  await page.getByRole("button",{name:"记录",exact:true}).click({timeout:60_000});
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档",{exact:true}).setInputFiles({name:"morning.json",mimeType:"application/json",buffer:Buffer.from(archives.get(key)!)});
  await expect(page).toHaveURL(/#\/mansion/,{timeout:60_000});
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition",/.+/,{timeout:60_000});
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step",key.split(":")[1]);
}
async function next(page:Page) {
  await expect(page.locator(".first-morning")).toHaveAttribute("data-state","idle");
  await page.locator(".rp-app__cue").click();
}

test("new choice labels preserve the same action in AVG and RP",async({page},info)=> {
  const errors=await observeArtifacts(page);
  await load(page,"A:6");
  for (const label of ["让她自己拿","端走盘子","喂她一口"]) await expect(page.getByRole("button",{name:label,exact:true})).toBeVisible();
  await page.getByRole("button",{name:"切换为 RP 舞台"}).click();
  await page.getByRole("button",{name:"端走盘子",exact:true}).click();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step","7");
  await expect(page.getByLabel("RP 消息流")).toContainText("向后拽开半尺");
  await page.screenshot({path:info.outputPath("new-choice-rp.png")});
  expect(errors).toEqual([]);
});

test("paged pressure starts at the new paragraph and survives a saved-node reload",async({page},info)=> {
  const errors=await observeArtifacts(page);
  await load(page,"A:56");
  await expect(page.locator(".first-morning")).not.toHaveAttribute("data-pressure","true");
  for(let i=0;i<3;i++) await next(page);
  await expect(page.locator(".first-morning")).toHaveAttribute("data-pressure","true");
  await expect(page.locator(".rp-adv__dialogue")).toContainText("脚下的影子毫无征兆地沸腾起来");
  await expect(page.locator(".first-morning")).toHaveAttribute("data-state","idle");
  await page.screenshot({path:info.outputPath("pressure-page.png")});
  await next(page);await next(page);
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step","57");
  await page.reload();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-pressure","true");
  expect(errors).toEqual([]);
});

for(const item of [
  {key:"A:86",pages:3,text:"阁下的旧毛毯",name:"cargo-reveal",width:1600},
  {key:"A:106",pages:0,text:"下午我还要去收拾哨所那帮人",name:"long-dialogue",width:1280},
  {key:"A:115",pages:0,text:"沙发角，悄悄滑出",name:"without-cloak",width:1600},
  {key:"C:115",pages:0,text:"沙发上那领宽大的斗篷下",name:"with-cloak",width:1600},
]) test(`renders the new ${item.name} in the original AVG`,async({page},info)=> {
  await page.setViewportSize({width:item.width,height:item.width*9/16});
  const errors=await observeArtifacts(page);
  await load(page,item.key);
  for(let i=0;i<item.pages;i++) await next(page);
  await expect(page.locator(".rp-adv__dialogue")).toContainText(item.text);
  await expect(page.locator(".first-morning")).toHaveAttribute("data-state","idle");
  await expect(page.locator(".rp-app__cue")).toBeInViewport();
  await page.screenshot({path:info.outputPath(`${item.name}.png`)});
  expect(errors).toEqual([]);
});

test("the unchanged final cursor still enters the real tide-cave tutorial",async({page})=> {
  const errors=await observeArtifacts(page);
  await load(page,"A:119");
  await expect(page.getByRole("region",{name:"第一章：雾滩·退潮岩窟"})).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/#\/battle.*expedition=/,{timeout:60_000});
  await expect(page.getByRole("main",{name:"雾滩·退潮岩窟"})).toBeVisible();
  expect(errors).toEqual([]);
});
