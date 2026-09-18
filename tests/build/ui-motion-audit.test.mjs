import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectMotionSources, manifestFiles } from '../../scripts/audit-ui-motion.mjs';

/** @param {string} source @param {string} [path] */
const file = (source, path = 'src/example.css') => ({ path, source });
/** @param {string} name */
const frame = name => `@keyframes ${name} { from {opacity: 0} to {opacity: 1} }`;

test('audit follows shorthand, custom-property fallbacks and generated DOM string references', () => {
  const result = inspectMotionSources([
    file(['inline', 'variable', 'fallback', 'dynamic', 'unused'].map(frame).join('\n') +
      '.x {animation: inline 1s; --score: variable 1s; animation-name: var(--name, fallback)}'),
    file('node.className = `generated-${kind}`; node.style.animationName = "dynamic"; // unused', 'src/runtime.ts'),
    file('const name = "unused";', 'src/example.test.ts'),
    file('.demo {animation: unused 1s}', 'src/example.stories.css'),
  ]);
  assert.deepEqual(result.unreferencedCandidates.map(item => item.name), ['unused']);
  assert.match(result.limitations, /Never auto-purge/);
});

test('same body remains a candidate with independent names and owner paths', () => {
  const result = inspectMotionSources([file(frame('board')), file(frame('enemy'), 'src/apps/battle/effects.css')]);
  assert.equal(result.identicalBodyCandidates.length, 1);
  assert.deepEqual(result.identicalBodyCandidates[0].map(item => [item.name, item.protected]), [['board', false], ['enemy', true]]);
});

test('only normal/reduced pairs and the four explicit cross-file RP replacements are exempt', () => {
  /** @param {string} name */
  const reduced = name => `@media (prefers-reduced-motion: reduce) {${frame(name)}}`;
  const local = inspectMotionSources([file(frame('local') + reduced('local'))]);
  assert.equal(local.allowedReduced.length, 1);
  const repeated = inspectMotionSources([file(frame('local') + frame('local') + reduced('local'))]);
  assert.equal(repeated.duplicateNames.length, 1);
  const unrelated = inspectMotionSources([file(frame('x')), file(reduced('x'), 'src/other.css')]);
  assert.equal(unrelated.duplicateNames.length, 1);
  const rp = inspectMotionSources([
    file(frame('abyssa-rp-node-pop'), 'src/shared/ui/styles/rp-bubble-effects.css'),
    file(reduced('abyssa-rp-node-pop'), 'src/shared/ui/styles/rp-motion.css'),
  ]);
  assert.equal(rp.allowedReduced.length, 1);
  const notReduced = inspectMotionSources([file(frame('x') + `@media (prefers-reduced-motion: no-preference) {${frame('x')}}`)]);
  assert.equal(notReduced.duplicateNames.length, 1);
});

test('all real reduced RP definitions remain explicitly recognized and imported last', () => {
  const paths = ['rp-bubble-effects.css', 'rp-message-layout.css', 'rp-motion.css'];
  const result = inspectMotionSources(paths.map(path => file(readFileSync(new URL(`../../src/shared/ui/styles/${path}`, import.meta.url), 'utf8'), `src/shared/ui/styles/${path}`)));
  assert.equal(result.allowedReduced.length, 4);
  assert.equal(result.duplicateNames.length, 0);
  const imports = readFileSync(new URL('../../src/shared/ui/styles/rp.css', import.meta.url), 'utf8');
  for (const path of paths.slice(0, 2)) assert.ok(imports.indexOf(path) < imports.indexOf('rp-motion.css'));
});

test('route measurement deduplicates shared files, follows cycles safely, excludes lazy routes', () => {
  const manifest = {
    entry: {file:'entry.js', imports:['shared'], dynamicImports:['page', 'other']},
    page: {file:'page.js', css:['page.css','shared.css'], imports:['shared'], dynamicImports:['optional']},
    shared: {file:'shared.js', css:['shared.css'], imports:['entry']},
    other: {file:'other.js'}, optional: {file:'optional.js'},
  };
  assert.deepEqual(manifestFiles(manifest, ['entry','page']), ['entry.js','page.css','page.js','shared.css','shared.js']);
  assert.throws(() => manifestFiles(manifest, ['missing']), /Unknown manifest key/);
});
