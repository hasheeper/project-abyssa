import { readFile, writeFile, stat, glob, mkdir, copyFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { projectRoot } from '../paths.mjs';
import { listFiles } from '../../scripts/lib/files.mjs';
import { sourceImports } from '../../scripts/lib/module-boundaries.mjs';

const assetPattern = /\.(?:png|jpe?g|webp|avif|gif|apng|svg|woff2?|ttf|mp3|ogg|wav|json|wasm)$/i;
const digest = (/** @type {string | Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex');

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
  for (const dir of ['src/assets/characters/paper-dolls', 'src/assets/emote', 'src/assets/icons', 'public']) {
    for (const file of await listFiles(resolve(projectRoot, dir))) if (assetPattern.test(file)) assets.add(file);
  }
  return Promise.all([...assets].sort().map(async file => ({
    url: file.includes('/public/') ? './' + relative(resolve(projectRoot, 'public'), file) : '/' + relative(projectRoot, file),
    bytes: (await stat(file)).size, revision: digest(await readFile(file)),
  })));
}

/** Build-only runtime manifest includes emitted chunks, styles and copied runtime art.
 * @param {string} directory
 */
export async function productionAssets(directory) {
  const files = (await listFiles(directory)).filter(file => {
    const path = relative(directory, file);
    return !path.startsWith('.') && !['game-assets.json', 'game-cache.js'].includes(path) && /\.(?:html|js|css|png|jpe?g|webp|avif|gif|apng|svg|woff2?|ttf|mp3|ogg|wav|json|wasm)$/i.test(file);
  });
  return Promise.all(files.sort().map(async file => ({url: './' + relative(directory, file).split('\\').join('/'), bytes: (await stat(file)).size, revision: digest(await readFile(file))})));
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
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/game-assets.json') return next();
        void developmentAssets(target).then(assets => {
          response.setHeader('content-type', 'application/json'); response.setHeader('cache-control', 'no-store');
          response.end(JSON.stringify({version: digest(JSON.stringify(assets)), development: true, assets}));
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
