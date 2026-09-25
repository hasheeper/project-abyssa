import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { directPatrol, directReady, manualDirectCopy, newDirectGame, readDirectConversation, savedDirect } from './airp-direct-helpers';
import { openManorJournal } from './playable-helpers';
import { inspectDirectAttempt } from '../../src/game-application/airp-direct-gameplay/inspection';
import type { D5GameRecord } from '../../src/game-application';

test.skip(process.env.ABYSSA_AIRP_P2_LIVE !== '1', 'Explicit paid P2 acceptance only');
const configPath = resolve('config/airp-test.local.json'), ledgerPath = resolve('dist/reports/airp-live/call-ledger.json');
const originalPreset = '/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json';

for (const outcome of ['extracted', 'cleared'] as const) test(`P2 LIVE real UI ${outcome}: return and followup, both read and summarized`, async ({page, context}, info) => {
  page.setDefaultTimeout(60000);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const connections = ['planning', 'writing', 'updater'].map(slot => ({...config.connection, ...config.models[slot]}));
  expect(connections.map(c => c.model)).toEqual(['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
  const secrets = connections.map(c => c.apiKey.trim()), origins = new Set(connections.map(c => new URL(c.baseUrl).origin));
  expect(createHash('sha256').update(readFileSync(originalPreset)).digest('hex')).toBe('3d394088a2b4c19a6d819a9cfba7bfacb372296a626c1192eaa6cab62c383968');
  const start = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  expect(start.limit).toBe(46); expect(start.limit - start.calls).toBeGreaterThanOrEqual(8);
  let calls = 0;
  const network: object[] = [], problems: string[] = [];
  const safe = (value: unknown) => {
    let json = JSON.stringify(value, (key, v) => key === 'baseUrl' ? '[configured-endpoint]' : v, 2);
    if (secrets.some(s => s && json.includes(s))) throw Error('Credential detected; evidence not written');
    for (const c of connections) json = json.replaceAll(c.baseUrl, '[configured-endpoint]').replaceAll(new URL(c.baseUrl).origin, '[configured-endpoint]');
    return json;
  };
  const save = (name: string, value: unknown) => writeFileSync(info.outputPath(name), safe(value));
  const savePrivateArchive = (record: D5GameRecord, checkpoint: string) => {
    const archive = JSON.stringify({archiveVersion: 4, record});
    if (secrets.some(s => s && archive.includes(s))) throw Error('Credential detected; private archive not written');
    mkdirSync(resolve('dist/reports/airp-p2/private'), {recursive: true});
    writeFileSync(resolve(`dist/reports/airp-p2/private/${outcome}-${record.head.saveId}-${checkpoint}.archive.local.json`), archive, {mode: 0o600, flag: 'wx'});
  };
  page.on('pageerror', () => problems.push('uncaught-page-error'));
  // Observe normal Chromium CORS requests; never fetch upstream in Node or rewrite headers.
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'POST' && origins.has(url.origin)) {
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      if (ledger.calls >= ledger.limit || calls >= 12) {problems.push('budget-exhausted'); return route.abort();}
      calls++; writeFileSync(ledgerPath, JSON.stringify({...ledger, calls: ledger.calls + 1}, null, 2));
      console.info(JSON.stringify({event: 'P2-paid-call', outcome, ordinal: calls, totalCalls: ledger.calls + 1, model: req.postDataJSON().model}));
    }
    if (/\/api\/v1\/(sessions|conversation-threads)/.test(url.pathname)) {problems.push('unexpected-rp'); return route.abort();}
    await route.continue();
  });
  page.on('response', response => {
    if (!origins.has(new URL(response.url()).origin)) return;
    network.push({method: response.request().method(), status: response.status(), cors: response.headers()['access-control-allow-origin'] ?? null});
  });
  async function configure() {
    await page.getByText('API／模型／预设设置', {exact: true}).click();
    await page.getByLabel('导入测试配置', {exact: true}).setInputFiles(configPath);
    await page.getByLabel('导入酒馆预设', {exact: true}).setInputFiles(originalPreset);
    await page.getByText('API／模型／预设设置', {exact: true}).click();
  }
  async function photographDialogue(path: string) {
    for (let n = 0; n < 256; n++) {
      await directReady(page); await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
      const r = await savedDirect(page), narrative = r.narrative;
      if (narrative?.version !== 2 || !narrative.reading) throw Error('Missing reading');
      const scene = narrative.scenes.find(s => s.id === narrative.reading!.sceneId)!;
      const node = scene.body.nodes[narrative.reading.node];
      if (node.kind === 'beat' && node.frames.some(f => f.kind === 'dialogue') || narrative.reading.node === scene.body.nodes.length - 1) {
        await page.screenshot({path}); return;
      }
      await page.locator('.rp-app__cue').click();
    }
  }
  async function watch(taskIndex: number, target: 'body' | 'memory') {
    let signature = '', changedAt = Date.now();
    const started = Date.now();
    while (Date.now() - started < 650000) {
      const r = await savedDirect(page), task = r.airpDirect!.tasks[taskIndex];
      const next = JSON.stringify(task.attempts.map(a => [a.id, a.status]));
      if (next !== signature) {
        signature = next; changedAt = Date.now(); save(`task-${taskIndex}-${target}-progress.json`, r);
        console.info(JSON.stringify({event: 'P2-stage', outcome, taskIndex, stages: task.attempts.map(a => ({stage: a.stage, status: a.status, usage: a.usage}))}));
      }
      if (target === 'body' ? task.source === 'browser-direct' : !!task.memoryId) return r;
      const last = task.attempts.at(-1);
      if (last && ['failed', 'interrupted'].includes(last.status) && Date.now() - changedAt > 10000)
        throw Error(`P2 ${target} stopped at ${last.stage}:${last.error}`);
      await page.waitForTimeout(1200);
    }
    throw Error('P2 stage observation timeout');
  }
  function sources(r: D5GameRecord) {
    const checks: object[] = [];
    for (const task of r.airpDirect!.tasks) {
      const material = r.airpDirect!.materials[task.materialHash!];
      expect(material.version).toBe(2);
      expect(material.resources.sources).toHaveLength(13);
      expect(material.preset.notes.some(n => n.includes('Kemini_Dramatron_v3.1.json'))).toBe(true);
      for (const s of material.resources.sources) {
        expect(createHash('sha256').update(s.text).digest('hex')).toBe(s.sha256);
        expect(readFileSync(s.path, 'utf8')).toBe(s.text);
      }
      for (const attempt of task.attempts) {
        const inspected = inspectDirectAttempt(r, task.sceneId, attempt.id);
        const messages = inspected.input.messages;
        for (const s of material.resources.sources) expect(messages.some(m => m.content.includes(s.text))).toBe(['planning', 'writing'].includes(attempt.stage));
        save(`task-${task.task}-${attempt.stage}-${attempt.ordinal}.json`, inspected);
        checks.push({task: task.task, stage: attempt.stage, inputHash: inspected.inputHash, sources: material.resources.sources.map(s => ({path: s.path, sha256: s.sha256})), bytes: inspected.input.bytes});
      }
    }
    save('source-integrity.json', checks);
  }
  try {
    await newDirectGame(page); await directPatrol(page, outcome);
    save('actual-patrol-gate.json', await savedDirect(page));
    await configure(); expect(calls).toBe(0);
    await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
    const generated = await watch(0, 'body');
    expect(generated.airpDirect!.tasks[0].context!.proof.outcome).toBe(outcome);
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    await page.locator('.rp-app__cue').click(); await directReady(page);
    const halfRead = await savedDirect(page), countBeforeRefresh = calls;
    await page.reload(); await directReady(page);
    expect((await savedDirect(page)).narrative).toEqual(halfRead.narrative); expect(calls).toBe(countBeforeRefresh);
    expect((await savedDirect(page)).airpDirect!.memories).toEqual([]);
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    await photographDialogue(info.outputPath('real-return-reading.png'));
    await readDirectConversation(page);
    await page.getByRole('button', {name: '确认交付并整理记忆', exact: true}).click(); await directReady(page);
    // Reload cleared the keys. Delivery must still commit and no paid request may occur.
    expect(calls).toBe(countBeforeRefresh);
    await openManorJournal(page, '旧药箱的搭扣');
    await configure();
    await page.getByRole('button', {name: '整理已读记忆', exact: true}).click();
    const delivered = await watch(0, 'memory');
    expect(delivered.narrative?.version === 2 && delivered.narrative.instances.find(i => i.id === delivered.airpDirect!.tasks[0].instanceId)?.status).toBe('resolved');
    await page.getByRole('button', {name: '再和艾洛拉聊聊药箱', exact: true}).click(); await directReady(page);
    await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
    await watch(1, 'body');
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    await photographDialogue(info.outputPath('real-followup-reading.png'));
    await readDirectConversation(page); const completed = await watch(1, 'memory');
    expect(completed.snapshot).toEqual(delivered.snapshot);
    expect(completed.airpDirect!.memories).toHaveLength(2);
    sources(completed); save('completed.json', completed);
    savePrivateArchive(completed, 'completed'); // Preserve paid results before any later UI assertion can fail.
    const recordBytes = Buffer.byteLength(JSON.stringify(completed)), directBytes = Buffer.byteLength(JSON.stringify(completed.airpDirect));
    const beforeReload = calls, reloadStarted = Date.now(); await page.reload(); await directReady(page);
    const reloadMs = Date.now() - reloadStarted;
    expect((await savedDirect(page)).airpDirect).toEqual(completed.airpDirect); expect(calls).toBe(beforeReload);
    save('acceptance.json', {outcome, calls, recordBytes, directBytes, reloadMs,
      paragraphs: completed.airpDirect!.tasks.map(t => completed.narrative?.scenes.find(s => s.id === t.sceneId)?.body.nodes.length), memories: completed.airpDirect!.memories, network, problems});
    await openManorJournal(page, '旧药箱的搭扣');
    await page.screenshot({path: info.outputPath('real-memories-after-refresh.png')});
    const copies = await manualDirectCopy(page);
    save('manual-copy.json', {source: copies.before.head, destination: copies.copy.head, sameDirectState: true, ancestorSource: copies.copy.originRef?.source.head,
      sourceBytes: Buffer.byteLength(JSON.stringify(copies.before)), destinationBytes: Buffer.byteLength(JSON.stringify(copies.copy))});
    expect(calls).toBe(beforeReload);
    expect(problems).toEqual([]); expect(calls).toBeGreaterThanOrEqual(8); expect(calls).toBeLessThanOrEqual(12);
    // Local-only restorable artifact. Unlike diagnostics this retains endpoint
    // metadata; never publish it with the static site or include it in traces.
    savePrivateArchive(copies.copy, 'copy');
  } finally {
    save('network.json', {outcome, calls, network, problems});
    try {save('last-record.json', await savedDirect(page));} catch { /* No usable save yet. */ }
  }
});
