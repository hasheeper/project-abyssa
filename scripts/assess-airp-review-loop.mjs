// Standalone audit/revision test bench. It never imports or writes game saves.
// --prepare low|mid|high: freeze inputs; --live <directory> <expected-ledger-count>: bounded loop.
// --step <directory> <expected-ledger-count>: one request; --report <directory>: offline report.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {digest, readVisibleResponse} from './lib/airp-native-baseline.mjs';
import {privateMarkers} from './lib/airp-pages.mjs';
import {loadReviewBaseline, compileReviewMaterials, inspectReviewDraft, createReviewRun, nextReviewStep,
  compileReviewRequest, parseReviewAudit, parseReviewRevision} from './lib/airp-review-loop.mjs';

const root = process.cwd(), mode = process.argv[2], args = process.argv.slice(3);
const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
let directory, connection, markers, activeLock;
const sanitize = input => {
  let text = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  assert(!(markers?.keys ?? []).some(key => text.includes(key)), 'Credential in output; archive refused');
  for (const endpoint of [...(markers?.endpoints ?? [])].sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]');
  return text;
};
const save = async (name, value, exclusive = false) => {
  const text = sanitize(value);
  if (exclusive) return fs.writeFile(path.join(directory, name), text + '\n', {flag: 'wx', mode: 0o600});
  const pending = path.join(directory, name + '.pending-' + process.pid);
  await fs.writeFile(pending, text + '\n', {flag: 'wx', mode: 0o600});
  await fs.rename(pending, path.join(directory, name));
};
const emit = value => console.log(sanitize(value));
async function loadConnection() {
  const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
  try {
    const {parseTestConfig} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/test-config.ts');
    const raw = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
    markers = privateMarkers(JSON.parse(raw));
    connection = parseTestConfig(raw);
    const {createMacroCompiler} = await vite.ssrLoadModule('/src/game-application/airp-generation/preset.ts');
    return createMacroCompiler;
  } finally {await vite.close();}
}
const slotFor = stage => stage === 'audit' ? 'planning' : 'writing';
const fingerprint = config => digest(JSON.stringify(config));
async function report(packet, run) {
  let text = '# AIRP 独立审计／修订闭环\n\n状态：' + run.status + '；' + (run.label ?? '尚未结束') +
    '。模式：' + run.mode + '。复用r8首稿，不重新生成；未接游戏。\n\n';
  text += '| 版本 | 中文汉字 | 段落 | 对白段 | 对白占比 | 格式问题 |\n| --- | --- | --- | --- | --- | --- |\n';
  for (const draft of run.drafts) {
    const m = draft.metrics;
    text += '| ' + [draft.id, m.chineseCharacters, m.paragraphs, m.dialogueParagraphs, m.dialogueRatioPercent + '%', draft.diagnostics.length].join(' | ') + ' |\n';
  }
  text += '\n数值为诊断，不是文风通过证明。缺日文／日中倒置时阅读稿仅复制已有中文，不重译，原文与错误另存。\n\n';
  text += '审计模型：' + packet.models.audit.model + '；修订模型：' + packet.models.revision.model + '。\n\n';
  for (const draft of run.drafts) {
    text += '## ' + draft.id + ' 中文阅读稿\n\n' + draft.reading + '\n\n';
    const audit = run.audits.find(a => a.report.draftId === draft.id)?.report;
    if (audit) {
      text += '### 审计：' + audit.verdict + '\n\n' + audit.summary + '\n\n';
      for (const issue of audit.issues) text += '- ' + issue.id + '（' + issue.paragraphIds.join('、') + '）：' + issue.impact + '\n  - 修订条件：' + issue.requirement + '\n';
      for (const item of audit.priorIssues) text += '- 原问题 ' + item.id + '：' + item.status + '；' + item.evidence + '\n';
      for (const question of audit.questions) text += '- 待确认：' + question + '\n';
      text += '\n';
    }
    const revision = run.revisions.find(r => r.from === draft.id);
    if (revision) {
      text += '### 修改记录（不是通过证明）\n\n';
      for (const item of revision.changes) text += '- ' + item.issueId + '：' + item.note + '\n';
      const after = run.drafts.find(d => d.id === revision.to);
      if (after) {
        text += '\n### 逐段差异\n\n';
        const beforeRows = draft.paragraphs, afterRows = after.paragraphs;
        if (beforeRows.length !== afterRows.length) text += '段数发生变化，下面按当前索引列出；完整稿为准，不冒称语义段落自动对齐。\n\n';
        for (let i = 0; i < Math.max(beforeRows.length, afterRows.length); i++) {
          if (beforeRows[i]?.raw === afterRows[i]?.raw) continue;
          text += '- ' + (beforeRows[i]?.id ?? afterRows[i]?.id) + '\n  - 改前：' + (beforeRows[i]?.raw ?? '（无）') + '\n  - 改后：' + (afterRows[i]?.raw ?? '（无）') + '\n';
        }
        if (draft.choices !== after.choices) text += '\n选项改前：\n\n' + draft.choices + '\n\n选项改后：\n\n' + after.choices + '\n';
      }
      text += '\n';
    }
  }
  if (run.error) text += '## 停止原因\n\n' + run.error + '\n\n';
  text += '## 材料与输入\n\n完整事实来源：' + packet.sources.length + '份，其中原世界／角色全文' +
    packet.sources.filter(s => s.kind === 'original-full-source').length + '份。修订保留文风参考全文，首稿ICOT／Plan不进入审计或修订。\n\n';
  text += '- packet.json：冻结资料、原句与适配清单、提示词、模型参数及指纹（不含地址或Key）。\n- 各请求的request.json与response.json：实际请求及原始公开输出。\n- state.json：完整状态、审计、修订和调用记录。\n';
  await save('完整对照.md', text);
  for (const draft of run.drafts) {
    await save(draft.id + '-完整双语正文.md', '# ' + draft.id + '\n\n' + draft.text);
    await save(draft.id + '-中文阅读稿.md', '# ' + draft.id + '\n\n' + draft.reading);
  }
}

try {
  assert(['--prepare', '--live', '--step', '--report'].includes(mode), 'Unknown mode');
  if (mode === '--prepare') {
    assert(args.length === 1 && ['low', 'mid', 'high'].includes(args[0]));
    const compiler = await loadConnection(), baseline = await loadReviewBaseline(root);
    assert.equal(connection.models.writing.model, baseline.request.model, 'Revision model differs from accepted writer');
    assert(connection.keys.planning && connection.keys.writing);
    const materials = compileReviewMaterials(baseline, compiler);
    const prompts = Object.fromEntries(await Promise.all(['audit', 'revision'].map(async stage =>
      [stage, (await fs.readFile(path.join(root, 'scripts/fixtures/airp-review-' + stage + '.txt'), 'utf8')).trim()])));
    const auditConfig = connection.models.planning;
    const auditSampling = {stream: true};
    for (const key of ['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'reasoning_effort', 'n']) {
      if (auditConfig[key] !== undefined) auditSampling[key] = auditConfig[key];
    }
    const {model: ignoredModel, messages: ignoredMessages, ...revisionSampling} = baseline.request;
    const packet = {version: 1, createdAt: new Date().toISOString(), sources: baseline.sources,
      scene: baseline.scene, catalog: baseline.catalog, materials, prompts,
      baselineResponseSha256: digest(baseline.response.text), originalResponse: baseline.response,
      models: {audit: {model: auditConfig.model, sampling: auditSampling, configurationHash: fingerprint(auditConfig)},
        revision: {model: connection.models.writing.model, sampling: revisionSampling, configurationHash: fingerprint(connection.models.writing)}}};
    const packetText = sanitize(packet), packetHash = digest(packetText);
    const draft = inspectReviewDraft(baseline.originalDraft, baseline.catalog, 'D0');
    const run = createReviewRun(args[0], draft, packetHash);
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-review-loop-'));
    await fs.chmod(directory, 0o700);
    await save('packet.json', packet, true);
    await save('state.json', run, true);
    await save('audit-preview.json', compileReviewRequest(packet, run, 'audit'), true);
    await report(packet, run);
    const ledger = await json(ledgerPath);
    emit({event: 'prepared', directory, mode: run.mode, models: {audit: packet.models.audit.model, revision: packet.models.revision.model},
      ledger: {calls: ledger.calls, limit: ledger.limit}, fullSources: packet.sources.filter(s => s.kind === 'original-full-source').map(s => s.id),
      retainedFragments: materials.fragments.length, referenceCharacters: materials.fragments.find(f => f.purpose === 'reference').text.length,
      diagnosticCount: draft.diagnostics.length});
  } else {
    assert(args.length === (mode === '--report' ? 1 : 2));
    directory = path.resolve(args[0]);
    assert.equal(path.dirname(directory), path.join(root, 'dist/reports'));
    assert(path.basename(directory).startsWith('airp-review-loop-'));
    assert(!(await fs.lstat(directory)).isSymbolicLink(), 'Symlink run directory');
    const packet = await json(path.join(directory, 'packet.json')), run = await json(path.join(directory, 'state.json'));
    assert.equal(digest(JSON.stringify(packet, null, 2)), run.contextHash, 'Frozen packet changed');
    if (mode === '--report') await report(packet, run);
    else {
      assert(/^\d+$/.test(args[1]), 'Expected ledger count required');
      let expected = Number(args[1]);
      await loadConnection();
      assert.equal(run.status, 'pending', 'Stopped/completed runs do not silently restart');
      activeLock = await fs.open(path.join(directory, 'run.lock'), 'wx', 0o600);
      assert(!run.attempts.some(a => a.status === 'running'), 'Uncertain attempt: inspect raw output, do not resend automatically');
      try {
        while (run.status === 'pending') {
          const next = nextReviewStep(run);
          if (next.stage === 'finish') {run.status = next.status; run.label = next.label; break;}
          const {stage} = next, slot = slotFor(stage), config = connection.models[slot];
          assert.equal(fingerprint(config), packet.models[stage].configurationHash, 'Connection/configuration changed; prepare a new task');
          const draft = run.drafts.at(-1), previous = run.audits.at(-1)?.report ?? null;
          const request = compileReviewRequest(packet, run, stage);
          const attempt = {id: String(run.attempts.length + 1).padStart(2, '0') + '-' + stage + '-' + draft.id,
            stage, draftId: draft.id, status: 'running', startedAt: new Date().toISOString(), requestSha256: digest(sanitize(request))};
          await save(attempt.id + '-request.json', request, true);
          const ledgerLock = await fs.open(ledgerPath + '.native-lock', 'wx', 0o600);
          try {
            const ledger = await json(ledgerPath);
            assert.equal(ledger.calls, expected, 'Concurrent ledger change: stop without sending');
            assert(ledger.calls < ledger.limit && ledger.limit <= 200, 'Call budget exhausted/changed');
            attempt.call = ledger.calls + 1;
            run.attempts.push(attempt); await save('state.json', run);
            ledger.calls++;
            const temporary = ledgerPath + '.review-' + process.pid + '.tmp';
            await fs.writeFile(temporary, JSON.stringify(ledger), {flag: 'wx', mode: 0o600});
            await fs.rename(temporary, ledgerPath);
            expected = ledger.calls;
          } finally {await ledgerLock.close(); await fs.unlink(ledgerPath + '.native-lock');}
          emit({event: 'dispatch', stage, draft: draft.id, model: request.model, call: expected, requestBytes: Buffer.byteLength(JSON.stringify(request))});
          const endpoint = config.baseUrl.replace(/\/+$/, '') + (/\/chat\/completions$/.test(config.baseUrl.replace(/\/+$/, '')) ? '' : '/chat/completions');
          const url = new URL(endpoint);
          assert(!url.username && !url.password && !url.search && !url.hash && ['https:', 'http:'].includes(url.protocol), 'Endpoint shape');
          const response = await fetch(endpoint, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
            headers: {'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: 'Bearer ' + connection.keys[slot]},
            body: JSON.stringify(request)});
          if (!response.ok) {await response.body?.cancel(); throw new Error('HTTP ' + response.status);}
          let last = Date.now();
          const output = await readVisibleResponse(response, characters => {
            if (Date.now() - last > 20000) {emit({event: 'receiving', stage, characters}); last = Date.now();}
          });
          await save(attempt.id + '-response.json', output, true);
          assert(output.finishReason === 'stop' && output.text.trim() && !output.refused && !output.toolCalls, 'Incomplete/refused/nontext response');
          attempt.usage = output.usage;
          if (stage === 'audit') {
            const parsed = parseReviewAudit(output.text, draft, packet.sources, previous);
            run.audits.push({attemptId: attempt.id, report: parsed});
            emit({event: 'audit', draft: draft.id, verdict: parsed.verdict, issues: parsed.issues.map(i => ({id: i.id, at: i.paragraphIds, impact: i.impact}))});
          } else {
            const required = [...previous.issues.map(i => i.id), ...draft.diagnostics.map(i => i.id)];
            const parsed = parseReviewRevision(output.text, draft, required, packet.catalog);
            run.revisions.push({attemptId: attempt.id, from: draft.id, to: parsed.draft?.id ?? null,
              status: parsed.status, changes: parsed.changes, questions: parsed.questions});
            if (parsed.status === 'blocked') {run.status = 'blocked'; run.label = '修订无法完成';}
            else run.drafts.push(parsed.draft);
            emit({event: 'revision', status: parsed.status, draft: parsed.draft?.id, metrics: parsed.draft?.metrics, diagnostics: parsed.draft?.diagnostics});
          }
          attempt.status = 'succeeded'; attempt.endedAt = new Date().toISOString();
          await save('state.json', run); await report(packet, run);
          if (mode === '--step') {
            const finish = nextReviewStep(run);
            if (finish?.stage === 'finish') {run.status = finish.status; run.label = finish.label;}
            break;
          }
        }
      } catch (error) {
        const last = run.attempts.at(-1);
        if (last?.status === 'running') {last.status = 'failed'; last.endedAt = new Date().toISOString();}
        run.status = 'technical-failure'; run.error = sanitize(error.message);
        process.exitCode = 1;
      } finally {
        await save('state.json', run); await report(packet, run);
        await activeLock.close(); activeLock = null; await fs.unlink(path.join(directory, 'run.lock'));
      }
      emit({event: 'stopped', directory, status: run.status, label: run.label, error: run.error, calls: expected,
        drafts: run.drafts.length, audits: run.audits.length, revisions: run.revisions.length});
    }
  }
} catch (error) {
  // Do not print request, config, response bodies or credential-bearing stack frames.
  emit({event: 'failed', error: markers ? sanitize(error.message) : error.name}); process.exitCode = 1;
}
