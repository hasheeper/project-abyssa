import { openManorJournal } from "./playable-helpers";
import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import { depart } from "./playable-helpers";
import { observeArtifacts } from "./helpers";
import type { FirstAirpRecord as D5GameRecord } from "../../src/game-application/testing/airp-playthrough";
import type { airpPatrolCommand } from "../../src/game-application/testing/airp-playthrough";

let pending: D5GameRecord, choose: typeof airpPatrolCommand;
test.beforeAll(async () => {
  test.setTimeout(180000);
  const outfile = resolve(projectRoot, "dist/reports/airp-2/browser-fixture.mjs");
  await build({ absWorkingDir: projectRoot, entryPoints: ["src/game-application/testing/airp-playthrough.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022" });
  const module = await import(pathToFileURL(outfile).href);
  choose = module.airpPatrolCommand;
  const file = resolve(projectRoot, "dist/reports/airp-2/checkpoints.json");
  // The player restore reader revalidates this command-produced archive in the browser.
  pending = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).pending : await (await module.firstAirpOffer()).read();
});
async function saved(page: Page): Promise<D5GameRecord> {
  return page.evaluate(async () => {
    const id = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    return await new Promise<any>((resolve, reject) => {
      const open = indexedDB.open("abyssa-game-v1", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, get = db.transaction("saves", "readonly").objectStore("saves").get(id);
        get.onsuccess = () => { resolve(get.result); db.close(); }; get.onerror = () => { reject(get.error); db.close(); };
      };
    });
  });
}
async function ready(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, { timeout: 60000 });
  await expect(page.locator(".game-client-status")).toHaveAttribute("data-status", "ready", { timeout: 30000 });
  const sequence = page.locator(".scene-sequence");
  if (await sequence.count()) await expect(sequence).toHaveAttribute("data-phase", "idle", { timeout: 20000 });
  const board = page.locator(".abyssa-expedition");
  if (await board.count()) await expect(board).toHaveAttribute("aria-busy", "false", { timeout: 20000 });
}
async function readConversation(page: Page) {
  for (let i = 0; i < 40; i++) {
    await ready(page);
    const r = await saved(page), n = r.narrative!, reading = n.reading;
    if (!reading || reading.completed || reading.paused) return;
    const scene = n.scenes.find(s => s.id === reading.sceneId)!, node = scene.body.nodes[reading.node];
    if (node.kind === "choice") await page.getByRole("button", { name: node.options[2].label, exact: true }).click();
    else await page.locator(".rp-app__cue").click();
    // One physical click can reveal text OR acknowledge it. Re-read durable state
    // before the next click; a timed second click can hit an unmounted final page.
    await ready(page);
  }
  throw Error("Reading did not finish");
}
test("AIRP: accept, real patrol, refresh with case, return and exactly one shared memory", async ({ page }, info) => {
  test.setTimeout(480000);
  page.setDefaultTimeout(20000);
  const errors = await observeArtifacts(page);
  // Only the initial departure seed is fixed. Rolls/damage/loot use the actual rules.
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => { if (values instanceof Uint32Array && values.length === 1) { values[0] = 19; return values; } return original(values); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "记录", exact: true }).click({ timeout: 60000 });
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "airp.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ archiveVersion: 4, record: pending })) });
  await expect(page).toHaveURL(/#\/menu/, { timeout: 60000 }); await ready(page);
  await page.goto(`/#/mansion?save=${pending.head.saveId}&epoch=${pending.head.epoch}`); await ready(page);
  await openManorJournal(page, "旧药箱的搭扣"); await page.getByRole("button", { name: "问问艾洛拉", exact: true }).click(); await ready(page);
  await page.screenshot({ path: info.outputPath("offer.png") });
  await page.getByRole("button", { name: "稍后再说", exact: true }).click(); await ready(page);
  await page.reload(); await ready(page);
  await openManorJournal(page, "旧药箱的搭扣"); await page.getByRole("button", { name: "继续谈药箱", exact: true }).click(); await readConversation(page);
  expect((await saved(page)).narrative!.instance).toMatchObject({ status: "accepted", stance: "pragmatic" });
  await depart(page, 5, 30000, true); await ready(page);
  let photographed = false;
  for (let i = 0; i < 300; i++) {
    await ready(page);
    if (await page.locator('.scene-sequence[data-scene="adv"]').count()) { await page.getByRole("button", { name: "跳过本段对白" }).click(); continue; }
    const r = await saved(page);
    if (!r.snapshot.run) break;
    if (r.narrative!.carryFactId && !photographed) {
      photographed = true;
      await page.getByRole("button", { name: "远征账本", exact: true }).click();
      await page.getByText("已找到空药箱", { exact: true }).click();
      await page.screenshot({ path: info.outputPath("found-case.png") });
      await page.getByRole("button", { name: "收起账本", exact: true }).click();
      const before = (await saved(page)).narrative;
      await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(before);
    }
    const op = choose(r);
    if (op.type === "resume-run") { await expect.poll(async () => (await saved(page)).head.revision).toBeGreaterThan(r.head.revision); continue; }
    if (op.type === "settle-expedition") { await page.getByRole("button", { name: "返回洋馆", exact: true }).click(); break; }
    if (op.type === "advance-room") await page.getByRole("button", { name: "继续前进", exact: true }).click();
    else if (op.type === "choose-event") await page.getByRole("button", { name: op.choiceId === "skip" ? "绕行" : "阅读迎宾簿", exact: true }).click();
    else if (op.type === "choose-exit") await page.getByRole("button", { name: "带宝离场", exact: true }).click();
    else if (op.type === "use-item" && op.target.kind === "member") {
      const run = r.snapshot.run;
      if (run.kind !== "expedition") throw Error("No patrol");
      const index = run.state.run.supplies.findIndex(s => s.instanceId === op.instanceId);
      await page.getByRole("button", { name: "打开道具坞", exact: true }).click();
      await page.locator(".item-dock__slots button").nth(index).click();
      const names: Record<string, string> = { kael: "你", elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛" };
      await page.locator(".item-dock__target-list").getByRole("button", { name: op.target.id === "kael" ? /^(你|凯尔)$/ : names[op.target.id], exact: true }).click();
      await ready(page); await page.getByRole("button", { name: "返回行动", exact: true }).click();
    } else if (op.type === "battle-command") {
      const c = op.command;
      if (c.type === "roll" || c.type === "end-turn" || c.type === "reroll") await page.getByRole("button", { name: c.type === "end-turn" ? "END TURN" : c.type.toUpperCase(), exact: true }).click();
      else if (c.type === "toggle-load") await page.locator(`[data-tutorial-anchor="battle.die:${c.actorId}"]`).click();
      else if (c.type === "act") {
        await page.locator(`[data-tutorial-anchor="battle.member:${c.actorId}"]`).click();
        await page.locator(`[data-tutorial-anchor="battle.${c.choice === "heal" ? "member" : c.choice === "guard" ? "intent" : "enemy"}:${c.targetId}"]`).click();
      } else throw Error(`Unexpected action ${c.type}`);
    } else throw Error(`Unexpected command ${op.type}`);
  }
  await expect(page).toHaveURL(/#\/mansion/, { timeout: 60000 }); await ready(page);
  expect(photographed).toBe(true); expect((await saved(page)).narrative!.instance!.status).toBe("ready");
  await openManorJournal(page, "旧药箱的搭扣"); await page.getByRole("button", { name: "把药箱交给艾洛拉", exact: true }).click(); await ready(page);
  await page.screenshot({ path: info.outputPath("return.png") });
  await page.reload(); await ready(page); await readConversation(page);
  const funds = (await saved(page)).snapshot.campaign.funds;
  await page.getByRole("button", { name: "交付空药箱", exact: true }).click(); await ready(page);
  const resolved = await saved(page);
  expect(resolved.narrative!.instance!.status).toBe("resolved"); expect(resolved.narrative!.memories).toHaveLength(1);
  expect(resolved.snapshot.campaign.funds).toEqual(funds);
  await info.attach("final-archive", { body: Buffer.from(JSON.stringify({ archiveVersion: 4, record: resolved })), contentType: "application/json" });
  await openManorJournal(page, "旧药箱的搭扣"); await page.getByText("委托记录", { exact: true }).click(); await page.screenshot({ path: info.outputPath("resolved.png") });
  await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(resolved.narrative);
  expect(errors).toEqual([]);
});
