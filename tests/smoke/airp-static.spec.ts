import { test, expect, type Page } from "@playwright/test";
import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { OUTLINE_PREFLIGHT } from "../../src/game-application/airp-generation/outline-output";
import { bilingualParagraphs } from "../../src/game-application/airp-generation/creative-output";

// This is an actual cross-origin HTTP fixture, NOT evidence of a real model call.
const firstDialogue = "「見回りも終わって、箱も戻ってきたんですね……よかった。（巡路完成了，箱子也带回来了……那就好。）」";
const draft = `旁白：空药箱在桌边投下一小块影子。\n艾洛拉：${firstDialogue}\n旁白：艾洛拉伸手托住箱底，把松下来的带子拢到旁边。\n艾洛拉：「まだ持ち上げないで。留め具を見てからにしましょう。（先别急着提它。我们先看看搭扣吧。）」\n旁白：她摸了摸搭扣的边缘，没有马上扳动。\n艾洛拉：「少し休んでいてください。まず、ここを見ますね。（您歇会儿吧。我先看看这里。）」`;
const performedDraft = draft.replaceAll("艾洛拉：", "艾洛拉[smile]：");
const formatted = JSON.stringify({ creationRecord: "这是模拟HTTP响应，用于验证输送与AVG，不是模型生成验收。", lines: bilingualParagraphs(draft).map(p => ({ speaker: p.speaker, emotion: p.speaker === "narrator" ? "neutral" : "smile", text: p.chinese })) });
const syntheticKey = "browser-fixture-key-not-real";
const eloraCard = readFileSync(new URL('../../st/setting/char/2-elora.txt', import.meta.url), 'utf8');
const diceBook = readFileSync(new URL('../../st/setting/Light & Shadow Dice.txt', import.meta.url), 'utf8');
let endpoint = "", mode = "normal", posts: any[] = [], preflights: { origin?: string; headers?: string }[] = [], held: ServerResponse | null = null;
const send = (res: ServerResponse, text: string) => res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 40, completion_tokens: 60, total_tokens: 100 } }));
const server = createServer(async (req, res) => {
  if (mode !== "cors-blocked") {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5195");
    res.setHeader("Access-Control-Allow-Headers", "authorization,content-type"); res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  }
  if (req.method === "OPTIONS") { preflights.push({ origin: req.headers.origin, headers: req.headers["access-control-request-headers"] }); res.writeHead(204); res.end(); return; }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") { res.writeHead(404); res.end(); return; }
  let body = ""; for await (const chunk of req) body += chunk;
  const request = JSON.parse(body); posts.push({ ...request, authenticated: req.headers.authorization === `Bearer ${syntheticKey}`, origin: req.headers.origin });
  res.setHeader("Content-Type", "application/json");
  if (mode === "auth") { res.writeHead(401); res.end(JSON.stringify({ error: { message: "mock denied" } })); return; }
  if (request.model === "gpt-5.6-sol") { send(res, OUTLINE_PREFLIGHT); return; }
  if (request.model === "gemini-3.8-flash") { if (mode === "hold") held = res; else send(res, `<prose>${performedDraft}</prose>`); return; }
  if (mode === "repair" && posts.filter(p => p.model === "deepseek-flash").length === 1) send(res, "broken JSON"); else send(res, formatted);
});
test.beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address();
  if (!address || typeof address === "string") throw Error("fixture port missing"); endpoint = `http://127.0.0.1:${address.port}/v1`;
});
test.afterAll(async () => { held?.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
test.beforeEach(() => { mode = "normal"; posts = []; preflights = []; held = null; });
async function configure(page: Page) {
  await page.goto("/airp.html");
  await expect(page.getByRole("heading", { name: "AIRP 静态试读", exact: true })).toBeVisible();
  await page.getByLabel("导入测试配置", { exact: true }).setInputFiles({ name: "synthetic-config.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 1, connection: { baseUrl: endpoint, apiKey: syntheticKey }, models: {
    planning: { model: "gpt-5.6-sol", timeoutMs: 3000 }, writing: { model: "gemini-3.8-flash", timeoutMs: 3000 }, updater: { model: "deepseek-flash", timeoutMs: 3000 },
  } })) });
  await expect(page.getByLabel("公共 API 地址", { exact: true })).toHaveValue(endpoint);
  expect(posts).toHaveLength(0);
}
async function generate(page: Page) {
  await page.getByRole("button", { name: "生成一场对白", exact: true }).click();
  await expect(page.getByText("场景已通过格式与原文保真校验，可以开始阅读。", { exact: true })).toBeVisible();
}
async function saved(page: Page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem("abyssa-airp-preview-v2")!)); }

test("static artifact: real CORS preflight, three mock phases, original AVG, refresh without key", async ({ page }, info) => {
  const errors: string[] = [], failures: string[] = []; page.on("pageerror", error => errors.push(error.message)); page.on("response", r => { if (r.status() >= 400) failures.push(r.url()); });
  await configure(page); await page.screenshot({ path: info.outputPath("configuration.png"), fullPage: true });
  await generate(page);
  expect(posts.map(p => p.model)).toEqual(["gpt-5.6-sol", "gemini-3.8-flash", "deepseek-flash"]);
  expect(posts.every(p => p.authenticated && p.origin === "http://127.0.0.1:5195")).toBe(true);
  expect(preflights.some(p => p.headers?.includes("authorization") && p.origin === "http://127.0.0.1:5195")).toBe(true);
  expect(JSON.stringify(posts[0].messages)).toContain("后续大纲"); expect(JSON.stringify(posts[1].messages)).toContain("AVG正文");
  for (const post of posts.slice(0, 2)) {
    expect(post.messages.some((m: { content: string }) => m.content.startsWith("<info>\n"))).toBe(true);
    expect(post.messages.some((m: { content: string }) => m.content.startsWith("<interactive_input>\n"))).toBe(true);
    expect(JSON.stringify(post.messages)).toContain("药箱状况与玩家身体状态未确立");
    expect(post.messages.some((m: {content: string}) => m.content.includes(eloraCard))).toBe(true);
    expect(post.messages.some((m: {content: string}) => m.content.includes(diceBook))).toBe(false);
  }
  expect(JSON.stringify(posts[2].messages)).not.toContain("拒绝所有道德说教");
  expect(posts[1].messages.some((m: {content: string}) => m.content === OUTLINE_PREFLIGHT)).toBe(true);
  expect(posts[1].messages.at(-1).content).toContain('段数也不受大纲段数限制');
  expect(JSON.parse(posts[2].messages.at(-1).content).paragraphMap[1]).toEqual({index: 1, speaker: "elora", emotion: "smile"});
  expect(JSON.stringify(await saved(page))).not.toContain(syntheticKey);
  await page.getByRole("button", { name: "阅读生成对白", exact: true }).click();
  await expect(page.getByRole("main", { name: "完成巡路 · 药箱归来", exact: true })).toBeVisible();
  await expect(page.locator(".rp-app")).toHaveAttribute("data-state", "idle", { timeout: 15000 });
  await page.getByRole("button", { name: "下一句", exact: true }).click();
  await expect(page.locator(".rp-app")).toHaveAttribute("data-state", "idle", { timeout: 15000 });
  await expect(page.getByText(bilingualParagraphs(draft)[1].chinese, { exact: true })).toBeVisible();
  await expect(page.locator('.emotion-actor[data-emotion="smile"]')).toHaveCount(1);
  await expect(page.getByRole("main")).not.toContainText("[smile]");
  await expect.poll(() => page.locator("img").evaluateAll(elements => (elements as HTMLImageElement[]).filter(i => !i.complete || !i.naturalWidth).map(i => i.src))).toEqual([]);
  await page.screenshot({ path: info.outputPath("avg-mock-response.png") });
  await page.getByRole("button", { name: "返回检查", exact: true }).click();
  await page.reload(); await expect(page.getByLabel("公共 API Key", { exact: true })).toHaveValue("");
  await expect(page.getByText("场景已通过格式与原文保真校验，可以开始阅读。", { exact: true })).toBeVisible(); expect(posts).toHaveLength(3);
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test("reading to the end changes only the preview cursor and never invokes a memory updater", async ({ page }) => {
  await configure(page); await generate(page); const before = await saved(page);
  await page.getByRole("button", { name: "阅读生成对白", exact: true }).click();
  for (let i = 0; i < before.scene.lines.length; i++) {
    await expect(page.locator(".rp-app")).toHaveAttribute("data-state", "idle", { timeout: 15000 });
    await page.getByRole("button", { name: i === before.scene.lines.length - 1 ? "结束试读" : "下一句", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "AIRP 静态试读", exact: true })).toBeVisible();
  const after = await saved(page);
  expect(after).toEqual({ ...before, cursor: before.scene.lines.length - 1 });
  expect(posts).toHaveLength(3);
});

test("original Kemini imports as explicit v7 outline/author adaptation, not a Tavern runtime clone", async ({ page }) => {
  test.skip(!process.env.ABYSSA_AIRP_PRESET, "Set ABYSSA_AIRP_PRESET to the user-provided original; not bundled in the repository.");
  await configure(page); await page.getByLabel("导入酒馆预设", { exact: true }).setInputFiles(process.env.ABYSSA_AIRP_PRESET!);
  await page.getByRole("button", { name: "大纲输入", exact: true }).click();
  await page.getByText("模块诊断与来源", { exact: true }).click();
  await expect(page.getByText(/识别 Kemini_Dramatron_v3.1.json/)).toBeVisible();
  await generate(page);
  const writing = JSON.stringify(posts[1].messages), planning = JSON.stringify(posts[0].messages);
  expect(planning).toContain("<Interleaved_thinking>"); expect(writing).toContain("AVG正文");
  expect(writing).not.toMatch(/ALL PREVIOUS PROMPT|防截断|NSFW|1000字/);
});

test("format repair is bounded and reuses upstream draft", async ({ page }) => {
  mode = "repair"; await configure(page); await generate(page); expect(posts).toHaveLength(4);
  const a = JSON.parse(posts[2].messages.at(-1).content), b = JSON.parse(posts[3].messages.at(-1).content);
  expect(b.draft).toBe(a.draft); expect(b.feedback.previousOutput).toBe("broken JSON");
  expect((await saved(page)).attempts.map((a: any) => a.status)).toEqual(["succeeded", "succeeded", "failed", "succeeded"]);
});

test("cancel does not accept late Writing, and explicit resume preserves Planning", async ({ page }) => {
  mode = "hold"; await configure(page); await page.getByRole("button", { name: "生成一场对白", exact: true }).click();
  await expect.poll(() => posts.length).toBe(2); await page.getByRole("button", { name: "取消生成", exact: true }).click();
  expect((await saved(page)).status).toBe("interrupted"); held?.end(); held = null; mode = "normal";
  await page.getByRole("button", { name: "重试／继续原任务", exact: true }).click();
  await expect(page.getByText("场景已通过格式与原文保真校验，可以开始阅读。", { exact: true })).toBeVisible();
  expect(posts.map(p => p.model)).toEqual(["gpt-5.6-sol", "gemini-3.8-flash", "gemini-3.8-flash", "deepseek-flash"]);
});

test("authentication failure is explicit, counted and never automatically retried", async ({ page }) => {
  mode = "auth"; await configure(page); await page.getByRole("button", { name: "生成一场对白", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("认证失败"); expect(posts).toHaveLength(1);
  expect((await saved(page)).status).toBe("failed"); expect(JSON.stringify(await saved(page))).not.toContain(syntheticKey);
});

test("CORS rejection is not bypassed and reports a generic network/cross-origin error", async ({ page }) => {
  mode = "cors-blocked"; await configure(page); await page.getByRole("button", { name: "生成一场对白", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("网络／跨域请求失败"); expect(preflights.length).toBeGreaterThan(0); expect(posts).toHaveLength(0);
  expect((await saved(page)).status).toBe("failed");
});
