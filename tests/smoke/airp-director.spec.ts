import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { confirmNewGame } from "./new-game-helpers";
import { openManorJournal, ready } from "./playable-helpers";
import { playPatrolRoute, savedDirect } from "./airp-direct-helpers";
import { AIRP_DIRECTOR_CATALOG } from "../../src/game-runtime/airp-director-context";
import { directorHash } from "../../src/game-core/session";
import { creationEnvelope } from "../../src/game-application/testing/airp-writing-fixture";
import { bilingualParagraphs } from "../../src/game-application/airp-generation/creative-output";

async function start(page: Page) {
  page.setDefaultTimeout(45000);
  await page.goto("/"); await page.getByRole("button", {name: "新的开始", exact: true}).click();
  await confirmNewGame(page, "AIRP 总管理验证", "林恩");
  await expect(page).toHaveURL(/#\/mansion\?/); await ready(page);
  const gift = page.getByRole("button", {name: /收下/}); if (await gift.isVisible()) await gift.click();
  await expect(page.locator(".mansion-character__bubble")).toHaveCount(0);
  await openManorJournal(page, "director-today");
}
async function configure(page: Page, config: unknown) {
  await page.getByText("API／模型／预设设置", {exact: true}).click();
  await page.getByLabel("导入测试配置", {exact: true}).setInputFiles({name: "gm-test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config))});
  await page.getByText("API／模型／预设设置", {exact: true}).click();
}
async function phase(page: Page) {
  const r = await savedDirect(page);
  await page.getByRole("button", {name: "推进相位", exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).snapshot.campaign.clock).not.toEqual(r.snapshot.campaign.clock);
  await ready(page); await expect(page.locator(".mansion-app")).toHaveAttribute("data-presentation", "ready");
}
async function readScene(page: Page) {
  const show = page.getByRole("button", {name: "阅读这场对白", exact: true});
  if (await show.isVisible()) await show.click();
  for (let i = 0; i < 256; i++) {
    const state = (await savedDirect(page)).airpDirector!, reading = state.reading;
    if (!reading || reading.paused) return;
    const job = state.jobs.find(j => j.id === reading.jobId)!;
    if (reading.cursor >= job.text!.lines.length) return;
    await expect(page.locator(".rp-app")).toHaveAttribute("data-state", "idle");
    await page.locator(".rp-app__cue").click();
    await expect.poll(async () => (await savedDirect(page)).airpDirector!.cursors[job.id]).toBe(reading.cursor + 1);
  }
  throw Error("Read loop capacity exceeded");
}

test("GM browser: real UI fixed lifecycle, refresh without resend and two checkpoints (mock provider)", async ({page}, info) => {
  let calls = 0;
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("https://gm.example.invalid/v1/chat/completions", async route => {
    calls++;
    const body = route.request().postDataJSON(), messages: {content: string}[] = body.messages;
    let output: string;
    if (messages[0].content.includes("你是洋馆事件总管理")) {
      const c = JSON.parse(messages.find(m => m.content.startsWith('{"context":'))!.content).context, day = c.budget.day;
      output = JSON.stringify({version: 1, day, reason: "浏览器mock验收", focus: day === 1 ? {kind: "new", id: "fixed"} : null,
        entries: day === 1 ? [{id: "fixed", fromPhase: 2, throughPhase: 3, basisIds: [c.world.sourceIds[0]], source: {kind: "fixed", definitionId: "ripple.elora.watch-note"}}] : []});
    } else if (body.model === "writing-test") {
      const m = messages.find(m => m.content.startsWith("<interactive_input>"))!;
      const c = JSON.parse(m.content.replace(/^<interactive_input>\s*|\s*<\/interactive_input>$/g, ""));
      const names: Record<string, string> = {elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
      output = `<prose>${names[c.actorIds[0]]}：「少し、いい？（能聊一会儿吗？）」</prose>`;
    } else if (body.model === "formatting-test") {
      const draft = JSON.parse(messages.at(-1)!.content).draft;
      const names = {elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
      output = JSON.stringify({creationRecord: "测试中文封装", lines: bilingualParagraphs(draft, names).map(p => ({speaker: p.speaker, emotion: "neutral", text: p.chinese}))});
    } else output = creationEnvelope(["旁白：测试进场。", "旁白：测试互动。", "旁白：测试衔接。"]);
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({choices: [{message: {role: "assistant", content: output}, finish_reason: "stop"}], usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2}})});
  });
  await start(page);
  await configure(page, {version: 1, connection: {baseUrl: "https://gm.example.invalid/v1", apiKey: "mock-key-70834589-not-real"}, models: {planning: {model: "planning-test"}, writing: {model: "writing-test"}, updater: {model: "formatting-test"}}});
  await page.getByRole("button", {name: "安排今日", exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirector!.jobs.at(-1)?.attempts.map(a => ({stage: a.stage, status: a.status, error: a.error})), {timeout: 15000}).toEqual([{stage: "director", status: "succeeded", error: null}]).catch(async error => {console.info(await page.locator(".journal-record").allTextContents()); throw error;});
  await page.getByRole("button", {name: "接纳今日安排", exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirector!.days.length).toBe(1);
  await expect(page.locator(".airp-direct-progress")).toBeFocused();
  await page.keyboard.press("Escape"); await phase(page); await phase(page);
  await expect(page.locator(".mansion-character__bubble")).toHaveCount(1);
  // The real plaza is to the right of the initial mansion camera. Pan using the real control.
  for (let i = 0; i < 4; i++) {
    const box = await page.getByRole("button", {name: "与艾洛拉交谈", exact: true}).boundingBox();
    if (box && box.x > 100 && box.x + box.width < 1500) break;
    const pan = page.getByRole("button", {name: "向右浏览", exact: true});
    if (!await pan.isEnabled()) break;
    await pan.click();
    await expect.poll(async () => (await page.getByRole("button", {name: "与艾洛拉交谈", exact: true}).boundingBox())?.x).not.toBe(box?.x);
  }
  await page.screenshot({path: info.outputPath("published-entrance.png")});
  const closeAndResume = async () => {
    const panel = page.getByRole("region", {name: "场景创作", exact: true});
    const close = panel.getByRole("button", {name: "关闭场景创作", exact: true});
    await expect(close).toBeEnabled();
    const before = (await savedDirect(page)).airpDirector!, beforeCalls = calls;
    await expect(panel.getByText("返回洋馆", {exact: true})).toHaveCount(0);
    const frameBox = (await panel.boundingBox())!, closeBox = (await close.boundingBox())!;
    expect(closeBox.x + closeBox.width / 2).toBeGreaterThan(frameBox.x + frameBox.width - 40);
    expect(Math.abs(closeBox.y + closeBox.height / 2 - frameBox.y)).toBeLessThan(30);
    await close.click();
    await expect(panel).toHaveCount(0);
    await expect.poll(async () => (await savedDirect(page)).airpDirector!.reading?.paused).toBe(true);
    const paused = (await savedDirect(page)).airpDirector!;
    expect(paused.reading).toEqual({...before.reading, paused: true});
    expect(paused.jobs).toEqual(before.jobs);
    expect(paused.events).toEqual(before.events);
    expect(paused.cursors).toEqual(before.cursors);
    await openManorJournal(page, before.reading!.eventId);
    await page.getByRole("button", {name: "继续这件事", exact: true}).click();
    await expect(panel).toBeVisible();
    expect((await savedDirect(page)).airpDirector!.reading).toEqual(before.reading);
    expect(calls).toBe(beforeCalls);
  };
  for (let scene = 0; scene < 5; scene++) {
    const state = (await savedDirect(page)).airpDirector!, e = state.events[0];
    if (scene === 0) await page.getByRole("button", {name: "与艾洛拉交谈", exact: true}).click();
    else {await openManorJournal(page, e.id); await page.getByRole("button", {name: "继续这件事", exact: true}).click();}
    if (!scene) {
      await closeAndResume();
      await page.screenshot({path: info.outputPath("generation-idle-close.png")});
    }
    await page.getByRole("button", {name: "生成这场对白", exact: true}).click();
    await page.getByRole("button", {name: "阅读这场对白", exact: true}).waitFor();
    if (!scene) {
      const before = calls; await page.screenshot({path: info.outputPath("generation-ready.png")});
      await closeAndResume();
      await page.reload(); await ready(page); expect(calls).toBe(before);
      await configure(page, {version: 1, connection: {baseUrl: "https://gm.example.invalid/v1", apiKey: "mock-key-70834589-not-real"}, models: {planning: {model: "planning-test"}, writing: {model: "writing-test"}, updater: {model: "formatting-test"}}});
    }
    await readScene(page);
    if (scene === 0 || scene === 2) await page.getByRole("button", {name: "参与这件事", exact: true}).click();
  }
  expect((await savedDirect(page)).airpDirector!.events[0].status).toBe("resolved");
  await phase(page); await phase(page);
  await openManorJournal(page, "director-today"); await page.getByRole("button", {name: "安排今日", exact: true}).click();
  await page.getByRole("button", {name: "接纳今日安排", exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirector!.days.length).toBe(2);
  const r = await savedDirect(page); expect(r.airpDirector!.days).toHaveLength(2); expect(calls).toBe(17); expect(errors).toEqual([]);
  expect(Object.values(r.airpDirector!.materials)[0].resources.version).toBe(5);
  for (const job of r.airpDirector!.jobs.filter(j => j.kind === "scene")) {
    expect(JSON.stringify(job.text)).not.toMatch(/[\u3040-\u30ff]/u);
    expect(job.text!.lines[0].text).toBe("「能聊一会儿吗？」");
  }
  writeFileSync(info.outputPath("mock-evidence.json"), JSON.stringify({kind: "mock-browser", calls, head: r.head, days: r.airpDirector!.days, events: r.airpDirector!.events.map(e => ({id: e.id, status: e.status})), sources: Object.values(r.airpDirector!.materials)[0].resources.sources.map(s => ({id: s.id, sha256: s.sha256})), bytes: Buffer.byteLength(JSON.stringify(r))}, null, 2));
});

test("GM LIVE browser two checkpoints and first reachable scene", async ({page}, info) => {
  test.skip(process.env.ABYSSA_AIRP_GM_LIVE !== "1", "Explicit live acceptance only");
  const complete = process.env.ABYSSA_AIRP_GM_COMPLETE === "1";
  const resume = complete ? process.env.ABYSSA_AIRP_GM_RESUME : undefined;
  if (complete) test.setTimeout(1800000);
  const config = JSON.parse(readFileSync("config/airp-test.local.json", "utf8"));
  const connections = ["planning", "writing", "updater"].map(slot => ({...config.connection, ...config.models[slot]}));
  const origins = new Set(connections.map(c => new URL(c.baseUrl).origin));
  let calls = 0;
  const network: {ordinal: number; status?: number; error?: string}[] = [];
  page.on("response", response => {
    if (response.request().method() === "POST" && origins.has(new URL(response.url()).origin)) network.push({ordinal: calls, status: response.status()});
  });
  page.on("requestfailed", request => {
    if (request.method() === "POST" && origins.has(new URL(request.url()).origin)) network.push({ordinal: calls, error: request.failure()?.errorText.match(/^net::[A-Z_]+/)?.[0] ?? "request-failed"});
  });
  await page.route("**/*", async route => {
    if (route.request().method() === "POST" && origins.has(new URL(route.request().url()).origin)) {
      if (++calls > (complete ? 40 : 8)) return route.abort();
      console.info(JSON.stringify({event: "GM-live-call", ordinal: calls, model: route.request().postDataJSON().model}));
    }
    await route.continue();
  });
  const waitForJob = async (kind: "day" | "scene", priorAttempts = 0) => {
    await expect.poll(async () => {
      const j = (await savedDirect(page)).airpDirector!.jobs.filter(j => j.kind === kind).at(-1);
      return j && j.attempts.length > priorAttempts && (j.attempts.at(-1)?.status === "failed" || (kind === "day" ? j.acceptedEntries !== null : j.text !== null));
    }, {timeout: 600000, intervals: [2000]}).toBe(true);
    const j = (await savedDirect(page)).airpDirector!.jobs.filter(j => j.kind === kind).at(-1)!;
    if (j.attempts.at(-1)?.status === "failed") throw Error(`Live ${kind} stopped: ${j.attempts.at(-1)?.stage}/${j.attempts.at(-1)?.error}`);
  };
  const openAndRead = async (eventId: string) => {
    let r = await savedDirect(page);
    if (!r.airpDirector!.reading || r.airpDirector!.reading.paused || r.airpDirector!.reading.eventId !== eventId) {
      for (let i = 0; i < 5; i++) {
        await openManorJournal(page, eventId);
        if (await page.getByRole("button", {name: "继续这件事", exact: true}).isVisible()) break;
        await page.getByRole("button", {name: "关闭日志", exact: true}).click(); await phase(page);
      }
      await page.getByRole("button", {name: "继续这件事", exact: true}).click();
      await expect.poll(async () => {
        const reading = (await savedDirect(page)).airpDirector!.reading;
        return reading?.eventId === eventId && !reading.paused;
      }).toBe(true);
      r = await savedDirect(page);
    }
    const job = r.airpDirector!.jobs.find(j => j.id === r.airpDirector!.reading!.jobId)!;
    if (!job.text) {
      await page.getByRole("button", {name: "生成这场对白", exact: true}).click();
      await waitForJob("scene", job.attempts.length);
    }
    await readScene(page);
    return job;
  };
  let failure: unknown;
  let resumedHead: unknown = null, priorTokens = 0;
  try {
  if (resume) {
    const source = JSON.parse(readFileSync(resume, "utf8")).record;
    if (source.contentRef?.contentVersion !== 19 || !source.airpDirector) throw Error("Resume requires a real content19 archive");
    page.setDefaultTimeout(60000);
    await page.goto("/"); await page.getByRole("button", {name: "记录", exact: true}).click();
    await page.getByRole("button", {name: "档案管理", exact: true}).click();
    await page.getByRole("button", {name: "导入档案", exact: true}).click();
    await page.getByLabel("导入格式").selectOption("restore");
    await page.getByLabel("导入存档", {exact: true}).setInputFiles(resume);
    await expect(page).toHaveURL(/#\/(menu|mansion)/);
    await page.goto(`/#/mansion?save=${source.head.saveId}&epoch=${source.head.epoch}`); await ready(page);
    expect(directorHash(await savedDirect(page))).toBe(directorHash(source));
    resumedHead = source.head;
    priorTokens = source.airpDirector.jobs.flatMap((j: {attempts: {usage: {totalTokens: number | null}}[]}) => j.attempts).reduce((sum: number, a: {usage: {totalTokens: number | null}}) => sum + (a.usage.totalTokens ?? 0), 0);
    if (!source.airpDirector.reading || source.airpDirector.reading.paused) await openManorJournal(page, "director-today");
    await configure(page, config);
    if (!source.airpDirector.reading || source.airpDirector.reading.paused) await page.keyboard.press("Escape");
    expect(calls).toBe(0); // Restore/reload/configure must never make a paid request.
  } else {
    await start(page); await configure(page, config);
    await page.getByRole("button", {name: "安排今日", exact: true}).click();
    await waitForJob("day");
    await page.getByRole("button", {name: "接纳今日安排", exact: true}).click();
    await expect.poll(async () => (await savedDirect(page)).airpDirector!.days.length).toBe(1);
    await page.keyboard.press("Escape");
  }
  let r = await savedDirect(page);
  if (!resume) for (let i = 0; i < 3 && !r.airpDirector!.events.some(e => e.status === "offered"); i++) {await phase(page); r = await savedDirect(page);}
  const event = r.airpDirector!.events.find(e => e.id === r.airpDirector!.reading?.eventId) ??
    r.airpDirector!.events.find(e => e.status === "offered" && e.card.form === "liaison") ??
    r.airpDirector!.events.find(e => ["offered", "accepted", "waiting-action", "feedback", "ready"].includes(e.status)) ??
    (resume ? r.airpDirector!.events.find(e => e.status === "resolved") : undefined);
  if (event) {
    if (complete) {
      for (let step = 0; step < 16; step++) {
        const current = (await savedDirect(page)).airpDirector!.events.find(e => e.id === event.id)!;
        if (current.status === "resolved") break;
        if (current.role === "action" && current.actionPhase !== null) {
          const action = current.card.actions[current.actionIndex];
          if (action.kind === "patrol") await playPatrolRoute(page, "extracted", AIRP_DIRECTOR_CATALOG);
          else if (action.kind === "wait") for (let i = 0; i < action.phases; i++) await phase(page);
          else throw Error("Unexpected pending local action");
        }
        const job = await openAndRead(event.id);
        if (job.scene!.role === "offer") await page.screenshot({path: info.outputPath("live-offer.png")});
        if (job.scene!.role === "offer" || job.scene!.role === "action") {
          const selected = (await savedDirect(page)).airpDirector!.events.find(e => e.id === event.id)!.selected.length;
          await page.getByRole("button", {name: job.scene!.choices[0].label, exact: true}).click();
          await expect.poll(async () => (await savedDirect(page)).airpDirector!.events.find(e => e.id === event.id)!.selected.length).toBe(selected + 1);
        }
      }
      expect((await savedDirect(page)).airpDirector!.events.find(e => e.id === event.id)?.status).toBe("resolved");
    } else {
      await openAndRead(event.id);
      await page.screenshot({path: info.outputPath("live-offer.png")});
      await page.getByRole("button", {name: "返回洋馆", exact: true}).click();
      await expect.poll(async () => (await savedDirect(page)).airpDirector!.reading?.paused).toBe(true);
    }
  }
  if (complete && !event) throw Error("GM chose an empty day; no full event was exercised");
  for (let i = 0; i < 4 && (await savedDirect(page)).snapshot.campaign.clock.day === 1; i++) await phase(page);
  await openManorJournal(page, "director-today");
  await page.getByRole("button", {name: "安排今日", exact: true}).click();
  await waitForJob("day");
  await page.getByRole("button", {name: "接纳今日安排", exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirector!.days.length).toBe(2);
  expect(calls).toBeGreaterThan(0);
  } catch (error) {
    failure = error;
    await page.locator("details[open]").evaluateAll(elements => elements.forEach(e => e.removeAttribute("open")));
    await page.screenshot({path: info.outputPath("failure-state.png")});
  }
  const r = await savedDirect(page);
  if (complete) {
    const archive = JSON.stringify({archiveVersion: 4, record: r});
    if (connections.some(c => c.apiKey && archive.includes(c.apiKey))) throw Error("Credential in private archive");
    mkdirSync("dist/reports/airp-gm/private", {recursive: true});
    const filename = `dist/reports/airp-gm/private/${r.head.saveId}.${r.head.epoch}.${r.head.revision}.archive.local.json`;
    if (existsSync(filename)) {
      if (readFileSync(filename, "utf8") !== archive) throw Error("Private archive identity collision; contents withheld");
    } else writeFileSync(filename, archive, {mode: 0o600, flag: "wx"});
  }
  const failureMessage = failure instanceof Error ? connections.reduce((s, c) => s.replaceAll(c.apiKey, "[key]").replaceAll(c.baseUrl, "[endpoint]"), failure.message).slice(0, 2500) : null;
  const savedTokens = r.airpDirector!.jobs.flatMap(j => j.attempts).reduce((sum, a) => sum + (a.usage.totalTokens ?? 0), 0);
  const evidence = {kind: complete ? "live-browser-two-checkpoints-and-complete-event" : "live-browser-two-checkpoints-and-offer-not-full-event", passed: !failure, failureMessage, calls, network, newTokens: savedTokens - priorTokens, resumedHead, head: r.head, days: r.airpDirector!.days,
    settlements: r.snapshot.campaign.settlements, archiveBytes: Buffer.byteLength(JSON.stringify(r)),
    fullyReadScenes: r.airpDirector!.events.flatMap(e => e.readSceneIds), processMemoryCount: r.airpDirector!.memories.length,
    events: r.airpDirector!.events.map(e => ({id: e.id, cardId: e.card.id, status: e.status, exposed: e.exposed})),
    jobs: r.airpDirector!.jobs.map(j => ({id: j.id, kind: j.kind, proposal: j.proposal, planningTasks: j.planning?.tasks, context: j.scene, text: j.text, attempts: j.attempts}))};
  const serialized = JSON.stringify(evidence, null, 2);
  if (connections.some(c => c.apiKey && serialized.includes(c.apiKey) || serialized.includes(c.baseUrl))) throw Error("Secret or endpoint in evidence");
  writeFileSync(info.outputPath("live-evidence.json"), serialized);
  // Close before a failed assertion can capture a settings form in error-context.
  await page.close();
  if (failure) throw Error("Live GM acceptance stopped; inspect the redacted live-evidence.json (no automatic retry).");
});
