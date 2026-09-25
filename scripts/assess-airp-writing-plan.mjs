// Isolated writer-editorial A/B experiment. No default prompt, deployment or player-save changes.
// Dry preparation: node scripts/assess-airp-writing-plan.mjs
// Opt-in fresh paired samples, at most 8 calls: --live <expected cumulative calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { createWritingPlanInput, measureAvgProse, writingPlanVariants } from './lib/airp-writing-plan-variants.mjs';
import { pagesInventory, privateMarkers, scanPrivateMarkers } from './lib/airp-pages.mjs';

const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || live && /^\d+$/.test(process.argv[3]) && process.argv.length === 4, 'Use no arguments or --live <expected calls>');
const expected = live ? Number(process.argv[3]) : null, allowance = 8;
const root = process.cwd(), baseline = path.join(root, 'dist/reports/airp-stage-ownership-IHK1j6');
const ids = ['A-medicine-control', 'C-care-reversed'];
const sha = text => createHash('sha256').update(text).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const { hash } = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const { readWritingOutput, readProseOnlyWritingOutput } = await vite.ssrLoadModule('/src/game-application/airp-generation/writing.ts');
  const { acceptGeneratedText } = await vite.ssrLoadModule('/src/game-application/airp-generation/scene.ts');
  const { createDirectProvider } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const { writingPerformanceGuide } = await vite.ssrLoadModule('/src/content/presentation/airp/writing-performance.ts');
  const { keminiSource, keminiOriginalModules } = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');
  const spec = await read(path.join(baseline, 'specification.json')), priorPreflight = await read(path.join(baseline, 'preflight.json'));
  assert.equal(keminiSource.revision, 'airp-kemini-3.1-r5-avg-flow');
  assert.equal(hash(spec), hash(runtime.defaultSpecification()), 'Default prompts/material changed; establish a new frozen baseline first');
  assert.equal(hash(spec.preset), priorPreflight.presetHash); assert.equal(hash(spec.resources), priorPreflight.resourcesHash);
  for (const source of spec.resources.sources) {
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text);
    assert.equal(sha(source.text), source.sha256);
  }
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert.equal(sha(original), keminiSource.sha256);
  for (const module of keminiOriginalModules) assert.equal(JSON.parse(original).prompts.find(p => p.identifier === module.identifier).content ?? '', module.content);

  const cases = await Promise.all(ids.map(async id => {
    const planning = await read(path.join(baseline, `${id}-planning.json`)), writing = await read(path.join(baseline, `${id}-writing.json`));
    assert.equal(planning.status, 'succeeded'); assert.equal(writing.status, 'succeeded');
    assert.equal(hash(planning.input), planning.inputHash); assert.equal(hash(writing.input), writing.inputHash);
    assert(writing.input.messages.at(-1).content.includes(`<scene_plan>\n${planning.text}\n</scene_plan>`));
    const variants = Object.fromEntries(writingPlanVariants.map(variant => [variant, createWritingPlanInput(writing.input, variant, writingPerformanceGuide)]));
    assert.deepEqual(variants['with-plan'].input, writing.input);
    for (const { input } of Object.values(variants)) {
      for (const source of spec.resources.sources) assert(input.messages.some(m => m.content.includes(source.text)));
      assert(input.messages.at(-1).content.includes(`<scene_plan>\n${planning.text}\n</scene_plan>`));
      assert(!input.messages.some(m => m.content.includes('不少于1000字')));
      assert(input.bytes <= 2097152);
    }
    return { id, planning, variants };
  }));

  const rawConfig = live ? await read(path.join(root, 'config/airp-test.local.json')) : null;
  const config = live ? runtime.parseTestConfig(JSON.stringify(rawConfig)) : null;
  const models = config ? runtime.resolveGenerationModels(config.models, spec.preset) : null;
  const markers = rawConfig ? privateMarkers(rawConfig) : { keys: [], endpoints: [] };
  if (models) {
    const priorModels = await read(path.join(baseline, 'models.json'));
    for (const slot of ['planning', 'writing', 'updater']) {
      const withoutEndpoint = ({ baseUrl, ...rest }) => rest;
      assert.deepEqual(withoutEndpoint(models[slot]), withoutEndpoint(priorModels[slot]), 'Do not change model/sampling/output limits during A/B');
    }
    assert(markers.keys.length && markers.endpoints.length, 'Missing private scan markers');
  }
  const sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, (key, val) => key === 'baseUrl' ? '[configured-endpoint]' : val, 2);
    assert(!markers.keys.some(key => text.includes(key)), 'Credential detected; refusing to save');
    for (const endpoint of markers.endpoints) text = text.replaceAll(endpoint, '[configured-endpoint]');
    return text;
  };
  const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-writing-plan-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
  const preflight = {
    revision: 'r5-writer-editorial-ab-v1', baseline, presetHash: hash(spec.preset), resourcesHash: hash(spec.resources),
    preservedOriginalModules: keminiOriginalModules.length, sourceIntegrity: priorPreflight.sourceIntegrity,
    variants: { 'with-plan': 'Unmodified r5 writer editorial guide and planning+prose response', 'without-plan': 'Only writer editorial exercise/references removed; standalone prose response' },
    runner: 'Node fetch, isolated experiment; no browser/CORS, save, or default-version acceptance claimed.',
    scenarios: cases.map(c => ({ id: c.id, sharedOutlineHash: sha(c.planning.text), inputs: Object.fromEntries(writingPlanVariants.map(v => [v, { hash: hash(c.variants[v].input), bytes: c.variants[v].input.bytes }])) })),
  };
  await save('preflight.json', preflight);
  for (const c of cases) {
    await save(`${c.id}-shared-outline.txt`, c.planning.text);
    for (const variant of writingPlanVariants) await save(`${c.id}-${variant}-writing-input.json`, c.variants[variant].input);
  }
  await save('without-plan-changes.json', cases[0].variants['without-plan'].changes);
  console.log(JSON.stringify({ event: 'prepared', directory, ...preflight }));
  if (live) {
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = await read(ledgerPath); assert.equal(ledger.calls, expected, 'Cumulative ledger changed');
    const newLimit = Math.max(ledger.limit, expected + allowance);
    ledger = { ...ledger, limit: newLimit, budgetAdjustments: [...(ledger.budgetAdjustments ?? []), {
      previousLimit: ledger.limit, newLimit, startingCalls: expected, additionalCallAllowance: newLimit - ledger.limit,
      reason: '用户要求正文有Plan/无Plan对照并确认保留三段式大纲；两场各两版，仅正文和格式化，最多8次，不重刷，不更换模型或资料。',
    }] };
    writeFileSync(ledgerPath, JSON.stringify(ledger)); await save('models.json', models);
    const provider = createDirectProvider(async (url, init) => {
      assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
      assert(ledger.calls < Math.min(ledger.limit, expected + allowance), 'Call limit reached');
      ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
      console.log(JSON.stringify({ event: 'dispatch', calls: ledger.calls, model: JSON.parse(init.body).model }));
      return fetch(url, init);
    });
    async function run(c, variant) {
      const result = { id: c.id, variant, status: 'running', sharedOutlineHash: sha(c.planning.text), attempts: [] };
      let prose;
      for (const stage of ['writing', 'formatting']) {
        const input = stage === 'writing' ? c.variants[variant].input : runtime.compileInput('formatting', spec, c.planning.text, prose);
        const slot = stage === 'writing' ? 'writing' : 'updater', name = `${c.id}-${variant}-${stage}`;
        const attempt = { stage, input, inputHash: hash(input), config: models[slot], startedAt: Date.now(), status: 'running' };
        result.attempts.push(attempt); await save(`${name}.json`, attempt);
        try {
          const completion = await provider({ config: models[slot], messages: input.messages }, config.keys[slot], new AbortController().signal);
          Object.assign(attempt, completion); await save(`${name}.txt`, completion.text);
          if (stage === 'writing') {
            const parts = variant === 'with-plan' ? readWritingOutput(completion.text, 4) : readProseOnlyWritingOutput(completion.text);
            prose = parts.prose; result.metrics = measureAvgProse(prose);
            await save(`${c.id}-${variant}-prose.txt`, prose);
            if (parts.editorial !== null) await save(`${c.id}-${variant}-editorial.txt`, parts.editorial);
          } else {
            const scene = acceptGeneratedText(completion.text, prose);
            assert.equal(scene.lines.length, result.metrics.pages);
            result.verbatim = true; await save(`${c.id}-${variant}-scene.json`, scene);
          }
          attempt.status = 'succeeded';
        } catch (error) {
          attempt.status = result.status = 'failed';
          attempt.error = { code: error.code ?? 'runner-error', message: error.code ? error.message : 'Local assessment failed', usage: error.usage ?? null };
        }
        attempt.endedAt = Date.now(); await save(`${name}.json`, attempt);
        console.log(sanitize({ event: 'stage-ended', id: c.id, variant, stage, status: attempt.status, elapsedMs: attempt.endedAt - attempt.startedAt, usage: attempt.usage, error: attempt.error }));
        if (result.status === 'failed') break;
      }
      if (result.status !== 'failed') result.status = 'accepted';
      await save(`${c.id}-${variant}-result.json`, result);
      return { id: c.id, variant, status: result.status, metrics: result.metrics, verbatim: result.verbatim };
    }
    // Two concurrent scenarios, reversed variant order to avoid always testing one variant first.
    const groups = await Promise.all(cases.map(async (c, index) => {
      const results = [];
      for (const variant of index % 2 ? [...writingPlanVariants].reverse() : writingPlanVariants) results.push(await run(c, variant));
      return results;
    }));
    const summary = { directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, results: groups.flat() };
    await save('summary.json', summary);
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({ event: 'completed', privateMarkerScan: 'passed', ...summary }));
    if (summary.results.some(r => r.status !== 'accepted')) process.exitCode = 1;
  }
} finally { await vite.close(); }
