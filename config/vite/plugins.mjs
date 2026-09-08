import { copyFile, cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transform } from 'esbuild';
import { projectRoot } from '../paths.mjs';

export const paperDollCharacterIds = ['abyssa', 'alvitr', 'marietta', 'lenore', 'vivienne', 'eustice', 'norma', 'elora', 'kororo', 'tibby'];

/** Explicit runtime assets that Vite cannot infer from computed URLs. @param {import('../types.js').Target} target */
export function runtimeAssetDirectories(target) {
  const profiles = new Set(target.entries.flatMap(entry => entry.assetProfiles));
  return [
    ...(profiles.has('paper-dolls') ? paperDollCharacterIds.map(id => ({ source: `src/assets/characters/paper-dolls/${id}`, destination: `character-art/${id}` })) : []),
    ...(profiles.has('emotes') ? [{ source: 'src/assets/emote', destination: 'emote-art' }] : []),
  ];
}

/** @param {import('../types.js').Target} target */
export function toolsIndex(target) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Abyssa 制作工具</title><body><main><h1>Abyssa 制作工具</h1><ul>${target.entries.map(entry => `<li><a href="./${entry.html}">${entry.id}</a></li>`).join('')}</ul></main></body></html>`;
}

/** @param {import('../types.js').Target} target @returns {import('vite').Plugin} */
export function targetAssets(target) {
  let outDir = target.outDir;
  const game = target.entries.some(entry => entry.kind === 'game');
  const homeRoute = game && target.id.startsWith('entry:') ? target.id.slice(6) : 'title';
  return {
    name: 'abyssa-target-assets',
    config(_config, environment) {
      const build = environment.command === 'build';
      return { define: {
        'import.meta.env.VITE_GAME_HOME': JSON.stringify(homeRoute),
        'import.meta.env.VITE_PAPER_DOLL_BASE_URL': JSON.stringify(build ? './character-art/' : '/src/assets/characters/paper-dolls/'),
        'import.meta.env.VITE_EMOTE_BASE_URL': JSON.stringify(build ? './emote-art/' : '/src/assets/emote/'),
      } };
    },
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const entry = target.entries.find(entry => url.pathname === '/' + entry.html);
        if (game && entry) {
          response.statusCode = 302;
          response.setHeader('location', `/index.html#/${entry.id}${url.search}`);
          response.end(); return;
        }
        if (entry?.sourceHtml) { request.url = '/' + entry.sourceHtml + url.search; return next(); }
        if (url.pathname !== '/' && url.pathname !== '/index.html') return next();
        if (game) return next();
        if (target.home === 'tools-index') {
          response.setHeader('content-type', 'text/html; charset=utf-8');
          response.end(toolsIndex(target));
        } else if (target.home !== 'index.html') {
          response.statusCode = 302;
          response.setHeader('location', `/${target.home}${url.search}`);
          response.end();
        } else next();
      });
    },
    async writeBundle() {
      await mkdir(outDir, { recursive: true });
      await Promise.all(runtimeAssetDirectories(target).map(({ source, destination }) => cp(
        resolve(projectRoot, source), resolve(outDir, destination), { recursive: true },
      )));
      if (game) {
        // Compatibility bookmarks only; the game itself has exactly one HTML entry.
        for (const entry of target.entries) await writeFile(resolve(outDir, entry.html), `<!doctype html><meta charset="utf-8"><title>ABYSSA</title><script>location.replace('./index.html#/${entry.id}'+location.search)</script>`);
        return;
      }
      // Source HTML lives under entries/; deployment URLs stay flat for existing lab/tools.
      const manifestPath = resolve(outDir, '.vite/manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      for (const entry of target.entries) {
        if (!entry.sourceHtml) continue;
        const source = await readFile(resolve(outDir, entry.sourceHtml), 'utf8');
        await writeFile(resolve(outDir, entry.html), source.replace(/(["'])\.\.\/\.\.\//g, '$1./'));
        await rm(resolve(outDir, entry.sourceHtml));
        if (manifest[entry.sourceHtml]) manifest[entry.sourceHtml].file = entry.html;
      }
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      if (target.home === 'tools-index') await writeFile(resolve(outDir, 'index.html'), toolsIndex(target));
      else if (target.home !== 'index.html') await copyFile(resolve(outDir, target.home), resolve(outDir, 'index.html'));
    },
  };
}

/** @returns {import('vite').Plugin} */
export function minifyVendorOnly() {
  return {
    name: 'abyssa-readable-vendor', enforce: 'post', apply: 'build',
    async renderChunk(code, chunk) {
      if (chunk.name !== 'vendor') return null;
      return { code: (await transform(code, { minify: true, target: 'es2020' })).code, map: null };
    },
  };
}
