import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
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
  return {
    name: 'abyssa-target-assets',
    config(_config, environment) {
      const build = environment.command === 'build';
      return { define: {
        'import.meta.env.VITE_PAPER_DOLL_BASE_URL': JSON.stringify(build ? './character-art/' : '/src/assets/characters/paper-dolls/'),
        'import.meta.env.VITE_EMOTE_BASE_URL': JSON.stringify(build ? './emote-art/' : '/src/assets/emote/'),
      } };
    },
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname !== '/' && url.pathname !== '/index.html') return next();
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
