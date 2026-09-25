import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { D5GameRecord } from "../../src/game-application";
import type { tideOperation as Operation } from "../../src/game-client/testing/tide-cave";
import { observeArtifacts } from "./helpers";
import { confirmNewGame } from "./new-game-helpers";

let afterMorning: string, beforeDeparture: string, currentContentVersion: number, choose: typeof Operation;
test.beforeAll(async () => {
  const outfile = resolve(projectRoot, "dist/reports/tide-cave/client-fixture.mjs");
  await build({absWorkingDir: projectRoot, entryPoints: ["src/game-client/testing/tide-cave.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022"});
  const module = await import(pathToFileURL(outfile).href);
  choose = module.tideOperation;
  const f = await module.tideClientFixture(9); // preserve the four-room compatibility regression
  afterMorning = f.afterMorning; beforeDeparture = f.beforeDeparture;
  currentContentVersion = f.currentContentVersion;
  f.session.dispose();
});
async function load(page: Page, archive: string, prefix = "/") {
  await page.goto(prefix);
  await page.getByRole("button", {name: "记录", exact: true}).click({timeout: 60_000});
  // Current packages preserve active narrative identity; use the supported recovery flow.
  const source = JSON.parse(archive) as {record: D5GameRecord};
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption(source.record.narrative ? "restore" : "application");
  await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: "tide.json", mimeType: "application/json", buffer: Buffer.from(archive)});
}
async function settled(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 60_000});
  await expect(page.locator(".game-client-status").first()).toHaveAttribute("data-status", "ready");
  const sequence = page.locator(".scene-sequence"), record = await saved(page);
  if (record.snapshot.run?.kind === "expedition" && record.snapshot.run.state.tutorial) {
    // A final hit removes the battle after its queue finishes. Wait for the committed destination,
    // not for the outgoing board to become idle after it has been unmounted.
    await expect(sequence).toHaveAttribute("data-scene", record.snapshot.run.state.tutorial.story ? "adv" : "battle", {timeout: 20000});
  }
  if (await sequence.count()) await expect(sequence).toHaveAttribute("data-phase", "idle", {timeout: 20000});
  const board = page.locator(".abyssa-expedition");
  if (await board.count()) await expect(board).toHaveAttribute("aria-busy", "false", {timeout: 20000});
}
async function saved(page: Page): Promise<D5GameRecord> {
  return page.evaluate(async () => {
    const id = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    return await new Promise<any>((resolve, reject) => {
      const open = indexedDB.open("abyssa-game-v1", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, get = db.transaction("saves", "readonly").objectStore("saves").get(id);
        get.onsuccess = () => {resolve(get.result); db.close();}; get.onerror = () => {reject(get.error); db.close();};
      };
    });
  });
}
async function doOperation(page: Page, record: D5GameRecord) {
  const op = choose(record);
  if (!op) return false;
  if (op.type === "tutorial-read") {
    if (op.storyId === "S3-4" && !(record.snapshot.run?.kind === "expedition" && record.snapshot.run.state.tutorial!.choices.length)) {
      await page.getByRole("button", {name: "跳过本段对白"}).click();
      await expect(page.getByRole("button", {name: "先检查货物", exact: true})).toBeVisible();
      await page.screenshot({path: test.info().outputPath("cargo-choice.png")});
      await page.getByRole("button", {name: "先检查货物", exact: true}).click();
    } else await page.getByRole("button", {name: "跳过本段对白"}).click();
  } else if (op.type === "advance") await page.getByRole("button", {name: "继续前进", exact: true}).click();
  else if (op.type === "item") {
    if (record.snapshot.run?.kind !== "expedition" || op.target.kind !== "member") throw Error("Unexpected item");
    const supplyIndex = record.snapshot.run.state.run.supplies.findIndex(s => s.instanceId === op.instanceId);
    await page.getByRole("button", {name: "打开道具坞", exact: true}).click();
    await page.locator(".item-dock__slots button").nth(supplyIndex).click();
    const id = op.target.id;
    const names: Record<string,string> = {kael:"你",eustice:"尤斯缇丝",elora:"艾洛拉",kororo:"柯萝萝",norma:"诺玛"};
    await page.locator(".item-dock__target-list").getByRole("button", {name: names[id], exact: true}).click();
    await settled(page);
    await page.getByRole("button", {name: "返回行动", exact: true}).click();
  } else if (op.type === "battle") {
    const c = op.command;
    if (c.type === "roll" || c.type === "reroll" || c.type === "end-turn") await page.getByRole("button", {name: c.type === "end-turn" ? "END TURN" : c.type.toUpperCase(), exact: true}).click();
    else if (c.type === "toggle-load") await page.locator(`[data-tutorial-anchor="battle.die:${c.actorId}"]`).click();
    else if (c.type === "act") {
      await page.locator(`[data-tutorial-anchor="battle.member:${c.actorId}"]`).click();
      const anchor = c.choice === "heal" ? `battle.member:${c.targetId}` : c.choice === "guard" ? `battle.intent:${c.targetId}` : `battle.enemy:${c.targetId}`;
      await page.locator(`[data-tutorial-anchor="${anchor}"]`).click();
    } else throw Error(`Unexpected action ${c.type}`);
  } else throw Error(`Unexpected operation ${op.type}`);
  await settled(page);
  return true;
}
async function expectStableEnemyArt(page: Page) {
  await expect.poll(async () => {
    const sizes = await page.locator(".abyssa-expedition-enemy > img").evaluateAll(nodes => nodes.map(node => {
      const image = node as HTMLImageElement, style = getComputedStyle(image);
      const frame = image.closest<HTMLElement>(".abyssa-expedition-frame")!;
      const frameScale = frame.getBoundingClientRect().width / frame.offsetWidth;
      return {
        authored: Number.parseFloat(image.style.height), rendered: image.getBoundingClientRect().height,
        expected: Number.parseFloat(image.style.height) * frameScale, maxWidth: style.maxWidth,
      };
    }));
    return sizes.length > 0 && sizes.every(size => size.maxWidth === "none" && Math.abs(size.rendered - size.expected) < 0.5)
      ? "stable"
      : JSON.stringify(sizes);
  }).toBe("stable");
}

test("normal morning handoff, four real battles, return stories and single reward", async ({page}, info) => {
  test.setTimeout(360_000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  const errors = await observeArtifacts(page);
  await load(page, beforeDeparture);
  await expect(page).toHaveURL(/#\/mansion/, {timeout: 60_000});
  await settled(page);
  await page.locator(".rp-app__cue").click();
  await expect(page).toHaveURL(/#\/battle.*expedition=/, {timeout: 60_000});
  await settled(page);
  expect((await saved(page)).contentRef.contentVersion).toBe(9);
  await expect(page.getByRole("main", {name: "雾滩·退潮岩窟"})).toBeVisible();
  await page.screenshot({path: info.outputPath("arrival.png")});
  let rolled = false, sawChoice = false, sawHome = false;
  const photographed = new Set<number>();
  for (let i = 0; i < 210; i++) {
    const record = await saved(page), run = record.snapshot.run;
    if (run?.kind !== "expedition") throw Error("Missing tutorial run");
    const t = run.state.tutorial!;
    if (t.stage === "claimable") break;
    expect(t.stage).not.toBe("failed");
    if (t.stage === "active" && run.state.node === "battle") await expectStableEnemyArt(page);
    if (t.stage === "active" && run.state.node === "battle" && !photographed.has(run.state.run.room)) {
      photographed.add(run.state.run.room);
      const expectedBackground = ["bg.tide-reef.shore", "bg.tide-reef.shore", "tidecall-grotto", "bg.tide-reef.cargo"][run.state.run.room];
      for (const selector of [".abyssa-expedition-enemies", ".abyssa-expedition-scene", ".battle-story-shell"]) {
        await expect.poll(async () => page.locator(selector).evaluate(node => {
          const style = getComputedStyle(node);
          return `${style.backgroundImage} ${style.getPropertyValue("--manor-scene-image")}`;
        })).toContain(expectedBackground);
      }
      await page.screenshot({path: info.outputPath(`encounter-${run.state.run.room + 1}.png`)});
    }
    if (t.story?.id === "S3-4") sawChoice = true;
    if (t.story?.id === "S4-1") {
      sawHome = true;
      await page.reload(); await settled(page);
      await page.screenshot({path: info.outputPath("return.png")});
    }
    if (!rolled && run.state.encounter?.phase === "act") {
      rolled = true;
      expect(run.state.encounter.dice.map(d => d.faceIndex! + 1)).toEqual([2, 2, 1, 1, 3]);
      for (const width of [1280, 1920]) {
        await page.setViewportSize({width, height: width * 9 / 16});
        await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveCount(1);
        await page.screenshot({path: info.outputPath(`roll-${width}.png`)});
      }
      // Opening the manual help over an active tutorial must still close in one click.
      await page.getByRole("button", {name: "操作指引", exact: true}).click();
      await expect(page.locator(".abyssa-tutorial[data-visible]")).toHaveAttribute("data-step", "battle.basics.intent");
      await page.getByRole("button", {name: "关闭操作指引", exact: true}).click(); await settled(page);
      await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
      const before = await saved(page);
      await page.reload(); await settled(page);
      expect((await saved(page)).snapshot).toEqual(before.snapshot);
      await expect(page.locator(".abyssa-tutorial")).toHaveCount(0);
    }
    await doOperation(page, record);
  }
  const before = await saved(page), final = before.snapshot.run;
  expect(final?.kind).toBe("expedition");
  if (final?.kind !== "expedition") throw Error("Missing result");
  expect(final.state.tutorial?.stage).toBe("claimable");
  expect(final.state.tutorial?.choices[0].choice).toBe("C");
  expect(rolled && sawChoice && sawHome).toBe(true);
  await page.screenshot({path: info.outputPath("claim.png")});
  await page.getByRole("button", {name: "领取并返回洋馆", exact: true}).click();
  await expect(page).toHaveURL(/#\/mansion/, {timeout: 60_000}); await settled(page);
  const complete = await saved(page);
  expect(complete.snapshot.campaign.tutorial?.status).toBe("completed");
  expect(complete.snapshot.campaign.funds.party).toBe(final.state.result!.totalGold + 8);
  expect(complete.snapshot.campaign.settlements).toHaveLength(1);
  expect(complete.snapshot.campaign.manor?.takeover).toBeNull();
  await page.reload(); await settled(page);
  expect((await saved(page)).snapshot.campaign.funds).toEqual(complete.snapshot.campaign.funds);
  const route = new URL(page.url()); route.hash = route.hash.replace("/mansion", "/shop");
  await page.goto(route.href); await settled(page); await expect(page).toHaveURL(/#\/shop/);
  expect(errors).toEqual([]);
});

test("pending chapter cannot be bypassed, wipe restores the encounter or chapter checkpoint", async ({page}, info) => {
  test.setTimeout(180_000);
  await load(page, afterMorning, "/abyssa/");
  await expect(page).toHaveURL(/#\/battle.*expedition=/, {timeout: 60_000}); await settled(page);
  const url = new URL(page.url()); url.hash = url.hash.replace("/battle", "/map");
  await page.goto(url.href); await expect(page).toHaveURL(/#\/battle/, {timeout: 60_000}); await settled(page);
  await page.getByRole("button", {name: "跳过本段对白"}).click(); await settled(page);
  const original = await saved(page);
  for (const scope of ["重试本场", "从入口重来"]) {
    for (let i=0; i<60; i++) {
      const record = await saved(page), run = record.snapshot.run;
      if (run?.kind !== "expedition") throw Error("No run");
      if (run.state.tutorial?.stage === "failed") break;
      const phase = run.state.encounter!.phase;
      await page.getByRole("button", {name: phase === "roll" ? "ROLL" : "END TURN", exact: true}).click(); await settled(page);
    }
    await page.reload(); await settled(page);
    await expect(page.getByRole("heading", {name: "重新整队"})).toBeVisible();
    await page.screenshot({path: info.outputPath("retry.png")});
    const failed = await saved(page);
    expect(failed.snapshot.campaign.settlements).toHaveLength(0);
    await page.getByRole("button", {name: scope, exact: true}).click(); await settled(page);
    const retry = await saved(page), run = retry.snapshot.run;
    if (run?.kind !== "expedition" || original.snapshot.run?.kind !== "expedition") throw Error("No run");
    expect(run.state.run.party).toEqual(original.snapshot.run.state.run.party);
    expect(run.state.run.supplies).toEqual(original.snapshot.run.state.run.supplies);
    expect(run.state.run.rng).toEqual(original.snapshot.run.state.run.rng);
    expect(retry.snapshot.campaign.clock).toEqual(original.snapshot.campaign.clock);
  }
});

test("new game keeps the prologue and authored morning ahead of tutorial", async ({page}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", {name: "新的开始", exact: true}).click({timeout: 60_000});
  await confirmNewGame(page, "序章");
  await expect(page).toHaveURL(/#\/prologue/, {timeout: 60_000}); await settled(page);
  const record = await saved(page);
  expect(record.contentRef.contentVersion).toBe(currentContentVersion);
  expect(record.snapshot.campaign.prologue?.status).toBe("playing");
  expect(record.snapshot.campaign.tutorial?.status).toBe("pending");
  await page.getByRole("button", {name: "按住跳过序幕"}).focus();
  await page.keyboard.down("Space");
  await expect(page).toHaveURL(/#\/mansion/, {timeout: 15_000});
  await page.keyboard.up("Space"); await settled(page);
  expect((await saved(page)).snapshot.campaign.opening?.step).toBe(0);
  expect((await saved(page)).snapshot.run).toBeNull();
});
