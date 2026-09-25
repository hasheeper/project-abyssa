// Controlled, opt-in experiment: old outline vs full performance workshop vs selected handoff.
// node scripts/assess-airp-bilingual.mjs [--live <expected cumulative calls>]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || (live && /^\d+$/.test(process.argv[3]) && process.argv.length === 4));
const expected = live ? Number(process.argv[3]) : null;
const root = process.cwd();
const baselineDirectory = path.join(root, 'dist/reports/airp-prose-assessment-LJt1Yc');
const promptPath = path.join(root, 'docs/plans/2026-09-23-airp-bilingual-performance-prompt.md');
const ids = ['A-medicine-control', 'C-care-reversed'];
const sha = text => createHash('sha256').update(text).digest('hex');
const fusion = await fs.readFile(promptPath, 'utf8');
const bilingual = `【本次实验统一输出要求：三组完全相同】
旁白使用中文。所有实际说出口的台词各自独立成自然段，严格采用「日本語原文（中文翻译）」；例如「バカ、早くいきなさいよ。（笨蛋，快点去啊。）」。日文是自然可配音的原句，中文忠实保留意思、语气和强度，不增加事实或情绪。保留日语语癖、片假名习惯及口语缩略，但不强塞它们。此语言要求优先于原预设的中文单语要求。
scene_plan 是上游提供的作品规划。只将选定的演出方案转为正文，不输出规划、废案、编辑评论、标签、CV说明或JSON。角色卡与世界书仍以完整原文为准。`;
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const { createDirectProvider } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const { acceptGeneratedText } = await vite.ssrLoadModule('/src/game-application/airp-generation/scene.ts');
  const { hash, bytes } = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const { keminiOriginalModules, keminiSource } = await vite.ssrLoadModule('/src/content/presentation/airp/kemini-profile.ts');
  const specification = runtime.defaultSpecification();
  const priorPreflight = JSON.parse(await fs.readFile(path.join(baselineDirectory, 'preflight.json'), 'utf8'));
  assert.equal(hash(specification.preset), priorPreflight.presetHash, 'Production preset changed');
  assert.equal(hash(specification.resources), priorPreflight.stageResourcesHash, 'Production resources changed');
  const original = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
  assert.equal(sha(original), keminiSource.sha256);
  const originalPrompts = JSON.parse(original).prompts;
  for (const module of keminiOriginalModules) {
    const prompt = originalPrompts.find(p => p.identifier === module.identifier);
    assert(prompt); assert.equal(prompt.content ?? '', module.content);
  }
  for (const source of specification.resources.sources) {
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text);
    assert.equal(sha(source.text), source.sha256);
  }
  const cases = await Promise.all(ids.map(async id => ({
    id,
    planning: JSON.parse(await fs.readFile(path.join(baselineDirectory, `${id}-planning-1.json`), 'utf8')),
    writing: JSON.parse(await fs.readFile(path.join(baselineDirectory, `${id}-writing-1.json`), 'utf8')),
  })));
  const inspect = (messages, stage) => {
    for (const source of specification.resources.sources) assert.equal(messages.some(m => m.content.includes(source.text)), stage !== 'formatting');
    const size = messages.reduce((n, m) => n + bytes(m.content), 0);
    assert(size <= 2097152);
    return { messages, bytes: size, hash: hash(messages) };
  };
  function planningInput(test) {
    const messages = structuredClone(test.planning.input.messages);
    const marker = '【AIRP 阶段适配与扩展：大纲】';
    const matches = messages.filter(m => m.content.includes(marker));
    assert.equal(matches.length, 1);
    const offset = matches[0].content.indexOf(marker);
    const preserved = matches[0].content.slice(0, offset);
    matches[0].content = preserved + fusion;
    messages.at(-1).content = '按本次实验适配交付完整的 <planning> 演出稿，含逐角色演出工作、语言协议锁和独立 <handoff> 三段式定稿。固定情境与原始资料已完整提供。不要写游戏正文、JSON或结算。';
    assert(matches[0].content.startsWith(preserved));
    return inspect(messages, 'planning');
  }
  function writingInput(test, outline) {
    const messages = structuredClone(test.writing.input.messages);
    const last = messages.at(-1);
    const oldBlock = `<scene_plan>\n${test.planning.text}\n</scene_plan>`;
    assert(last.content.startsWith(oldBlock));
    last.content = `<scene_plan>\n${outline}\n</scene_plan>` + last.content.slice(oldBlock.length) + '\n\n' + bilingual;
    // Apart from the plan slot all writer inputs must be exactly the same.
    const signature = hash(messages.map(m => ({ ...m, content: m.content.replace(`<scene_plan>\n${outline}\n</scene_plan>`, '<scene_plan>[CONTROLLED VARIABLE]</scene_plan>') })));
    return { ...inspect(messages, 'writing'), nonPlanSignature: signature };
  }
  function extractHandoff(text) {
    assert(/^\s*<planning>[\s\S]*<\/planning>\s*$/.test(text), 'Missing outer planning wrapper');
    const handoffs = [...text.matchAll(/<handoff>([\s\S]*?)<\/handoff>/g)];
    assert.equal(handoffs.length, 1, 'Handoff must occur once');
    assert(text.includes('<performance_audit>') && text.includes('<language_lock>'));
    for (const label of ['拟态废案', '本音矫正', '定稿录入', 'REQUIRE', 'FORBIDDEN']) assert(text.includes(label), `Missing workshop field ${label}`);
    const handoff = handoffs[0][1].trim();
    assert(handoff.includes('第一段') && handoff.includes('第二段') && handoff.includes('第三段'));
    return handoff;
  }
  function languageChecks(scene) {
    const lines = scene.lines.filter(l => l.speaker === 'elora');
    return { dialogueCount: lines.length, allBilingual: lines.length > 0 && lines.every(l => /^「[^\n]+（[^\n]+）」$/u.test(l.text)),
      paragraphs: lines.map((l, index) => {
        const match = /^「([\s\S]+)（([\s\S]+)）」$/u.exec(l.text);
        return { index, shape: Boolean(match), japaneseHasKana: Boolean(match && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(match[1])), translationHasKana: Boolean(match && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(match[2])) };
      }),
    };
  }
  const preflight = {
    baselineDirectory, ids, promptPath, fusionSha256: sha(fusion), bilingual,
    sourceChecks: priorPreflight.sourceIntegrity, preservedOriginalModules: keminiOriginalModules.length,
    comparison: ['old-outline', 'full-workshop', 'selected-handoff'],
    changes: 'Only experimental AIRP planner adaptation/last task changed; original preset bodies and author library preserved. All writers share identical non-plan messages and bilingual instructions. Same fused plan feeds full/selected arms.',
    previews: cases.map(test => ({ id: test.id, planningBytes: planningInput(test).bytes, oldOutlineWritingBytes: writingInput(test, test.planning.text).bytes })),
  };
  if (!live) console.log(JSON.stringify({ mode: 'dry-run', ...preflight }, null, 2));
  else {
    const config = runtime.parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
    const models = runtime.resolveGenerationModels(config.models, specification.preset);
    assert.deepEqual(['planning', 'writing', 'updater'].map(s => models[s].model), ['gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-flash']);
    for (const test of cases) for (const stage of ['planning', 'writing']) {
      const { baseUrl: currentUrl, ...current } = models[stage], { baseUrl: priorUrl, ...prior } = test[stage].config;
      assert.deepEqual(current, prior, 'Sampling/model settings changed');
    }
    const keys = [...new Set(Object.values(config.keys))]; assert(keys.every(Boolean));
    const endpointTexts = [...new Set(Object.values(models).flatMap(m => [m.baseUrl, new URL(m.baseUrl).origin]))];
    const sanitize = value => {
      let text = typeof value === 'string' ? value : JSON.stringify(value, (key, val) => key === 'baseUrl' ? '[configured-endpoint]' : val, 2);
      assert(!keys.some(key => text.includes(key)), 'Credential detected; refusing to save');
      for (const endpoint of endpointTexts) text = text.replaceAll(endpoint, '[configured-endpoint]');
      return text;
    };
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert.equal(ledger.calls, expected); assert.equal(ledger.limit, 58); assert.equal(expected, 55);
    const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-bilingual-'));
    await fs.chmod(directory, 0o700);
    const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
    await save('preflight.json', preflight); await save('models.json', models);
    ledger = { ...ledger, limit: expected + 20, budgetAdjustments: [...ledger.budgetAdjustments, {
      previousLimit: ledger.limit, newLimit: expected + 20, startingCalls: expected, additionalCallAllowance: 20,
      reason: '用户要求融合角色演出规划并实测双语；两场三组，同一新规划的完整/定稿交接对照；正常14次，至多6次格式修复，替代上轮未用余额、不清零历史。',
    }] };
    writeFileSync(ledgerPath, JSON.stringify(ledger));
    console.log(JSON.stringify({ event: 'started', directory, calls: expected, limit: ledger.limit }));
    const provider = createDirectProvider(async (url, init) => {
      assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger);
      assert(ledger.calls < ledger.limit);
      ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
      console.log(JSON.stringify({ event: 'dispatch', calls: ledger.calls, model: JSON.parse(init.body).model }));
      return fetch(url, init);
    });
    const attempts = [];
    async function call(id, stage, input, ordinal = 1) {
      const slot = stage === 'formatting' ? 'updater' : stage;
      const attempt = { id, stage, ordinal, input, config: models[slot], startedAt: Date.now(), endedAt: null, status: 'running' };
      attempts.push(attempt); await save(`${id}-${stage}-${ordinal}.json`, attempt);
      try {
        const completion = await provider({ config: models[slot], messages: input.messages }, config.keys[slot], new AbortController().signal);
        Object.assign(attempt, completion, { status: 'succeeded' });
        await save(`${id}-${stage}-${ordinal}.txt`, completion.text);
      } catch (error) {
        attempt.status = 'failed'; attempt.error = { code: error.code ?? 'runner-error', message: error.code ? error.message : 'Experiment failed locally', outcomeUnknown: Boolean(error.outcomeUnknown), usage: error.usage ?? null };
      }
      attempt.endedAt = Date.now(); await save(`${id}-${stage}-${ordinal}.json`, attempt);
      console.log(sanitize({ event: 'stage-ended', id, stage, ordinal, status: attempt.status, characters: attempt.text?.length, elapsedMs: attempt.endedAt - attempt.startedAt, usage: attempt.usage, error: attempt.error }));
      return attempt;
    }
    async function arm(test, name, outline) {
      const id = `${test.id}-${name}`;
      const input = writingInput(test, outline);
      assert.equal(input.nonPlanSignature, writingInput(test, test.planning.text).nonPlanSignature);
      const write = await call(id, 'writing', input);
      if (write.status !== 'succeeded') return { id, status: 'writing-failed' };
      let feedback;
      for (let ordinal = 1; ordinal <= 2; ordinal++) {
        const formatted = runtime.compileInput('formatting', specification, '', write.text, feedback);
        const formattedAttempt = await call(id, 'formatting', inspect(formatted.messages, 'formatting'), ordinal);
        if (formattedAttempt.status !== 'succeeded') return { id, status: 'formatting-failed' };
        try {
          const scene = acceptGeneratedText(formattedAttempt.text, write.text);
          const checks = languageChecks(scene);
          await save(`${id}-scene.json`, { scene, checks, textVerbatim: true });
          return { id, status: checks.allBilingual ? 'ready' : 'language-format-failed', characters: write.text.length, lines: scene.lines.length, checks, nonPlanSignature: input.nonPlanSignature };
        } catch (error) {
          await save(`${id}-validation-${ordinal}.json`, { valid: false, code: error.code, message: error.message });
          if (ordinal === 2) return { id, status: 'validation-failed' };
          feedback = { previousOutput: formattedAttempt.text, error: error.message };
        }
      }
    }
    async function run(test) {
      // Both independent branches settle before cleanup even when one branch fails.
      const [old, fused] = await Promise.all([
        arm(test, 'old-outline', test.planning.text),
        call(test.id, 'planning', planningInput(test)),
      ]);
      if (fused.status !== 'succeeded') return [old, { id: test.id, status: 'planning-failed' }];
      let handoff;
      try { handoff = extractHandoff(fused.text); }
      catch { await save(`${test.id}-handoff-error.json`, { error: 'Workshop structure invalid; no automatic planning retry' }); return [old, { id: test.id, status: 'planning-structure-failed' }]; }
      await save(`${test.id}-selected-handoff.txt`, handoff);
      const results = await Promise.all([arm(test, 'full-workshop', fused.text), arm(test, 'selected-handoff', handoff)]);
      return [old, ...results];
    }
    const results = (await Promise.all(cases.map(run))).flat();
    const summary = { directory, startingCalls: expected, calls: ledger.calls, limit: ledger.limit, results,
      attempts: attempts.map(({ input, config: model, text, ...a }) => ({ ...a, inputBytes: input.bytes, model: model.model, characters: text?.length })),
    };
    await save('summary.json', summary);
    console.log(sanitize({ event: 'completed', ...summary }));
    if (results.some(r => r.status !== 'ready')) process.exitCode = 1;
  }
} finally { await vite.close(); }
