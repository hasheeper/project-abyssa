// Opt-in verification of production stage/AVG prompts; no deployment or player-save access.
// node scripts/assess-airp-stage-ownership.mjs [--live <expected cumulative calls>]
// One explicit writer-only recheck: --retry-writing <expected calls> <prior report directory>
// User-authorized r5 AVG test, at most eight new calls: --avg-live <expected calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';

const retryWriting = process.argv[2] === '--retry-writing';
const avgFlowTest = process.argv[2] === '--avg-live';
const live = process.argv[2] === '--live' || retryWriting || avgFlowTest;
assert(process.argv.length === 2 || live && /^\d+$/.test(process.argv[3]) && process.argv.length === (retryWriting ? 5 : 4));
const expected = live ? Number(process.argv[3]) : null;
const root = process.cwd(), priorDirectory = path.join(root, 'dist/reports/airp-prose-assessment-LJt1Yc');
const ids = retryWriting ? ['A-medicine-control'] : ['A-medicine-control', 'C-care-reversed'];
const allowance = retryWriting ? 1 : avgFlowTest ? 8 : 6;
const retryDirectory = retryWriting ? path.resolve(process.argv[4]) : null;
if (retryDirectory) assert(retryDirectory.startsWith(path.join(root, 'dist/reports/airp-stage-ownership-')));
const sha = text => createHash('sha256').update(text).digest('hex');
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {contextValues} = await vite.ssrLoadModule('/src/game-application/airp-generation/context.ts');
  const {hash, bytes} = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const {readWritingOutput} = await vite.ssrLoadModule('/src/game-application/airp-generation/writing.ts');
  const {acceptGeneratedText} = await vite.ssrLoadModule('/src/game-application/airp-generation/scene.ts');
  const {createDirectProvider} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {keminiOriginalModules, keminiSource, keminiPlanningChecklist} = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');
  const spec = runtime.defaultSpecification(); assert.equal(spec.resources.version, 4);
  if (avgFlowTest) assert.equal(keminiSource.revision, 'airp-kemini-3.1-r5-avg-flow');
  if (retryDirectory) {
    const previous = JSON.parse(await fs.readFile(path.join(retryDirectory, 'preflight.json'), 'utf8'));
    assert.equal(previous.presetHash, hash(spec.preset), 'Planner/writer preset must remain unchanged; only final delivery task refined');
  }
  const sourceIntegrity = [];
  for (const source of spec.resources.sources) {
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text);
    assert.equal(sha(source.text), source.sha256);
    sourceIntegrity.push({path: source.path, sha256: source.sha256, bytes: bytes(source.text)});
  }
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert.equal(sha(original), keminiSource.sha256);
  const prompts = JSON.parse(original).prompts;
  for (const module of keminiOriginalModules) assert.equal(prompts.find(p => p.identifier === module.identifier).content ?? '', module.content);
  const icot = prompts.find(p => p.identifier === 'fd9adcfd-bbbe-447e-8be6-4f1d87e50da7').content;
  assert.equal(keminiPlanningChecklist, icot.slice(icot.indexOf('- 如果为'), icot.indexOf('</thinking_format>')));
  assert(spec.preset.planningPrefix.includes(keminiPlanningChecklist));
  const cases = await Promise.all(ids.map(async id => {
    const previous = JSON.parse(await fs.readFile(path.join(priorDirectory, `${id}-planning-1.json`), 'utf8'));
    const situation = previous.input.messages.find(m => m.content.startsWith('<interactive_input>')).content;
    const context = JSON.parse(situation.replace(/^<interactive_input>\s*/, '').replace(/\s*<\/interactive_input>$/, '')).context;
    return {id, situation, context};
  }));
  function compile(test, stage, outline = '', prose = '', feedback) {
    const input = runtime.compileInput(stage, spec, outline, prose, feedback);
    // Same two fixed author scenarios as the earlier assessment, not new game events.
    // Only scenario data and the medicine-specific final task phrase are substituted.
    if (test.id === 'C-care-reversed' && stage !== 'formatting') {
      const current = contextValues(spec).context;
      input.messages.find(m => m.content.startsWith('<interactive_input>')).content = test.situation;
      if (stage === 'writing') {
        const last = input.messages.at(-1), oldFacts = JSON.stringify({facts: current.agenda.facts, unknown: current.agenda.unknown});
        assert(last.content.includes(oldFacts)); assert(last.content.includes('承接药箱归来的本次实际结果'));
        last.content = last.content.replace(oldFacts, JSON.stringify({facts: test.context.agenda.facts, unknown: test.context.agenda.unknown}))
          .replace('承接药箱归来的本次实际结果', '承接本场作者提供的固定前情');
      }
      input.contextHash = hash(test.context);
    }
    for (const source of spec.resources.sources) assert.equal(input.messages.some(m => m.content.includes(source.text)), stage !== 'formatting');
    input.bytes = input.messages.reduce((n, m) => n + bytes(m.content), 0); assert(input.bytes <= 2097152);
    return input;
  }
  const preflight = {
    revision: keminiSource.revision, presetHash: hash(spec.preset), resourcesHash: hash(spec.resources), checklistSha256: sha(keminiPlanningChecklist),
    preservedOriginalModules: keminiOriginalModules.length, sourceIntegrity, scenarios: ids,
    runner: 'Production prompts/compiler/provider/parser via Node fetch; no browser/CORS or player-save acceptance claimed.',
    mode: retryWriting ? 'writer-only contract recheck, same successful planner output; not an end-to-end run' : avgFlowTest ? 'r5 AVG two-scene acceptance; at most one format repair per scene, no planner/writer rerolls' : 'two scenes, three stages each',
    retryDirectory,
    previews: cases.map(test => ({id: test.id, planningBytes: compile(test, 'planning').bytes, writingBytes: compile(test, 'writing', '离线占位').bytes})),
  };
  if (!live) console.log(JSON.stringify({mode: 'dry-run', ...preflight}, null, 2));
  else {
    const config = runtime.parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
    const models = runtime.resolveGenerationModels(config.models, spec.preset);
    assert.deepEqual(['planning', 'writing', 'updater'].map(s => models[s].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
    const secrets = [...new Set(Object.values(config.keys))]; assert(secrets.every(Boolean));
    const endpoints = [...new Set(Object.values(models).flatMap(m => [m.baseUrl, new URL(m.baseUrl).origin]))];
    const sanitize = value => {
      let text = typeof value === 'string' ? value : JSON.stringify(value, (key, val) => key === 'baseUrl' ? '[configured-endpoint]' : val, 2);
      assert(!secrets.some(key => text.includes(key)), 'Credential detected; refusing to save');
      for (const endpoint of endpoints) text = text.replaceAll(endpoint, '[configured-endpoint]');
      return text;
    };
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected, 'Cumulative ledger changed');
    if (avgFlowTest) assert.equal(ledger.limit, expected, 'Review existing unused allowance before assigning a fresh test budget');
    else assert(ledger.limit - expected >= allowance, 'Existing call allowance required');
    const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-stage-ownership-')); await fs.chmod(directory, 0o700);
    const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
    await save('preflight.json', preflight); await save('models.json', models); await save('specification.json', spec);
    const newLimit = avgFlowTest ? expected + allowance : ledger.limit;
    ledger = {...ledger, limit: newLimit, budgetAdjustments: [...(ledger.budgetAdjustments ?? []), {
      previousLimit: ledger.limit, newLimit, startingCalls: expected, additionalCallAllowance: avgFlowTest ? allowance : 0,
      reason: avgFlowTest ? '用户明确要求开始测试新版AVG提示词；两场各三阶段，另各预留一次格式化修复，最多新增8次，不清零、不改提示词、不重刷大纲或正文。' : retryWriting ? '使用本轮剩余一次余额复验正文输出协议：复用药箱大纲，只重跑正文；不扩大额度，不冒称三阶段成功。' : '用户要求重新调整且保留三段式；使用现有六次余额验证大纲/正文分工，两场各三阶段、不重试、不扩大额度。',
    }]};
    writeFileSync(ledgerPath, JSON.stringify(ledger));
    console.log(JSON.stringify({event: 'started', directory, calls: expected, limit: ledger.limit}));
    const provider = createDirectProvider(async (url, init) => {
      assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
      assert(ledger.calls < Math.min(ledger.limit, expected + allowance), 'Call limit reached');
      ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
      console.log(JSON.stringify({event: 'dispatch', calls: ledger.calls, model: JSON.parse(init.body).model}));
      return fetch(url, init);
    });
    async function run(test) {
      const result = {id: test.id, status: 'running', attempts: []}, outputs = {};
      if (retryDirectory) {
        const prior = JSON.parse(await fs.readFile(path.join(retryDirectory, `${test.id}-planning.json`), 'utf8'));
        assert.equal(prior.status, 'succeeded');
        assert.equal(hash(prior.input), hash(compile(test, 'planning')), 'Frozen planner input changed');
        outputs.planning = prior.text;
      }
      for (const stage of retryWriting ? ['writing'] : ['planning', 'writing', 'formatting']) {
        let feedback;
        for (let ordinal = 1; ordinal <= (avgFlowTest && stage === 'formatting' ? 2 : 1); ordinal++) {
        const input = compile(test, stage, outputs.planning, outputs.prose, feedback), slot = stage === 'formatting' ? 'updater' : stage;
        const file = `${test.id}-${stage}${ordinal === 1 ? '' : `-${ordinal}`}`;
        const attempt = {stage, ordinal, input, inputHash: hash(input), config: models[slot], startedAt: Date.now(), status: 'running'};
        result.attempts.push(attempt); await save(`${file}.json`, attempt);
        try {
          const completion = await provider({config: models[slot], messages: input.messages}, config.keys[slot], new AbortController().signal);
          Object.assign(attempt, completion); await save(`${file}.txt`, completion.text);
          if (stage === 'writing') {
            const parts = readWritingOutput(completion.text, spec.resources.version); outputs.prose = parts.prose;
            await save(`${test.id}-editorial.txt`, parts.editorial); await save(`${test.id}-prose.txt`, parts.prose);
            if (retryWriting) result.checks = {validWriting: true, proseCharacters: parts.prose.length, fullPipelineVerified: false};
          }
          if (stage === 'formatting') {
            const scene = acceptGeneratedText(completion.text, outputs.prose), dialogue = scene.lines.filter(l => l.speaker === 'elora');
            result.checks = {verbatim: true, allBilingual: dialogue.length > 0 && dialogue.every(l => /^「[^\n]+（[^\n]+）」$/u.test(l.text)),
              dialogueCount: dialogue.length, threeParts: ['第一段', '第二段', '第三段'].every(p => outputs.planning.includes(p)),
              proseCharacters: outputs.prose.length, planningCharacters: outputs.planning.length};
            await save(`${test.id}-scene.json`, {scene, checks: result.checks});
          }
          outputs[stage] = completion.text; attempt.status = 'succeeded';
        } catch (error) {
          attempt.status = 'failed';
          if (avgFlowTest && stage === 'formatting' && ordinal === 1 && error.code === 'invalid-scene' && attempt.text) feedback = {previousOutput: attempt.text, error: error.message};
          else result.status = 'failed';
          attempt.error = {code: error.code ?? 'runner-error', message: error.code ? error.message : 'Local assessment failed', usage: error.usage ?? null};
        }
        attempt.endedAt = Date.now(); await save(`${file}.json`, attempt);
        console.log(sanitize({event: 'stage-ended', id: test.id, stage, ordinal, status: attempt.status, characters: attempt.text?.length, elapsedMs: attempt.endedAt - attempt.startedAt, usage: attempt.usage, error: attempt.error}));
        if (attempt.status === 'succeeded' || result.status === 'failed') break;
        }
        if (result.status === 'failed') break;
      }
      if (result.status !== 'failed') result.status = retryWriting ? 'writer-ready' : result.checks?.allBilingual && result.checks.threeParts ? 'ready' : 'check-failed';
      await save(`${test.id}-result.json`, result);
      return {id: result.id, status: result.status, checks: result.checks};
    }
    const results = await Promise.all(cases.map(run));
    const summary = {directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, results};
    await save('summary.json', summary); console.log(sanitize({event: 'completed', ...summary}));
    if (results.some(r => !['ready', 'writer-ready'].includes(r.status))) process.exitCode = 1;
  }
} finally {await vite.close();}
