/** Refresh real content11 overview screenshots from isolated, validated saves.
 * Run after build:game. Never opens the user's browser profile or player database. */
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { projectRoot } from "../config/paths.mjs";
import { createArtifactServer } from "./serve-built.mjs";

const bundle = await build({absWorkingDir: projectRoot, stdin: {resolveDir: projectRoot, contents: `
  export {tideClientFixture, tideOperation, tideCommand} from './src/game-client/testing/tide-cave';
  export {TIDE_GUIDE} from './src/content/gameplay/demo-v11/guide';
`}, bundle: true, write: false, format: "esm", platform: "node", target: "es2022"});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const fixture = await api.tideClientFixture(11);
const checkpoints = new Map([
  ["T1.R1.kael.fix", "dice"], ["T2.R2.guard-bow", "intents"],
  ["E1.attempt", "event"], ["T3.R1.end", "rewards"],
]);
const archives = [];
try {
  await fixture.start();
  for (let i = 0; i < 120 && archives.length < checkpoints.size; i++) {
    const record = fixture.session.getSnapshot().record;
    const cursor = record.snapshot.run.state.tutorial.guide.cursor;
    const name = checkpoints.get(api.TIDE_GUIDE.steps[cursor]?.id);
    if (name && !archives.some(entry => entry.name === name)) archives.push({name, archive: await fixture.archive()});
    if (archives.length === checkpoints.size) break;
    const operation = api.tideOperation(record);
    if (!operation) throw Error("Screenshot checkpoint not reachable");
    await fixture.send(api.tideCommand(operation));
  }
} finally { fixture.session.dispose(); }
if (archives.length !== checkpoints.size) throw Error("Missing screenshot checkpoints");
const output = resolve(projectRoot, "src/assets/tutorial");
await mkdir(output, {recursive: true});
const server = createArtifactServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true, executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE, args: ["--enable-unsafe-swiftshader"]});
try {
  for (const {name, archive} of archives) {
    const context = await browser.newContext({viewport: {width: 1600, height: 900}, reducedMotion: "reduce"});
    try {
      const page = await context.newPage();
      await page.goto(origin);
      await page.getByRole("button", {name: "记录", exact: true}).click({timeout: 60000});
      await page.getByLabel("导入格式").selectOption("restore");
      await page.getByLabel("导入存档", {exact: true}).setInputFiles({name: "tutorial-screenshot.json", mimeType: "application/json", buffer: Buffer.from(archive)});
      await expect(page).toHaveURL(/#\/battle/, {timeout: 60000});
      await expect(page.locator("html")).not.toHaveAttribute("data-scene-transition", /.+/, {timeout: 60000});
      await expect(page.locator(".scene-sequence")).toHaveAttribute("data-phase", "idle", {timeout: 30000});
      await expect(page.locator(".abyssa-expedition")).toHaveAttribute("aria-busy", "false", {timeout: 30000});
      if (name === "event") await page.locator('[data-tutorial-anchor="battle.member:elora"]').click();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(img => img.decode().catch(() => undefined)));
      });
      await expect(page.locator(".abyssa-tutorial[data-visible]")).toBeVisible();
      await page.getByRole("button", {name: "收起操作指引", exact: true}).click();
      await expect(page.locator(".abyssa-tutorial")).toHaveAttribute("data-collapsed", "true");
      const style = ".abyssa-tutorial { visibility: hidden !important; }";
      await page.screenshot({path: resolve(output, `${name}.jpg`), type: "jpeg", quality: 88, style});
      // Handbook assets are deliberate detail crops, never a scaled full-screen capture.
      const crops = {
        intents: [["intent-detail", 405, 135, 510, 445]],
        event: [["event-detail", 866, 188, 145, 167]],
        rewards: [["hand-detail", 310, 650, 710, 132], ["hand-preview", 640, 795, 132, 46], ["factor-detail", 1128, 184, 181, 73]],
      }[name] ?? [];
      for (const [file, x, y, width, height] of crops)
        await page.screenshot({path: resolve(output, `${file}.png`), clip: {x, y, width, height}, style});
      console.log(`Captured ${name}.jpg from ${api.TIDE_GUIDE.id}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
