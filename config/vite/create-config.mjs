import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { assertOutputDirectory, projectRoot } from '../paths.mjs';
import { resolveTarget } from '../targets.mjs';
import { minifyVendorOnly, targetAssets } from './plugins.mjs';

/** @param {string} targetId @param {import('../types.js').TargetOptions} [options] @returns {import('vite').InlineConfig} */
export function createTargetConfig(targetId, options = {}) {
  const target = resolveTarget(targetId);
  const outDir = assertOutputDirectory(resolve(projectRoot, options.outDir ?? target.outDir), target.outDir);
  const ui = target.profile === 'ui';
  const readable = target.profile === 'readable';
  const hasMap = target.entries.some(entry => entry.id === 'map');
  const enableAi = options.enableAi ?? false;
  return {
    configFile: false, root: projectRoot, base: options.base ?? './',
    plugins: [react(), ...(!ui ? [targetAssets(target)] : []), ...(readable ? [minifyVendorOnly()] : [])],
    define: { 'import.meta.env.VITE_DICE_RUNTIME_ENABLED': JSON.stringify(String(enableAi)) },
    server: {
      host: options.host ?? '127.0.0.1', port: options.port ?? target.port, strictPort: true,
      open: options.open ?? target.open,
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
      rollupOptions: ui ? { external: ['react', 'react-dom', 'react/jsx-runtime'] } : {
        input: Object.fromEntries(target.entries.map(entry => [entry.id, resolve(projectRoot, entry.html)])),
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
