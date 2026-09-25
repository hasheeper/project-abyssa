import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileNativeOrder, strictTextMessages, readVisibleResponse, originalBody, performancePlanBody, withPerformancePlan, chineseReadingBody, splitNativeChoiceTail, applyNativeMicroEdits, digest} from '../../scripts/lib/airp-native-baseline.mjs';

test('micro-edits change only eight anchored fragments and preserve the original preset', () => {
  /** @type {{modules: import('../../scripts/lib/airp-native-baseline.mjs').SourcePrompt[]}} */
  const source = JSON.parse(readFileSync(new URL('../../src/content/presentation/airp/kemini-source.json', import.meta.url), 'utf8'));
  /** @type {import('../../scripts/lib/airp-native-baseline.mjs').MicroEdit[]} */
  const edits = JSON.parse(readFileSync(new URL('../../scripts/fixtures/airp-native-micro-edits.json', import.meta.url), 'utf8'));
  assert.equal(edits.length, 8);
  const original = {prompts: source.modules, prompt_order: [{character_id: 100001, order: []}]};
  const saved = JSON.stringify(original), actual = applyNativeMicroEdits(original, edits);
  assert.equal(JSON.stringify(original), saved); assert.deepEqual(actual.prompt_order, original.prompt_order);
  const restored = applyNativeMicroEdits(actual, [...edits].reverse().map(e => ({...e, before: e.after, after: e.before})));
  assert.deepEqual(restored, original);
  const settingsModule = actual.prompts.find(p => p.identifier === '451043ae-17bf-4162-a45f-2f80eb42ba67'); assert(settingsModule);
  const settings = settingsModule.content;
  assert(settings.includes('三段合计约600字')); assert(settings.includes('全篇共20个左右自然段'));
  assert(!settings.includes('1000')); assert(settings.includes('每一次互动的叙事正文结尾'));
  const revised = actual.prompts.filter(p => edits.some(e => e.identifier === p.identifier)).map(p => p.content).join('\n');
  assert(revised.includes("tell, don't show")); assert(revised.includes('适量内心独白')); assert(revised.includes('50%'));
  assert(!revised.includes('每段尽量一句')); assert(!revised.includes('不解说心理'));
  assert.throws(() => applyNativeMicroEdits({prompts: [{identifier: 'x', content: 'twice twice'}]}, [{identifier: 'x', before: 'twice', after: 'once'}]), /Ambiguous/);
});

test('600-word AVG revision permits coherent multi-sentence units and excludes non-prose content', () => {
  /** @type {import('../../scripts/lib/airp-native-baseline.mjs').MicroEdit[]} */
  const edits = JSON.parse(readFileSync(new URL('../../scripts/fixtures/airp-native-micro-edits.json', import.meta.url), 'utf8'));
  const settings = edits.filter(e => e.identifier === '451043ae-17bf-4162-a45f-2f80eb42ba67');
  assert.equal(settings.length, 2);
  assert.equal(edits.filter(e => e.identifier !== '451043ae-17bf-4162-a45f-2f80eb42ba67').length, 6);
  assert(settings[0].after.includes('字数与段数只计中文正文，不含日文、创作记录、末尾选项与差分标记'));
  assert(settings[0].after.includes('每段为一次完整发言或一小段连贯叙述，不限于一句'));
  assert(settings[0].after.includes('不为凑数扩写或机械拆句'));
  assert(!settings[0].after.includes('400'));
  assert.deepEqual(settings[1], {identifier: '451043ae-17bf-4162-a45f-2f80eb42ba67', before: '- 每一次互动结尾：', after: '- 每一次互动的叙事正文结尾：'});
});

test('narration and three-option output are separate short rules without examples', () => {
  const narrative = readFileSync(new URL('../../scripts/fixtures/airp-native-player-boundary.txt', import.meta.url), 'utf8');
  const options = readFileSync(new URL('../../scripts/fixtures/airp-native-choice-output.txt', import.meta.url), 'utf8');
  assert(narrative.startsWith('【叙事规则】'));
  assert(narrative.includes('自然衔接')); assert(narrative.includes('不得借话语、动作或旁白代作主观判断或未确认的决定'));
  assert(narrative.includes('需要玩家表态时，在表态前收住'));
  assert(!narrative.includes('选项')); assert(!narrative.includes('回应'));
  assert(options.startsWith('【选项输出规则】'));
  for (const requirement of ['正文结束后、</Interleaving>之前', '默认', '三个中文短标签', '明显不同的态度或互动取向', '不把同一取向换成三种办事方式', '可用简短动作体现态度', '不写台词或执行过程', '选项尚未发生', '不续写结果', '不计入正文长度和对白占比']) assert(options.includes(requirement));
  assert(!options.includes('主观判断'));
  assert(!/例如|好啊|按需|1000/.test(narrative + options));
  assert(narrative.trim().length < 90); assert(options.trim().length < 160);
});

test('AVG narration connects actions and speech without forbidding inner changes', () => {
  /** @type {import('../../scripts/lib/airp-native-baseline.mjs').MicroEdit[]} */
  const edits = JSON.parse(readFileSync(new URL('../../scripts/fixtures/airp-native-micro-edits.json', import.meta.url), 'utf8'));
  const target = edits.filter(e => e.before.startsWith('- 克制描写：'));
  assert.equal(target.length, 1);
  for (const text of ['通俗白描', '简短、连贯', '动作和画面', '与对话接得上', '读来不费力']) assert(target[0].after.includes(text));
  assert(target[0].after.startsWith(target[0].before));
  assert(!target[0].after.includes('每段一句'));
  assert(!target[0].after.includes('不打断连续对白'));
  assert.equal(edits[1].after, "- tell, don't show：对于直接可以点明的人物内心变化，不需要采用文学式的侧面描写，不需要通过神态语气侧面表达，直接简短地告诉读者，不重复解释对白已表达的内容");
  const innerVoice = edits.find(e => e.before === '角色的**大量**内心独白填充正文'); assert(innerVoice);
  assert.equal(innerVoice.after, '角色的适量内心独白辅助正文');
  const style = edits.find(e => e.before.startsWith('日本视觉小说风格：')); assert(style);
  assert(style.before.includes('魔法使之夜'));
  for (const text of ['日常戏里的对话与画面配合', '人物性格从说话方式里显出来', '明白顺口']) assert(style.after.includes(text));
});

test('optional Chinese responses stay verbatim outside performed prose and its metrics', () => {
  const body = '旁白。\n\n「はい。（好。）」';
  const choices = '【可选回应】\n1. 我可以陪你去。\n2. 能晚一点吗？';
  assert.deepEqual(splitNativeChoiceTail(body), {body, choices: ''});
  assert.deepEqual(splitNativeChoiceTail(body + '\n\n' + choices), {body, choices});
  assert.throws(() => splitNativeChoiceTail(body + '\n\n【可选回应】'), /Empty/);
  assert.throws(() => splitNativeChoiceTail(body + '\n\n' + choices + '\n于是玩家答应并走了。'), /Unexpected content/);
  assert.throws(() => splitNativeChoiceTail(body + '\n\n' + choices + '\n【可选回应】\n1. 重复'), /Repeated/);
  assert.throws(() => splitNativeChoiceTail(body + '\n\n【可选回应】\n1. はい'), /Chinese/);
});

test('split-rule default expects three final response options while old samples remain readable', () => {
  const body = '叙事正文。';
  const options = '【可选回应】\n1. 回应一\n2. 回应二\n3. 回应三';
  assert.deepEqual(splitNativeChoiceTail(body + '\n\n' + options, {expectedCount: 3}), {body, choices: options});
  assert.throws(() => splitNativeChoiceTail(body, {expectedCount: 3}), /Missing expected/);
  assert.throws(() => splitNativeChoiceTail(body + '\n\n【可选回应】\n1. 回应一\n2. 回应二', {expectedCount: 3}), /response-option count/);
  assert.throws(() => splitNativeChoiceTail(body + '\n\n' + options + '\n4. 回应四', {expectedCount: 3}), /response-option count/);
});

test('performance Plan is additive and leaves the frozen baseline and sampling intact', () => {
  const baseline = {model: 'test', temperature: 1, max_tokens: 65535, messages: [{role: 'assistant', content: 'ack'}, {role: 'user', content: 'original'}]};
  const saved = JSON.stringify(baseline), next = withPerformancePlan(baseline, 'Plan');
  assert.equal(JSON.stringify(baseline), saved);
  const last = next.messages.at(-1); assert(last);
  assert.equal(last.content, 'original\n\nPlan');
  last.content = 'original'; assert.deepEqual(next, baseline);
});

test('AVG speech carries character reactions and keeps the 50-percent dialogue target', () => {
  /** @type {{modules: import('../../scripts/lib/airp-native-baseline.mjs').SourcePrompt[]}} */
  const source = JSON.parse(readFileSync(new URL('../../src/content/presentation/airp/kemini-source.json', import.meta.url), 'utf8'));
  /** @type {import('../../scripts/lib/airp-native-baseline.mjs').MicroEdit[]} */
  const edits = JSON.parse(readFileSync(new URL('../../scripts/fixtures/airp-native-micro-edits.json', import.meta.url), 'utf8'));
  const clause = '连续对白不必句句插旁白';
  const targets = edits.filter(e => e.after.includes(clause));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].identifier, 'f67b3638-2808-4cc0-a167-4f8ecc464e30');
  for (const text of ['同一次发言可以有几句连贯短句', '句首只标角色名与差分', '语气词、停顿和标点随人物自然使用', '中文译文保留口吻', '对白约占中文正文的50%', '差分标记']) assert(targets[0].after.includes(text));
  assert(!targets[0].after.includes('60%'));
  const original = {prompts: source.modules, prompt_order: [{character_id: 100001, order: []}]};
  const previousEdits = edits.map(e => ({...e, after: e.after.replace(clause, '')}));
  const previous = applyNativeMicroEdits(original, previousEdits), current = applyNativeMicroEdits(original, edits);
  const differences = current.prompts.filter((p, i) => JSON.stringify(p) !== JSON.stringify(previous.prompts[i]));
  assert.equal(differences.length, 1);
  assert.equal(differences[0].content.split(clause).length - 1, 1);
  differences[0].content = differences[0].content.replace(clause, '');
  assert.deepEqual(current, previous);
});

test('performance Plan reading retains original ICOT body and copies only supplied translations', () => {
  const result = performancePlanBody('<planning>校正</planning>\n<Interleaving><thinking>a</thinking>旁白。\n\n<thinking>b</thinking>「はい。（好。）」\n\n<thinking>c</thinking>结尾。</Interleaving>');
  assert.equal(result.plan, '校正');
  assert.equal(chineseReadingBody(result.body, line => {assert.equal(line, '「はい。（好。）」'); return '「好。」';}), '旁白。\n\n「好。」\n\n结尾。');
  assert.throws(() => chineseReadingBody('旁白に', line => line), /Japanese remains/);
  assert.throws(() => performancePlanBody('<Interleaving>missing Plan</Interleaving>'), /leading performance/);
});

test('reading copy removes only original wrappers and creation records', () => {
  const raw = '<Interleaving>\n<thinking>a</thinking>第一段。\n\n<thinking>b</thinking>「对白。」\n\n<thinking>c</thinking>结尾。</Interleaving>';
  assert.equal(originalBody(raw), '第一段。\n\n「对白。」\n\n结尾。');
  assert.throws(() => originalBody('unexpected'), /wrapper/);
});

test('native order keeps literal modules, skips disabled modules and binds history as messages', () => {
  /** @param {string} identifier @param {string} role @param {string} content @param {boolean} marker */
  const module = (identifier, role, content, marker = false) => ({identifier, name: identifier, role, content, marker, unsupported: []});
  const preset = {modules: [module('a', 'system', 'original'), module('b', 'user', 'disabled'), module('chatHistory', 'system', '', true), module('c', 'assistant', 'ack')],
    orders: [{id: '100001', entries: ['a', 'b', 'chatHistory', 'c'].map(identifier => ({identifier, enabled: identifier !== 'b'}))}]};
  const result = compileNativeOrder(preset, '100001', x => x, {chatHistory: [{role: 'user', content: 'scene'}]});
  assert.deepEqual(result.messages, [{role: 'system', content: 'original'}, {role: 'user', content: 'scene'}, {role: 'assistant', content: 'ack'}]);
  assert.equal(result.trace[0].originalSha256, digest('original'));
  assert.throws(() => compileNativeOrder(preset, '100001', x => x, {}), /Unbound/);
});

test('strict no-tools preserves text order and does not mutate original roles', () => {
  const input = [['system', 'a'], ['system', 'b'], ['user', 'c'], ['system', 'd'], ['user', 'e'], ['assistant', 'f'], ['system', 'g']].map(([role, content]) => ({role, content}));
  const original = structuredClone(input), actual = strictTextMessages(input);
  assert.deepEqual(actual, [{role: 'system', content: 'a\n\nb'}, {role: 'user', content: 'c\n\nd\n\ne'}, {role: 'assistant', content: 'f'}, {role: 'user', content: 'g'}]);
  assert.deepEqual(input, original);
  assert.equal(actual.map(m => m.content).join('\n\n'), input.map(m => m.content).join('\n\n'));
});

test('stream archive captures all visible Chinese content but not private reasoning', async () => {
  const encoder = new TextEncoder();
  const stream = ['data: {"model":"fixture","choices":[{"delta":{"reasoning_content":"private","content":"正文"}}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"。"},"finish_reason":"stop"}],"usage":{"completion_tokens":3}}\n\n', 'data: [DONE]\n\n'].join('');
  const bytes = encoder.encode(stream);
  const response = new Response(new ReadableStream({start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close();
  }}), {headers: {'Content-Type': 'text/event-stream'}});
  const result = await readVisibleResponse(response);
  assert.equal(result.text, '正文。'); assert.equal(result.finishReason, 'stop');
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('nonstream and truncated visible responses are retained without protocol rewriting', async () => {
  const result = await readVisibleResponse(new Response(JSON.stringify({choices: [{message: {content: '<Interleaving>原文'}, finish_reason: 'length'}]})));
  assert.equal(result.text, '<Interleaving>原文'); assert.equal(result.finishReason, 'length');
});
