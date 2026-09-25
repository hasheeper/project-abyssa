// Opt-in real prose check using the production v5 compiler/provider/gameplay reducer.
// Default: offline preflight. Live: node scripts/assess-airp-creation-v5.mjs --live <cumulative calls>
// Isolated memory saves only. No prompt edits, writer rerolls, deployment, or player-save access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';

const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || live && process.argv.length === 4 && /^\d+$/.test(process.argv[3]));
const expected = live ? Number(process.argv[3]) : null, allowance = 12;
const root = process.cwd(), sha = text => createHash('sha256').update(text).digest('hex');
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let sanitize = () => '[details withheld]', directory;
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {directorTestMaterial} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-fixture.ts');
  const {poolTestRuntime} = await vite.ssrLoadModule('/src/game-application/testing/airp-pool-playthrough.ts');
  const {directorPlan} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-playthrough.ts');
  const {compileDirectorJob, directorStage} = await vite.ssrLoadModule('/src/game-application/airp-director/jobs.ts');
  const {directorActorNames, directorProse, validateDirectorWriting, acceptDirectorText} = await vite.ssrLoadModule('/src/game-application/airp-director/scene.ts');
  const {readCreationOutput, bilingualParagraphs, validateCreativeStage} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
  const {createDirectProvider, completionUrl} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {hash, emptyUsage} = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const {keminiSource, keminiOriginalModules, keminiCreationModules} = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');
  // Credential-bearing configuration is read only by this program and never saved/logged.
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
  const markers = privateMarkers(JSON.parse(privateText)), config = runtime.parseTestConfig(privateText);
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, (key, value) => key === 'baseUrl' ? '[configured-endpoint]' : value, 2);
    if (markers.keys.some(key => text.includes(key))) throw Error('Credential detected; refusing output');
    for (const endpoint of [...markers.endpoints].sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]');
    return text;
  };
  const material = directorTestMaterial(5), defaults = runtime.defaultModels();
  assert.equal(material.resources.version, 5);
  // Explicit, isolated test capacity floors from v5 defaults; local configuration is untouched.
  material.models = runtime.resolveGenerationModels(Object.fromEntries(Object.entries(config.models).map(([slot, model]) => [slot,
    {...model, max_tokens: Math.max(model.max_tokens ?? 0, defaults[slot].max_tokens)}])), material.preset, 5);
  assert.deepEqual(['planning', 'writing', 'updater'].map(s => material.models[s].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
  const sourceIntegrity = [];
  for (const source of material.resources.sources) {
    assert((await fs.readFile(path.join(root, source.path), 'utf8')) === source.text, `Source differs: ${source.path}`);
    assert(sha(source.text) === source.sha256, `Source hash differs: ${source.path}`);
    sourceIntegrity.push({id: source.id, path: source.path, sha256: source.sha256, bytes: Buffer.byteLength(source.text)});
  }
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert(sha(original) === keminiSource.sha256, 'Original preset differs');
  const prompts = JSON.parse(original).prompts;
  for (const module of keminiOriginalModules) assert((prompts.find(p => p.identifier === module.identifier).content ?? '') === module.content, 'Original module differs');
  async function fixture(id, definitionId) {
    const f = poolTestRuntime(undefined, id);
    const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 19, profileId: 'profile.demo.first-run', saveId: id, epoch: `${id}-epoch`, clientRequestId: `create-${id}`});
    assert(created.ok); await f.send({type: 'select-game-start', startAt: 'airp-director', playerName: '林恩'});
    assert(created.ok, 'Isolated new game failed');
    await f.send({type: 'airp-director-configure', material});
    await directorPlan(f, {kind: 'fixed', definitionId});
    await f.send({type: 'advance-phase'}); await f.send({type: 'advance-phase'});
    const eventId = (await f.read()).airpDirector.events[0].id;
    await f.send({type: 'airp-director-open', eventId});
    return {...f, eventId};
  }
  const elora = await fixture('prose-v5-elora', 'ripple.elora.watch-note');
  const kororo = await fixture('prose-v5-kororo', 'ripple.kororo.quiet-cup');
  const current = async f => {const s = (await f.read()).airpDirector; return s.jobs.find(j => j.id === s.reading.jobId);};
  const preflight = {
    version: 5, presetHash: hash(material.preset), resourcesHash: hash(material.resources), sourceIntegrity,
    retainedPresetModules: keminiCreationModules.length,
    models: Object.fromEntries(Object.entries(material.models).map(([slot, m]) => [slot, {...m, configuredMaxTokens: config.models[slot].max_tokens ?? null}])),
    mode: '真实场景调用；GM排程和玩家操作为隔离验收控制，不是用户真实存档经历；非浏览器/CORS复验',
    cases: ['A-艾洛拉提出', 'B-艾洛拉接受', 'C-柯萝萝提出'],
    budget: '通常9次，逐场最多1次中文封装修复，总上限12；不重刷创作/润色，不改提示词',
    capacity: '仅本次隔离测试使用v5默认输出额度作为下限；不修改私有配置',
    previews: await Promise.all([elora, kororo].map(async f => {
      const job = await current(f), input = compileDirectorJob(material, job);
      for (const source of material.resources.sources) assert(input.messages.some(m => m.content.includes(source.text)), `Missing full source ${source.id}`);
      return {title: job.scene.card.title, role: job.scene.role, actors: job.scene.actorIds, bytes: input.bytes, previous: job.scene.previous.length};
    })),
  };
  if (!live) console.log(sanitize({...preflight, execution: 'dry-run'}));
  else {
    // Catalog check is a GET, not a generation call. Never print the catalog or endpoint.
    const catalogs = new Map();
    for (const [slot, model] of Object.entries(material.models)) {
      const lookup = `${model.baseUrl}\n${config.keys[slot]}`;
      if (!catalogs.has(lookup)) {
        const url = completionUrl(model.baseUrl).replace(/\/chat\/completions$/, '/models');
        const response = await fetch(url, {headers: {Authorization: `Bearer ${config.keys[slot]}`}, redirect: 'error', signal: AbortSignal.timeout(30000)});
        assert(response.ok, 'Model catalog unavailable; no generation started');
        const body = await response.json(); assert(Array.isArray(body.data), 'Invalid model catalog');
        catalogs.set(lookup, new Set(body.data.map(m => m.id)));
      }
      assert(catalogs.get(lookup).has(model.model), `Configured model absent: ${model.model}`);
    }
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected, 'Cumulative ledger changed');
    assert.equal(ledger.limit, expected, 'Review unused allowance before adding a fresh test budget');
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-creation-v5-')); await fs.chmod(directory, 0o700);
    const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
    await save('preflight.json', preflight); await save('material.json', material);
    ledger = {...ledger, limit: expected + allowance, budgetAdjustments: [...(ledger.budgetAdjustments ?? []), {
      previousLimit: ledger.limit, newLimit: expected + allowance, startingCalls: expected, additionalCallAllowance: allowance,
      reason: '用户要求测试新版正文质量：v5三场真实创作/润色/中文封装，正常9次，另各预留一次封装修复；不清零、不改提示词、不刷稿；使用隔离内存存档。',
    }]};
    writeFileSync(ledgerPath, JSON.stringify(ledger));
    console.log(sanitize({event: 'started', directory, calls: expected, limit: ledger.limit, models: preflight.models}));
    const results = [];
    async function runScene(f, id, expectedRole) {
      let job = await current(f);
      assert.equal(job.scene.role, expectedRole);
      const actors = Object.fromEntries(job.scene.actorIds.map(id => [id, directorActorNames[id]]));
      await save(`${id}-context.json`, job.scene);
      const result = {id, title: job.scene.card.title, role: job.scene.role, status: 'running', attempts: []};
      for (const stage of ['planning', 'writing', 'formatting']) {
        for (let ordinal = 1; ordinal <= (stage === 'formatting' ? 2 : 1); ordinal++) {
          assert.equal(directorStage(job), stage);
          const formatRepair = ordinal === 2 ? 1 : undefined;
          const input = compileDirectorJob(material, job, formatRepair), slot = stage === 'formatting' ? 'updater' : stage;
          const stem = `${id}-${stage}-${ordinal}`, attemptId = `live:${id}:${stage}:${ordinal}`;
          const attempt = {stage, ordinal, input, inputHash: hash(input), config: material.models[slot], startedAt: Date.now(), status: 'running'};
          result.attempts.push(attempt);
          await save(`${stem}.json`, attempt);
          await f.send({type: 'airp-director-begin', jobId: job.id, attemptId, stage, at: attempt.startedAt, ...(formatRepair ? {formatRepair} : {})});
          const provider = createDirectProvider(async (url, init) => {
            assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
            assert(ledger.calls < Math.min(ledger.limit, expected + allowance), 'Call limit reached');
            ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
            console.log(sanitize({event: 'dispatch', id, stage, calls: ledger.calls, model: material.models[slot].model, inputBytes: input.bytes}));
            const response = await fetch(url, init);
            // Preserve delivered content/usage even on truncation. Do not collect private reasoning fields.
            const text = await response.clone().text();
            let receipt;
            try {
              const raw = JSON.parse(text);
              receipt = {status: response.status, id: raw.id, model: raw.model, usage: raw.usage, error: raw.error,
                choices: raw.choices?.map(c => ({finish_reason: c.finish_reason, message: {content: c.message?.content, refusal: c.message?.refusal}}))};
            } catch {receipt = {status: response.status, body: text};}
            await save(`${stem}-response.json`, receipt);
            return response;
          });
          try {
            const completion = await provider({config: material.models[slot], messages: input.messages}, config.keys[slot], new AbortController().signal);
            Object.assign(attempt, completion); await save(`${stem}-raw.txt`, completion.text);
            await f.send({type: 'airp-director-result', jobId: job.id, attemptId, at: Date.now(), output: completion.text, usage: completion.usage});
            job = await current(f);
            const accepted = job.attempts.at(-1);
            if (accepted.status !== 'succeeded') {
              try {
                if (stage === 'planning') validateCreativeStage(stage, completion.text, '', actors);
                else if (stage === 'writing') validateDirectorWriting(completion.text, material, job);
                else acceptDirectorText(completion.text, directorProse(material, job), job.scene.actorIds, 5);
              } catch (error) {attempt.validation = {code: error.code, message: error.message};}
              attempt.status = 'failed'; attempt.error = 'invalid-output';
            } else {
              attempt.status = 'succeeded';
              if (stage === 'planning') {
                const parts = readCreationOutput(completion.text);
                await save(`${id}-sol-prose.txt`, parts.prose);
                await save(`${id}-sol-chinese.txt`, bilingualParagraphs(parts.prose, actors).map(p => `${directorActorNames[p.speaker]}：${p.chinese}`).join('\n\n'));
              }
              if (stage === 'writing') {
                const prose = directorProse(material, job);
                await save(`${id}-gemini-prose.txt`, prose);
                await save(`${id}-gemini-chinese.txt`, bilingualParagraphs(prose, actors).map(p => `${directorActorNames[p.speaker]}：${p.chinese}`).join('\n\n'));
                // A readable diagnostic projection is not a successful formatter/gameplay result.
                result.editedChinesePreview = bilingualParagraphs(prose, actors).map(p => p.speaker === 'narrator' ? p.chinese : `**${directorActorNames[p.speaker]}**：${p.chinese}`).join('\n\n');
              }
              if (stage === 'formatting') {
                await save(`${id}-scene.json`, job.text);
                const chinese = job.text.lines.map(l => l.speaker === 'narrator' ? l.text : `**${directorActorNames[l.speaker]}**：${l.text}`).join('\n\n');
                await save(`${id}-正文.md`, `# ${job.scene.card.title} · ${job.scene.role}\n\n${chinese}\n`);
                result.chinese = chinese;
                result.counts = {paragraphs: job.text.lines.length, dialogue: job.text.lines.filter(l => l.speaker !== 'narrator').length, characters: job.text.lines.reduce((n, l) => n + l.text.length, 0)};
              }
            }
          } catch (error) {
            attempt.status = 'failed'; attempt.error = error.code ?? 'runner-error';
            attempt.message = error.code ? error.message : 'Local runner failed; raw confidential details withheld';
            attempt.usage ??= error.usage ?? emptyUsage();
            job = await current(f);
            if (job.attempts.at(-1)?.status === 'running') await f.send({type: 'airp-director-fail', jobId: job.id, attemptId, at: Date.now(), error: 'provider-error', outcomeUnknown: error.outcomeUnknown ?? true, usage: attempt.usage});
            job = await current(f);
          }
          attempt.endedAt = Date.now(); await save(`${stem}.json`, attempt);
          console.log(sanitize({event: 'stage-ended', id, stage, ordinal, status: attempt.status, error: attempt.error, validation: attempt.validation, usage: attempt.usage, elapsedMs: attempt.endedAt - attempt.startedAt}));
          if (attempt.status === 'succeeded') break;
          if (!(stage === 'formatting' && ordinal === 1 && attempt.error === 'invalid-output')) {result.status = 'failed'; break;}
        }
        if (result.status === 'failed') break;
      }
      if (result.status !== 'failed') {
        result.status = 'ready';
        await f.send({type: 'airp-director-show', jobId: job.id});
        for (let cursor = 0; cursor < job.text.lines.length; cursor++) await f.send({type: 'airp-director-read', jobId: job.id, cursor});
      }
      await save(`${id}-result.json`, result);
      results.push(result);
      return result;
    }
    await Promise.all([
      (async () => {
        const offered = await runScene(elora, 'A-elora-offer', 'offer');
        if (offered.status === 'ready') {
          await elora.send({type: 'airp-director-choose', eventId: elora.eventId, choiceId: 'participate'});
          await elora.send({type: 'airp-director-open', eventId: elora.eventId});
          const next = await current(elora);
          assert(next.scene.previous.length > 0, 'Acceptance must include read offer');
          assert(!/[\u3040-\u30ff]/u.test(JSON.stringify(next.scene.previous)), 'Read history must be Chinese');
          await runScene(elora, 'B-elora-acceptance', 'acceptance');
        } else results.push({id: 'B-elora-acceptance', status: 'blocked-by-offer'});
      })(),
      runScene(kororo, 'C-kororo-offer', 'offer'),
    ]);
    results.sort((a, b) => a.id.localeCompare(b.id));
    const summary = {directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, results: results.map(({attempts, chinese, editedChinesePreview, ...rest}) => rest)};
    await save('summary.json', summary);
    await save('正文试读.md', '# AIRP v5 · 真实正文试读\n\n三场固定工作稿，正式模型链路。GM排程和玩家操作由隔离测试控制；没有改动用户存档。玩家显示名：林恩。双语只用于中间稿；各场分别注明成功状态。下列中文均为模型原有中文，没有人工润色。\n\n' + results.map(r => `## ${r.id} · ${r.title ?? ''}\n\n${r.chinese ? `三阶段通过。\n\n${r.chinese}` : r.editedChinesePreview ? `中文封装未通过；以下只供评读，是双语润色稿的中文投影，未回填游戏。\n\n${r.editedChinesePreview}` : `未得到通过校验的双语终稿：${r.status}。`}\n`).join('\n'));
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'completed', ...summary, privacyScan: 'passed'}));
    if (results.some(r => r.status !== 'ready')) process.exitCode = 1;
  }
} catch (error) {
  console.error(sanitize({event: 'stopped', directory, code: error.code ?? 'preflight-or-runner-error', message: error.message}));
  process.exitCode = 1;
} finally {await vite.close();}
