import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createArtifactServer } from './serve-built.mjs';
import { isMain } from './lib/files.mjs';
import { distRoot } from '../config/paths.mjs';

/** Keep startup integrity checks enabled for the instrumented HTML too.
 * In-memory QA overrides only; JS/CSS game bundles and disk files are untouched.
 * @param {string} directory @param {string} probe */
export async function motionAuditOverrides(directory, probe) {
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  if (!html.includes('</head>')) throw Error('Missing HTML head');
  const instrumented = Buffer.from(html.replace('</head>', `<script>${probe}</script></head>`));
  const manifest = JSON.parse(await readFile(resolve(directory, 'game-assets.json'), 'utf8'));
  /** @param {string|Buffer} value */
  const digest = value => createHash('sha256').update(value).digest('hex');
  const entry = manifest.assets.find((/** @type {{url:string}} */ asset) => asset.url === './index.html');
  if (!entry) throw Error('Missing index.html integrity entry');
  entry.bytes = instrumented.length; entry.revision = digest(instrumented);
  manifest.version = digest(JSON.stringify(manifest.assets));
  const worker = await readFile(resolve(directory, 'game-cache.js'), 'utf8');
  if (!worker.startsWith('const GAME_ASSETS = ')) throw Error('Unexpected cache worker format');
  return { 'game/index.html': instrumented, 'game/game-assets.json': Buffer.from(JSON.stringify(manifest)),
    'game/game-cache.js': Buffer.from(`const GAME_ASSETS = ${JSON.stringify(manifest)};\n${worker.slice(worker.indexOf('\n') + 1)}`) };
}
if (isMain(import.meta.url)) {
  const probe = await readFile(new URL('./lib/motion-audit-probe.js', import.meta.url), 'utf8');
  const server = createArtifactServer(undefined, { overrides: await motionAuditOverrides(resolve(distRoot, 'game'), probe) });
  const port = Number(process.env.ABYSSA_MOTION_AUDIT_PORT ?? 5198);
  server.listen(port, '127.0.0.1', () => console.log(`Motion QA (separate origin/save): http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
