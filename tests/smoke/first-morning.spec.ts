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
      if ([6,24,56,86,96,106,115,119].includes(step)) {
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
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
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

test("new choice labels preserve the same action in AVG and NVL",async({page},info)=> {
  const errors=await observeArtifacts(page);
  await load(page,"A:6");
  for (const label of ["让她自己拿","端走盘子","喂她一口"]) await expect(page.getByRole("button",{name:label,exact:true})).toBeVisible();
  await expect(page.locator(".story-choices__row").last()).toHaveCSS("opacity", "1");
  await page.screenshot({path:info.outputPath("choice-avg.png")});
  await page.getByRole("button",{name:"切换为 NVL 舞台"}).click();
  await page.getByRole("button",{name:"端走盘子",exact:true}).click();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step","7");
  await expect(page.getByLabel("NVL 消息流")).toContainText("向后拽开半尺");
  await expect(page.locator(".story-choices")).toHaveCount(0);
  const record = page.getByRole("note", {name:"选择记录：端走盘子"});
  await expect(record).toBeVisible();
  await expect(record).toContainText("已选择01");
  await expect(page.locator('.abyssa-rp__message[data-kind="narration"]').filter({hasText:"向后拽开半尺"})).toHaveAttribute("data-recent", "true");
  await page.screenshot({path:info.outputPath("new-choice-rp.png")});
  expect(errors).toEqual([]);
});

test("choice presentation fades in, docks below NVL history and releases LOG space", async ({page}, info) => {
  await page.emulateMedia({reducedMotion: "no-preference"});
  const errors = await observeArtifacts(page);
  await load(page, "A:96");
  const choices = page.locator(".story-choices"), log = page.locator(".abyssa-rp__log");
  await expect(choices.getByRole("button")).toHaveCount(2);
  await expect(page.locator(".story-choices__row").last()).toHaveCSS("opacity", "1");
  await expect(choices.locator(".abyssa-ribbon-button__label").first()).toHaveCSS("font-size", "17px");
  await expect(page.locator(".story-choices__prompt")).toHaveCount(0);
  await expect(choices).toHaveCSS("width", "620px");
  await page.screenshot({path: info.outputPath("two-choices-avg.png")});
  await page.getByRole("button", {name: "切换为 NVL 舞台"}).click();
  await expect(page.locator(".first-morning")).not.toHaveAttribute("data-morph", /.+/);
  await expect(choices).toHaveAttribute("data-placement", "inline");
  await expect(page.locator(".abyssa-rp__center")).toHaveCSS("z-index", "3");
  await expect(page.locator(".story-choices__row").last()).toHaveCSS("opacity", "1");
  await expect(log).toHaveCSS("padding-bottom", "22px");
  await expect(choices.locator(".abyssa-ribbon-button__label").first()).toHaveCSS("font-size", "17px");
  const accents = await page.locator('.abyssa-rp__message[data-kind="say"]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute("data-actor-id"), getComputedStyle(node).getPropertyValue("--abyssa-rp-accent").trim()])));
  expect(accents).toMatchObject({abyssa:"#8fd0d4",marietta:"#d98d8d",norma:"#9db8a4",elora:"#c9a3d8",eustice:"#d4b96a"});
  const dockedHeight = await log.evaluate(node => node.clientHeight);
  const dockHeight = await choices.evaluate(node => node.getBoundingClientRect().height);
  const choiceTop = (await choices.boundingBox())!.y;
  expect((await log.boundingBox())!.y + (await log.boundingBox())!.height).toBeLessThanOrEqual(choiceTop);
  await log.evaluate(node => {node.scrollTop -= 240;});
  const jump = page.getByRole("button", {name: /回到最新/});
  await expect(jump).toHaveAttribute("data-show", "true");
  const jumpBounds = (await jump.boundingBox())!;
  expect(jumpBounds.y + jumpBounds.height).toBeLessThan(choiceTop);
  await page.screenshot({path: info.outputPath("two-choices-rp.png")});
  await jump.click();
  await expect.poll(() => log.evaluate(node => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(2);
  await page.getByRole("button", {name: "回看已读对白"}).click();
  await expect(choices).toHaveCount(0);
  expect(await log.evaluate(node => node.clientHeight)).toBeGreaterThan(dockedHeight + dockHeight - 2);
  await expect(log).toHaveCSS("padding-bottom", "22px");
  await page.screenshot({path: info.outputPath("choice-log.png")});
  await page.evaluate(() => {
    (window as any).choiceFrames = new Promise(resolve => {
      const frames: {time:number; opacity:number[]}[] = [], start = performance.now();
      function tick() {
        const opacity = [...document.querySelectorAll(".story-choices__row")].map(node => Number(getComputedStyle(node).opacity));
        if (opacity.length) frames.push({time:performance.now() - start, opacity});
        if (performance.now() - start < 1000) requestAnimationFrame(tick); else resolve(frames);
      }
      requestAnimationFrame(tick);
    });
  });
  await page.getByRole("button", {name: "关闭回看"}).click();
  await expect(page.locator(".story-choices__row").last()).toHaveCSS("opacity", "1");
  const frames = await page.evaluate(() => (window as any).choiceFrames) as {time:number;opacity:number[]}[];
  for (const index of [0,1]) expect(frames.filter(frame => frame.opacity[index] > .02 && frame.opacity[index] < .98).length).toBeGreaterThan(2);
  expect(frames.some(frame => frame.opacity[0] > frame.opacity[1] + .05)).toBe(true);
  await info.attach("choice-fade-frames", {body:JSON.stringify(frames),contentType:"application/json"});
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "96");
  await page.getByRole("button", {name: "切换为 AVG 舞台"}).click();
  await expect(page.locator(".first-morning")).not.toHaveAttribute("data-morph", /.+/);
  await expect(choices).toHaveAttribute("data-placement", "overlay");
  await page.setViewportSize({width:1280,height:720});
  await expect(choices).toBeInViewport({ratio:1});
  await page.screenshot({path: info.outputPath("choice-return-1280.png")});
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`choice confirmation exits in layers without advancing twice (${reduced ? "reduced" : "full"})`, async ({page}, info) => {
  await page.emulateMedia({reducedMotion: reduced ? "reduce" : "no-preference"});
  const errors = await observeArtifacts(page);
  await load(page, "A:6");
  const rows = page.locator(".story-choices__row"), button = page.getByRole("button", {name: "端走盘子", exact: true});
  await expect(rows.last()).toHaveCSS("opacity", "1");
  await button.hover();
  await expect(button).toHaveAttribute("data-highlighted", "true");
  await expect(page.locator(".story-choices__cursor--right")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 62)");
  await expect(page.locator(".story-choices__gem")).toHaveCount(2);
  await expect(page.locator('.story-choices [class*="sheen"]')).toHaveCount(0);
  expect(await page.locator(".story-choices").evaluate(node => node.getAnimations({subtree:true}).filter(animation => animation.effect?.getTiming().iterations === Infinity).length)).toBe(0);
  await expect(button.locator(".abyssa-ribbon-button__label")).toHaveCSS("transform", "none");
  await page.screenshot({path:info.outputPath("choice-highlight.png")});
  await page.evaluate(() => {
    (window as any).choiceExitFrames = new Promise(resolve => {
      document.querySelector('.story-choices__row[data-choice-id="B"] button')!.addEventListener("click", () => {
        const frames: {time:number; opacity:number[]; locked:boolean; picked:boolean; step:string|undefined}[] = [], start = performance.now();
        function tick() {
          const opacity = [...document.querySelectorAll(".story-choices__row")].map(node => Number(getComputedStyle(node).opacity));
          const choice = document.querySelector('.story-choices__button[data-selected]');
          frames.push({time: performance.now() - start, opacity, picked: !!choice,
            locked: !!document.querySelector<HTMLButtonElement>(".rp-app__cue")?.disabled,
            step: document.querySelector<HTMLElement>(".first-morning")?.dataset.step});
          // Simulate an impatient second activation during the real presence exit.
          if (opacity.length && frames.at(-1)?.step === "7") {
            document.querySelector<HTMLElement>(".rp-app__stage")?.click();
            document.querySelector<HTMLElement>(".rp-app__stage")?.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
          }
          if (performance.now() - start < 700) requestAnimationFrame(tick); else resolve(frames);
        }
        requestAnimationFrame(tick);
      }, {once:true});
    });
  });
  await button.click();
  await expect(page.locator(".story-choices")).toHaveCount(0);
  const frames = await page.evaluate(() => (window as any).choiceExitFrames) as {time:number;opacity:number[];locked:boolean;picked:boolean;step:string}[];
  const visible = frames.filter(frame => frame.opacity.length);
  expect(visible.length).toBeGreaterThan(0);
  expect(visible.every(frame => frame.locked && frame.picked)).toBe(true);
  if (!reduced) {
    expect(visible.some(frame => frame.opacity[1] > .7 && frame.opacity[0] < .2)).toBe(true);
    expect(visible.filter(frame => frame.opacity[1] > .02 && frame.opacity[1] < .98).length).toBeGreaterThan(2);
  }
  await info.attach("choice-exit-frames", {body:JSON.stringify(frames),contentType:"application/json"});
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "7");
  await expect(page.locator(".rp-app__cue")).toBeEnabled();
  await page.reload();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "7");
  expect(errors).toEqual([]);
});

test("failed choice save restores feedback and retries the original pending command", async ({page}, info) => {
  await page.emulateMedia({reducedMotion: "no-preference"});
  const errors = await observeArtifacts(page);
  await load(page, "A:6");
  await expect(page.locator(".story-choices__row").last()).toHaveCSS("opacity", "1");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "receipts") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Choice test: interrupted save", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", {name:"端走盘子", exact:true}).click();
  await expect(page.locator(".story-choices__error")).toBeVisible();
  await expect(page.locator(".story-choices")).not.toHaveAttribute("data-pending", "true");
  await expect(page.locator(".story-choices__row").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "6");
  await page.screenshot({path:info.outputPath("choice-save-failed.png")});
  await page.getByRole("button", {name:"重新读取 / 重试", exact:true}).click();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "7");
  await expect(page.locator(".story-choices")).toHaveCount(0);
  await expect(page.locator(".rp-app__cue")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("choice record keeps the actual decision and character colors in NVL, LOG and reload", async ({page}, info) => {
  const errors = await observeArtifacts(page);
  await load(page, "A:24");
  await page.getByRole("button", {name:"故意找茬", exact:true}).click();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "25");
  await expect(page.locator(".story-choices")).toHaveCount(0);
  await page.getByRole("button", {name:"切换为 NVL 舞台"}).click();
  const record = page.getByRole("note", {name:"选择记录：故意找茬"});
  await expect(record).toBeVisible();
  await expect(record).toContainText("已选择02");
  await expect(page.locator('.abyssa-rp__message[data-choice-record="morning.choice.training"]')).toHaveCount(1);
  await expect(page.locator(".abyssa-rp__log")).toContainText("下巴指了指门垫边的一小块泥印");
  await expect(page.locator('.abyssa-rp__message[data-kind="narration"]').filter({hasText:"下巴指了指门垫边的一小块泥印"})).toHaveAttribute("data-recent", "true");
  await record.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath("record-rp.png")});
  const original = await record.elementHandle();
  await page.getByRole("button", {name:"回看已读对白"}).click();
  expect(await record.evaluate((node, original) => node === original, original)).toBe(true);
  await expect(record.locator("..")).toHaveCSS("animation-name", "none");
  await page.screenshot({path:info.outputPath("record-log.png")});
  await page.getByRole("button", {name:"关闭回看"}).click();
  expect(await record.evaluate((node, original) => node === original, original)).toBe(true);
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "25");
  await page.reload();
  await expect(page.locator(".first-morning")).toHaveAttribute("data-step", "25");
  await page.getByRole("button", {name:"切换为 NVL 舞台"}).click();
  await expect(record).toHaveCount(1);
  await expect(record).toContainText("已选择02");
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
