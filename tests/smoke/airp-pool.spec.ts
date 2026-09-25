import { openManorJournal } from "./playable-helpers";
import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../../config/paths.mjs";
import type { PoolRecord, poolPatrolCommand } from "../../src/game-application/testing/airp-pool-playthrough";
import { depart } from "./playable-helpers";
import { observeArtifacts } from "./helpers";

let pending: PoolRecord, choose: typeof poolPatrolCommand;
test.beforeAll(async () => {
  test.setTimeout(180000);
  const outfile = resolve(projectRoot, "dist/reports/airp-3/browser-fixture.mjs");
  await build({ absWorkingDir: projectRoot, entryPoints: ["src/game-application/testing/airp-pool-playthrough.ts"], outfile, bundle: true, format: "esm", platform: "node", target: "es2022" });
  const module = await import(pathToFileURL(outfile).href); choose = module.poolPatrolCommand;
  const file = resolve(projectRoot, "dist/reports/airp-3/checkpoints.json");
  pending = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).pending : await (await module.firstPoolOffer()).read();
});
async function saved(page: Page): Promise<PoolRecord> {
  return page.evaluate(async () => {
    const saveId = new URLSearchParams(location.hash.split("?")[1]).get("save")!;
    return new Promise<any>((resolve, reject) => {
      const open = indexedDB.open("abyssa-game-v1", 1); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, get = db.transaction("saves", "readonly").objectStore("saves").get(saveId); get.onsuccess = () => { resolve(get.result); db.close(); }; get.onerror = () => { reject(get.error); db.close(); }; };
    });
  });
}
async function ready(page: Page) {
  // Check one live DOM snapshot: a final hit may replace the board with ADV
  // while a locator is waiting, so never wait on a previously present board.
  await expect.poll(() => page.evaluate(() => {
    const sequence = document.querySelector('.scene-sequence'), board = document.querySelector('.abyssa-expedition');
    return !document.documentElement.hasAttribute('data-scene-transition')
      && document.querySelector('.game-client-status')?.getAttribute('data-status') === 'ready'
      && (!sequence || sequence.getAttribute('data-phase') === 'idle')
      && (!board || board.getAttribute('aria-busy') === 'false')
      && !document.querySelector('.action-dock[data-state="busy"]');
  }), { timeout: 60000, message: 'The current scene and command queue must be idle' }).toBe(true);
}
async function readConversation(page: Page) {
  for (let step = 0; step < 50; step++) {
    await ready(page); const state = (await saved(page)).narrative, r = state.reading;
    if (!r || r.completed || r.paused) return;
    const node = state.scenes.find(s => s.id === r.sceneId)!.body.nodes[r.node];
    if (node.kind === "choice") await page.getByRole("button", { name: node.options[1].label, exact: true }).click();
    else await page.locator(".rp-app__cue").click();
  }
  throw Error("Reading did not terminate");
}
test("AIRP-3: four forms, real patrol, target conversation and refresh-safe memories", async ({ page }, info) => {
  test.setTimeout(480000); page.setDefaultTimeout(30000);
  const errors = await observeArtifacts(page);
  await page.addInitScript(() => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => { if (values instanceof Uint32Array && values.length === 1) { values[0] = 19; return values; } return original(values); }; });
  await page.goto("/"); await page.getByRole("button", { name: "记录", exact: true }).click({ timeout: 60000 });
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "airp-pool.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ archiveVersion: 4, record: pending })) });
  await expect(page).toHaveURL(/#\/menu/, { timeout: 60000 }); await ready(page);
  await page.goto(`/#/mansion?save=${pending.head.saveId}&epoch=${pending.head.epoch}`); await ready(page);
  const card = (id: string) => page.locator(`[data-airp-id="${id}"]`);
  await openManorJournal(page);
  await page.screenshot({ path: info.outputPath("four-forms.png") });
  // Household: explicit action and final commit, not merely viewing its scene.
  await openManorJournal(page, "ripple.elora.fold-cloths"); await card("ripple.elora.fold-cloths").getByRole("button").click(); await readConversation(page);
  expect((await saved(page)).narrative.memories).toHaveLength(0);
  await page.getByRole("button", { name: "完成这件小事", exact: true }).click(); await ready(page);
  // Vignette: deferral is persisted, then quiet reading and deliberate finish.
  await openManorJournal(page, "ripple.kororo.quiet-cup"); await card("ripple.kororo.quiet-cup").getByRole("button").click(); await ready(page);
  await page.getByRole("button", { name: "稍后再说", exact: true }).click(); await ready(page); await page.reload(); await ready(page);
  await openManorJournal(page, "ripple.kororo.quiet-cup"); await card("ripple.kororo.quiet-cup").getByRole("button").click(); await readConversation(page);
  await page.getByRole("button", { name: "完成这件小事", exact: true }).click(); await ready(page);
  // Liaison: specifically visit Eustice, then come back to Elora.
  await openManorJournal(page, "ripple.elora.watch-note"); await card("ripple.elora.watch-note").getByRole("button").click(); await readConversation(page);
  await openManorJournal(page, "ripple.elora.watch-note"); await card("ripple.elora.watch-note").getByRole("button", { name: "找尤斯缇丝传话", exact: true }).click(); await ready(page);
  const targetReading = (await saved(page)).narrative;
  await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(targetReading);
  await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
  await page.screenshot({ path: info.outputPath("liaison-target.png") }); await readConversation(page);
  await openManorJournal(page, "ripple.elora.watch-note"); await card("ripple.elora.watch-note").getByRole("button", { name: "找艾洛拉收尾", exact: true }).click(); await readConversation(page);
  await page.getByRole("button", { name: "确认交付", exact: true }).click(); await ready(page);
  expect((await saved(page)).narrative.memories).toHaveLength(3);
  // Sortie: actual battle controls and supplies; no patched objective/HP/results.
  await openManorJournal(page, "ripple.elora.old-medicine-case"); await card("ripple.elora.old-medicine-case").getByRole("button").click(); await readConversation(page);
  await depart(page, 5, 30000, true); await ready(page);
  let found = false;
  for (let step = 0; step < 350; step++) {
    await ready(page);
    if (await page.locator('.scene-sequence[data-scene="adv"]').count()) { await page.getByRole("button", { name: "跳过本段对白" }).click(); continue; }
    const r = await saved(page); if (!r.snapshot.run) break;
    if (!found && r.narrative.instances.some(i => i.carryFactId)) {
      found = true; await page.getByRole("button", { name: "远征账本", exact: true }).click();
      await page.getByRole("heading", { name: "旧药箱的搭扣", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("patrol-found.png") });
      await page.getByRole("button", { name: "收起账本", exact: true }).click();
      await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(r.narrative);
    }
    const op = choose(r);
    if (op.type === "resume-run") { await expect.poll(async () => (await saved(page)).head.revision).toBeGreaterThan(r.head.revision); continue; }
    if (op.type === "settle-expedition") { await page.getByRole("button", { name: "返回洋馆", exact: true }).click(); break; }
    if (op.type === "advance-room") await page.getByRole("button", { name: "继续前进", exact: true }).click();
    else if (op.type === "choose-event") await page.getByRole("button", { name: op.choiceId === "skip" ? "绕行" : "阅读迎宾簿", exact: true }).click();
    else if (op.type === "choose-exit") await page.getByRole("button", { name: "带宝离场", exact: true }).click();
    else if (op.type === "use-item" && op.target.kind === "member") {
      if (r.snapshot.run.kind !== "expedition") throw Error();
      const index = r.snapshot.run.state.run.supplies.findIndex(s => s.instanceId === op.instanceId);
      await page.getByRole("button", { name: "打开道具坞", exact: true }).click(); await page.locator(".item-dock__slots button").nth(index).click();
      const names: Record<string, string> = { elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛" };
      await page.locator(".item-dock__target-list").getByRole("button", { name: op.target.id === "kael" ? /^(你|凯尔)$/ : names[op.target.id], exact: true }).click();
      await expect.poll(async () => (await saved(page)).head.revision, { message: "The item target must commit before closing the tray", timeout: 15000 }).toBeGreaterThan(r.head.revision);
      await ready(page); await page.getByRole("button", { name: "返回行动", exact: true }).click();
    } else if (op.type === "battle-command") {
      const c = op.command;
      if (c.type === "roll" || c.type === "end-turn" || c.type === "reroll") await page.getByRole("button", { name: c.type === "end-turn" ? "END TURN" : c.type.toUpperCase(), exact: true }).click();
      else if (c.type === "toggle-load") await page.locator(`[data-tutorial-anchor="battle.die:${c.actorId}"]`).click();
      else if (c.type === "act") { await page.locator(`[data-tutorial-anchor="battle.member:${c.actorId}"]`).click(); await page.locator(`[data-tutorial-anchor="battle.${c.choice === "heal" ? "member" : c.choice === "guard" ? "intent" : "enemy"}:${c.targetId}"]`).click(); }
      else throw Error(`Unexpected action ${c.type}`);
    } else throw Error(`Unexpected operation ${op.type}`);
    await expect.poll(async () => (await saved(page)).head.revision, { message: `UI must commit ${JSON.stringify(op)}`, timeout: 15000 }).toBeGreaterThan(r.head.revision);
  }
  await expect(page).toHaveURL(/#\/mansion/, { timeout: 60000 }); await ready(page); expect(found).toBe(true);
  await openManorJournal(page, "ripple.elora.old-medicine-case"); await card("ripple.elora.old-medicine-case").getByRole("button").click(); await readConversation(page);
  const funds = (await saved(page)).snapshot.campaign.funds;
  await page.getByRole("button", { name: "确认交付", exact: true }).click(); await ready(page);
  const final = await saved(page); expect(final.narrative.memories).toHaveLength(4); expect(final.snapshot.campaign.funds).toEqual(funds);
  await openManorJournal(page); await page.getByText("共同记忆", { exact: true }).click(); await page.screenshot({ path: info.outputPath("four-memories.png") });
  await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(final.narrative);
  await info.attach("final-archive", { body: Buffer.from(JSON.stringify({ archiveVersion: 4, record: final })), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("AIRP-3: two missed events have readable aftermaths and no duplicate memory", async ({ page }, info) => {
  test.setTimeout(180000); page.setDefaultTimeout(60000);
  const file = resolve(projectRoot, "dist/reports/airp-3/checkpoints.json");
  const source: PoolRecord | undefined = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).twoAftermaths : undefined;
  test.skip(!source, "Requires the real-return aftermath checkpoint; never synthesize expiry in the browser");
  const errors = await observeArtifacts(page);
  await page.goto("/"); await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "aftermath.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ archiveVersion: 4, record: source! })) });
  await expect(page).toHaveURL(/#\/menu/, { timeout: 120000 }); await ready(page);
  await page.goto(`/#/mansion?save=${source!.head.saveId}&epoch=${source!.head.epoch}`); await ready(page);
  for (const title of ["两张不同的整备表", "晾布绳上的死结"]) {
    await openManorJournal(page, title); await page.getByRole("button", { name: `看看「${title}」的后续`, exact: true }).click(); await ready(page);
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    await page.screenshot({ path: info.outputPath(`${title}.png`) }); await readConversation(page);
  }
  const final = await saved(page);
  expect(final.narrative.instances.filter(i => i.aftermathRead)).toHaveLength(2);
  expect(final.narrative.memories).toEqual(source!.narrative.memories);
  expect(final.snapshot.campaign.funds).toEqual(source!.snapshot.campaign.funds);
  await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(final.narrative);
  expect(errors).toEqual([]);
});

for (const outcome of ["wipe", "extracted"] as const) test(`AIRP-3: unfinished ${outcome} returns get a refresh-safe Reprise opening`, async ({ page }, info) => {
  test.setTimeout(120000); page.setDefaultTimeout(30000);
  const file = resolve(projectRoot, "dist/reports/airp-3/reprise-checkpoints.json");
  const source: PoolRecord | undefined = existsSync(file) ? JSON.parse(readFileSync(file, "utf8"))[outcome] : undefined;
  test.skip(!source, "Requires a real first-clear return followed by a validated departure");
  const errors = await observeArtifacts(page);
  await page.goto("/"); await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "档案管理", exact: true }).click();
  await page.getByRole("button", { name: "导入档案", exact: true }).click();
  await page.getByLabel("导入格式").selectOption("restore");
  await page.getByLabel("导入存档", { exact: true }).setInputFiles({ name: "reprise.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ archiveVersion: 4, record: source! })) });
  await expect(page).toHaveURL(/#\/battle/, { timeout: 60000 }); await ready(page);
  const opening = page.getByRole("main", { name: "再战 · 未散的家宴", exact: true });
  await expect(opening).toBeVisible();
  // Advance to the companion line; a newcomer receives an on-screen briefing first.
  for (let i = 0; i < (outcome === "wipe" ? 2 : 1); i++) {
    await expect(opening).toHaveAttribute("data-state", "idle"); await page.locator(".rp-app__cue").click(); await ready(page);
  }
  await expect(opening).toHaveAttribute("data-state", "idle");
  const line = outcome === "wipe" ? "上次的事我听明白了" : "上次撤回来不算结束";
  await expect(opening).toContainText(line);
  await page.screenshot({ path: info.outputPath(`reprise-${outcome}.png`) });
  await page.reload(); await ready(page); await expect(opening).toContainText(line);
  expect(await saved(page)).toEqual(source);
  await page.getByRole("button", { name: "跳过本段对白", exact: true }).click(); await ready(page);
  await expect(page.getByRole("main", { name: "克雷格旧庄园战斗界面", exact: true })).toBeVisible();
  await page.reload(); await ready(page); await expect(opening).toHaveCount(0);
  expect(await saved(page)).toEqual(source); // A reading cursor is not a game outcome or memory.
  expect(errors).toEqual([]);
});
