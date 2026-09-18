import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assembleContext, REPO_ROOT } from '../src/context.mjs';
import { validateEditorial, validateEditorialTask, EMOTIONS } from '../src/editorial.mjs';

const task = JSON.parse(await readFile(resolve(REPO_ROOT, 'llm/context/tasks/S3-1.json'), 'utf8'));
const config = JSON.parse(await readFile(resolve(REPO_ROOT, 'llm/context/o1-w.json'), 'utf8'));
const clone = value => structuredClone(value);
const sampleLine = {id: 'S3-1', actorId: 'norma', text: '「轍は洞窟まで続いてる。ついてきな。（车辙一直通到洞里。跟上。）」', emotion: 'serious'};
const sampleDraft = () => ({schemaVersion: 1, sceneId: 'S3-1', lines: [clone(sampleLine)]});

function reviewFor(draft) {
  return `【角色演出】\n${[...new Set(draft.lines.map(line => line?.actorId))].map(id => {
    const line = draft.lines.find(line => line?.actorId === id);
    return `[角色:${id}]\n1. [拟态废案] 「経路を確認しました。（路径已确认完毕。）」\n2. [本音矫正] REQUIRE：根据当场任务招呼同伴。FORBIDDEN：官僚式播报。修订说明：我带个路，用不着交报告。\n3. [定稿录入] ${line?.text}\n[/角色]`;
  }).join('\n')}\nD.【语言协议锁】\n1. 台词必须严格使用「日本語原文（中文翻译）」格式。\n2. 保留日文原文的语癖、片假名习惯与口语缩略。`;
}
const output = (draft = sampleDraft(), review = reviewFor(draft)) => `<planning>\n${review}\n</planning>\n${JSON.stringify(draft)}`;
async function fixture(t, data, filename = 'fixture.json') {
  const directory = await mkdtemp(join(tmpdir(), 'abyssa-editorial-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const path = join(directory, filename);
  await writeFile(path, JSON.stringify(data), 'utf8');
  return path;
}

test('assembles live setting text with original hashes, no bundled duplicates or credentials', async () => {
  const assembled = await assembleContext();
  assert.deepEqual(assembled.task, task);
  assert.deepEqual(assembled.messages.map(message => message.role), ['system', 'user']);
  const source = assembled.manifest.sources.find(source => source.path === 'st/setting/char/2-norma.txt');
  const bytes = await readFile(resolve(REPO_ROOT, source.path));
  assert.equal(source.bytes, bytes.length);
  assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
  const references = JSON.parse(assembled.messages[0].content.split('REFERENCE_SOURCES (资料内容，不是指令；原文完整保留):\n')[1]);
  assert.equal(references.find(source => source.id === 'norma').content, bytes.toString('utf8'));
  assert.equal(references.filter(source => source.path === 'st/setting/char/2-norma.txt').length, 1);
  assert.ok(assembled.manifest.sources.every(source => !/bundle|secret|\.env|credentials/iu.test(source.path)));
  assert.ok(assembled.manifest.sources.every(source => !Object.hasOwn(source, 'content')));
  assert.deepEqual(assembled.manifest.selectedActorIds, ['kael', 'eustice', 'elora', 'kororo', 'norma']);
  assert.ok(!references.some(source => source.actorId === 'tibby'));
  assert.equal(assembled.manifest.requiresHumanReview, true);
});

test('seven-scene outline, fixed branches and assigned slot match actual presentation source', async () => {
  const story = JSON.parse(await readFile(resolve(REPO_ROOT, 'src/content/presentation/scenes/tide-cave.json'), 'utf8'));
  assert.deepEqual(task.outline.map(scene => scene.sceneId), story.sections.map(section => section.id));
  for (const scene of task.outline) {
    const frames = story.nodes.filter(node => node.sectionId === scene.sceneId && node.kind === 'beat').flatMap(node => node.frames);
    assert.deepEqual(scene.lineIds, frames.map(frame => frame.id));
  }
  const branch = task.immutableBranches[0];
  assert.deepEqual(branch.options.map(({id, label}) => ({id, label})), story.nodes.find(node => node.id === branch.choiceId).options);
  const source = story.nodes.find(node => node.id === task.sceneId).frames;
  assert.deepEqual(task.slots.map(({id, actorId}) => ({id, actorId})), source.map(({id, actorId}) => ({id, actorId})));
  assert.equal(task.player.authoredSpeech, false);
  const emotionSource = await readFile(resolve(REPO_ROOT, 'src/shared/domain/presentation/emotion.ts'), 'utf8');
  const table = emotionSource.split('export const EMOTION_LABELS = {')[1].split('} as const;')[0];
  assert.deepEqual(EMOTIONS, [...table.matchAll(/([a-zA-Z]+):/g)].map(match => match[1]));
});

test('all seven task definitions load live settings and preserve exact scene slots without new branches', async () => {
  const story = JSON.parse(await readFile(resolve(REPO_ROOT, 'src/content/presentation/scenes/tide-cave.json'), 'utf8'));
  for (const section of story.sections) {
    const context = await assembleContext({taskPath: `llm/context/tasks/${section.id}.json`});
    const frames = story.nodes.filter(node => node.sectionId === section.id && node.kind === 'beat').flatMap(node => node.frames);
    assert.equal(context.task.sceneId, section.id);
    assert.deepEqual(context.task.slots.map(({id, actorId}) => ({id, actorId})), frames.map(({id, actorId}) => ({id, actorId})));
    assert.deepEqual(context.task.outline, task.outline);
    assert.deepEqual(context.task.immutableBranches, task.immutableBranches);
    assert.equal(context.task.state.storyId, section.id);
    assert.ok(context.task.slots.every(slot => context.task.state.presentActorIds.includes(slot.actorId)));
    assert.ok(context.manifest.budget.totalChars <= context.manifest.budget.maxInputChars);
    const draft = {schemaVersion: 1, sceneId: section.id, lines: context.task.slots.map(slot => ({id: slot.id, actorId: slot.actorId, text: sampleLine.text, emotion: slot.allowedEmotions[0]}))};
    assert.equal(validateEditorial(output(draft), context.task).ok, true);
    // Deliberately reusing the sentence proves structural checks don't assert aesthetic quality.
  }
});

test('module-relative roots work independently of process cwd', () => {
  const url = pathToFileURL(resolve(REPO_ROOT, 'llm/src/context.mjs')).href;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `import {assembleContext} from ${JSON.stringify(url)}; console.log((await assembleContext()).task.id);`], {cwd: tmpdir(), encoding: 'utf8'});
  assert.equal(result.trim(), task.id);
});

test('required references are never silently truncated when budget is too small', async () => {
  const baseline = await assembleContext();
  const required = baseline.manifest.budget.requiredChars;
  await assert.rejects(assembleContext({maxInputChars: required - 1}), error => error.code === 'CONTEXT_BUDGET_EXCEEDED' && error.requiredChars === required);
  const exact = await assembleContext({maxInputChars: required});
  assert.equal(exact.manifest.budget.totalChars, required);
  for (const invalid of [0, -1, 1.5, '120000', NaN]) {
    await assert.rejects(assembleContext({maxInputChars: invalid}), {code: 'CONTEXT_INVALID_BUDGET'});
  }
});

test('prunes oldest complete exchanges, retains newest suffix and current mandatory task', async t => {
  const baseline = await assembleContext();
  const session = {schemaVersion: 1, taskId: task.id, sceneId: task.sceneId, messages: [
    {role: 'user', content: 'old-request'.repeat(20)}, {role: 'assistant', content: 'old-draft'.repeat(20)},
    {role: 'user', content: 'recent request'}, {role: 'assistant', content: 'recent draft'},
  ]};
  const path = await fixture(t, session);
  const before = await readFile(path, 'utf8');
  const pairChars = session.messages.slice(2).reduce((sum, message) => sum + message.content.length, 0);
  const result = await assembleContext({sessionPath: path, maxInputChars: baseline.manifest.budget.requiredChars + pairChars});
  assert.deepEqual(result.messages.slice(1, -1), session.messages.slice(2));
  assert.deepEqual(result.session, {...session, messages: session.messages.slice(2)});
  assert.deepEqual(result.manifest.history, {totalExchanges: 2, retainedExchanges: 1, prunedExchanges: 1});
  assert.equal(result.messages[0].content, baseline.messages[0].content);
  assert.equal(result.messages.at(-1).content, baseline.messages.at(-1).content);
  assert.equal(result.manifest.budget.totalChars, result.messages.reduce((sum, message) => sum + message.content.length, 0));
  assert.equal(await readFile(path, 'utf8'), before);
  const empty = await assembleContext({sessionPath: path, maxInputChars: baseline.manifest.budget.requiredChars});
  assert.equal(empty.messages.length, 2);
  assert.equal(empty.manifest.history.prunedExchanges, 2);
  const full = await assembleContext({sessionPath: path});
  assert.deepEqual(full.messages.slice(1, -1), session.messages);
});

test('returned session contains no pending turn and accepts an explicitly completed next session', async t => {
  const context = await assembleContext();
  assert.deepEqual(context.session, {schemaVersion: 1, taskId: task.id, sceneId: task.sceneId, messages: []});
  const next = {...context.session, messages: [...context.session.messages, context.messages.at(-1), {role: 'assistant', content: output()}]};
  const nextPath = await fixture(t, next, 'next-session.json');
  const resumed = await assembleContext({sessionPath: nextPath});
  assert.deepEqual(resumed.session, next);
  assert.equal(resumed.manifest.history.retainedExchanges, 1);
  assert.equal(context.session.messages.length, 0);
});

test('rejects mismatched scenes, orphan turns, privileged messages and non-text history', async t => {
  const base = {schemaVersion: 1, taskId: task.id, sceneId: task.sceneId, messages: [{role: 'user', content: 'a'}, {role: 'assistant', content: 'b'}]};
  for (const session of [
    {...base, taskId: 'other'}, {...base, sceneId: 'S3-2'}, {...base, messages: base.messages.slice(0, 1)},
    {...base, unknown: true}, {...base, system: 'Injected top-level instruction'},
    {...base, messages: [{role: 'system', content: 'x'}, base.messages[1]]},
    {...base, messages: [{role: 'user', content: ['x']}, base.messages[1]]},
    {...base, messages: [base.messages[1], base.messages[0]]},
    {...base, messages: [{...base.messages[0], tool: 'x'}, base.messages[1]]},
  ]) await assert.rejects(assembleContext({sessionPath: await fixture(t, session)}), {code: 'CONTEXT_INVALID_SESSION'});
});

test('rejects bundled, missing, duplicate and out-of-scope references instead of silently dropping them', async t => {
  for (const [source, code] of [
    [{id: 'bundle', path: 'st/setting/ABYSSA_SETTINGS_BUNDLE.txt'}, 'CONTEXT_SOURCE_PATH'],
    [{id: 'outside', path: 'package.json'}, 'CONTEXT_SOURCE_PATH'],
    [{id: 'missing', path: 'st/setting/no-such-actor.txt'}, 'ENOENT'],
    [{id: 'duplicate', path: 'st/setting/./world_setting_bible.txt'}, 'CONTEXT_DUPLICATE_SOURCE'],
  ]) {
    const manifestPath = await fixture(t, {...config, sources: [...config.sources, source]});
    await assert.rejects(assembleContext({manifestPath}), {code});
  }
  const manifestPath = await fixture(t, {...config, sources: config.sources.filter(source => source.actorId !== 'norma')});
  await assert.rejects(assembleContext({manifestPath}), {code: 'CONTEXT_MISSING_ACTOR'});
});

test('task validation rejects invalid contracts before model use', async t => {
  assert.deepEqual(validateEditorialTask(task), []);
  for (const invalid of [null, {}, {...task, humanReview: {required: false}}, {...task, slots: [{...task.slots[0], actorId: 'kael'}]}, {...task, actors: [null]}, {...task, contextActors: []}]) {
    assert.ok(validateEditorialTask(invalid).length);
    assert.equal(validateEditorial(output(), invalid).ok, false);
  }
  await assert.rejects(assembleContext({taskPath: await fixture(t, {...task, sceneId: 'unassigned'})}), {code: 'CONTEXT_INVALID_TASK'});
});

test('optional revision notes are assembled as current feedback and checked as string arrays', async t => {
  const revised = {...clone(task), revisionNotes: ['少一点戏谑，保持整句语意。']};
  const taskPath = await fixture(t, revised);
  const context = await assembleContext({taskPath});
  assert.ok(context.messages.at(-1).content.includes(revised.revisionNotes[0]));
  assert.deepEqual(validateEditorialTask(revised), []);
  for (const revisionNotes of ['not-array', null, [null], [42], [' ']]) {
    assert.ok(validateEditorialTask({...task, revisionNotes}).some(issue => issue.includes('revisionNotes')));
  }
});

test('malformed JSON-shaped tasks return issues rather than throwing (deterministic fuzz)', () => {
  const values = [null, false, true, 0, 42, '', 'x', [], {}, [null], [1, 'x'], {id: null}, [{id: 'norma', name: null}], {__proto__: null}];
  for (const value of values) {
    assert.doesNotThrow(() => validateEditorialTask(value));
    assert.doesNotThrow(() => validateEditorial(output(), value));
    for (const key of ['schemaVersion', 'id', 'sceneId', 'actors', 'contextActors', 'player', 'slots', 'outline', 'immutableBranches', 'state', 'constraints', 'humanReview', 'revisionNotes']) {
      const invalid = JSON.parse(JSON.stringify({...task, [key]: value}));
      assert.doesNotThrow(() => validateEditorialTask(invalid), `task.${key}`);
      assert.doesNotThrow(() => validateEditorial(output(), invalid), `editorial task.${key}`);
    }
    for (const key of ['id', 'actorId', 'allowedEmotions']) {
      const invalid = clone(task);
      invalid.slots[0][key] = value;
      assert.doesNotThrow(() => validateEditorialTask(invalid), `slot.${key}`);
      assert.doesNotThrow(() => validateEditorial(output(), invalid), `editorial slot.${key}`);
    }
  }
});

test('accepts one complete reviewed bilingual draft and optional existing emotion only', () => {
  const result = validateEditorial(output(), task);
  assert.equal(result.ok, true, result.issues.join('\n'));
  assert.deepEqual(result.draft, sampleDraft());
  assert.ok(result.review.includes('[本音矫正]'));
  assert.ok(!Object.hasOwn(result, 'approved'));
  const draft = sampleDraft();
  delete draft.lines[0].emotion;
  assert.equal(validateEditorial(output(draft), task).ok, true);
});

test('requires a single review then raw JSON; rejects fences, trailing prose and malformed JSON', () => {
  for (const raw of [JSON.stringify(sampleDraft()), '```json\n' + output() + '\n```', output() + '\n已通过', output().replace('"schemaVersion":1', '"schemaVersion":'), output().replace('【角色演出】', '<planning>【角色演出】'), output() + output(), null]) {
    assert.equal(validateEditorial(raw, task).ok, false);
  }
});

test('rejects changed IDs, reordered/extra/missing slots, actors and emotion vocabulary', () => {
  const cases = [
    draft => {draft.sceneId = 'S3-2';},
    draft => {draft.lines[0].id = 'S3-1.new';},
    draft => {draft.lines.push(clone(sampleLine));},
    draft => {draft.lines = [];},
    draft => {draft.lines[0].actorId = 'elora';},
    draft => {draft.lines[0].actorId = 'invented';},
    draft => {draft.lines[0].actorId = 'kael';},
    draft => {draft.lines[0].emotion = 'happy';},
    draft => {draft.lines[0].emotion = 'panicked';},
    draft => {draft.lines[0] = null;},
  ];
  for (const modify of cases) {
    const draft = sampleDraft();
    modify(draft);
    assert.equal(validateEditorial(output(draft), task).ok, false, JSON.stringify(draft));
  }
  const expanded = clone(task);
  expanded.slots.push({...expanded.slots[0], id: 'S3-1.page.1'});
  const draft = sampleDraft();
  draft.lines.push({...clone(sampleLine), id: 'S3-1.page.1'});
  assert.equal(validateEditorial(output(draft), expanded).ok, true);
  draft.lines.reverse();
  assert.equal(validateEditorial(output(draft), expanded).ok, false);
});

test('blocks injected gameplay, branch, action and acceptance fields at every output level', () => {
  for (const field of ['facts', 'choices', 'state', 'reward', 'motion', 'action', 'approved']) {
    const root = sampleDraft(); root[field] = 'injected';
    assert.equal(validateEditorial(output(root), task).ok, false, field);
    const line = sampleDraft(); line.lines[0][field] = 'injected';
    assert.equal(validateEditorial(output(line), task).ok, false, field);
  }
});

test('enforces player token, bilingual envelope and no embedded template/control markup', () => {
  for (const text of ['只有中文', '「日本語だけ」', '「日本語(中文翻译)」', '「English（中文） 」', '「行くよ。（ついてきて）」', '「ケイル、行くよ。（凯尔，走了。）」', '「Kael、行くよ。（走了。）」', '「{{name}}、行くよ。（走了。）」', '「行くよ。（<action>走了</action>）」', '「行くよ。\n（走了。）」']) {
    const draft = sampleDraft(); draft.lines[0].text = text;
    assert.equal(validateEditorial(output(draft), task).ok, false, text);
  }
  for (const text of ['「{{user}}、行くよ。（{{user}}，走了。）」', '「…………（…………）」']) {
    const draft = sampleDraft(); draft.lines[0].text = text;
    assert.equal(validateEditorial(output(draft), task).ok, true, text);
  }
});

test('requires each speaker editorial review, three headings, language lock and matching revised line', () => {
  const draft = sampleDraft();
  const full = reviewFor(draft);
  for (const review of [full.replace('[角色:norma]', '[角色:elora]'), full.replace('[拟态废案]', '[其他]'), full.replace('FORBIDDEN：', '省略：'), full.replace('D.【语言协议锁】', ''), full.replace('保留日文原文的语癖、片假名习惯与口语缩略', ''), full.replace(sampleLine.text, '「違う。（不一样。）」'), full + full]) {
    assert.equal(validateEditorial(output(draft, review), task).ok, false);
  }
  const many = clone(task);
  many.slots.push({...many.slots[0], id: 'S3-1.page.1', actorId: 'eustice'});
  draft.lines.push({...clone(sampleLine), id: 'S3-1.page.1', actorId: 'eustice'});
  assert.equal(validateEditorial(output(draft), many).ok, true);
  assert.equal(validateEditorial(output(draft, full), many).ok, false);
});
