import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { resolveTarget } from '../config/targets.mjs';
import { isWithin, projectRoot } from '../config/paths.mjs';
import { runtimeAssetDirectories } from '../config/vite/plugins.mjs';
import { fileHash, isMain, listFiles } from './lib/files.mjs';

/** @param {string} targetId @param {string} [directory] */
export async function validateBuildOutput(targetId, directory = resolveTarget(targetId).outDir) {
  const target = resolveTarget(targetId);
  const errors = [];
  /** @param {string} path @param {string} source */
  function requireFile(path, source) {
    const file = resolve(directory, path);
    if (!isWithin(directory, file) || !existsSync(file) || !statSync(file).isFile()) errors.push(`${source}: missing or unsafe artifact ${path}`);
  }
  if (!existsSync(directory)) return [`Missing output directory: ${directory}`];
  for (const entry of target.entries) requireFile(entry.html, 'entry registry');
  if (target.profile !== 'ui') requireFile('index.html', 'target home');
  if (target.profile !== 'ui') {
    const manifestFile = resolve(directory, '.vite/manifest.json');
    requireFile('.vite/manifest.json', 'Vite manifest');
    if (existsSync(manifestFile)) {
      const manifest = /** @type {Record<string, {file: string, css?: string[], assets?: string[], imports?: string[], dynamicImports?: string[]}>} */ (JSON.parse(await readFile(manifestFile, 'utf8')));
      for (const [key, chunk] of Object.entries(manifest)) {
        for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) requireFile(file, key);
        for (const imported of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) if (!manifest[imported]) errors.push(`${key}: unknown manifest import ${imported}`);
      }
    }
  }
  if (target.home !== 'tools-index' && target.home !== 'index.html' && existsSync(resolve(directory, 'index.html')) && existsSync(resolve(directory, target.home))) {
    if (await fileHash(resolve(directory, 'index.html')) !== await fileHash(resolve(directory, target.home))) errors.push(`index.html must match ${target.home}`);
  }
  for (const file of (await listFiles(directory)).filter(file => /\.(html|css)$/.test(file))) {
    const source = await readFile(file, 'utf8');
    const references = file.endsWith('.html')
      ? [...source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(match => match[1])
      : [...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(match => match[1]);
    for (const ref of references) {
      if (!ref || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
      const pathname = decodeURIComponent(ref.split(/[?#]/)[0] ?? '');
      if (!pathname) continue;
      const destination = pathname.startsWith('/') ? resolve(directory, `.${pathname}`) : resolve(dirname(file), pathname);
      requireFile(relative(directory, destination), relative(directory, file));
    }
  }
  // Check JS-only navigation too: these links need not occur in emitted HTML.
  for (const entry of target.entries) for (const dependency of entry.navigationDependencies) {
    const destination = resolveTarget(`entry:${dependency}`).home;
    requireFile(destination, `${entry.id} navigation`);
  }
  if (target.entries.some(entry => entry.assetProfiles.includes('mansion'))) {
    const manifestPath = resolve(directory, 'mansion-map/manifest.json');
    requireFile('mansion-map/manifest.json', 'mansion');
    requireFile('mansion-map/composite-reference.png', 'mansion');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (!Array.isArray(manifest.layers)) errors.push('Invalid mansion manifest layers');
      else for (const layer of manifest.layers) {
        if (typeof layer.src !== 'string') errors.push('Invalid mansion layer source');
        else requireFile(`mansion-map/${layer.src}`, 'mansion manifest');
      }
    }
  }
  for (const { source, destination } of runtimeAssetDirectories(target)) {
    const sourceRoot = resolve(projectRoot, source);
    for (const file of await listFiles(sourceRoot)) requireFile(`${destination}/${relative(sourceRoot, file)}`, 'runtime asset profile');
  }
  return errors;
}

if (isMain(import.meta.url)) {
  const target = process.argv[2] ?? 'game';
  const errors = await validateBuildOutput(target, process.argv[3] ? resolve(process.argv[3]) : undefined);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Build output check passed: ${target}`);
}
