// Offline snapshot integrity, not a style/logic pass and never a paid API call.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

assert.equal(process.argv.length, 2, 'No arguments or private configuration are needed');
const directory = fileURLToPath(new URL('../docs/baselines/airp-style-r8/', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(directory, name), 'utf8');
const json = name => JSON.parse(read(name));
const manifest = json('manifest.json');
assert.equal(manifest.id, 'airp-native-gemini-r8-style-only');
assert.equal(manifest.acceptance.proseStyle, 'accepted-provisional');
assert.equal(manifest.acceptance.storyLogic, 'not-accepted');
assert.equal(manifest.acceptance.characterPerformance, 'not-accepted');
assert.equal(manifest.acceptance.bilingualProtocol, 'failed');
assert.equal(manifest.acceptance.formalGameIntegration, 'not-tested');

const actual = [];
const visit = prefix => {
  for (const entry of fs.readdirSync(path.join(directory, prefix), {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), 'Snapshot cannot contain symlinks');
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) visit(name);
    else {assert(entry.isFile(), 'Unexpected special file'); actual.push(name);}
  }
};
visit('');
assert.deepEqual(actual.sort(), ['manifest.json', ...manifest.files.map(file => file.path)].sort(), 'Snapshot inventory changed');
for (const file of manifest.files) {
  assert(!path.isAbsolute(file.path) && !file.path.split('/').includes('..'), 'Invalid inventory path');
  const bytes = fs.readFileSync(path.join(directory, file.path));
  assert.equal(bytes.length, file.bytes, `Size changed: ${file.path}`);
  assert.equal(digest(bytes), file.sha256, `Content changed: ${file.path}`);
}

const request = json('request.json'), preset = json('preset.json'), response = json('response.json');
assert.equal(digest(JSON.stringify(request, null, 2)), manifest.source.requestSha256, 'Request differs from paid call');
assert.equal(digest(JSON.stringify(preset, null, 2)), manifest.source.effectivePresetSha256, 'Preset differs from prepared export');
assert.equal(digest(response.text), manifest.source.responseTextSha256, 'Original visible response changed');
assert.equal(manifest.source.requestSha256, '5fd9f062d02093a97bc59423200cabe352bcf11db5a648cad52ea32b5ae665e6');
assert.equal(manifest.source.responseTextSha256, 'cfb0dcf7305ee29902bedbbe6499b9a1de88aaaa11bba86e339d7f757338b1b9');
assert.equal(request.model, 'gemini-3.8-flash');
assert.deepEqual(Object.keys(request).sort(), ['model', 'messages', 'stream', 'temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'reasoning_effort', 'n'].sort());
assert.deepEqual(request.messages.map(message => message.role), ['user', 'assistant', 'user']);
for (const message of request.messages) assert.deepEqual(Object.keys(message).sort(), ['content', 'role']);
for (const [requestKey, presetKey] of [['stream', 'stream_openai'], ['max_tokens', 'openai_max_tokens'], ...['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'reasoning_effort', 'n'].map(key => [key, key])]) {
  assert.deepEqual(request[requestKey], preset[presetKey], `Sampling mismatch: ${requestKey}`);
}
assert.equal(preset.prompts.length, 59);
assert.equal(preset.prompt_order.find(order => String(order.character_id) === '100001').order.filter(entry => entry.enabled).length, 34);
for (const [id, file] of [['airp-native-performance-plan', 'performance-plan.txt'], ['airp-native-player-boundary', 'player-boundary.txt'], ['airp-native-choice-output', 'choice-output.txt'], ['airp-native-expression-output', 'expression-output.txt']]) {
  assert.equal(preset.prompts.find(prompt => prompt.identifier === id).content.trimEnd(), read(file).trimEnd());
  assert(request.messages.some(message => message.content.includes(read(file).trimEnd())), `Missing prompt: ${id}`);
}
for (const source of manifest.context) {
  const archived = fs.readFileSync(path.join(directory, source.snapshot));
  const original = archived.subarray(0, source.originalBytes);
  assert.equal(digest(original), source.sha256, `Source text changed: ${source.id}`);
  assert(/^\n*$/.test(archived.subarray(source.originalBytes).toString()), 'Only an archive terminal newline may be added');
  assert(request.messages.some(message => message.content.includes(original.toString())), `Full source missing: ${source.id}`);
}
for (const brief of json('context/absent-briefs.json')) assert(request.messages.some(message => message.content.includes(brief.text)));
const scene = json('scene.json');
for (const text of [scene.scenario, scene.userInput]) assert(request.messages.some(message => message.content.includes(text)));
const catalog = json('expression-catalog.json'), review = json('diagnostic-review.json');
assert.deepEqual(catalog.actors.map(actor => actor.id), Object.keys(scene.actors));
assert.deepEqual(catalog.player, scene.player);
assert.equal(Object.keys(catalog.common).length, 14);
assert.equal(review.strictBilingualPass, false);
assert.equal(review.diagnosticOnly, true);
assert.equal(review.errors.length, 2);
assert.equal(review.rawSha256, digest(response.text));
assert.equal(review.metrics.dialogueRatioPercent, 32.7);
const lines = review.lines.filter(line => line.kind === 'dialogue');
assert.equal(lines.length, 8);
for (const line of lines) {
  const actor = [...catalog.actors, {...catalog.player, specials: []}].find(actor => actor.id === line.speaker);
  assert(actor && (Object.hasOwn(catalog.common, line.emotion) || actor.specials.includes(line.emotion)), 'Invalid expression in frozen sample');
  assert(response.text.includes(`${line.name}[${line.emotion}]：${line.bilingual}`), 'Dialogue trace changed');
}
assert(read('sample-cn.md').includes(review.body));
assert(read('sample-cn.md').includes(review.choices));
console.log(JSON.stringify({baseline: manifest.id, integrity: 'passed', payloadFiles: manifest.files.length,
  accepted: 'prose-style-only', knownBilingualErrors: review.errors.length, legalDialogueTags: lines.length,
  storyLogic: manifest.acceptance.storyLogic, characterPerformance: manifest.acceptance.characterPerformance, networkCalls: 0}, null, 2));
