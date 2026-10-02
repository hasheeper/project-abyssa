import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { captureGameBuild, assertGameBuildSource, assertReleaseMetadata, assertPublicationIdentity, releaseStage, validateGameRelease, validateReleaseRecords } from '../../scripts/lib/game-release.mjs';
import { createTargetConfig } from '../../config/vite/create-config.mjs';
import { pagesInventory, sha256 } from '../../scripts/lib/airp-pages.mjs';
import { registerReleaseArtifact } from '../../scripts/record-airp-release.mjs';

/** @param {string} root @param {string[]} args */
const git = (root, args) => execFileSync('git', ['-c', 'user.name=Release Fixture', '-c', 'user.email=release@example.invalid', ...args], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();

/** @param {import('node:test').TestContext} context */
async function repository(context) {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-release-'));
  context.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(resolve(root, 'config'));
  await mkdir(resolve(root, 'docs/deployment'), {recursive: true});
  await writeFile(resolve(root, 'config/game-release.json'), '{"version":"0.1.0-alpha.1"}\n');
  await writeFile(resolve(root, 'docs/deployment/game-releases.json'), '[]\n');
  await writeFile(resolve(root, '.gitignore'), 'dist/\n');
  await writeFile(resolve(root, 'source.txt'), 'first');
  git(root, ['init']); git(root, ['add', '.']); git(root, ['commit', '-m', 'fixture']);
  return root;
}

/** @param {string} root @param {import('../../config/types.js').GameBuild} build @param {string} hash */
function tagArtifact(root, build, hash) {
  git(root, ['tag', '-a', `v${build.release.version}`, '-m', JSON.stringify({version: build.release.version, manifestSha256: hash, builtAt: build.release.builtAt})]);
}

test('game versions derive stages and reject ambiguous numbering', () => {
  assert.equal(releaseStage('0.1.0-alpha.1'), 'alpha');
  assert.equal(releaseStage('0.2.0-beta.3'), 'beta');
  assert.equal(releaseStage('1.0.0'), 'stable');
  for (const value of [null, 'v0.1.0-alpha.1', '0.01.0-alpha.1', '0.1.0-alpha.0', '0.1.0-alpha.01', '0.1.0-rc.1', '1.0.0+private']) assert.throws(() => releaseStage(value));
});

test('one snapshot provides development flags, public fields and Vite injection', async context => {
  const root = await repository(context);
  const build = captureGameBuild(root, true);
  assert.equal(build.release.development, false);
  assert.equal(captureGameBuild(root).release.development, true);
  assert.deepEqual(Object.keys(build.release).sort(), ['builtAt', 'development', 'revision', 'stage', 'version']);
  assert.doesNotThrow(() => validateGameRelease(build.release));
  const config = createTargetConfig('game', {gameBuild: build});
  assert.deepEqual(JSON.parse(config.define?.__ABYSSA_GAME_RELEASE__), build.release);
  assertGameBuildSource(build, root);
  await writeFile(resolve(root, 'source.txt'), 'dirty');
  assert.equal(captureGameBuild(root, true).release.development, true);
});

test('source archives without Git remain explicitly development-only', async context => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-release-archive-'));
  context.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(resolve(root, 'config')); await writeFile(resolve(root, 'config/game-release.json'), '{"version":"0.1.0-alpha.1"}');
  const build = captureGameBuild(root, true);
  assert.equal(build.release.revision, null); assert.equal(build.release.development, true);
});

test('builds reject dirty-to-dirty edits, untracked byte changes and HEAD changes', async context => {
  const root = await repository(context);
  await writeFile(resolve(root, 'source.txt'), 'dirty one');
  const dirty = captureGameBuild(root, true);
  await writeFile(resolve(root, 'source.txt'), 'dirty two');
  assert.throws(() => assertGameBuildSource(dirty, root), /Source changed/);
  await writeFile(resolve(root, ' extra.txt'), 'one');
  const untracked = captureGameBuild(root, true);
  await writeFile(resolve(root, ' extra.txt'), 'two');
  assert.throws(() => assertGameBuildSource(untracked, root), /Source changed/);
  const beforeCommit = captureGameBuild(root, true);
  git(root, ['add', '.']); git(root, ['commit', '-m', 'changed']);
  assert.throws(() => assertGameBuildSource(beforeCommit, root), /Source changed/);
});

test('release configuration is rechecked even when Git ignores worktree changes', async context => {
  const root = await repository(context);
  git(root, ['update-index', '--assume-unchanged', 'config/game-release.json']);
  const build = captureGameBuild(root, true);
  await writeFile(resolve(root, 'config/game-release.json'), '{"version":"0.1.0-alpha.2"}');
  assert.throws(() => assertGameBuildSource(build, root), /Source changed/);
});

test('SOURCE_DATE_EPOCH supports byte-reproducible metadata', async context => {
  const root = await repository(context), previous = process.env.SOURCE_DATE_EPOCH;
  context.after(() => { if (previous === undefined) delete process.env.SOURCE_DATE_EPOCH; else process.env.SOURCE_DATE_EPOCH = previous; });
  process.env.SOURCE_DATE_EPOCH = '1700000000';
  assert.deepEqual(captureGameBuild(root, true).release, captureGameBuild(root, true).release);
  assert.equal(captureGameBuild(root, true).release.builtAt, '2023-11-14T22:13:20.000Z');
  process.env.SOURCE_DATE_EPOCH = 'not-a-date'; assert.throws(() => captureGameBuild(root, true), /SOURCE_DATE_EPOCH/);
});

test('public identity must match the report and source, without extra private fields', async context => {
  const root = await repository(context), build = captureGameBuild(root, true);
  const report = {gameRelease: build.release, ...build.source};
  assertReleaseMetadata(build.release, report);
  assert.throws(() => assertReleaseMetadata({...build.release, version: '0.1.0-alpha.2'}, report), /differs/);
  assert.throws(() => assertReleaseMetadata(build.release, {...report, dirty: true}), /differs/);
  assert.throws(() => validateGameRelease({...build.release, apiKey: 'not-a-real-key'}), /metadata/);
  assert.throws(() => validateGameRelease({...build.release, stage: 'beta'}));
});

test('publication pins an annotated tag to both source and exact artifact', async context => {
  const root = await repository(context), build = captureGameBuild(root, true), hash = 'a'.repeat(64);
  assert.throws(() => assertPublicationIdentity(build.release, hash, [], root), /annotated/);
  git(root, ['tag', `v${build.release.version}`]);
  assert.throws(() => assertPublicationIdentity(build.release, hash, [], root), /annotated/);
  git(root, ['tag', '-d', `v${build.release.version}`]); tagArtifact(root, build, hash);
  assertPublicationIdentity(build.release, hash, [], root);
  assert.throws(() => assertPublicationIdentity(build.release, 'b'.repeat(64), [], root), /different artifact/);
  assert.throws(() => assertPublicationIdentity({...build.release, builtAt: '2026-01-01T00:00:00.000Z'}, hash, [], root), /different artifact/);
  assert.throws(() => assertPublicationIdentity({...build.release, development: true}, hash, [], root), /Development/);
  assert.throws(() => assertPublicationIdentity({...build.release, revision: 'b'.repeat(40)}, hash, [], root), /another source/);
});

test('deployment registration retains the original artifact and is idempotent', async context => {
  const root = await repository(context), build = captureGameBuild(root, true);
  await mkdir(resolve(root, 'dist/game'), {recursive: true});
  await writeFile(resolve(root, 'dist/game/release.json'), JSON.stringify(build.release));
  await writeFile(resolve(root, 'dist/game/index.html'), 'fixture');
  const hash = sha256(JSON.stringify(await pagesInventory(resolve(root, 'dist/game')))); tagArtifact(root, build, hash);
  const report = {gameRelease: build.release, manifestSha256: hash};
  const id = '12345678-1234-1234-1234-123456789abc', url = 'https://12345678.abyssa-airp-alpha.pages.dev/';
  await registerReleaseArtifact(report, id, url, root); await registerReleaseArtifact(report, id, url, root);
  const records = validateReleaseRecords(JSON.parse(await readFile(resolve(root, 'docs/deployment/game-releases.json'), 'utf8')));
  assert.equal(records.length, 1); assert.equal(records[0].deployments.length, 1);
  assertPublicationIdentity(build.release, hash, records, root);
  assert.throws(() => validateReleaseRecords([...records, records[0]]), /records/);
  assert.throws(() => validateReleaseRecords([{...records[0], apiKey: 'not-a-real-key'}]), /records/);
  assert.throws(() => validateReleaseRecords([{...records[0], deployments: [...records[0].deployments, records[0].deployments[0]]}]), /records/);
  assert.throws(() => assertPublicationIdentity(build.release, hash, [{...records[0], manifestSha256: 'b'.repeat(64)}], root), /already assigned/);
  const archive = resolve(root, 'dist/releases/v0.1.0-alpha.1/game');
  assert.equal(sha256(JSON.stringify(await pagesInventory(archive))), hash);
  await writeFile(resolve(archive, 'index.html'), 'changed');
  await assert.rejects(registerReleaseArtifact(report, id, url, root), /Archived artifact differs/);
  await assert.rejects(registerReleaseArtifact(report, id, 'https://abyssa-airp-alpha.pages.dev/', root), /immutable/);
});
