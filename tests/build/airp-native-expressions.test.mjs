import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {nativeExpressionCatalog, nativeExpressionPrompt, readNativeExpressionBody} from '../../scripts/lib/airp-native-expressions.mjs';
import {performancePlanBody, splitNativeChoiceTail} from '../../scripts/lib/airp-native-baseline.mjs';

const labels = {neutral: '平静', smile: '微笑'};
/** @type {Record<string, object>} */
const faces = {a: {}, b: {}, '>_<': {}, 'star-eyes': {}};
/** @param {string} special */
const profile = special => ({cues: {neutral: {expression: 'a'}, smile: {expression: 'b'}}, specials: {[special]: {expression: special}}});
const sources = {labels, profiles: {elora: profile('>_<'), abyssa: profile('star-eyes')}, recipes: {elora: faces, abyssa: faces}, player: {id: 'kael', name: '凯尔'}};
const catalog = nativeExpressionCatalog({...sources, actors: {elora: '艾洛拉'}});
/** @param {string} text */
const extract = text => {assert.equal(text, '「あ。（啊。）」'); return '「啊。」';};

test('catalog follows explicit presence, never all known characters', () => {
  assert.deepEqual(catalog.actors, [{id: 'elora', name: '艾洛拉', specials: ['>_<']}]);
  assert(!JSON.stringify(catalog).includes('star-eyes'));
  assert.throws(() => nativeExpressionCatalog({...sources, actors: {absent: '无素材者'}}), /Missing expression assets/);
  assert.throws(() => nativeExpressionCatalog({...sources, actors: {elora: '凯尔'}}), /Ambiguous/);
  const broken = structuredClone(sources); delete broken.recipes.elora['>_<'];
  assert.throws(() => nativeExpressionCatalog({...broken, actors: {elora: '艾洛拉'}}), /Missing special/);
});

test('prompt includes only present specials and keeps tagging a light separate rule', () => {
  const template = readFileSync(new URL('../../scripts/fixtures/airp-native-expression-output.txt', import.meta.url), 'utf8');
  const prompt = nativeExpressionPrompt(template, catalog);
  assert(prompt.includes('neutral=平静') && prompt.includes('艾洛拉（elora）：专属 >_<'));
  assert(prompt.includes('表情没变可以沿用') && prompt.includes('不为换差分而加戏或拆段'));
  assert(prompt.includes('旁白、创作记录和选项不标差分'));
  assert(!prompt.includes('star-eyes') && !prompt.includes('艾比希斯'));
  assert(!prompt.includes('{{差分目录}}'));
  assert.throws(() => nativeExpressionPrompt('missing slot', catalog), /one expression catalog/);
});

test('Chinese reading preserves text and paragraph boundaries, retaining metadata separately', () => {
  const raw = '她停了停。\r\n\r\n 艾洛拉[>_<]：「あ。（啊。）」 \r\n\r\n\r\n艾洛拉[smile]：「あ。（啊。）」';
  const result = readNativeExpressionBody(raw, extract, catalog);
  assert.equal(result.body, '她停了停。\r\n\r\n 「啊。」 \r\n\r\n\r\n「啊。」');
  assert.deepEqual(result.lines.map(line => [line.paragraph, line.kind, line.speaker, line.emotion, line.scope]), [
    [1, 'narration', undefined, undefined, undefined], [2, 'dialogue', 'elora', '>_<', 'special'], [3, 'dialogue', 'elora', 'smile', 'common'],
  ]);
});

test('special IDs allow punctuation and hyphens without borrowing another character face', () => {
  const both = nativeExpressionCatalog({...sources, actors: {elora: '艾洛拉', abyssa: '艾比希斯'}});
  assert.equal(readNativeExpressionBody('abyssa[star-eyes]：「あ。（啊。）」', extract, both).lines[0].emotion, 'star-eyes');
  assert.throws(() => readNativeExpressionBody('艾洛拉[star-eyes]：「あ。（啊。）」', extract, both), /Unsupported expression/);
  assert.throws(() => readNativeExpressionBody('艾比希斯[neutral]：「あ。（啊。）」', extract, catalog), /not present/);
});

test('player metadata uses only common emotions, without inventing a player sprite', () => {
  assert.equal(readNativeExpressionBody('凯尔[neutral]：「あ。（啊。）」', extract, catalog).lines[0].speaker, 'kael');
  assert.throws(() => readNativeExpressionBody('凯尔[>_<]：「あ。（啊。）」', extract, catalog), /Unsupported expression/);
});

test('missing/invalid tags fail rather than silently defaulting to neutral', () => {
  for (const text of ['「あ。（啊。）」', '艾洛拉：「あ。（啊。）」', '艾洛拉[]：「あ。（啊。）」', '艾洛拉[smile]「あ。（啊。）」', '旁白[neutral]：「あ。（啊。）」', '艾洛拉[未知]：「あ。（啊。）」']) {
    assert.throws(() => readNativeExpressionBody(text, extract, catalog));
  }
  assert.throws(() => readNativeExpressionBody('旁白に', extract, catalog), /Japanese/);
  assert.throws(() => readNativeExpressionBody('艾洛拉[smile]：「あ。（啊。）」\n艾洛拉[smile]：「あ。（啊。）」', extract, catalog), /malformed/);
});

test('actual source catalogs and Chinese extractor support every existing actor special', async () => {
  const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false}, appType: 'custom'});
  try {
    const {EMOTION_LABELS} = await vite.ssrLoadModule('/src/shared/domain/presentation/emotion.ts');
    const {CHARACTER_EMOTION_PROFILES} = await vite.ssrLoadModule('/src/content/presentation/character-emotions.ts');
    const {CHARACTER_EXPRESSIONS} = await vite.ssrLoadModule('/src/shared/ui/patterns/expressions.ts');
    const {chineseDialogue} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
    const all = nativeExpressionCatalog({labels: EMOTION_LABELS, profiles: CHARACTER_EMOTION_PROFILES, recipes: CHARACTER_EXPRESSIONS,
      actors: Object.fromEntries(Object.keys(CHARACTER_EMOTION_PROFILES).map(id => [id, id])), player: sources.player});
    assert.equal(Object.keys(all.common).length, 14);
    assert.deepEqual(all.actors.filter(a => a.specials.length).map(a => [a.id, a.specials]), [
      ['abyssa', ['star-eyes', 'cat-mouth']], ['elora', ['>_<']], ['kororo', ['wink']], ['tibby', ['smiling-eyes']],
    ]);
    const raw = '<planning>校正</planning><Interleaving><thinking>a</thinking>纸落在桌上。\n\n<thinking>b</thinking>elora[>_<]：「えっ？（诶？（还没说完））」\n\n<thinking>c</thinking>她等着答复。\n\n【可选回应】\n1. 顺着她\n2. 故意逗她\n3. 暂且搁下</Interleaving>';
    const prose = splitNativeChoiceTail(performancePlanBody(raw).body, {expectedCount: 3});
    const result = readNativeExpressionBody(prose.body, chineseDialogue, all);
    assert.equal(result.body, '纸落在桌上。\n\n「诶？（还没说完）」\n\n她等着答复。');
    assert.equal(result.lines[1].emotion, '>_<');
    assert.throws(() => readNativeExpressionBody('凯尔[neutral]：「是看不太清么。」', chineseDialogue, all), /日文和/);
    assert.throws(() => readNativeExpressionBody('elora[smile]：「啊。（あ。）」', chineseDialogue, all), /日文假名/);
  } finally {await vite.close();}
});
