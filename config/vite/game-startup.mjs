import { readFile, writeFile, stat, glob, mkdir, copyFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { projectRoot } from '../paths.mjs';
import { listFiles } from '../../scripts/lib/files.mjs';
import { sourceImports } from '../../scripts/lib/module-boundaries.mjs';

const assetPattern = /\.(?:png|jpe?g|webp|avif|gif|apng|svg|woff2?|ttf|mp3|ogg|wav|json|wasm)$/i;
const digest = (/** @type {string | Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex');

/** Keep editor/reference layers on disk, but not in the game's download/offline inventory.
 * @param {string} [root] */
async function mansionRuntimeFiles(root = resolve(projectRoot, 'public')) {
  const path = resolve(root, 'mansion-map/manifest-materials-v1.json');
  if (!existsSync(path)) return new Set();
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  return new Set(['mansion-map/manifest-materials-v1.json', 'mansion-map/composite-materials-v1.png',
    ...manifest.layers.filter((/** @type {{visible: boolean}} */ layer) => layer.visible)
      .map((/** @type {{src: string}} */ layer) => 'mansion-map/' + layer.src)]);
}

/** Prioritize the shell and title's next frames, not alphabetically early battle/source art.
 * @param {{url: string}[]} assets */
function orderForWarmup(assets) {
  const priority = (/** @type {string} */ url) => /\.(html|js|css)$/.test(url) ? 0
    : /\/(?:cg-b-\d+|01-cathedral)(?:[-.]|$)/.test(url) ? 1
    : /\/(?:manor-night-gallery|mansion-first-morning)(?:[-.]|$)/.test(url) ? 2 : 3;
  return assets.sort((a, b) => priority(a.url) - priority(b.url) || a.url.localeCompare(b.url, 'en'));
}

/** Shared requests reuse the same snapshot until a source/asset watcher invalidates it.
 * @template T @param {() => Promise<T>} build */
export function cachedDevelopmentManifest(build) {
  /** @type {Promise<T> | undefined} */
  let pending;
  return {
    read() {
      if (!pending) {
        const task = build().catch(error => { if (pending === task) pending = undefined; throw error; });
        pending = task;
      }
      return pending;
    },
    invalidate() { pending = undefined; },
  };
}

/** Development follows production imports; source PNGs, editors and tests are not a download list.
 * @param {import('../types.js').Target} target
 */
export async function developmentAssets(target) {
  const seen = new Set();
  const assets = new Set();
  /** @param {string} file */
  async function visit(file) {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    if (assetPattern.test(file)) { assets.add(file); return; }
    if (!/\.(tsx?|css)$/.test(file)) return;
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/import\.meta\.glob(?:<[^>]+>)?\(\s*["']([^"']+)["']/g)) {
      for await (const name of glob(match[1], {cwd: dirname(file)})) await visit(resolve(dirname(file), name));
    }
    const imports = file.endsWith('.css')
      ? [...source.matchAll(/(?:url\(\s*|@import\s*)["']?([^\s"')]+)["']?/g)].map(match => match[1])
      : sourceImports(source, file).filter(edge => !edge.typeOnly).map(edge => edge.specifier).filter(Boolean);
    for (const specifier of imports) {
      if (!specifier?.startsWith('.')) continue;
      // raw SVG imports are part of their module, not separate network resources.
      if (/[?&]raw(?:&|$)/.test(specifier)) continue;
      const path = resolve(dirname(file), specifier.split('?')[0]);
      const found = [path, path + '.ts', path + '.tsx', path + '/index.ts', path + '/index.tsx'].find(p => existsSync(p) && statSync(p).isFile());
      if (found) await visit(found);
    }
  }
  if (target.entries.some(e => e.kind === 'game')) await visit(resolve(projectRoot, 'src/game-shell/main.tsx'));
  // Computed paper-doll, emote and icon URLs are not discoverable from imports.
  const mansionFiles = await mansionRuntimeFiles();
  for (const dir of ['src/assets/characters/paper-dolls', 'src/assets/emote', 'src/assets/icons', 'public']) {
    for (const file of await listFiles(resolve(projectRoot, dir))) {
      const path = relative(resolve(projectRoot, 'public'), file);
      if (path.startsWith('mansion-map/') && !mansionFiles.has(path)) continue;
      if (assetPattern.test(file)) assets.add(file);
    }
  }
  const manifest = await Promise.all([...assets].sort().map(async file => ({
    url: file.includes('/public/') ? './' + relative(resolve(projectRoot, 'public'), file) : '/' + relative(projectRoot, file),
    bytes: (await stat(file)).size, revision: digest(await readFile(file)),
  })));
  orderForWarmup(manifest);
  return manifest;
}

/** Build-only runtime manifest includes emitted chunks, styles and copied runtime art.
 * @param {string} directory
 */
export async function productionAssets(directory) {
  const mansionFiles = await mansionRuntimeFiles(directory);
  const files = (await listFiles(directory)).filter(file => {
    const path = relative(directory, file);
    if (path.startsWith('mansion-map/') && !mansionFiles.has(path)) return false;
    return !path.startsWith('.') && !['game-assets.json', 'game-cache.js'].includes(path) && /\.(?:html|js|css|png|jpe?g|webp|avif|gif|apng|svg|woff2?|ttf|mp3|ogg|wav|json|wasm)$/i.test(file);
  });
  const manifest = await Promise.all(files.sort().map(async file => ({url: './' + relative(directory, file).split('\\').join('/'), bytes: (await stat(file)).size, revision: digest(await readFile(file))})));
  orderForWarmup(manifest);
  return manifest;
}

/** @param {import('../types.js').Target} target @returns {import('vite').Plugin} */
export function gameStartup(target) {
  const enabled = target.entries.some(entry => entry.kind === 'game');
  let outDir = target.outDir;
  let building = false;
  return {
    name: 'abyssa-game-startup',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); building = config.command === 'build'; },
    configureServer(server) {
      if (!enabled) return;
      const manifest = cachedDevelopmentManifest(async () => {
        const assets = await developmentAssets(target);
        return JSON.stringify({version: digest(JSON.stringify(assets)), development: true, assets});
      });
      const invalidate = (/** @type {string} */ _event, /** @type {string} */ file) => {
        const path = relative(projectRoot, file).split('\\').join('/');
        if (path.startsWith('src/') || path.startsWith('public/')) manifest.invalidate();
      };
      server.watcher.on('all', invalidate);
      server.httpServer?.once('close', () => server.watcher.off('all', invalidate));
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/game-assets.json') return next();
        void manifest.read().then(body => {
          response.setHeader('content-type', 'application/json'); response.setHeader('cache-control', 'no-store');
          response.end(body);
        }).catch(error => { response.statusCode = 500; response.end(String(error)); });
      });
    },
    // closeBundle runs after runtimeAssetDirectories and the index.html alias are copied.
    async closeBundle() {
      if (!enabled || !building) return;
      await mkdir(resolve(outDir, 'licenses/fonts'), {recursive: true});
      for (const file of ['OFL-Cinzel.txt', 'OFL-NotoSerifSC.txt']) await copyFile(resolve(projectRoot, 'src/assets/fonts', file), resolve(outDir, 'licenses/fonts', file));
      const assets = await productionAssets(outDir);
      const manifest = {version: digest(JSON.stringify(assets)), development: false, assets};
      await writeFile(resolve(outDir, 'game-assets.json'), JSON.stringify(manifest));
      const worker = await readFile(resolve(projectRoot, 'src/shared/loading/cache-worker.js'), 'utf8');
      await writeFile(resolve(outDir, 'game-cache.js'), `const GAME_ASSETS = ${JSON.stringify(manifest)};\n${worker}`);
    },
  };
}
