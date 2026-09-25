// One opt-in v7 production-chain sample. No prompt edits, rerolls or player-save access.
// Offline preflight by default; live: node scripts/assess-airp-outline-v7.mjs --live <expected calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';

const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || live && process.argv.length === 4 && /^\d+$/.test(process.argv[3]));
const expected = live ? Number(process.argv[3]) : null, allowance = 4, root = process.cwd();
const sha = value => createHash('sha256').update(value).digest('hex');
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let sanitize = () => '[details withheld]', directory;
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {directorTestMaterial} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-fixture.ts');
  const {poolTestRuntime} = await vite.ssrLoadModule('/src/game-application/testing/airp-pool-playthrough.ts');
  const {directorPlan} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-playthrough.ts');
  const {compileDirectorJob, directorStage} = await vite.ssrLoadModule('/src/game-application/airp-director/jobs.ts');
  const {directorActorNames, directorProse, validateDirectorWriting, acceptDirectorText} = await vite.ssrLoadModule('/src/game-application/airp-director/scene.ts');
  const {validateCreativeStage, performedParagraphs, planningPreflight} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
  const {compileDirectorScene} = await vite.ssrLoadModule('/src/game-application/airp-director/scene.ts');
  const {createDirectProvider} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {hash, emptyUsage} = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const {keminiSource, keminiOriginalModules} = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');

  // Only this program reads credentials. Never log config, headers, endpoint or private reasoning fields.
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
  const config = runtime.parseTestConfig(privateText), markers = privateMarkers(JSON.parse(privateText));
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, (k, v) => k === 'baseUrl' ? '[configured-endpoint]' : v, 2);
    assert(!markers.keys.some(k => text.includes(k)), 'Credential detected; refusing to save or print');
    for (const endpoint of [...markers.endpoints].sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]');
    return text;
  };
  const material = directorTestMaterial(7);
  material.models = runtime.resolveGenerationModels(config.models, material.preset, 7);
  assert.equal(material.resources.version, 7);
  assert.deepEqual(['planning', 'writing', 'updater'].map(s => material.models[s].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
  const integrity = [];
  for (const source of material.resources.sources) {
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text, `Source differs: ${source.id}`);
    assert.equal(sha(source.text), source.sha256, `Source hash differs: ${source.id}`);
    integrity.push({id: source.id, path: source.path, bytes: Buffer.byteLength(source.text), sha256: source.sha256});
  }
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert.equal(sha(original), keminiSource.sha256, 'Original preset differs');
  const originalPrompts = JSON.parse(original).prompts;
  for (const module of keminiOriginalModules) assert.equal(originalPrompts.find(p => p.identifier === module.identifier).content ?? '', module.content, 'Original module differs');

  const f = poolTestRuntime(undefined, 'outline-v7-elora');
  assert((await f.runtime.application.create({protocolVersion: 4, contentVersion: 19, profileId: 'profile.demo.first-run', saveId: 'outline-v7-elora', epoch: 'outline-v7-test', clientRequestId: 'create-outline-v7'})).ok);
  await f.send({type: 'select-game-start', startAt: 'airp-director', playerName: '林恩'});
  await f.send({type: 'airp-director-configure', material});
  await directorPlan(f, {kind: 'fixed', definitionId: 'ripple.elora.watch-note'});
  await f.send({type: 'advance-phase'}); await f.send({type: 'advance-phase'});
  const eventId = (await f.read()).airpDirector.events[0].id;
  await f.send({type: 'airp-director-open', eventId});
  const current = async () => {const state = (await f.read()).airpDirector; return state.jobs.find(j => j.id === state.reading.jobId);};
  let job = await current(); assert.equal(job.scene.role, 'offer');
  const actors = Object.fromEntries(job.scene.actorIds.map(id => [id, directorActorNames[id]]));
  const planningInput = compileDirectorJob(material, job);
  // No request: verify writer handoff and source selection using a tagged placeholder.
  const preflightJob = {...job, attempts: [{id: 'preflight', stage: 'planning', ordinal: 1, inputHash: '', at: 1, endedAt: 2,
    status: 'succeeded', output: planningPreflight(7), usage: emptyUsage(), outcomeUnknown: false, error: null}]};
  const writingInput = compileDirectorScene(material, preflightJob, 'writing');
  for (const id of job.scene.actorIds) {
    const source = material.resources.sources.find(s => s.kind === 'character' && s.id === id);
    for (const input of [planningInput, writingInput]) assert(input.messages.some(m => m.content.includes(source.text)), `Missing full onstage card: ${id}`);
  }
  for (const source of material.resources.sources.filter(s => s.kind === 'character' && !job.scene.actorIds.includes(s.id))) {
    assert(!writingInput.messages.some(m => m.content.includes(source.text)), `Unexpected full offstage card: ${source.id}`);
    assert(writingInput.messages.some(m => m.content.includes(source.brief)), `Missing offstage brief: ${source.id}`);
  }
  const preflight = {
    version: 7, title: job.scene.card.title, role: job.scene.role, actorIds: job.scene.actorIds,
    models: material.models, configuredSamplingPreserved: true,
    presetHash: hash(material.preset), resourcesHash: hash(material.resources), integrity,
    planningBytes: planningInput.bytes, writingPreflightBytes: writingInput.bytes, sourceSelection: writingInput.diagnostics,
    mode: '正式场景编译器与游戏接受链路；GM排程和玩家入场由隔离内存测试控制，不是实际玩家经历；不复验浏览器CORS',
    budget: '大纲1次、正文1次、封装1次；仅非法封装可修复1次，不重刷大纲或正文，不改配置和提示词',
  };
  if (!live) {
    console.log(sanitize({event: 'preflight', title: preflight.title, role: preflight.role, models: preflight.models,
      planningBytes: preflight.planningBytes, writingPreflightBytes: preflight.writingPreflightBytes,
      sourceSelection: writingInput.diagnostics.slice(0, material.resources.sources.length), integrity: 'all original sources and preset verified'}));
  } else {
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected, 'Cumulative call count changed');
    assert(ledger.limit - expected >= allowance, 'User-approved allowance is insufficient; no generation sent');
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-outline-v7-live-')); await fs.chmod(directory, 0o700);
    const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
    await save('preflight.json', preflight); await save('material.json', material); await save('scene-context.json', job.scene);
    console.log(sanitize({event: 'started', directory, calls: ledger.calls, limit: ledger.limit, title: preflight.title}));
    const attempts = [];
    const names = {planning: 'Sol · 三段式大纲', writing: 'Gemini · 正文与表情', formatting: 'DeepSeek · 中文JSON封装'};
    for (const stage of ['planning', 'writing', 'formatting']) {
      assert.equal(directorStage(job), stage);
      for (let ordinal = 1; ordinal <= (stage === 'formatting' ? 2 : 1); ordinal++) {
        const repair = ordinal === 2 ? {formatRepair: 1} : {}, slot = stage === 'formatting' ? 'updater' : stage;
        const input = compileDirectorJob(material, job, repair.formatRepair), stem = `${stage}-${ordinal}`;
        const attempt = {stage, ordinal, model: material.models[slot].model, config: material.models[slot], input, startedAt: Date.now(), status: 'running'};
        attempts.push(attempt); await save(`${stem}.json`, attempt);
        await f.send({type: 'airp-director-begin', jobId: job.id, attemptId: stem, stage, at: attempt.startedAt, ...repair});
        const provider = createDirectProvider(async (url, init) => {
          assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
          assert(ledger.calls < Math.min(ledger.limit, expected + allowance), 'Call limit reached');
          ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
          console.log(sanitize({event: 'dispatch', stage, ordinal, model: material.models[slot].model, calls: ledger.calls, inputBytes: input.bytes}));
          const response = await fetch(url, init);
          const receiptText = await response.clone().text();
          assert(Buffer.byteLength(receiptText) <= 2097152, 'Response receipt exceeds defensive capacity');
          let receipt = {status: response.status};
          try {
            const raw = JSON.parse(receiptText);
            receipt = {...receipt, id: raw.id, model: raw.model, usage: raw.usage,
              choices: raw.choices?.map(c => ({finish_reason: c.finish_reason, message: {content: c.message?.content, refusal: c.message?.refusal}}))};
            // Preserve the entire returned visible text even if termination/validation fails.
            if (typeof raw.choices?.[0]?.message?.content === 'string') {
              attempt.text = raw.choices[0].message.content;
              await save(`${stem}-raw.txt`, attempt.text);
            }
          } catch (error) { if (error instanceof SyntaxError) receipt.invalidJson = true; else throw error; }
          await save(`${stem}-response.json`, receipt);
          return response;
        });
        try {
          const completion = await provider({config: material.models[slot], messages: input.messages}, config.keys[slot], new AbortController().signal);
          Object.assign(attempt, completion); await save(`${stem}-raw.txt`, completion.text);
          await f.send({type: 'airp-director-result', jobId: job.id, attemptId: stem, at: Date.now(), output: completion.text, usage: completion.usage});
          job = await current(); attempt.status = job.attempts.at(-1).status;
          if (attempt.status !== 'succeeded') {
            attempt.error = 'invalid-output';
            try {
              if (stage === 'planning') validateCreativeStage(stage, completion.text, '', actors, 7);
              else if (stage === 'writing') validateDirectorWriting(completion.text, material, job);
              else acceptDirectorText(completion.text, directorProse(material, job), job.scene.actorIds, 7);
            } catch (error) {attempt.validation = {code: error.code, message: error.message};}
          }
        } catch (error) {
          attempt.status = 'failed'; attempt.error = error.code ?? 'runner-error'; attempt.usage ??= error.usage ?? emptyUsage();
          attempt.message = error.code ? error.message : 'Local runner failure; confidential details withheld';
          job = await current();
          if (job.attempts.at(-1)?.status === 'running') await f.send({type: 'airp-director-fail', jobId: job.id, attemptId: stem, at: Date.now(),
            error: 'provider-error', outcomeUnknown: error.outcomeUnknown ?? true, usage: attempt.usage});
          job = await current();
        }
        attempt.endedAt = Date.now(); await save(`${stem}.json`, attempt);
        console.log(sanitize({event: 'stage-ended', stage, ordinal, status: attempt.status, error: attempt.error,
          validation: attempt.validation, usage: attempt.usage, elapsedMs: attempt.endedAt - attempt.startedAt}));
        if (attempt.status === 'succeeded' || !(stage === 'formatting' && ordinal === 1 && attempt.error === 'invalid-output')) break;
      }
      if (job.attempts.at(-1).status !== 'succeeded') break;
    }
    let readAccepted = false, restored = false;
    if (job.text) {
      await save('scene.json', job.text);
      await save('中文正文.md', `# ${preflight.title} · 中文正文\n\n以下为通过正式封装的模型中文原文，未人工润色。\n\n${job.text.lines.map(l => l.speaker === 'narrator' ? l.text : `**${directorActorNames[l.speaker]} · ${l.emotion}**：${l.text}`).join('\n\n')}\n`);
      await f.send({type: 'airp-director-show', jobId: job.id});
      for (let cursor = 0; cursor < job.text.lines.length; cursor++) await f.send({type: 'airp-director-read', jobId: job.id, cursor});
      readAccepted = true;
      const record = await f.read();
      restored = (await poolTestRuntime().runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: 'v7-live-restore'})).ok;
      assert(restored, 'Isolated real-output archive restore failed');
    }
    const counts = job.text ? {paragraphs: job.text.lines.length, dialogue: job.text.lines.filter(l => l.speaker !== 'narrator').length,
      narration: job.text.lines.filter(l => l.speaker === 'narrator').length, chineseCharacters: job.text.lines.reduce((n, l) => n + l.text.length, 0)} : null;
    const summary = {version: 7, directory, title: preflight.title, status: job.text ? 'ready' : 'failed', startingCalls: expected, calls: ledger.calls, limit: ledger.limit,
      readAccepted, restored, counts, attempts: attempts.map(({input, text, config, ...rest}) => rest)};
    await save('summary.json', summary);
    const fence = text => '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1)));
    const transcript = ['# AIRP v7 · 三模型完整输出', '', `场景：${preflight.title}／提出；玩家显示名：林恩。`, '',
      '三模型均为本次新调用；GM排程与玩家入场由隔离测试控制，未改用户存档。以下完整保留返回的可见文本，不截断、不润色；不含供应商私有推理字段或凭据。', '',
      `结果：${summary.status}；本次调用${ledger.calls - expected}次，累计${ledger.calls}/${ledger.limit}。`, ''];
    for (const stage of ['planning', 'writing', 'formatting']) {
      transcript.push(`## ${names[stage]}`, '');
      const stageAttempts = attempts.filter(a => a.stage === stage);
      if (!stageAttempts.length) transcript.push('上游未通过，本阶段没有调用。', '');
      for (const a of stageAttempts) {
        transcript.push(`模型：${a.model}；第${a.ordinal}次；${a.status}；${((a.endedAt - a.startedAt) / 1000).toFixed(1)}秒；tokens ${a.usage?.totalTokens ?? '未知'}。`, '');
        if (a.text !== undefined) {const marker = fence(a.text); transcript.push(marker, a.text, marker, '');}
        else transcript.push('没有收到可见正文；错误：' + (a.message ?? a.error ?? '未知'), '');
        if (a.validation) transcript.push(`校验结果：${a.validation.message}`, '');
      }
    }
    await save('三模型完整输出.md', transcript.join('\n'));
    // Verify output preservation independently of the response parser.
    for (const a of attempts.filter(a => a.text !== undefined)) assert.equal(await fs.readFile(path.join(directory, `${a.stage}-${a.ordinal}-raw.txt`), 'utf8'), sanitize(a.text));
    if (job.text) performedParagraphs(directorProse(material, job), actors);
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'completed', ...summary, privacyScan: 'passed'}));
    if (!job.text) process.exitCode = 1;
  }
} catch (error) {
  console.error(sanitize({event: 'stopped', directory, code: error.code ?? 'preflight-or-runner-error', message: error.message}));
  process.exitCode = 1;
} finally {await vite.close();}
