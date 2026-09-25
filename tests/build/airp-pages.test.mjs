import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { allowedPagesPath, assertReleaseSource, pagesHeaders, pagesInventory, pagesLimits, privateMarkers, scanPrivateMarkers, sha256, validatePagesInventory, verifyBuildSnapshot } from '../../scripts/lib/airp-pages.mjs';

test('final release requires a clean committed source revision', () => {
  assert.throws(() => assertReleaseSource({dirty: true, revision: 'abc'}), /clean Git revision/);
  assert.throws(() => assertReleaseSource({dirty: false, revision: null}), /clean Git revision/);
  assert.throws(() => assertReleaseSource({dirty: false, revision: 'abc'}, {dirty: true, revision: 'abc'}), /clean Git revision/);
  assert.throws(() => assertReleaseSource({dirty: false, revision: 'abc'}, {dirty: false, revision: 'later'}), /clean Git revision/);
  assert.doesNotThrow(() => assertReleaseSource({dirty: false, revision: 'abc'}));
});

test('Pages uses a real 404 and a bounded policy compatible with inline bookmark scripts', async () => {
  const html = await readFile(new URL('../../config/deployment/cloudflare-pages/404.html', import.meta.url), 'utf8');
  assert.match(html, /页面未找到/); assert.doesNotMatch(html, /<script/);
  const headers = pagesHeaders(['<script type="module" src="./assets/game-a.js"></script>', "<script>location.replace('./index.html#/title'+location.search)</script>", html]);
  assert.match(headers, /script-src 'self' 'sha256-[A-Za-z0-9+/]+=*'/);
  assert.doesNotMatch(headers, /script-src[^;]*unsafe-inline|unsafe-eval/);
  assert.match(headers, /connect-src 'self' https:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /no-transform/); assert.ok(headers.split('\n').every(line => line.length <= 2000));
  assert.throws(() => pagesHeaders(['<script src="https://third-party.invalid/script.js"></script>']), /Unexpected script source/);
});

test('upload allowlist rejects private, executable-server, hidden, source-map and archive files', () => {
  for (const path of ['.vite/manifest.json', '_headers', '404.html', 'assets/main-abc.js', 'character-art/elora/eyes_1.png', 'mansion-map/composite-reference.png']) assert.equal(allowedPagesPath(path), true, path);
  for (const path of ['config/airp-test.local.json', 'assets/settings.local.json', 'reports/result.json', '.env', '.DS_Store', 'assets/.hidden', '_worker.js', 'functions/api.js', 'assets/main.js.map', 'assets/backup.zip', 'src/main.ts', '../index.html']) assert.equal(allowedPagesPath(path), false, path);
  assert.throws(() => validatePagesInventory([{path: 'assets/big.png', bytes: pagesLimits.fileBytes + 1}]), /size limit/);
  assert.throws(() => validatePagesInventory(Array.from({length: 20001}, () => ({path: 'index.html', bytes: 1}))), /file-count/);
});

test('upload inventory never follows symlinks and does not hide unexpected files', async t => {
  const folder = await mkdtemp(resolve(tmpdir(), 'abyssa-pages-'));
  t.after(() => rm(folder, {recursive: true, force: true}));
  await writeFile(resolve(folder, '.DS_Store'), 'hidden');
  assert.deepEqual((await pagesInventory(folder)).map(file => file.path), ['.DS_Store']);
  await symlink(resolve(folder, '.DS_Store'), resolve(folder, 'alias'));
  await assert.rejects(pagesInventory(folder), /Special file/);
  await assert.rejects(pagesInventory(resolve(folder, 'alias')), /real directory/);
});

test('private scans catch literal/escaped credentials and endpoints without echoing them', async t => {
  const folder = await mkdtemp(resolve(tmpdir(), 'abyssa-pages-private-'));
  t.after(() => rm(folder, {recursive: true, force: true}));
  const key = 'synthetic-private-key-0123456789', endpoint = 'https://private.example.invalid/v1';
  const markers = privateMarkers({connection: {apiKey: key, baseUrl: endpoint}, models: {writing: {apiKey: 'separate-key-012345'}}});
  assert.ok(markers.keys.includes(key)); assert.ok(markers.endpoints.includes(new URL(endpoint).origin));
  await mkdir(resolve(folder, 'assets'));
  await writeFile(resolve(folder, 'assets/test.png'), Buffer.from(`binary-prefix\u0000${key}`));
  await assert.rejects(scanPrivateMarkers(folder, await pagesInventory(folder), markers), error => {
    assert.ok(error instanceof Error); assert.doesNotMatch(error.message, new RegExp(key)); return /Private credential/.test(error.message);
  });
  await writeFile(resolve(folder, 'assets/test.png'), encodeURIComponent(endpoint));
  await assert.rejects(scanPrivateMarkers(folder, await pagesInventory(folder), markers), /Private credential/);
  await writeFile(resolve(folder, 'assets/test.png'), 'clean bytes');
  await scanPrivateMarkers(folder, await pagesInventory(folder), markers);
  await writeFile(resolve(folder, 'assets/test.png'), 'prefix\u0000sk-proj-' + 'a'.repeat(32));
  await assert.rejects(scanPrivateMarkers(folder, await pagesInventory(folder), {keys: [], endpoints: []}), error => {
    assert.ok(error instanceof Error); assert.doesNotMatch(error.message, /sk-proj-/); return /Credential-shaped/.test(error.message);
  });
  await writeFile(resolve(folder, 'assets/test.png'), 'apiKey: "opaque-secret-' + 'b'.repeat(20) + '"');
  await assert.rejects(scanPrivateMarkers(folder, await pagesInventory(folder), {keys: [], endpoints: []}), /Credential-shaped/);
});

test('release snapshot rejects changed, omitted or injected runtime files', () => {
  const file = {path: 'index.html', bytes: 5, sha256: sha256('hello')};
  verifyBuildSnapshot([file, {path: '_headers', bytes: 1, sha256: 'generated'}], [file]);
  assert.throws(() => verifyBuildSnapshot([{...file, sha256: sha256('other')}], [file]), /differ/);
  assert.throws(() => verifyBuildSnapshot([], [file]), /missing/);
  assert.throws(() => verifyBuildSnapshot([file, {...file, path: 'assets/extra.js'}], [file]), /differ/);
  assert.throws(() => verifyBuildSnapshot([file], [file, {...file, path: '_headers'}]), /already contains/);
});
