import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { build } from 'vite';
import { createTargetConfig } from '../../config/vite/create-config.mjs';
import { projectRoot } from '../../config/paths.mjs';
import { resolveTarget } from '../../config/targets.mjs';
import { fileHash, listFiles } from './files.mjs';
import { captureGameBuild, assertGameBuildSource } from './game-release.mjs';

const execute = promisify(execFile);
/** @param {string} targetId @param {import('../../config/types.js').TargetOptions} [options] */
export async function buildTarget(targetId, options = {}) {
  const gameBuild = options.gameBuild ?? captureGameBuild(projectRoot, true);
  const config = createTargetConfig(targetId, {...options, gameBuild});
  config.logLevel = 'warn';
  const directory = /** @type {string} */ (config.build?.outDir);
  await build(config);
  if (targetId === 'ui') await execute(process.execPath, [resolve(projectRoot, 'node_modules/typescript/bin/tsc'), '-p', resolve(projectRoot, 'tsconfig.build.json'), '--outDir', directory], { cwd: projectRoot });
  const files = [];
  for (const file of await listFiles(directory)) files.push({ path: relative(directory, file).split('\\').join('/'), bytes: (await stat(file)).size, sha256: await fileHash(file) });
  const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
  const toolVersions = Object.fromEntries(await Promise.all(['vite', 'typescript'].map(async name => [name, JSON.parse(await readFile(resolve(projectRoot, 'node_modules', name, 'package.json'), 'utf8')).version])));
  assertGameBuildSource(gameBuild, projectRoot);
  const report = {
    target: targetId, entries: resolveTarget(targetId).entries.map(entry => entry.id),
    revision: gameBuild.source.revision, dirty: gameBuild.source.dirty, sourceFingerprint: gameBuild.source.fingerprint,
    ...(resolveTarget(targetId).entries.some(entry => entry.kind === 'game') ? {gameRelease: gameBuild.release} : {}),
    node: process.version, npm: process.env.npm_config_user_agent?.match(/^npm\/([\d.]+)/)?.[1] ?? null,
    packageManager: pkg.packageManager, toolVersions,
    files, totalBytes: files.reduce((n, file) => n + file.bytes, 0),
  };
  const reports = resolve(projectRoot, 'dist/reports');
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, `${targetId.replace(':', '-')}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Built ${targetId}: ${files.length} files, ${(report.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
  return { directory, report };
}
