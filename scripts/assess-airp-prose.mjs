// Opt-in literary assessment. No save database, no frontend changes, no automatic rewriting.
// Dry run: node scripts/assess-airp-prose.mjs
// Paid run: node scripts/assess-airp-prose.mjs --live <expected cumulative calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || (live && /^\d+$/.test(process.argv[3]) && process.argv.length === 4), 'Use --live <expected calls> explicitly');
const expected = live ? Number(process.argv[3]) : null;
const sha = text => createHash('sha256').update(text).digest('hex');
const cases = [
  { id: 'A-medicine-control', title: '原样对照：巡路后的空药箱交接', control: true },
  {
    id: 'B-treatment-disagreement', title: '医疗意见冲突：小伤不值得用药？',
    goal: '承接玩家刚说的话，写艾洛拉对省药与处理伤口的回应；停在需要玩家回应的位置。',
    phase: 13, location: '洋馆 · 公共休息室',
    selectedAction: '玩家此前表达了希望节省药物的意见，尚未接受治疗。',
    facts: [
      '在场者只有玩家与艾洛拉。玩家手背有一处浅划伤，已经止血，尚未清洁和包扎；这些情况双方都能看到。',
      '桌上有普通清洁用品和绷带，艾洛拉的医疗包中另有高阶恢复药水；均未使用。',
      '玩家刚说过：“已经不流血了，别把药用在这种地方。留着总会有更需要的时候。”此句是作者提供的固定前情，不得续写玩家的新台词。',
    ],
    unknown: ['伤口原因、感染与暗伤、剩余数量和价格未提供', '玩家是否接受清洁、包扎或用药尚未决定，不能写成已经执行'],
    locusUnknown: '天气、具体伤口原因与房间设施状态未提供',
  },
  {
    id: 'C-care-reversed', title: '安静日常：关心被反过来点破',
    goal: '承接玩家刚说的话，写艾洛拉被问到自己那份时的回应；停在需要玩家回应的位置。',
    phase: 15, location: '洋馆 · 公共休息室',
    selectedAction: '玩家问了艾洛拉自己的份额，没有接受她的新安排。',
    facts: [
      '在场者只有玩家与艾洛拉，两人正在桌边分装明天的干粮。桌上有两份同样的面包和一小碟甜浆果。',
      '艾洛拉刚把碟里的甜浆果全部分进了玩家的纸包；她自己的纸包只有面包。',
      '玩家指了指她的纸包，刚说过：“你是不是又把自己的那份省掉了？”这一动作和这一句是作者提供的固定前情，不得续写玩家的新动作或台词。',
    ],
    unknown: ['干粮价格、全队库存和明天目的地未提供', '不能把邀请、重新分配的提议写成玩家已经接受，也不能新增玩家反应'],
    locusUnknown: '天气与房间设施状态未提供',
  },
];

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const { contextValues } = await vite.ssrLoadModule('/src/game-application/airp-generation/context.ts');
  const { bytes, hash } = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const { createDirectProvider } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const { acceptGeneratedText } = await vite.ssrLoadModule('/src/game-application/airp-generation/scene.ts');
  const { keminiOriginalModules, keminiSource } = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');
  const spec = runtime.defaultSpecification();
  const sourceIntegrity = [];
  for (const source of spec.resources.sources) {
    assert.equal(sha(source.text), source.sha256);
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text);
    sourceIntegrity.push({ path: source.path, sha256: source.sha256, bytes: bytes(source.text) });
  }
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert.equal(sha(original), keminiSource.sha256);
  const originalPrompts = JSON.parse(original).prompts;
  for (const module of keminiOriginalModules) {
    const prompt = originalPrompts.find(p => p.identifier === module.identifier);
    assert(prompt, 'Original preset module missing');
    assert.equal(prompt.content ?? '', module.content);
  }
  assert.equal(sourceIntegrity.length, 13);

  // Only the scenario envelope/fact recap and the medicine-specific task phrase change.
  // Policies, raw author documents, compiled preset and all stage rules stay byte-identical.
  // This adapter is test-only: the production event system does not support these extra scenes.
  function compile(test, stage, outline = '', draft = '', feedback) {
    const input = runtime.compileInput(stage, spec, outline, draft, feedback);
    if (!test.control && stage !== 'formatting') {
      const { context } = contextValues(spec, outline);
      const sample = structuredClone(context);
      sample.sampleId = test.id;
      sample.agenda = {
        selectedAction: test.selectedAction, actionScope: '作者提供的固定前情；不允许续写玩家反应',
        facts: test.facts.map((text, index) => ({ id: `${test.id}.${index}`, text, knownBy: ['kael', 'elora'] })),
        sceneGoal: test.goal, unknown: test.unknown,
      };
      sample.locus = { day: Math.floor(test.phase / 4) + 1, phase: ['晨', '昼', '昏', '夜'][test.phase % 4], location: test.location, actorIds: ['kael', 'elora'], unknown: test.locusUnknown };
      const situationIndex = input.messages.findIndex(m => m.content.startsWith('<interactive_input>'));
      assert(situationIndex >= 0);
      input.messages[situationIndex].content = `<interactive_input>\n${JSON.stringify({ context: sample })}\n</interactive_input>`;
      const last = input.messages.at(-1);
      if (stage === 'writing') {
        const before = JSON.stringify({ facts: context.agenda.facts, unknown: context.agenda.unknown });
        assert(last.content.includes(before) && last.content.includes('承接药箱归来的本次实际结果'));
        last.content = last.content.replace(before, JSON.stringify({ facts: sample.agenda.facts, unknown: sample.agenda.unknown }))
          .replace('承接药箱归来的本次实际结果', '承接本场作者提供的固定前情');
      }
      input.contextHash = hash(sample);
      input.diagnostics = [`文学质量模拟：${test.id}；仅替换情境与药箱专用任务短语，不是已接入的游戏事件`];
      const baseline = runtime.compileInput(stage, spec, outline, draft, feedback);
      baseline.messages.forEach((message, index) => {
        if (index !== situationIndex && !(stage === 'writing' && index === baseline.messages.length - 1)) assert.deepEqual(input.messages[index], message);
      });
    }
    input.bytes = input.messages.reduce((sum, m) => sum + bytes(m.content), 0);
    for (const source of spec.resources.sources) {
      assert.equal(input.messages.some(m => m.content.includes(source.text)), stage !== 'formatting');
    }
    return input;
  }
  const preflight = {
    sourceIntegrity, sourceBytes: sourceIntegrity.reduce((n, s) => n + s.bytes, 0),
    originalPresetSha256: sha(original), preservedOriginalModules: keminiOriginalModules.length,
    presetHash: hash(spec.preset), stageResourcesHash: hash(spec.resources),
    runner: 'Node fetch using unchanged production provider; no browser/CORS/UI/save verification in this assessment',
    scenarios: cases,
    previews: cases.map(test => ({ id: test.id, planningBytes: compile(test, 'planning').bytes, writingBytesWithPlaceholderOutline: compile(test, 'writing', '仅用于离线预检的大纲占位，不发送').bytes })),
  };
  if (!live) {
    console.log(JSON.stringify({ mode: 'dry-run', ...preflight }, null, 2));
  } else {
    const configuration = runtime.parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
    const models = runtime.resolveGenerationModels(configuration.models, spec.preset);
    assert.deepEqual(['planning', 'writing', 'updater'].map(slot => models[slot].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
    const secrets = [...new Set(Object.values(configuration.keys))];
    assert(secrets.every(key => key.length > 0));
    const endpoints = [...new Set(Object.values(models).flatMap(m => [m.baseUrl, new URL(m.baseUrl).origin]))];
    const sanitize = value => {
      let text = typeof value === 'string' ? value : JSON.stringify(value, (key, val) => key === 'baseUrl' ? '[configured-endpoint]' : val, 2);
      assert(!secrets.some(key => text.includes(key)), 'Credential detected; refusing to persist');
      for (const endpoint of endpoints) text = text.replaceAll(endpoint, '[configured-endpoint]');
      return text;
    };
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected, 'Cumulative ledger changed');
    assert.equal(ledger.limit, expected, 'Inspect existing unused allowance first');
    const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-prose-assessment-'));
    await fs.chmod(directory, 0o700);
    const save = (file, value) => fs.writeFile(path.join(directory, file), sanitize(value), { mode: 0o600 });
    await save('preflight.json', preflight);
    await save('models.json', models);
    ledger = { ...ledger, limit: expected + 12, budgetAdjustments: [...(ledger.budgetAdjustments ?? []), {
      previousLimit: ledger.limit, newLimit: expected + 12, startingCalls: expected, additionalCallAllowance: 12,
      reason: '用户要求模拟多个场景评估当前文章质量；三场各三阶段，另每场至多一次格式修复；不改预设、不刷稿、不清零历史。',
    }] };
    writeFileSync(ledgerPath, JSON.stringify(ledger));
    console.log(JSON.stringify({ event: 'started', directory, calls: expected, limit: ledger.limit }));
    const provider = createDirectProvider(async (url, init) => {
      const latest = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      assert.deepEqual(latest, ledger, 'Ledger changed by another process');
      assert(ledger.calls < ledger.limit, 'Call allowance exhausted');
      ledger.calls++;
      writeFileSync(ledgerPath, JSON.stringify(ledger));
      console.log(JSON.stringify({ event: 'dispatch', model: JSON.parse(init.body).model, calls: ledger.calls }));
      return fetch(url, init);
    });
    async function run(test) {
      const result = { id: test.id, title: test.title, status: 'running', attempts: [], scene: null };
      const outputs = {};
      for (const stage of ['planning', 'writing', 'formatting']) {
        let feedback;
        for (let ordinal = 1; ordinal <= (stage === 'formatting' ? 2 : 1); ordinal++) {
          const input = compile(test, stage, outputs.planning, outputs.writing, feedback);
          const config = models[stage === 'formatting' ? 'updater' : stage];
          const key = configuration.keys[stage === 'formatting' ? 'updater' : stage];
          const attempt = { stage, ordinal, input, inputHash: hash(input), config, startedAt: Date.now(), endedAt: null, status: 'running' };
          result.attempts.push(attempt);
          await save(`${test.id}-${stage}-${ordinal}.json`, attempt);
          try {
            const completion = await provider({ config, messages: input.messages }, key, new AbortController().signal);
            Object.assign(attempt, completion);
            await save(`${test.id}-${stage}-${ordinal}.txt`, completion.text);
            if (stage === 'formatting') result.scene = acceptGeneratedText(completion.text, outputs.writing);
            outputs[stage] = completion.text;
            attempt.status = 'succeeded';
          } catch (error) {
            attempt.status = 'failed';
            attempt.error = { code: error.code ?? 'runner-error', message: error.code ? error.message : 'Local assessment runner failed', outcomeUnknown: Boolean(error.outcomeUnknown), usage: error.usage ?? null };
            if (stage === 'formatting' && ordinal === 1 && error.code === 'invalid-scene' && attempt.text) feedback = { previousOutput: attempt.text, error: error.message };
            else result.status = 'failed';
          }
          attempt.endedAt = Date.now();
          await save(`${test.id}-${stage}-${ordinal}.json`, attempt);
          console.log(sanitize({ event: 'stage-ended', id: test.id, stage, ordinal, status: attempt.status, characters: attempt.text?.length, elapsedMs: attempt.endedAt - attempt.startedAt, usage: attempt.usage, error: attempt.error }));
          if (attempt.status === 'succeeded' || result.status === 'failed') break;
        }
        if (result.status === 'failed') break;
      }
      if (result.status !== 'failed') result.status = result.scene ? 'ready' : 'failed';
      await save(`${test.id}-result.json`, result);
      return { id: result.id, status: result.status, lines: result.scene?.lines.length, attempts: result.attempts.map(({ input, config, text, ...a }) => ({ ...a, model: config.model, inputBytes: input.bytes, characters: text?.length })) };
    }
    const results = await Promise.all(cases.map(run));
    const summary = { directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, results };
    await save('summary.json', summary);
    console.log(sanitize({ event: 'completed', ...summary }));
    if (results.some(result => result.status !== 'ready')) process.exitCode = 1;
  }
} finally {
  await vite.close();
}
