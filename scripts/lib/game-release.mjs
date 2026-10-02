import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const digest = (/** @type {string | Buffer} */ value) => createHash('sha256').update(value).digest('hex');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta)\.([1-9]\d*))?$/;

/** @param {unknown} version @returns {'alpha' | 'beta' | 'stable'} */
export function releaseStage(version) {
  if (typeof version !== 'string') throw Error('Invalid game release version.');
  const match = versionPattern.exec(version);
  if (!match) throw Error('Invalid game release version.');
  return match[4] === 'alpha' ? 'alpha' : match[4] === 'beta' ? 'beta' : 'stable';
}

/** @param {unknown} value @returns {import('../../src/shared/release/game-release.js').GameRelease} */
export function validateGameRelease(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid game release metadata.');
  const release = /** @type {import('../../src/shared/release/game-release.js').GameRelease} */ (value);
  const keys = ['version', 'stage', 'revision', 'builtAt', 'development'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) ||
      release.stage !== releaseStage(release.version) || typeof release.development !== 'boolean' ||
      release.revision !== null && (typeof release.revision !== 'string' || !/^[a-f0-9]{40}$/.test(release.revision)) ||
      typeof release.builtAt !== 'string' || !Number.isFinite(Date.parse(release.builtAt)) || new Date(release.builtAt).toISOString() !== release.builtAt ||
      !release.development && release.revision === null) throw Error('Invalid game release metadata.');
  return release;
}

/** @param {string} root @param {string[]} args */
function git(root, args) {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024});
}

/** @param {string} root @returns {import('../../config/types.js').GameBuild['source']} */
export function sourceIdentity(root) {
  try {
    const revision = git(root, ['rev-parse', 'HEAD']).trim();
    const status = git(root, ['status', '--porcelain', '-z', '--untracked-files=all']);
    const hash = createHash('sha256').update(revision).update(status).update(git(root, ['diff', '--binary', 'HEAD']));
    for (const file of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort()) {
      const path = resolve(root, file);
      hash.update(file).update('\0').update(lstatSync(path).isSymbolicLink() ? readlinkSync(path) : readFileSync(path)).update('\0');
    }
    return {revision, dirty: status !== '', fingerprint: hash.digest('hex')};
  } catch { return {revision: null, dirty: null, fingerprint: null}; }
}

/** @param {string} root @param {boolean} [building] @returns {import('../../config/types.js').GameBuild} */
export function captureGameBuild(root, building = false) {
  const configuration = readFileSync(resolve(root, 'config/game-release.json'));
  let parsed;
  try { parsed = JSON.parse(configuration.toString()); }
  catch { throw Error('Invalid game release configuration.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, 'version')) throw Error('Invalid game release configuration.');
  const stage = releaseStage(parsed.version);
  const source = sourceIdentity(root);
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && (!/^\d+(?:\.\d{1,3})?$/.test(epoch) || !Number.isFinite(Number(epoch) * 1000))) throw Error('Invalid SOURCE_DATE_EPOCH.');
  const timestamp = new Date(epoch === undefined ? Date.now() : Number(epoch) * 1000);
  if (!Number.isFinite(timestamp.getTime())) throw Error('Invalid SOURCE_DATE_EPOCH.');
  const builtAt = timestamp.toISOString();
  return {release: {version: parsed.version, stage, revision: source.revision, builtAt, development: !building || source.dirty !== false || source.revision === null},
    source, configurationSha256: digest(configuration)};
}

/** @param {import('../../config/types.js').GameBuild} build @param {string} root */
export function assertGameBuildSource(build, root) {
  const current = sourceIdentity(root);
  if (current.revision !== build.source.revision || current.dirty !== build.source.dirty || current.fingerprint !== build.source.fingerprint ||
      digest(readFileSync(resolve(root, 'config/game-release.json'))) !== build.configurationSha256) throw Error('Source changed during the build; rebuild before publication.');
}

/** @param {unknown} value @param {{gameRelease?: unknown, revision?: string | null, dirty?: boolean | null}} build */
export function assertReleaseMetadata(value, build) {
  const release = validateGameRelease(value);
  const reported = validateGameRelease(build.gameRelease);
  if (!isDeepStrictEqual(release, reported) || release.revision !== build.revision ||
      release.development !== (build.dirty !== false || build.revision === null || build.revision === undefined)) throw Error('Game release metadata differs from the build source.');
  return release;
}

/** @param {unknown} value @returns {import('../../config/types.js').GameReleaseRecord[]} */
export function validateReleaseRecords(value) {
  if (!Array.isArray(value)) throw Error('Invalid game release records.');
  const versions = new Set();
  const deployments = new Set();
  for (const record of value) {
    releaseStage(record?.version);
    const keys = ['version', 'revision', 'builtAt', 'manifestSha256', 'deployments'];
    if (Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key)) || versions.has(record.version) ||
        typeof record.revision !== 'string' || !/^[a-f0-9]{40}$/.test(record.revision) || typeof record.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.manifestSha256) ||
        typeof record.builtAt !== 'string' || !Number.isFinite(Date.parse(record.builtAt)) || !Array.isArray(record.deployments) || !record.deployments.length) throw Error('Invalid game release records.');
    for (const deployment of record.deployments) {
      validateDeployment(deployment?.id, deployment?.url);
      if (Object.keys(deployment).length !== 3 || deployments.has(deployment.id) || typeof deployment.recordedAt !== 'string' || !Number.isFinite(Date.parse(deployment.recordedAt))) throw Error('Invalid game release records.');
      deployments.add(deployment.id);
    }
    versions.add(record.version);
  }
  return value;
}

/** @param {unknown} id @param {unknown} url */
export function validateDeployment(id, url) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) ||
      url !== `https://${id.slice(0, 8)}.abyssa-airp-alpha.pages.dev/`) throw Error('Expected the immutable deployment URL for the existing Pages project.');
}

/** @param {import('../../src/shared/release/game-release.js').GameRelease} release @param {string} manifestSha256 @param {import('../../config/types.js').GameReleaseRecord[]} records @param {string} root */
export function assertPublicationIdentity(release, manifestSha256, records, root) {
  validateGameRelease(release);
  if (!/^[a-f0-9]{64}$/.test(manifestSha256)) throw Error('Invalid artifact digest.');
  if (release.development || !release.revision) throw Error('Development builds cannot be published.');
  let tagged;
  let artifact;
  try {
    tagged = git(root, ['rev-parse', `refs/tags/v${release.version}^{commit}`]).trim();
    const configuration = JSON.parse(git(root, ['show', `refs/tags/v${release.version}:config/game-release.json`]));
    if (configuration.version !== release.version || git(root, ['cat-file', '-t', `refs/tags/v${release.version}`]).trim() !== 'tag') throw Error('Invalid tagged version.');
    artifact = JSON.parse(git(root, ['for-each-ref', '--format=%(contents)', `refs/tags/v${release.version}`]));
  } catch { throw Error('Publication requires a matching annotated game release tag.'); }
  if (tagged !== release.revision) throw Error('Game release tag points to another source revision.');
  if (artifact?.version !== release.version || artifact?.manifestSha256 !== manifestSha256 || artifact?.builtAt !== release.builtAt) throw Error('Game release tag identifies a different artifact.');
  const previous = validateReleaseRecords(records).find(record => record.version === release.version);
  if (previous && (previous.revision !== release.revision || previous.manifestSha256 !== manifestSha256 || previous.builtAt !== release.builtAt)) throw Error('Game version is already assigned to a different artifact.');
}
