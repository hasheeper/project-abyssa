import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createTargetConfig } from '../../config/vite/create-config.mjs';
import { projectRoot, distRoot } from '../../config/paths.mjs';
import { buildTarget } from '../../scripts/lib/build-target.mjs';
import { fileHash } from '../../scripts/lib/files.mjs';
import { validateBuildOutput } from '../../scripts/check-build-output.mjs';

const execute = promisify(execFile);

test('mansion build closes navigation and detects missing pages, chunks and dynamic art', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'abyssa-assets-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const outDir = resolve(temporary, 'mansion output');
  const first = await buildTarget('entry:mansion', { outDir });
  assert.deepEqual(await validateBuildOutput('entry:mansion', outDir), []);
  assert.match(await readFile(resolve(outDir, 'mansion.html'), 'utf8'), /index\.html#\/mansion/);
  const second = await buildTarget('entry:mansion', { outDir });
  assert.deepEqual(second.report.files, first.report.files, 'same input must produce the same asset bytes');
  const manifest = JSON.parse(await readFile(resolve(outDir, 'mansion-map/manifest.json'), 'utf8'));
  const layer = resolve(outDir, 'mansion-map', manifest.layers[0].src);
  const art = resolve(outDir, 'character-art/abyssa');
  await rm(layer);
  await rm(art, { recursive: true });
  await rm(resolve(outDir, 'shop.html'));
  const viteManifest = JSON.parse(await readFile(resolve(outDir, '.vite/manifest.json'), 'utf8'));
  const chunk = Object.values(viteManifest).find(value => /** @type {{file: string}} */(value).file.endsWith('.js'));
  assert(chunk);
  await rm(resolve(outDir, /** @type {{file: string}} */(chunk).file));
  const errors = await validateBuildOutput('entry:mansion', outDir);
  assert(errors.some(error => error.includes('shop.html')));
  assert(errors.some(error => error.includes('mansion manifest')));
  assert(errors.some(error => error.includes('character-art/abyssa')));
  assert(errors.some(error => error.includes('.js')));
});

test('CLI works from another cwd and honors a custom dice output directory', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outDir = resolve(root, 'dice output');
  const defaultIndex = resolve(distRoot, 'entries/dice/index.html');
  const before = existsSync(defaultIndex) ? await fileHash(defaultIndex) : null;
  await execute(process.execPath, [resolve(projectRoot, 'scripts/run-target.mjs'), 'build', 'entry:dice', '--outDir', outDir], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
  assert.deepEqual(await validateBuildOutput('entry:dice', outDir), []);
  assert.match(await readFile(resolve(outDir, 'dice.html'), 'utf8'), /index\.html#\/dice/);
  assert.equal(existsSync(defaultIndex) ? await fileHash(defaultIndex) : null, before);
});

test('UI and game builds preserve each other and the package excludes all other targets', async t => {
  const markers = ['game', 'lab', 'tools', 'reports'].map(id => resolve(distRoot, id, `s0-isolation-${process.pid}.txt`));
  t.after(() => Promise.all(markers.map(file => rm(file, { force: true }))));
  for (const marker of markers) { await mkdir(resolve(marker, '..'), { recursive: true }); await writeFile(marker, 'preserve sibling'); }
  await buildTarget('ui');
  for (const marker of markers) assert.equal(await readFile(marker, 'utf8'), 'preserve sibling');
  const uiFiles = ['index.js', 'index.d.ts', 'abyssa-ui.css'];
  const before = await Promise.all(uiFiles.map(file => fileHash(resolve(distRoot, 'ui', file))));
  await buildTarget('game');
  assert.deepEqual(await Promise.all(uiFiles.map(file => fileHash(resolve(distRoot, 'ui', file)))), before);
  await execute(process.execPath, [resolve(projectRoot, 'scripts/check-package-release.mjs')], { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 });
});

test('studio artifact includes computed sprite and emote URLs and detects missing layers', async t => {
  const outDir = await mkdtemp(resolve(tmpdir(), 'abyssa-studio-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildTarget('entry:studio', { outDir });
  assert.deepEqual(await validateBuildOutput('entry:studio', outDir), []);
  await rm(resolve(outDir, 'character-art/elora/eyes_1.png'));
  await rm(resolve(outDir, 'emote-art/heart-still.png'));
  const errors = await validateBuildOutput('entry:studio', outDir);
  assert(errors.some(error => error.includes('character-art/elora/eyes_1.png')));
  assert(errors.some(error => error.includes('emote-art/heart-still.png')));
});

test('independent dice dev root preserves query parameters', async t => {
  const server = await createServer(createTargetConfig('entry:dice', { port: 0, open: false }));
  await server.listen();
  t.after(() => server.close());
  const address = server.httpServer?.address();
  assert(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/?fixture=1`, { redirect: 'manual' });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /src\/game-shell\/main/);
  const legacy = await fetch(`http://127.0.0.1:${address.port}/dice.html?fixture=1`, {redirect: 'manual'});
  assert.equal(legacy.headers.get('location'), '/index.html#/dice?fixture=1');
});
