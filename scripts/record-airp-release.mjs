import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot } from '../config/paths.mjs';
import { prepareAirpPages } from './prepare-airp-pages.mjs';
import { pagesInventory, sha256 } from './lib/airp-pages.mjs';
import { assertPublicationIdentity, validateDeployment, validateReleaseRecords, assertReleaseMetadata } from './lib/game-release.mjs';
import { isMain } from './lib/files.mjs';

/** @param {string} id @param {string} url */
export async function recordAirpRelease(id, url) {
  validateDeployment(id, url);
  const report = await prepareAirpPages(true, true, true);
  const response = await fetch(new URL('release.json', url), {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw Error('Deployment release metadata is not available.');
  assertReleaseMetadata(await response.json(), {...report.build, gameRelease: report.gameRelease});
  return registerReleaseArtifact(report, id, url);
}

/** @param {{gameRelease: import('../src/shared/release/game-release.js').GameRelease, manifestSha256: string}} report @param {string} id @param {string} url @param {string} [root] */
export async function registerReleaseArtifact(report, id, url, root = projectRoot) {
  validateDeployment(id, url);
  const registryPath = resolve(root, 'docs/deployment/game-releases.json');
  const records = validateReleaseRecords(JSON.parse(await readFile(registryPath, 'utf8')));
  assertPublicationIdentity(report.gameRelease, report.manifestSha256, records, root);
  const archiveRoot = resolve(root, 'dist/releases', `v${report.gameRelease.version}`);
  const archive = resolve(archiveRoot, 'game');
  if (!existsSync(archive)) {
    await mkdir(archiveRoot, {recursive: true});
    await cp(resolve(root, 'dist/game'), archive, {recursive: true, errorOnExist: true, force: false});
  }
  if (sha256(JSON.stringify(await pagesInventory(archive))) !== report.manifestSha256) throw Error('Archived artifact differs; no release record was changed.');
  await writeFile(resolve(archiveRoot, 'pages-release.local.json'), JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
  let record = records.find(entry => entry.version === report.gameRelease.version);
  if (!record) {
    record = {version: /** @type {string} */ (report.gameRelease.version), revision: /** @type {string} */ (report.gameRelease.revision),
      builtAt: /** @type {string} */ (report.gameRelease.builtAt), manifestSha256: report.manifestSha256, deployments: []};
    records.push(record);
  }
  if (!record.deployments.some(deployment => deployment.id === id)) record.deployments.push({id, url, recordedAt: new Date().toISOString()});
  validateReleaseRecords(records);
  await writeFile(registryPath, JSON.stringify(records, null, 2) + '\n');
  console.log(`Recorded v${record.version}: ${id}`);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--deployment-id' || args[2] !== '--deployment-url') throw Error('Usage: npm run record:pages -- --deployment-id <id> --deployment-url <immutable-url>');
  try { await recordAirpRelease(args[1], args[3]); }
  catch { console.error('Release registration failed. No upload was attempted; inspect the publication gate and deployment identity.'); process.exitCode = 1; }
}
