// Reuse the exact prior paid Sol output; test only v6 editor + formatter.
// Offline by default. Live: node scripts/verify-airp-editor-performance.mjs --live <expected calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';
const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || live && process.argv.length === 4 && /^\d+$/.test(process.argv[3]));
const root = process.cwd(), expected = Number(process.argv[3]), prior = path.join(root, 'dist/reports/airp-creation-v5-PG3KC4');
const sha = value => createHash('sha256').update(value).digest('hex');
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let sanitize = () => '[details withheld]';
try {
  const {directorTestMaterial, directorTestJob} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-fixture.ts');
  const {compileDirectorJob, reduceDirectorJob} = await vite.ssrLoadModule('/src/game-application/airp-director/jobs.ts');
  const {directorProse, validateDirectorWriting, acceptDirectorText} = await vite.ssrLoadModule('/src/game-application/airp-director/scene.ts');
  const {performedParagraphs} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
  const {directorHash} = await vite.ssrLoadModule('/src/game-core/session/index.ts');
  const {parseTestConfig, resolveGenerationModels} = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {createDirectProvider} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {emptyUsage} = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
  const markers = privateMarkers(JSON.parse(privateText)), config = parseTestConfig(privateText);
  sanitize = value => {
    let s = typeof value === 'string' ? value : JSON.stringify(value, (key, value) => key === 'baseUrl' ? '[configured-endpoint]' : value, 2);
    assert(!markers.keys.some(k => s.includes(k)), 'Credential detected; output refused');
    for (const e of [...markers.endpoints].sort((a, b) => b.length - a.length)) s = s.replaceAll(e, '[configured-endpoint]');
    return s;
  };
  const material = directorTestMaterial(6);
  material.models = resolveGenerationModels(config.models, material.preset, 6);
  assert.deepEqual(['planning', 'writing', 'updater'].map(s => material.models[s].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
  for (const s of material.resources.sources) assert.equal(sha(await fs.readFile(path.join(root, s.path))), s.sha256);
  let job = {...directorTestJob(material), id: 'performance-v6-check', kind: 'scene', planning: null,
    scene: JSON.parse(await fs.readFile(path.join(prior, 'A-elora-offer-context.json'), 'utf8')), materialHash: directorHash(material)};
  const original = JSON.parse(await fs.readFile(path.join(prior, 'A-elora-offer-planning-1.json'), 'utf8'));
  assert.equal(original.status, 'succeeded');
  assert.equal(sha(JSON.stringify(compileDirectorJob(material, job).messages)), sha(JSON.stringify(original.input.messages)), 'Creator messages changed; do not reuse unrelated output');
  job = reduceDirectorJob(job, material, {type: 'airp-director-begin', jobId: job.id, attemptId: 'reused-sol', stage: 'planning', at: 1});
  job = reduceDirectorJob(job, material, {type: 'airp-director-result', jobId: job.id, attemptId: 'reused-sol', output: original.text, usage: emptyUsage(), at: 2});
  assert.equal(job.attempts.at(-1).status, 'succeeded');
  const preflight = {version: 6, reusedCreator: 'airp-creation-v5-PG3KC4/A-elora-offer-planning-1.json', creatorMessagesIdentical: true,
    newCalls: 'editor + formatter; at most one formatter repair; use existing allowance only', writerBytes: compileDirectorJob(material, job).bytes,
    models: {writing: material.models.writing, updater: material.models.updater}};
  if (!live) console.log(sanitize(preflight));
  else {
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected); assert(ledger.limit - expected >= 3, 'Existing allowance needed; do not extend automatically');
    const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-performance-v6-')); await fs.chmod(directory, 0o700);
    const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
    await save('preflight.json', preflight); await save('material.json', material);
    const attempts = [];
    console.log(sanitize({event: 'started', directory, calls: expected, limit: ledger.limit}));
    for (const stage of ['writing', 'formatting']) {
      for (let ordinal = 1; ordinal <= (stage === 'formatting' ? 2 : 1); ordinal++) {
        const formatRepair = ordinal === 2 ? 1 : undefined, input = compileDirectorJob(material, job, formatRepair), slot = stage === 'writing' ? 'writing' : 'updater';
        const name = `${stage}-${ordinal}`, startedAt = Date.now();
        const attempt = {stage, ordinal, input, startedAt, status: 'running'}; attempts.push(attempt);
        await save(`${name}.json`, attempt);
        job = reduceDirectorJob(job, material, {type: 'airp-director-begin', jobId: job.id, attemptId: name, stage, at: startedAt, ...(formatRepair ? {formatRepair} : {})});
        const provider = createDirectProvider(async (url, init) => {
          assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
          assert(ledger.calls < Math.min(ledger.limit, expected + 3), 'Call limit reached');
          ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
          console.log(sanitize({event: 'dispatch', stage, ordinal, model: material.models[slot].model, calls: ledger.calls}));
          const response = await fetch(url, init);
          const raw = await response.clone().json().catch(() => null);
          await save(`${name}-response.json`, {status: response.status, usage: raw?.usage, choices: raw?.choices?.map(c => ({finishReason: c.finish_reason, content: c.message?.content}))});
          return response;
        });
        try {
          const completion = await provider({config: material.models[slot], messages: input.messages}, config.keys[slot], new AbortController().signal);
          Object.assign(attempt, completion); await save(`${name}-raw.txt`, completion.text);
          job = reduceDirectorJob(job, material, {type: 'airp-director-result', jobId: job.id, attemptId: name, at: Date.now(), output: completion.text, usage: completion.usage});
          attempt.status = job.attempts.at(-1).status; attempt.error = job.attempts.at(-1).error;
          if (attempt.status !== 'succeeded') {
            if (stage === 'writing') validateDirectorWriting(completion.text, material, job);
            else acceptDirectorText(completion.text, directorProse(material, job), job.scene.actorIds, 6);
          }
        } catch (error) {
          attempt.status = 'failed'; attempt.error ??= error.code ?? 'local-error';
          attempt.message = error.code ? error.message : 'Local failure; confidential details withheld';
          attempt.usage ??= error.usage ?? emptyUsage();
          if (job.attempts.at(-1).status === 'running') job = reduceDirectorJob(job, material, {type: 'airp-director-fail', jobId: job.id, attemptId: name, at: Date.now(), error: 'provider-error', outcomeUnknown: error.outcomeUnknown ?? true, usage: attempt.usage});
        }
        attempt.endedAt = Date.now(); await save(`${name}.json`, attempt);
        console.log(sanitize({event: 'stage-ended', stage, ordinal, status: attempt.status, error: attempt.error, message: attempt.message, usage: attempt.usage}));
        if (attempt.status === 'succeeded' || !(stage === 'formatting' && ordinal === 1 && attempt.error === 'invalid-output')) break;
      }
      if (job.attempts.at(-1).status !== 'succeeded') break;
    }
    const writing = job.attempts.find(a => a.stage === 'writing' && a.status === 'succeeded');
    if (writing) {
      const prose = directorProse(material, job); await save('edited-prose.txt', prose);
      const paragraphs = performedParagraphs(prose);
      await save('中文与表情.md', '# 真实文笔模型标注\n\n复用上轮Sol初稿，只重新调用Gemini和DeepSeek；不是新跑完整三阶段。' + (job.text ? '中文与表情均通过正式封装校验。' : '封装未通过，下列只是文笔终稿的中文投影。') + '\n\n' + paragraphs.map(p => p.speaker === 'narrator' ? p.chinese : `**艾洛拉 · ${p.emotion}**：${p.chinese}`).join('\n\n'));
    }
    if (job.text) await save('scene.json', job.text);
    const summary = {directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, status: job.text ? 'ready' : 'failed', reusedCreator: true,
      expressions: job.text?.lines.filter(l => l.speaker !== 'narrator').map(l => l.emotion), attempts: attempts.map(({input, text, ...rest}) => rest)};
    await save('summary.json', summary);
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'completed', directory, calls: ledger.calls, status: summary.status, expressions: summary.expressions, privacy: 'passed'}));
    if (!job.text) process.exitCode = 1;
  }
} catch (error) {console.error(sanitize({event: 'stopped', code: error.code, message: error.message})); process.exitCode = 1;}
finally {await vite.close();}
