// Explicit, paid acceptance runner. Never part of npm test or automatic startup.
// Reads the local credential file internally; no tracing, HAR, header dumps or key logs.
import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd(), configPath = path.join(root, "config/airp-test.local.json");
const presetPath = process.env.ABYSSA_AIRP_PRESET;
if (!presetPath) throw Error("Set ABYSSA_AIRP_PRESET to the original Kemini file before paid acceptance");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const slots = ["planning", "writing", "updater"], names = ["大纲", "正文", "格式化"];
const connections = slots.map(slot => ({ slot, ...config.models[slot], baseUrl: config.models[slot].baseUrl ?? config.connection.baseUrl, apiKey: config.models[slot].apiKey ?? config.connection.apiKey }));
const secrets = connections.map(c => c.apiKey).filter(Boolean);
const resumePath = process.argv[2];
const previous = resumePath ? JSON.parse(await fs.readFile(resumePath, "utf8")) : null;
if (previous && (!previous.budget || previous.budget.limit !== 12 || previous.probes?.some(p => p.status !== "succeeded"))) throw Error("Invalid prior acceptance evidence");
if (connections.some(c => !c.baseUrl || !c.apiKey || !c.model)) throw Error("Local configuration is incomplete");
const folder = path.join(root, "dist/reports/airp-live", new Date().toISOString().replace(/[:.]/g, "-"));
await fs.mkdir(folder, { recursive: true });
// Carry cumulative acceptance counts across process restarts, including failed requests.
const reportRoot = path.dirname(folder), ledgerPath = path.join(reportRoot, "call-ledger.json");
let spent = previous?.budget.calls ?? 0;
for (const entry of await fs.readdir(reportRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  for (const name of await fs.readdir(path.join(reportRoot, entry.name))) {
    if (!/^(probe-|cleared|extracted|stopped)/.test(name) || !name.endsWith(".json")) continue;
    const record = JSON.parse(await fs.readFile(path.join(reportRoot, entry.name, name), "utf8"));
    if (Number.isSafeInteger(record.budget?.calls)) spent = Math.max(spent, record.budget.calls);
  }
}
try { const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")); spent = Math.max(spent, ledger.calls); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!Number.isSafeInteger(spent) || spent >= 12) throw Error("Acceptance call budget exhausted or invalid; do not reset evidence to retry");
writeFileSync(ledgerPath, JSON.stringify({ calls: spent, limit: 12 }));
const sanitize = value => {
  const json = JSON.stringify(value, (key, v) => key === "baseUrl" ? "[configured-endpoint]" : v, 2);
  if (secrets.some(s => json.includes(s))) throw Error("Credential detected in evidence; refusing to save");
  return json;
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(budget => { if (!sessionStorage.getItem("abyssa-airp-call-budget-v1")) sessionStorage.setItem("abyssa-airp-call-budget-v1", JSON.stringify(budget)); }, { calls: spent, limit: 12 });
const page = await context.newPage();
let operation = "open";
const network = [], reports = [];
const endpointOrigins = connections.map(c => new URL(c.baseUrl).origin);
page.on("request", request => {
  if (request.method() === "POST" && endpointOrigins.includes(new URL(request.url()).origin)) writeFileSync(ledgerPath, JSON.stringify({ calls: ++spent, limit: 12 }));
});
page.on("response", response => {
  const request = response.request();
  if (!endpointOrigins.includes(new URL(response.url()).origin)) return;
  const body = request.postDataJSON();
  network.push({ method: request.method(), status: response.status(), model: body?.model ?? null, origin: request.headers().origin ?? null, allowedOrigin: response.headers()["access-control-allow-origin"] ?? null });
  console.log(JSON.stringify({ event: "api-response", method: request.method(), status: response.status(), model: body?.model ?? null }));
});
const readState = () => page.evaluate(() => ({ run: JSON.parse(sessionStorage.getItem("abyssa-airp-preview-v2") ?? "null"), probes: JSON.parse(sessionStorage.getItem("abyssa-airp-probes-v1") ?? "[]"), budget: JSON.parse(sessionStorage.getItem("abyssa-airp-call-budget-v1") ?? '{"calls":0,"limit":12}') }));
const save = async label => {
  const state = await readState();
  spent = Math.max(spent, state.budget.calls); writeFileSync(ledgerPath, JSON.stringify({ calls: spent, limit: 12 }));
  reports.push({ label, ...state });
  await fs.writeFile(path.join(folder, `${label}.json`), sanitize({ label, origin: "http://127.0.0.1:5195", ...state, network }));
  console.log(JSON.stringify({ event: label, calls: state.budget.calls, status: state.run?.status, attempts: state.run?.attempts.map(a => ({ stage: a.stage, status: a.status, inputBytes: a.input.bytes, usage: a.usage, elapsedMs: a.endedAt - a.startedAt, error: a.error })) }));
  return state;
};
try {
  await page.goto("http://127.0.0.1:5195/airp.html");
  await page.getByLabel("导入测试配置", { exact: true }).setInputFiles(configPath);
  // Read actual catalogue from this browser origin, with normal CORS and no proxy.
  const catalog = await page.evaluate(async c => {
    const url = new URL(c.baseUrl); url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "") + "/models";
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${c.apiKey.trim()}` }, mode: "cors", credentials: "omit", redirect: "error", cache: "no-store" });
      if (!response.ok) return { status: response.status, ids: [] };
      const body = await response.json(); return { status: response.status, ids: (body.data ?? []).map(m => m.id) };
    } catch { return { status: "browser-network-error", ids: [] }; }
  }, connections[0]);
  const matches = connections.map(c => ({ slot: c.slot, model: c.model, listed: catalog.ids.includes(c.model) }));
  await fs.writeFile(path.join(folder, "catalog.json"), sanitize({ status: catalog.status, count: catalog.ids.length, matches }));
  console.log(JSON.stringify({ event: "browser-catalog", status: catalog.status, count: catalog.ids.length, matches }));
  if (catalog.status !== 200 || matches.some(m => !m.listed)) throw Error("Browser model discovery did not pass");
  for (let i = 0; !previous && i < slots.length; i++) {
    operation = `probe-${slots[i]}`;
    await page.getByRole("button", { name: `测试${names[i]}连接`, exact: true }).click();
    await page.waitForFunction(n => JSON.parse(sessionStorage.getItem("abyssa-airp-probes-v1") ?? "[]").length > n, i, { timeout: 310000 });
    const state = await save(`probe-${slots[i]}`);
    if (state.probes.at(-1)?.status !== "succeeded") throw Error(`Probe failed: ${slots[i]}`);
  }
  for (const outcome of ["cleared", "extracted"]) {
    operation = `select-${outcome}`;
    await page.getByLabel("样例情境").selectOption(`medicine-case.${outcome}`);
    if (outcome === "extracted") await page.getByLabel("导入酒馆预设", { exact: true }).setInputFiles(presetPath);
    operation = `generate-${outcome}`;
    await page.getByRole("button", { name: "生成一场对白", exact: true }).click();
    await page.waitForFunction(() => {
      const run = JSON.parse(sessionStorage.getItem("abyssa-airp-preview-v2") ?? "null");
      return run && ["ready", "failed", "interrupted"].includes(run.status);
    }, undefined, { timeout: 950000 });
    const state = await save(outcome);
    if (state.run?.status !== "ready") throw Error(`Generation failed: ${outcome}`);
    operation = `read-${outcome}`;
    await page.getByRole("button", { name: "阅读生成对白", exact: true }).click();
    await page.locator(".rp-app[data-state=idle]").waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(folder, `${outcome}-avg.png`) });
    await page.getByRole("button", { name: "下一句", exact: true }).click();
    await page.locator(".rp-app[data-state=idle]").waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(folder, `${outcome}-avg-next.png`) });
    await page.getByRole("button", { name: "返回检查", exact: true }).click();
  }
  const before = await readState();
  await page.reload();
  const after = await readState();
  const refresh = { restored: after.run?.status === "ready", cursorRetained: before.run.cursor === after.run.cursor, callsUnchanged: before.budget.calls === after.budget.calls, keyCleared: await page.getByLabel("公共 API Key", { exact: true }).inputValue() === "" };
  await fs.writeFile(path.join(folder, "refresh.json"), sanitize(refresh));
  console.log(JSON.stringify({ event: "refresh", ...refresh }));
} catch (error) {
  // Never dump Playwright call logs or DOM values. Redact the first line too.
  await save("stopped").catch(() => {});
  let reason = String(error?.message ?? "failed").split("\n")[0];
  for (const value of [...secrets, ...connections.map(c => c.baseUrl)]) reason = reason.replaceAll(value, "[redacted]");
  console.log(JSON.stringify({ event: "stopped", operation, reason }));
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(folder, "network.json"), sanitize(network));
  await browser.close();
  console.log(JSON.stringify({ evidenceFolder: folder }));
}
