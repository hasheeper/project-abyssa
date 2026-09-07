import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { entryClosure } from '../../config/entries.mjs';
import { assertOutputDirectory, distRoot, projectRoot } from '../../config/paths.mjs';
import { validateEntries } from '../../scripts/check-entries.mjs';
import { createArtifactServer } from '../../scripts/serve-built.mjs';

/** @param {string} id @param {string[]} navigationDependencies @returns {import('../../config/types.js').Entry} */
const entry = (id, navigationDependencies) => ({ id, html: `${id}.html`, kind: 'game', port: 5173, navigationDependencies, assetProfiles: [] });

test('navigation closure terminates on real back links and rejects missing destinations', () => {
  const catalog = [entry('one', ['two']), entry('two', ['one'])];
  assert.deepEqual(entryClosure(['one'], catalog).map(item => item.id), ['one', 'two']);
  assert.throws(() => entryClosure(['missing'], catalog), /Unknown entry/);
});

test('source navigation, unregistered HTML and duplicate IDs are rejected', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/apps/one'), { recursive: true });
  await writeFile(resolve(root, 'one.html'), '<script type="module" src="/src/apps/one/main.tsx"></script>');
  await writeFile(resolve(root, 'src/apps/one/main.tsx'), '// "comment-only.html"\nconst href = "./missing.html";');
  const catalog = [entry('one', [])];
  const navigation = await validateEntries(catalog, root);
  assert(navigation.some(error => error.includes('missing.html')));
  assert(!navigation.some(error => error.includes('comment-only.html')));
  await writeFile(resolve(root, 'src/apps/one/main.tsx'), 'export const fixture = true;');
  assert.deepEqual(await validateEntries(catalog, root), []);
  await writeFile(resolve(root, 'stray.html'), 'unregistered');
  assert((await validateEntries(catalog, root)).some(error => error.includes('Unregistered HTML')));
  assert((await validateEntries([...catalog, ...catalog], root)).some(error => error.includes('duplicate entry')));
});

test('output confinement rejects source, sibling targets, parent directories and symlink escapes', async t => {
  const target = resolve(distRoot, 'game');
  for (const unsafe of [projectRoot, resolve(projectRoot, 'src'), distRoot, resolve(distRoot, 'ui'), tmpdir()]) assert.throws(() => assertOutputDirectory(unsafe, target), /Unsafe output/);
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(projectRoot, resolve(root, 'escape'), 'dir');
  assert.throws(() => assertOutputDirectory(resolve(root, 'escape/src'), target), /Unsafe output/);
  assert(assertOutputDirectory(resolve(root, 'valid output'), target).endsWith('valid output'));
});

test('artifact server supports subpaths and returns 404 instead of HTML fallback', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-http-'));
  await mkdir(resolve(root, 'game'), { recursive: true });
  await writeFile(resolve(root, 'game/index.html'), '<main>game</main>');
  await writeFile(resolve(root, 'game/app.js'), 'export const artifact = true;');
  const server = createArtifactServer(root);
  await new Promise(resolveReady => server.listen(0, '127.0.0.1', () => resolveReady(undefined)));
  t.after(async () => { await new Promise(resolveClosed => server.close(() => resolveClosed(undefined))); await rm(root, { recursive: true, force: true }); });
  const address = server.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal(await (await fetch(`${base}/abyssa/`)).text(), '<main>game</main>');
  assert.match((await fetch(`${base}/abyssa/app.js`)).headers.get('content-type') ?? '', /javascript/);
  assert.equal((await fetch(`${base}/abyssa/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/src/apps/title/main.tsx`)).status, 404);
});

test('navigation hidden in an imported route table must belong to the entry closure', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-routes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/apps/one'), { recursive: true });
  await mkdir(resolve(root, 'src/game-client'), { recursive: true });
  await writeFile(resolve(root, 'one.html'), '<script type="module" src="/src/apps/one/main.tsx"></script>');
  await writeFile(resolve(root, 'src/apps/one/main.tsx'), 'import { href } from "../../game-client/navigation";');
  await writeFile(resolve(root, 'src/game-client/navigation.ts'), 'export const href = { missing: "missing.html" };');
  assert((await validateEntries([entry('one', [])], root)).some(error => error.includes('missing.html')));
});
