import { expect, test, type Page, type Locator } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import type { tideOperation } from "../../src/game-client/testing/tide-cave";
import { observeArtifacts } from "./helpers";
import g4Story from "../../src/content/presentation/scenes/tide-cave-guided.json" with {type:"json"};
import tactical from "../../src/content/presentation/tutorial/tide-tactical.json" with {type:"json"};

let beforeDeparture: string, beforeEvent: string, beforeAction: string, choose: typeof tideOperation;
const observationArchives: Record<string, string> = {};
test.beforeAll(async () => {
  test.setTimeout(120000);
  const outfile = resolve(projectRoot, "dist/reports/tide-guided-g3/client-fixture.mjs");
  await build({absWorkingDir:projectRoot,entryPoints:["src/game-client/testing/tide-cave.ts"],outfile,bundle:true,format:"esm",platform:"node",target:"es2022"});
  const mod = await import(pathToFileURL(outfile).href);
  choose = mod.tideOperation;
  const f = await mod.tideClientFixture(11);
  try {
    beforeDeparture = f.beforeDeparture;
    await f.start();
    for (let n = 0; n < 160; n++) {
      const record = f.session.getSnapshot().record;
      const op = choose(record);
      const v = f.runtime.queries.journey(record), t = v.tutorial;
      const key = ({"T1.R1.roll":"slimes", "T2.R2.roll":"bowReady", "E1.attempt":"event", "T3.R1.focus.kael.fix":"twoPairs"} as Record<string,string>)[t.guide?.step?.id];
      if (key) observationArchives[key] = await f.archive();
      if (!beforeAction && op?.type === "battle" && op.command.type === "act") beforeAction = await f.archive();
      if (!beforeEvent && record.snapshot.run.state.node === "event") beforeEvent = await f.archive();
      if (t.encounter === 3 && t.guide?.mode === "free" && v.battle?.encounter.round === 2) {
        observationArchives.pairResult = await f.archive(); break;
      }
      await f.send(mod.tideCommand(choose(record)));
    }
    expect(beforeEvent).toBeTruthy();
  } finally { f.session.dispose(); }
});
async function saved(page: Page): Promise<D5GameRecord> {
  return page.evaluate(async () => {
    const id = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    return new Promise<any>((resolve, reject) => {
      const open = indexedDB.open("abyssa-game-v1", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, read = db.transaction("saves", "readonly").objectStore("saves").get(id);
        read.onsuccess = () => {resolve(read.result);db.close();}; read.onerror = () => {reject(read.error);db.close();};
      };
    });
  });
}
function state(record: D5GameRecord) {
  if (record.snapshot.run?.kind !== "expedition") throw Error("Missing expedition");
  return record.snapshot.run.state;
}
async function settled(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout:60000});
  await expect(page.locator(".game-client-status").first()).toHaveAttribute("data-status", "ready");
  const sequence = page.locator(".scene-sequence"), record = await saved(page);
  if (record.snapshot.run?.kind === "expedition") await expect(sequence).toHaveAttribute("data-scene", state(record).tutorial?.story ? "adv" : "battle", {timeout:20000});
  if (await sequence.count()) await expect(sequence).toHaveAttribute("data-phase", "idle", {timeout:20000});
  if (await page.locator(".abyssa-expedition").count()) await expect(page.locator(".abyssa-expedition")).toHaveAttribute("aria-busy", "false", {timeout:20000});
}
async function load(page: Page, archive: string, prefix = "/") {
  await page.goto(prefix);
  await page.getByRole("button", {name:"记录",exact:true}).click({timeout:60000});
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", {exact:true}).setInputFiles({name:"guided.json",mimeType:"application/json",buffer:Buffer.from(archive)});
  await expect(page).toHaveURL(/#\/(battle|mansion)/, {timeout:60000});
  await settled(page);
}
const button = (page: Page, name: string) => page.getByRole("button", {name,exact:true});
const anchor = (page: Page, id: string) => page.locator(`[data-tutorial-anchor="${id}"]`);
async function keyPress(node: Locator) {await node.focus(); await node.press("Enter");}
async function acknowledgeObservation(page: Page) {
  const observation = page.locator('.abyssa-tutorial[data-observation="true"]');
  if (!await observation.count()) return;
  await expect(observation).toHaveAttribute("data-visible","true");
  const before = await saved(page);
  await observation.locator(".abyssa-tutorial__next").click();
  await expect(observation).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
}
async function guide(page: Page, target: string) {
  await acknowledgeObservation(page);
  await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(1);
  await expect(anchor(page,target)).toHaveAttribute("aria-describedby", /tutorial-copy-/);
}
async function contextFocus(page: Page, target: string) {
  await expect(page.locator(`.abyssa-tutorial__context[data-context-target="${target}"]`)).toBeVisible();
}
async function stageScroll(page: Page) {
  return page.locator(".scene-sequence, .battle-companion").evaluateAll(nodes => nodes.map(n => [n.scrollLeft,n.scrollTop]));
}
async function stableFrame(page: Page) {
  let previous = "", stable = 0;
  await expect.poll(async () => {
    const next = JSON.stringify(await page.locator(".abyssa-expedition-frame").boundingBox());
    stable = next === previous ? stable + 1 : 0; previous = next;
    return stable;
  },{intervals:[100]}).toBeGreaterThanOrEqual(3);
}
async function clearGeometry(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const card = document.querySelector(".abyssa-tutorial__card")?.getBoundingClientRect();
    const target = document.querySelector('[data-tutorial-anchor][aria-describedby*="tutorial-copy-"]')?.getBoundingClientRect();
    const outline = document.querySelector(".abyssa-tutorial__outline")?.getBoundingClientRect();
    if (!card || !target || !outline) return false;
    const overlap = (r: DOMRect) => r.width > 0 && r.height > 0 && card.left < r.right && card.right > r.left && card.top < r.bottom && card.bottom > r.top;
    const protectedNodes = [...document.querySelectorAll<HTMLElement>("[data-tutorial-anchor]")].filter(n => /battle\.(die|health|enemy-health|intent):/.test(n.dataset.tutorialAnchor!) || /battle\.(event-|roll$|reroll$|end-turn$|items$|ledger$|hand$|multiplier$)/.test(n.dataset.tutorialAnchor!));
    const contexts = [...document.querySelectorAll(".abyssa-tutorial__context")];
    return card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight && Math.abs(outline.left - target.left + 6) < 1 && Math.abs(outline.top - target.top + 6) < 1 && [...protectedNodes,...contexts].every(n => !overlap(n.getBoundingClientRect()));
  })).toBe(true);
}
async function menu(page: Page, label: string) {
  await button(page,"展开菜单").click();
  await page.getByRole("button", {name:new RegExp(`^${label}`)}).click();
  await settled(page);
}
async function operation(page: Page, record: D5GameRecord) {
  await acknowledgeObservation(page);
  const op = choose(record);
  if (!op) throw Error("Missing next operation");
  if (op.type === "tutorial-read") {
    await button(page,"跳过本段对白").click();
    if (op.storyId === "S3-1") {
      await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
      expect((await saved(page)).head).toEqual(record.head);
      await button(page, "开始战斗").click();
    }
    if (op.storyId === "S3-4") await button(page,"守住出口").click();
  } else if (op.type === "advance") await keyPress(button(page,"继续前进"));
  else if (op.type === "tutorial-observe") await keyPress(button(page,"确认结果"));
  else if (op.type === "item") {
    await button(page,"打开道具坞").click();
    await guide(page,`battle.item:${op.instanceId}`);
    await keyPress(anchor(page,`battle.item:${op.instanceId}`));
    await guide(page,`battle.item-target:${op.instanceId}`);
    await keyPress(anchor(page,`battle.item-target:${op.instanceId}`));
  } else if (op.type === "event") {
    await expect(button(page,"ROLL")).toBeDisabled();
    await expect(anchor(page,"battle.member:kael")).toHaveAttribute("aria-disabled","true");
    await keyPress(anchor(page,`battle.member:${op.actorId}`));
    expect((await saved(page)).head).toEqual(record.head); // participant draft is not a game operation
    await keyPress(button(page,"ROLL"));
    await expect(page.locator('.manor-journey[data-event-phase="rolling"]')).toBeVisible();
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
    await expect(page.getByText("此刻尚未揭晓", {exact:true})).toBeVisible();
    await expect(page.getByLabel("整理结果", {exact:true})).toHaveCount(0);
  } else if (op.type === "battle") {
    const c = op.command;
    if (c.type === "roll" || c.type === "reroll" || c.type === "end-turn") await keyPress(button(page,c.type === "end-turn" ? "END TURN" : c.type.toUpperCase()));
    else if (c.type === "toggle-load") await keyPress(anchor(page,`battle.die:${c.actorId}`).locator(".expedition-die"));
    else if (c.type === "act") {
      await keyPress(anchor(page,`battle.member:${c.actorId}`));
      expect((await saved(page)).head).toEqual(record.head); // held actor is also only a UI draft
      await keyPress(anchor(page,`battle.${c.choice === "heal" ? "member" : c.choice === "guard" ? "intent" : "enemy"}:${c.targetId}`));
    } else throw Error(`Unexpected command ${c.type}`);
  } else throw Error(`Unexpected operation ${op.type}`);
  await settled(page);
}

test("tutorial overview follows the opening scene after the authored first-morning ending", async ({page}) => {
  test.setTimeout(90000);
  await load(page, beforeDeparture);
  await page.locator(".rp-app__cue").click();
  await expect(page).toHaveURL(/#\/battle/, {timeout:60000}); await settled(page);
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene-id", "tutorial:S3-1");
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toHaveCount(0);
  const pending = await saved(page);
  expect(pending.snapshot.campaign.opening?.status).toBe("viewed");
  expect(state(pending).tutorial).toMatchObject({stage: "story", story: {id: "S3-1", step: 0}, guide: {mode: "guided", cursor: 0}});
  const frames = g4Story.nodes.find(node=>node.id === "S3-1")!.frames!;
  for (let i = 0; i < frames.length; i++) {
    await expect(page.locator(".rp-app[data-layout=adv]")).toHaveAttribute("data-state", "idle");
    await expect(page.locator(".rp-adv__dialogue")).toContainText(frames[i].text);
    await button(page, i === frames.length - 1 ? "玩法总览" : "下一句").click();
  }
  await settled(page);
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
  expect(await saved(page)).toEqual(pending);
  await page.reload(); await settled(page);
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toBeVisible();
  expect(await saved(page)).toEqual(pending);
  await button(page, "开始战斗").click(); await settled(page);
  expect(state(await saved(page)).tutorial).toMatchObject({stage: "active", story: null});
  expect((await saved(page)).head.revision).toBe(pending.head.revision + 1);
});

for (const kind of ["battle", "event"] as const) test(`handbook returns to the same guided ${kind} selection without a command`, async ({page}, info) => {
  test.setTimeout(120000);
  const errors = await observeArtifacts(page);
    const archive = kind === "battle" ? beforeAction : beforeEvent;
    await load(page, archive);
    await acknowledgeObservation(page);
    const before = await saved(page);
    const actor = kind === "battle" ? "kael" : "elora";
    await keyPress(anchor(page, `battle.member:${actor}`));
    const selected = page.locator(kind === "battle" ? `.abyssa-expedition-party-card[data-character="${actor}"]` : '.manor-journey');
    const selectedBefore = await selected.first().innerHTML();
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(1);
    await button(page, "展开菜单").click();
    await button(page, "玩法手册").click();
    const dialog = page.getByRole("dialog", {name: "战斗与探索规则总览"});
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".handbook")).toHaveAttribute("data-chapter", "battle");
    await expect(dialog.locator(".handbook")).toHaveAttribute("data-section", "interface");
    await expect(dialog.locator(".handbook__interface-regions p").first()).toHaveCSS("color", "rgb(194, 203, 203)");
    await expect(dialog.locator(".handbook__heading > p")).toHaveCSS("color", "rgb(194, 203, 203)");
    await expect(page.locator(".abyssa-expedition")).toHaveAttribute("inert", "");
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
    await dialog.getByRole("button", {name: kind === "battle" ? "倍率机制" : "其他机制", exact: true}).click();
    if (kind === "event") await dialog.getByRole("button", {name: "事件机制：专长直通＋点数保底", exact: true}).click();
    else await dialog.getByRole("button", {name: "总倍率与金币结算", exact: true}).click();
    for (const img of await dialog.locator(".handbook__article img").all()) {
      await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    }
    await page.screenshot({path: info.outputPath(`handbook-in-${kind}.png`)});
    expect(await saved(page)).toEqual(before);
    await button(page, "返回实战").focus();
    await page.keyboard.press("Tab");
    await expect(button(page, "关闭战斗与探索规则总览")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".abyssa-expedition")).not.toHaveAttribute("inert");
    await expect(button(page, "展开菜单")).toBeFocused();
    await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(1);
    expect(await saved(page)).toEqual(before);
    expect(await selected.first().innerHTML()).toEqual(selectedBefore);
    // Reading can be resumed too, without discarding the last selected handbook section.
    await button(page, "玩法手册").click();
    await expect(dialog.locator(".handbook")).toHaveAttribute("data-chapter", kind === "battle" ? "rewards" : "other");
    await button(page, "返回实战").click();
    expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

for (const kind of ["battle", "event"] as const) test(`guided ${kind} hint collapses without losing the selection or hiding the next step`, async ({page}, info) => {
  test.setTimeout(120000);
  await load(page, kind === "battle" ? beforeAction : beforeEvent);
  await acknowledgeObservation(page);
  const actor = kind === "battle" ? "kael" : "elora";
  await keyPress(anchor(page, `battle.member:${actor}`));
  const before = await saved(page);
  const root = page.locator(".abyssa-tutorial");
  await expect(root).toHaveAttribute("data-visible", "true");
  const step = await root.getAttribute("data-step");
  const selection = page.locator(kind === "battle" ? `.abyssa-expedition-party-card[data-character="${actor}"]` : ".manor-journey").first();
  const selectionBefore = await selection.innerHTML();
  await button(page, "收起操作指引").click();
  await expect(root).toHaveAttribute("data-collapsed", "true");
  await expect(root.locator(".abyssa-tutorial__outline")).not.toHaveCount(0);
  await expect(button(page, "展开操作指引")).toBeVisible();
  expect(await saved(page)).toEqual(before);
  expect(await selection.innerHTML()).toEqual(selectionBefore);
  await page.screenshot({path: info.outputPath(`collapsed-${kind}.png`)});
  await button(page, "展开操作指引").click();
  await expect(root).not.toHaveAttribute("data-collapsed");
  await button(page, "收起操作指引").click();
  await menu(page, "操作指引");
  await expect(root).not.toHaveAttribute("data-collapsed");
  expect(await saved(page)).toEqual(before);
  await button(page, "收起操作指引").click();
  // Continue from the original selected actor while the long explanation is collapsed.
  const op = choose(before);
  if (op?.type === "battle" && op.command.type === "act") await keyPress(anchor(page, `battle.enemy:${op.command.targetId}`));
  else if (op?.type === "event") await keyPress(button(page, "ROLL"));
  else throw Error("Expected a selected battle/event action");
  await settled(page);
  await expect(root).toHaveAttribute("data-visible", "true");
  await expect(root).not.toHaveAttribute("data-collapsed");
  await expect(root).not.toHaveAttribute("data-step", step!);
  expect(state(await saved(page)).tutorial!.hintsEnabled).toBe(true);
});

for (const [kind, focus, next] of [
  ["slimes","battle.enemies","battle.roll"],
  ["bowReady","bow-intent","battle.roll"],
  ["event","battle.event-scene","battle.member:elora"],
  ["twoPairs","battle.hand","battle.die:kael"],
  ["pairResult","battle.multiplier",null],
] as const) test(`orientation: ${kind} focuses the situation before controls and never writes gameplay`, async ({page}, info) => {
  test.setTimeout(120000);
  await load(page,observationArchives[kind]);
  const before=await saved(page), root=page.locator(".abyssa-tutorial");
  const target=focus === "bow-intent"
    ? `battle.intent:${state(before).encounter!.enemies.find(e=>e.definitionId === "enemy.intro.crossbowman")!.id}` : focus;
  await expect(root).toHaveAttribute("data-step",new RegExp(`^guided.observe.${kind}:`));
  await expect(anchor(page,target)).toHaveAttribute("aria-describedby",/tutorial-copy-/);
  await clearGeometry(page);
  if (kind === "twoPairs") await expect(root).toContainText("下方牌型栏也已亮起");
  if (kind === "pairResult") await expect(root).toContainText("诺玛也补上了一记飞刀");
  if (kind === "bowReady") await contextFocus(page,"battle.health:eustice");
  await page.screenshot({path:info.outputPath(`${kind}-observe.png`)});
  if (kind === "pairResult") {
    const scroll=await stageScroll(page);
    await button(page,"远征账本").click();
    await expect(root).not.toHaveAttribute("data-visible");
    await button(page,"收起账本").click();
    expect(await stageScroll(page)).toEqual(scroll);
    await expect(root).toHaveAttribute("data-visible","true");
    expect(await saved(page)).toEqual(before);
  }
  // Closing is still a local collapse, not a dismissal or acknowledgment.
  await button(page,"收起操作指引").click();
  await expect(root).toHaveAttribute("data-collapsed","true");
  expect(await saved(page)).toEqual(before);
  await button(page,"展开操作指引").click();
  await acknowledgeObservation(page);
  if (next) {
    await guide(page,next);
    const expectedContext=kind === "slimes" ? "battle.enemies" : kind === "bowReady" ? target : kind === "event" ? "battle.event-scene" : "battle.hand";
    await contextFocus(page,expectedContext);
    await clearGeometry(page);
    await page.screenshot({path:info.outputPath(`${kind}-action.png`)});
  } else await expect(root).toHaveCount(0);
  await page.reload(); await settled(page);
  await expect(page.locator('.abyssa-tutorial[data-observation="true"]')).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  if (next) await guide(page,next);
});

test("G4: authored reading, truthful cues, five-room controls, recovery and exact claim", async ({page}, info) => {
  test.setTimeout(480000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  const errors = await observeArtifacts(page);
  await load(page,beforeDeparture);
  await page.locator(".rp-app__cue").click();
  await expect(page).toHaveURL(/#\/battle/, {timeout:60000}); await settled(page);
  await expect(page.locator(".scene-sequence")).toHaveAttribute("data-scene-id", "tutorial:S3-1");
  await expect(page.getByRole("heading", {name: "战斗与探索规则总览"})).toHaveCount(0);
  let testedUndo = false, testedResult = false;
  const stories = new Set<string>(), battles = new Set<number>();
  for (let n = 0; n < 180; n++) {
    let record = await saved(page), s = state(record), t = s.tutorial!;
    expect(record.contentRef.contentVersion).toBe(11);
    expect(t.stage).not.toBe("failed");
    if (t.stage === "claimable") break;
    if (t.story) {
      stories.add(t.story.id);
      const frames = g4Story.nodes.find(node=>node.id === t.story!.id)!.frames!;
      for (let i = 0; i < frames.length; i++) {
        // Let typing finish: a queued reveal click can become "next" on the final glyph.
        await expect(page.locator(".rp-app[data-layout=adv]")).toHaveAttribute("data-state","idle");
        await expect(page.locator(".rp-adv__dialogue")).toContainText(frames[i].text);
        expect((await saved(page)).head).toEqual(record.head); // paging is not a story command
        if (t.story.id === "S4-1" && i === 7 || t.story.id === "S4-2" && i === 5) {
          await page.screenshot({path:info.outputPath(`${t.story.id}-reading.png`)});
          await page.reload(); await settled(page);
          await expect(page.locator(".rp-app[data-layout=adv]")).toHaveAttribute("data-state","idle");
          await expect(page.locator(".rp-adv__dialogue")).toContainText(frames[i].text);
        }
        if (i < frames.length-1) await button(page,"下一句").click();
      }
    }
    if (s.node === "battle") battles.add(s.run.room);
    if (!testedUndo && t.guide?.cursor === 2) {
      testedUndo = true;
      await expect(button(page,"END TURN")).toBeDisabled();
      await expect(button(page,"REROLL")).toBeDisabled();
      await expect(anchor(page,"battle.die:eustice").locator(".expedition-die")).toBeDisabled();
      await button(page,"展开菜单").click();
      await expect(page.getByRole("button",{name:/^结束回合/})).toBeDisabled();
      await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await button(page,"远征账本").click();
      await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(0);
      await page.keyboard.press("Escape");
      for (const [width,height] of [[1280,720],[1600,900],[1920,1080]]) {
        await page.setViewportSize({width,height}); await guide(page,"battle.die:kael"); await stableFrame(page);
        const before = await page.locator(".abyssa-expedition-frame").boundingBox();
        await button(page,"收起操作指引").click(); await settled(page);
        expect(state(await saved(page)).tutorial!.guide).toEqual(t.guide);
        await expect(button(page,"END TURN")).toBeDisabled();
        expect(await page.locator(".abyssa-expedition-frame").boundingBox()).toEqual(before);
        await menu(page,"操作指引"); await guide(page,"battle.die:kael");
        await clearGeometry(page);
        await page.screenshot({path:info.outputPath(`guide-${width}.png`)});
      }
      await page.setViewportSize({width:1600,height:900});
      await operation(page, await saved(page)); // fix
      await keyPress(button(page,"撤回：上一步操作")); await settled(page);
      expect(state(await saved(page)).tutorial!.guide).toEqual(t.guide);
      record = await saved(page); s = state(record); t = s.tutorial!;
    }
    if (s.node === "event") {
      await expect(page.getByRole("heading",{name:"潮坑落货",exact:true})).toBeVisible();
      await expect(page.locator(".manor-journey")).not.toContainText(/庄园|迎宾簿|遗物/);
      for (const [width,height] of [[1280,720],[1600,900],[1920,1080]]) {
        await page.setViewportSize({width,height}); await stableFrame(page);
        await guide(page,"battle.member:elora"); await clearGeometry(page);
        await page.screenshot({path:info.outputPath(`event-participant-${width}.png`)});
      }
      await page.setViewportSize({width:1600,height:900}); await stableFrame(page);
    }
    if (s.node === "battle" && s.encounter!.round === 1 && s.encounter!.phase === "roll" && s.run.room === 4) {
      await expect(page.locator(".battle-reaction__speech")).toContainText(tactical.bossA.text);
      await expect(page.getByLabel("战斗目标")).toHaveText("击败全部敌人，夺回货物。");
      await expect(page.locator(".abyssa-tutorial")).toHaveAttribute("data-step",/^guided.observe.boss:/);
      await clearGeometry(page);
      await page.screenshot({path:info.outputPath("boss-observe.png")});
      await acknowledgeObservation(page);
      await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
      await page.screenshot({path:info.outputPath("boss-opening.png")});
    }
    if (s.node === "battle" && s.run.room === 3 && s.encounter!.round === 1 && s.encounter!.phase === "roll") {
      if (!t.hintsEnabled) await menu(page,"操作指引");
      await guide(page,"battle.roll");
      await contextFocus(page,"battle.enemies");
      await expect(page.locator(".abyssa-tutorial__card")).toContainText("战利品更丰厚");
      record = await saved(page);
    }
    if (t.guide?.cursor === 47) {
      for (const [width,height] of [[1280,720],[1600,900],[1920,1080]]) {
        await page.setViewportSize({width,height}); await stableFrame(page);
        await guide(page,"battle.end-turn"); await contextFocus(page,"battle.multiplier"); await clearGeometry(page);
        await expect(page.locator(".abyssa-tutorial__card")).toContainText("两对已成型");
        await expect(page.locator(".abyssa-tutorial__card")).toContainText("追击");
        await page.screenshot({path:info.outputPath(`multiplier-${width}.png`)});
      }
      await page.setViewportSize({width:1600,height:900});
    }
    if (!testedResult && choose(record)?.type === "tutorial-observe") {
      testedResult = true;
      await expect(page.getByLabel("整理结果",{exact:true})).toContainText("强成功");
      await expect(page.getByLabel("整理结果",{exact:true})).toContainText("花费 0 G · 获得 0 G");
      await expect(button(page,"继续前进")).toHaveCount(0);
      await button(page,"收起操作指引").click(); await settled(page);
      const before = await saved(page);
      await page.reload(); await settled(page);
      expect((await saved(page)).snapshot).toEqual(before.snapshot);
      await expect(page.locator(".abyssa-tutorial")).toHaveAttribute("data-visible", "true");
      await expect(page.locator(".abyssa-tutorial")).not.toHaveAttribute("data-collapsed");
      await expect(button(page,"确认结果")).toBeEnabled();
      await page.screenshot({path:info.outputPath("event-result-restored.png")});
      record = await saved(page);
      await page.emulateMedia({reducedMotion:"reduce"}); // normal event reveal already verified above
    }
    await operation(page,record);
    if (t.guide?.cursor === 47) {
      await expect(page.locator(".battle-reaction__speech")).toContainText(tactical.throwingKnife.text);
      await expect(page.getByLabel("当前总倍率 3.30")).toBeVisible();
      const scroll=await stageScroll(page);
      await button(page,"远征账本").click();
      await expect(page.getByLabel("收益倍率明细")).toContainText("牌型 ×3.00 · 层深 ×1.00 · 大地加成 ×1.10 ＝ 总倍率 ×3.30");
      await page.screenshot({path:info.outputPath("multiplier-ledger.png")});
      await button(page,"收起账本").click();
      expect(await stageScroll(page)).toEqual(scroll);
      await expect(page.locator('.abyssa-tutorial[data-observation="true"]')).toHaveAttribute("data-visible","true");
      await page.screenshot({path:info.outputPath("covenant-impact.png")});
    }
  }
  const before = await saved(page), s = state(before);
  expect(testedUndo && testedResult).toBe(true);
  expect(s.tutorial!.stage).toBe("claimable");
  expect(s.tutorial!.guide).toMatchObject({mode:"free",reason:"completed",cursor:48});
  expect(s.run.eventResults).toHaveLength(1);
  expect([...battles]).toEqual([0,1,3,4]);
  expect([...stories]).toEqual(["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1","S4-2"]);
  expect(s.result!.totalGold).toBe(36);
  expect(before.snapshot.campaign.funds.party).toBe(0);
  expect(before.snapshot.campaign.clock.phase).toBe("dawn");
  await expect(page.getByLabel("本次结算")).toContainText("远征实得 36 G · 追回报酬 8 G · 本次总入账 44 G");
  await page.screenshot({path:info.outputPath("claim.png")});
  await keyPress(button(page,"领取并返回洋馆"));
  await expect(page).toHaveURL(/#\/mansion/,{timeout:60000}); await settled(page);
  const after = await saved(page);
  expect(after.snapshot.campaign.funds.party).toBe(44);
  expect(after.snapshot.campaign.settlements).toHaveLength(1);
  expect(after.snapshot.campaign.tutorial!.status).toBe("completed");
  expect(after.snapshot.campaign.clock).toMatchObject({day:1,phase:"day"});
  expect(after.snapshot.campaign.supplies.map(s => [s.definitionId,s.charges])).toEqual([["item.food",3],["item.potion",2]]);
  await page.reload(); await settled(page);
  expect((await saved(page)).snapshot).toEqual(after.snapshot);
  expect(errors).toEqual([]);
});

test("G3: explicitly exit guidance, keep hints separate and bypass E1 without an extra roll", async ({page},info) => {
  test.setTimeout(120000);
  await load(page,beforeEvent,"/abyssa/");
  const before = state(await saved(page));
  await expect(button(page,"绕行")).toBeDisabled();
  await menu(page,"退出带做");
  expect(state(await saved(page)).tutorial!.guide).toMatchObject({mode:"free",reason:"exited"});
  expect(state(await saved(page)).tutorial!.hintsEnabled).toBe(true);
  await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
  await expect(button(page,"绕行")).toBeEnabled();
  await keyPress(button(page,"绕行")); await settled(page);
  const result = state(await saved(page));
  expect(result.run.eventResults[0].method).toBe("skip");
  expect(result.run.eventRng).toEqual(before.run.eventRng);
  await expect(page.locator(".manor-journey")).not.toContainText(/庄园|迎宾簿|遗物/);
  await keyPress(button(page,"继续前进")); await settled(page);
  await keyPress(button(page,"ROLL")); await settled(page);
  await expect(button(page,"END TURN")).toBeEnabled();
  await keyPress(anchor(page,"battle.die:eustice").locator(".expedition-die")); await settled(page);
  await keyPress(button(page,"撤回：上一步操作")); await settled(page);
  expect(state(await saved(page)).tutorial!.guide).toMatchObject({mode:"free",reason:"exited"});
  await page.screenshot({path:info.outputPath("free.png")});
  await page.reload(); await settled(page);
  expect(state(await saved(page)).tutorial!.guide?.mode).toBe("free");
});
