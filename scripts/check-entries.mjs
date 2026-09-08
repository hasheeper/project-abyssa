import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { entries, entryClosure } from '../config/entries.mjs';
import { aggregateIds, resolveTarget } from '../config/targets.mjs';
import { projectRoot } from '../config/paths.mjs';
import { isMain, listFiles } from './lib/files.mjs';
import { sourceImports } from './lib/module-boundaries.mjs';
import { visitSource } from './lib/source-ast.mjs';

/** @param {import('../config/types.js').Entry[]} [catalog] @param {string} [root] */
export async function validateEntries(catalog = entries, root = projectRoot) {
  const errors = [];
  const ids = new Set();
  const htmls = new Set();
  for (const entry of catalog) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) errors.push(`Invalid/duplicate entry ID: ${entry.id}`);
    if (!/^[a-z][a-z0-9-]*\.html$/.test(entry.html) || htmls.has(entry.html)) errors.push(`Invalid/duplicate HTML: ${entry.html}`);
    ids.add(entry.id); htmls.add(entry.html);
  }
  for (const html of (await readdir(root)).filter(file => file.endsWith('.html'))) if (html !== 'index.html' && !htmls.has(html)) errors.push(`Unregistered HTML: ${html}`);
  for (const entry of catalog) {
    let closure;
    try { closure = entryClosure([entry.id], catalog); } catch (error) { errors.push(String(error)); continue; }
    const html = resolve(root, entry.kind === 'game' ? 'index.html' : entry.sourceHtml ?? entry.html);
    if (!existsSync(html)) { errors.push(`Missing HTML: ${entry.html}`); continue; }
    const source = await readFile(html, 'utf8');
    const modulePath = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^\"]+)"/.exec(source)?.[1];
    const expectedModule = entry.kind === 'game' ? '/src/game-shell/main.tsx' : `/src/${entry.kind === 'tool' ? 'tools' : 'apps'}/${entry.id}/main.tsx`;
    if (modulePath !== expectedModule || !existsSync(resolve(root, `.${expectedModule}`))) { errors.push(`Invalid module for ${entry.html}: expected ${expectedModule}`); continue; }
    if (entry.kind === 'game' && !existsSync(resolve(root, `src/apps/${entry.id}/route.tsx`))) errors.push(`Missing game route: ${entry.id}`);
    const allowed = new Set((entry.kind === 'game' ? catalog.filter(item => item.kind === 'game') : closure).map(item => item.html));
    if (entry.kind === 'game') allowed.add('index.html');
    for (const file of await navigationSources(resolve(root, `.${expectedModule}`))) {
      visitSource(await readFile(file, 'utf8'), file, node => {
        if (node.type === 'StringLiteral' && typeof node.value === 'string') {
          const destination = /^(?:\.\/)?([\w-]+\.html)(?:[?#].*)?$/.exec(node.value)?.[1];
          if (destination && !allowed.has(destination)) errors.push(`${file}: navigation to ${destination} is not registered for ${entry.id}`);
        }
      });
    }
  }
  return errors;
}

/** Follow production imports so routing hidden in a shared helper is checked too.
 * @param {string} entry @returns {Promise<string[]>}
 */
async function navigationSources(entry) {
  const seen = new Set();
  /** @param {string} file */
  async function visit(file) {
    if (seen.has(file) || !/\.tsx?$/.test(file) || /\.(test|stories|bench)\./.test(file)) return;
    seen.add(file);
    for (const edge of sourceImports(await readFile(file, 'utf8'), file)) {
      if (edge.typeOnly || !edge.specifier?.startsWith('.')) continue;
      const path = resolve(dirname(file), edge.specifier);
      const resolved = [path, path + '.ts', path + '.tsx', path + '/index.ts', path + '/index.tsx'].find(p => /\.tsx?$/.test(p) && existsSync(p));
      if (resolved) await visit(resolved);
    }
  }
  await visit(entry); return [...seen];
}

export async function checkEngineeringBoundaries() {
  const errors = [];
  for (const directory of ['config', 'scripts']) {
    for (const file of (await listFiles(resolve(projectRoot, directory))).filter(file => /\.(mjs|ts)$/.test(file))) {
      visitSource(await readFile(file, 'utf8'), file, node => {
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(String(node.type)) && node.source && typeof node.source === 'object' && 'value' in node.source && typeof node.source.value === 'string') {
          const specifier = node.source.value;
          if (/src\/(apps|tools)\//.test(specifier) || /rp-style-lab\//.test(specifier)) errors.push(`${file}: forbidden engineering dependency ${specifier}`);
        }
      });
    }
  }
  const outputPaths = aggregateIds.map(id => resolveTarget(id).outDir);
  if (new Set(outputPaths).size !== outputPaths.length) errors.push('Duplicate aggregate output path');
  const ports = aggregateIds.filter(id => id !== 'ui').map(id => resolveTarget(id).port);
  if (new Set(ports).size !== ports.length || ports.some(port => entries.some(entry => entry.port === port))) errors.push('Aggregate dev port conflict');
  return errors;
}

if (isMain(import.meta.url)) {
  const errors = [...await validateEntries(), ...await checkEngineeringBoundaries()];
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Entry check passed: ${entries.length} pages; navigation and engineering boundaries checked.`);
}
