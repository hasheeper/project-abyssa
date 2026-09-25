import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { projectRoot, assertOutputDirectory } from '../config/paths.mjs';
import { validateBuildOutput } from './check-build-output.mjs';
import { isMain } from './lib/files.mjs';
import { assertReleaseSource, pagesHeaders, pagesInventory, privateMarkers, scanPrivateMarkers, sha256, validatePagesInventory, verifyBuildSnapshot, pagesLimits } from './lib/airp-pages.mjs';

/** Local-only packaging. No account discovery, upload, network fetch or API call.
 * @param {boolean} [checkOnly]
 * @param {boolean} [releaseReady]
 */
export async function prepareAirpPages(checkOnly = false, releaseReady = false) {
  const directory = assertOutputDirectory(resolve(projectRoot, 'dist/game'), resolve(projectRoot, 'dist/game'));
  const before = await pagesInventory(directory);
  validatePagesInventory(before);
  const built = JSON.parse(await readFile(resolve(projectRoot, 'dist/reports/game.json'), 'utf8'));
  if (built.target !== 'game') throw Error('Expected the game build report.');
  if (releaseReady) {
    let current;
    try {
      current = {
        revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: projectRoot, encoding: 'utf8'}).trim(),
        dirty: !!execFileSync('git', ['status', '--porcelain'], {cwd: projectRoot, encoding: 'utf8'}).trim(),
      };
    } catch { throw Error('Release source is not a clean Git revision; publication stopped.'); }
    assertReleaseSource(built, current);
  }
  verifyBuildSnapshot(before, built.files);
  let config = null;
  try { config = JSON.parse(await readFile(resolve(projectRoot, 'config/airp-test.local.json'), 'utf8')); }
  catch (error) { if (/** @type {NodeJS.ErrnoException} */(error).code !== 'ENOENT') throw Error('Cannot inspect private config; details withheld.'); }
  const markers = privateMarkers(config);
  await scanPrivateMarkers(directory, before, markers);
  const notFound = await readFile(resolve(projectRoot, 'config/deployment/cloudflare-pages/404.html'), 'utf8');
  const html = await Promise.all(before.filter(file => file.path.endsWith('.html') && file.path !== '404.html').map(file => readFile(resolve(directory, file.path), 'utf8')));
  const controls = {'404.html': notFound, _headers: pagesHeaders([...html, notFound])};
  for (const [path, content] of Object.entries(controls)) {
    if (checkOnly) {
      if (await readFile(resolve(directory, path), 'utf8') !== content) throw Error('Deployment controls differ; prepare the release again.');
    } else await writeFile(resolve(directory, path), content);
  }
  if ((await validateBuildOutput('game', directory)).length) throw Error('Game output validation failed; run check:output -- game.');
  const files = await pagesInventory(directory);
  validatePagesInventory(files);
  await scanPrivateMarkers(directory, files, markers);
  verifyBuildSnapshot(files, built.files);
  const report = {
    version: 1, target: 'cloudflare-pages-root', localOnly: true, published: false,
    preparedAt: new Date().toISOString(), node: process.version,
    build: {revision: built.revision, dirty: built.dirty, node: built.node, packageManager: built.packageManager},
    manifestSha256: sha256(JSON.stringify(files)), files,
    fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    largestFileBytes: Math.max(...files.map(file => file.bytes)),
    dragAndDropCompatible: files.length <= pagesLimits.dragAndDropFiles, limits: pagesLimits,
    privacy: {configPresent: config !== null, keyMarkersPresent: markers.keys.length > 0,
      endpointMarkersPresent: markers.endpoints.length > 0, matchedPrivateMarkers: 0},
    pending: ['author-material-sharing-confirmation', 'cloudflare-project-creation', 'public-https-acceptance', 'source-baseline-freeze'],
  };
  const reportPath = resolve(projectRoot, 'dist/reports/airp-p3/pages-release.local.json');
  if (checkOnly) {
    const prepared = JSON.parse(await readFile(reportPath, 'utf8'));
    if (prepared.manifestSha256 !== report.manifestSha256) throw Error('Prepared inventory changed; publication stopped.');
  } else {
    await mkdir(resolve(reportPath, '..'), {recursive: true});
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
  }
  console.log(JSON.stringify({localOnly: true, published: false, checked: checkOnly, files: report.fileCount,
    totalMiB: Number((report.totalBytes / 1024 / 1024).toFixed(2)), largestMiB: Number((report.largestFileBytes / 1024 / 1024).toFixed(2)),
    dragAndDropCompatible: report.dragAndDropCompatible, privacy: report.privacy, manifestSha256: report.manifestSha256}));
  return report;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--release'].includes(arg)) || args.length !== new Set(args).size || args.includes('--release') && !args.includes('--check')) throw Error('Usage: node scripts/prepare-airp-pages.mjs [--check [--release]]');
  try { await prepareAirpPages(args.includes('--check'), args.includes('--release')); }
  catch (error) {
    const sourceBlocked = error instanceof Error && error.message === 'Release source is not a clean Git revision; publication stopped.';
    console.error(sourceBlocked ? error.message : 'Pages local preparation/check failed. No upload was attempted. Inspect build checks and local configuration; private details were withheld.');
    process.exitCode = 1;
  }
}
