// Explicit diagnostic only: extract complete returned prose blocks, never waive the game writer gate.
// Usage: node scripts/diagnose-airp-v7-format.mjs <report directory> <expected cumulative calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';

assert(process.argv.length === 4 && /^\d+$/.test(process.argv[3]));
const root = process.cwd(), directory = path.resolve(process.argv[2]), expected = Number(process.argv[3]);
assert(directory.startsWith(path.join(root, 'dist/reports/airp-outline-v7-live-')));
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let sanitize = () => '[details withheld]';
try {
  const runtime = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {directorTestMaterial} = await vite.ssrLoadModule('/src/game-application/testing/airp-director-fixture.ts');
  const {compileCreativeInput} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-input.ts');
  const {performedParagraphs} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
  const {directorActorNames, acceptDirectorText} = await vite.ssrLoadModule('/src/game-application/airp-director/scene.ts');
  const {createDirectProvider} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {hash, emptyUsage} = await vite.ssrLoadModule('/src/game-application/airp-generation/contracts.ts');
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
  const config = runtime.parseTestConfig(privateText), markers = privateMarkers(JSON.parse(privateText));
  sanitize = value => {
    let s = typeof value === 'string' ? value : JSON.stringify(value, (k, v) => k === 'baseUrl' ? '[configured-endpoint]' : v, 2);
    assert(!markers.keys.some(k => s.includes(k)), 'Credential found; refusing output');
    for (const e of [...markers.endpoints].sort((a, b) => b.length - a.length)) s = s.replaceAll(e, '[configured-endpoint]');
    return s;
  };
  const read = name => fs.readFile(path.join(directory, name), 'utf8');
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600, flag: 'wx'});
  const previous = JSON.parse(await read('summary.json')), preflight = JSON.parse(await read('preflight.json'));
  assert.equal(previous.version, 7); assert.equal(previous.status, 'failed'); assert.equal(previous.calls, expected);
  assert.equal(previous.attempts.at(-1).stage, 'writing'); assert.equal(previous.attempts.at(-1).error, 'invalid-output');
  assert.equal(await fs.stat(path.join(directory, 'formatting-diagnostic-summary.json')).then(() => true, () => false), false, 'Diagnostic already exists');
  const material = directorTestMaterial(7); material.models = runtime.resolveGenerationModels(config.models, material.preset, 7);
  assert.equal(hash(material.resources), preflight.resourcesHash); assert.equal(hash(material.preset), preflight.presetHash);
  assert.deepEqual(JSON.parse(sanitize(material.models)), preflight.models);
  const original = await read('writing-1-raw.txt');
  assert.equal(original, JSON.parse(await read('writing-1.json')).text);
  const outer = /^\s*<Interleaving>\s*([\s\S]*?)\s*<\/Interleaving>\s*$/.exec(original);
  assert(outer, 'Not the explicitly reviewed interleaved response');
  const groups = [...outer[1].matchAll(/<thinking>[\s\S]*?<\/thinking>\s*<prose>([\s\S]*?)<\/prose>\s*/g)];
  assert.equal(groups.length, 3); assert.equal(groups.map(g => g[0]).join(''), outer[1]);
  const draft = groups.map(g => g[1]).join('\n');
  const context = JSON.parse(await read('scene-context.json')), actors = Object.fromEntries(context.actorIds.map(id => [id, directorActorNames[id]]));
  const paragraphs = performedParagraphs(draft, actors);
  const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
  let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')); assert.equal(ledger.calls, expected); assert(ledger.limit - expected >= 2);
  await save('diagnostic-draft.txt', draft);
  await save('formatting-diagnostic-preflight.json', {mode: 'diagnostic-only', formalWriterAccepted: false,
    origin: 'writing-1-raw.txt', originalHash: hash(original), extractedDraftHash: hash(draft), blocks: groups.length,
    method: '仅拼接三个完整prose区块，不改段落、文字、表情，不修改正式解析器或游戏状态', paragraphCount: paragraphs.length});
  const attempts = []; let scene = null, feedback = null;
  for (let ordinal = 1; ordinal <= 2; ordinal++) {
    const stem = `diagnostic-formatting-${ordinal}`;
    const input = compileCreativeInput({stage: 'formatting', material, context, history: '', playerName: context.playerName, actors, draft, feedback, selectedMemoryIds: []});
    await save(`${stem}-input.json`, input);
    const a = {stage: 'formatting', ordinal, mode: 'diagnostic-only', model: material.models.updater.model, startedAt: Date.now()}; attempts.push(a);
    const provider = createDirectProvider(async (url, init) => {
      assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
      assert(ledger.calls < Math.min(ledger.limit, expected + 2)); ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
      console.log(sanitize({event: 'diagnostic-dispatch', ordinal, model: a.model, calls: ledger.calls}));
      const response = await fetch(url, init), raw = await response.clone().json().catch(() => null);
      await save(`${stem}-response.json`, {status: response.status, model: raw?.model, usage: raw?.usage,
        choices: raw?.choices?.map(c => ({finish_reason: c.finish_reason, message: {content: c.message?.content, refusal: c.message?.refusal}}))});
      if (typeof raw?.choices?.[0]?.message?.content === 'string') {a.text = raw.choices[0].message.content; await save(`${stem}-raw.txt`, a.text);}
      return response;
    });
    try {
      const completion = await provider({config: material.models.updater, messages: input.messages}, config.keys.updater, new AbortController().signal);
      Object.assign(a, completion);
      try {scene = acceptDirectorText(a.text, draft, context.actorIds, 7); a.status = 'diagnostic-succeeded';}
      catch (error) {a.status = 'failed'; a.error = 'invalid-output'; a.validation = error.message; feedback = {previousOutput: a.text, error: error.message};}
    } catch (error) {a.status = 'failed'; a.error = error.code ?? 'runner-error'; a.usage ??= error.usage ?? emptyUsage();}
    a.endedAt = Date.now(); await save(`${stem}.json`, a);
    console.log(sanitize({event: 'diagnostic-ended', ordinal, status: a.status, error: a.error, usage: a.usage}));
    if (scene || a.error !== 'invalid-output') break;
  }
  const summary = {mode: 'diagnostic-only', status: scene ? 'diagnostic-succeeded' : 'failed', formalChainStatus: 'failed-at-writing', formalWriterAccepted: false,
    startingCalls: expected, calls: ledger.calls, limit: ledger.limit, counts: {paragraphs: paragraphs.length,
      dialogue: paragraphs.filter(p => p.speaker !== 'narrator').length, narration: paragraphs.filter(p => p.speaker === 'narrator').length},
    attempts: attempts.map(({text, ...rest}) => rest)};
  await save('formatting-diagnostic-summary.json', summary);
  if (scene) {
    await save('diagnostic-scene.json', scene);
    await save('中文正文-仅诊断.md', `# ${preflight.title} · 中文阅读投影\n\nGemini正式输出协议失败；这里只展示原有中文译文，独立封装诊断通过，未进入游戏。正文未人工润色。\n\n${scene.lines.map(l => l.speaker === 'narrator' ? l.text : `**${directorActorNames[l.speaker]} · ${l.emotion}**：${l.text}`).join('\n\n')}\n`);
  }
  const sections = [];
  for (const [title, filename] of [['Sol · 完整大纲输出（正式阶段通过）', 'planning-1-raw.txt'], ['Gemini · 完整返回（正式输出协议失败）', 'writing-1-raw.txt']]) sections.push(`## ${title}\n\n\`\`\`text\n${await read(filename)}\n\`\`\`\n`);
  for (const a of attempts) sections.push(`## DeepSeek · 独立封装诊断 #${a.ordinal}\n\n${a.status}；这是从Gemini三个prose区块机械提取正文后的独立调用，不代表正式链路通过。\n\n\`\`\`json\n${a.text ?? '没有收到可见正文'}\n\`\`\`\n`);
  await save('三模型完整输出-含封装诊断.md', '# AIRP v7 · 三个模型的完整可见输出\n\n场景：两张不同的整备表／提出；玩家名：林恩。没有截断或润色输出，不含供应商私有推理字段或凭据。\n\n**正式链路失败于Gemini输出协议。** Sol通过；Gemini返回旧的三段交错容器；DeepSeek另作独立封装诊断，未写入游戏。\n\n' + `合计调用${ledger.calls - previous.startingCalls}次，累计${ledger.calls}/${ledger.limit}。\n\n` + sections.join('\n'));
  await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
  console.log(sanitize({event: 'diagnostic-completed', directory, ...summary, privacyScan: 'passed'}));
  if (!scene) process.exitCode = 1;
} catch (error) {console.error(sanitize({event: 'diagnostic-stopped', code: error.code, message: error.message})); process.exitCode = 1;}
finally {await vite.close();}
