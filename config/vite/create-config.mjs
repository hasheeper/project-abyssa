import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { assertOutputDirectory, projectRoot } from '../paths.mjs';
import { resolveTarget } from '../targets.mjs';
import { minifyVendorOnly, targetAssets } from './plugins.mjs';
import { gamePageStyles } from './game-page-styles.mjs';
import { gameStartup } from './game-startup.mjs';
import { gameRelease } from './game-release.mjs';
import { captureGameBuild } from '../../scripts/lib/game-release.mjs';

/** @param {string} targetId @param {import('../types.js').TargetOptions} [options] @returns {import('vite').InlineConfig} */
export function createTargetConfig(targetId, options = {}) {
  const target = resolveTarget(targetId);
  const outDir = assertOutputDirectory(resolve(projectRoot, options.outDir ?? target.outDir), target.outDir);
  const ui = target.profile === 'ui';
  const readable = target.profile === 'readable';
  const hasMap = target.entries.some(entry => entry.id === 'map');
  const enableAi = options.enableAi ?? false;
  const gameBuild = options.gameBuild ?? captureGameBuild(projectRoot);
  const hasGame = target.entries.some(entry => entry.kind === 'game');
  return {
    configFile: false, root: projectRoot, base: options.base ?? './',
    // Concurrent game/lab servers must not replace each other's optimized deps.
    cacheDir: resolve(projectRoot, 'node_modules/.vite', `${target.id.replace(':', '-')}${enableAi ? '-ai' : ''}`),
    plugins: [react(), ...(!ui ? [targetAssets(target), gameRelease(gameBuild, hasGame), gameStartup(target)] : []), ...(readable ? [minifyVendorOnly()] : [])],
    css: { postcss: { plugins: target.entries.some(e => e.kind === 'game') ? [gamePageStyles()] : [] } },
    define: { 'import.meta.env.VITE_DICE_RUNTIME_ENABLED': JSON.stringify(String(enableAi)), __ABYSSA_GAME_RELEASE__: JSON.stringify(gameBuild.release) },
    server: {
      host: options.host ?? '127.0.0.1', port: options.port ?? target.port, strictPort: true,
      open: options.open ?? target.open,
      // Preserve Vite's existing credential denylist and protect the BYOK local file
      // in every dev target sharing this root (not only the AIRP entry).
      fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/*.local.json', '**/dist/reports/**'] },
      ...(enableAi ? { proxy: { '/api': 'http://127.0.0.1:8787' } } : {}),
    },
    preview: { host: options.host ?? '127.0.0.1', port: options.port ?? target.port, strictPort: true, open: options.open ?? false },
    build: {
      outDir, emptyOutDir: true, copyPublicDir: !ui, manifest: !ui,
      ...(hasMap ? { chunkSizeWarningLimit: 520 } : {}),
      ...(readable ? { minify: false, cssMinify: false, modulePreload: { polyfill: false }, reportCompressedSize: false } : {}),
      ...(ui ? {
        lib: {
          entry: Object.fromEntries(['index', 'branding', 'patterns', 'primitives'].map(id => [id, resolve(projectRoot, `src/${id}.ts`)])),
          formats: ['es'], fileName: (_format, name) => `${name}.js`, cssFileName: 'abyssa-ui',
        },
      } : {}),
      rollupOptions: ui ? {
        external: ['react', 'react-dom', 'react/jsx-runtime', /^motion(?:\/|$)/],
        // Library CSS and images ship together at the package root. Be explicit
        // so Vite's CSS URL resolver does not assume the app's assets/ directory.
        output: { assetFileNames: '[name].[ext]' },
      } : {
        input: {
          ...(target.entries.some(e => e.kind === 'game') ? { game: resolve(projectRoot, 'index.html') } : {}),
          ...Object.fromEntries(target.entries.filter(entry => entry.kind !== 'game').map(entry => [entry.id, resolve(projectRoot, entry.sourceHtml ?? entry.html)])),
        },
        output: {
          ...(readable ? { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } : {}),
          ...((hasMap || readable) ? { manualChunks(id) {
            if (hasMap && id.includes('/node_modules/three/')) return 'three';
            if (hasMap && id.includes('/node_modules/gsap/')) return 'gsap';
            if (id.includes('node_modules')) return 'vendor';
          } } : {}),
        },
      },
    },
  };
}
