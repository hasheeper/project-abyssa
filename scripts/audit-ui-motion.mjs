import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { parse } from '@babel/parser';
import postcss from 'postcss';
import { isMain, listFiles } from './lib/files.mjs';
import { projectRoot } from '../config/paths.mjs';

/** @typedef {{name:string, path:string, line:number, scopes:string[], protected:boolean, signature:string}} Definition */
/** @typedef {Record<string, {file:string, css?:string[], imports?:string[], dynamicImports?:string[]}>} Manifest */
/** @param {string} value */
const words = value => value.match(/[a-zA-Z_][\w-]*/g) ?? [];
/** @param {string} path */
const production = path => /\.(css|[jt]sx?)$/.test(path) && !/(?:\.test\.|\.spec\.|\.stories\.|\/(?:testing|tools)\/)/.test(path);
/** @param {string} path */
const protectedPath = path => /\/(?:branding|title|menu|battle|dice|rp|adv|prologue)\/|(?:weather|sky|emotion|actor-performance|mansion-motion|first-morning|story-item|styles\/rp-)/.test(path);
// rp.css imports its reduced replacements last, across separate source files.
/** @type {Record<string,string>} */
const rpReducedPairs = {
  'abyssa-rp-node-pop': 'src/shared/ui/styles/rp-bubble-effects.css',
  'abyssa-rp-message-in': 'src/shared/ui/styles/rp-message-layout.css',
  'abyssa-rp-rule-in': 'src/shared/ui/styles/rp-message-layout.css',
  'abyssa-rp-avatar-pop': 'src/shared/ui/styles/rp-message-layout.css',
};
/** @param {import('postcss').ChildNode} node */
function context(node) {
  const scopes = [];
  /** @type {import('postcss').Node|undefined} */
  let p = node.parent;
  for (; p; p = p.parent) if (p.type === 'atrule') {
    const rule = /** @type {import('postcss').AtRule} */ (p);
    scopes.unshift(`@${rule.name} ${rule.params}`);
  }
  return scopes;
}
/** @param {import('postcss').ChildNode} node @returns {unknown} */
function structure(node) {
  if (node.type === 'comment') return null;
  if (node.type === 'decl') return [node.prop, node.value.replace(/\s+/g, ' ').trim(), !!node.important];
  return [node.type, node.type === 'rule' ? node.selector.replace(/\s+/g, ' ').trim() : node.params,
    (node.nodes ?? []).map(structure).filter(Boolean)];
}

/** Conservative, read-only inventory. Candidates are never deletion decisions.
 * @param {{path:string, source:string}[]} files */
export function inspectMotionSources(files) {
  /** @type {Definition[]} */
  const definitions = [];
  const references = new Set();
  let cssFiles = 0, motionCssFiles = 0;
  for (const { path, source } of files.filter(file => production(file.path))) {
    if (path.endsWith('.css')) {
      cssFiles++;
      const root = postcss.parse(source, { from: path });
      let hasMotion = false;
      root.walkAtRules(/^(?:-webkit-)?keyframes$/, node => {
        hasMotion = true;
        definitions.push({ name: node.params.replace(/^['"]|['"]$/g, ''), path, line: node.source?.start?.line ?? 0,
          scopes: context(node), protected: protectedPath(path), signature: JSON.stringify((node.nodes ?? []).map(structure).filter(Boolean)) });
      });
      root.walkDecls(node => {
        if (/^(?:-webkit-)?animation(?:-|$)/.test(node.prop)) hasMotion = true;
        // Custom properties may carry the entire shorthand, including var fallbacks.
        if (/^(?:(?:-webkit-)?animation(?:-|$)|--)/.test(node.prop)) words(node.value).forEach(word => references.add(word));
      });
      if (hasMotion) motionCssFiles++;
    } else {
      // Comments and identifiers aren't evidence; strings also cover animationName
      // assignments and generated DOM. Dynamic expressions remain an audit limit.
      const ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
      /** @param {unknown} value */
      const walk = value => {
        if (!value || typeof value !== 'object') return;
        const node = /** @type {import('@babel/types').Node} */ (value);
        if (node.type === 'StringLiteral') words(node.value).forEach(word => references.add(word));
        if (node.type === 'TemplateElement') words(node.value.raw).forEach(word => references.add(word));
        for (const [key, child] of Object.entries(node)) if (!['loc', 'comments', 'tokens'].includes(key)) {
          if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child);
        }
      };
      walk(ast.program);
    }
  }
  /** @param {Definition} value */
  const site = ({ signature, ...definition }) => definition;
  /** @param {'name'|'signature'} key */
  const groupBy = key => {
    /** @type {Map<string,Definition[]>} */
    const groups = new Map();
    for (const definition of definitions) {
      const value = definition[key];
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value)?.push(definition);
    }
    return [...groups.values()];
  };
  /** @type {Omit<Definition,'signature'>[][]} */
  const allowedReduced = [];
  /** @type {Omit<Definition,'signature'>[][]} */
  const duplicateNames = [];
  for (const group of groupBy('name').filter(group => group.length > 1)) {
    /** @param {Definition} item */
    const reduced = item => item.scopes.some(scope => /^@media\b/.test(scope) && /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(scope));
    // Exempt a single same-file pair or an explicitly verified RP pair only.
    const normal = group.find(item => !reduced(item)), replacement = group.find(reduced);
    const knownRp = normal?.path === rpReducedPairs[group[0].name] && replacement?.path === 'src/shared/ui/styles/rp-motion.css';
    const intentional = group.length === 2 && group.filter(reduced).length === 1 && (group[0].path === group[1].path || knownRp);
    (intentional ? allowedReduced : duplicateNames).push(group.map(site));
  }
  return {
    counts: { cssFiles, motionCssFiles, keyframes: definitions.length, names: new Set(definitions.map(d => d.name)).size },
    unreferencedCandidates: definitions.filter(d => !references.has(d.name)).map(site),
    duplicateNames, allowedReduced,
    identicalBodyCandidates: groupBy('signature').filter(group => new Set(group.map(d => d.name)).size > 1).map(group => group.map(site)),
    limitations: 'Source literals only, not selector coverage, final cascade, execution or FPS. Dynamic expressions may evade reference detection. Identical bodies can have distinct owners/timing. Never auto-purge candidates.',
  };
}

/** Static imports only: do not charge every lazy route to a single page.
 * @param {Manifest} manifest @param {string[]} roots */
export function manifestFiles(manifest, roots) {
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {Set<string>} */
  const files = new Set();
  /** @param {string} key */
  const visit = key => {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw Error(`Unknown manifest key: ${key}`);
    visited.add(key);
    if (/\.(?:js|css)$/.test(chunk.file)) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  roots.forEach(visit);
  return [...files].sort();
}
/** @param {string} directory */
export async function inspectMotionBuild(directory) {
  /** @type {Manifest} */
  const manifest = JSON.parse(await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'));
  const routes = Object.keys(manifest).filter(key => /^src\/apps\/[^/]+\/route\.tsx$/.test(key)).sort();
  const entry = manifestFiles(manifest, ['index.html']);
  /** @type {Map<string,{bytes:number,gzipBytes:number,sha256:string}>} */
  const assets = new Map();
  /** @param {string[]} files */
  const measure = async files => {
    const result = { jsBytes: 0, cssBytes: 0, jsGzipBytes: 0, cssGzipBytes: 0, files };
    for (const file of files) {
      if (!assets.has(file)) {
        const absolute = resolve(directory, file);
        if (!absolute.startsWith(`${resolve(directory)}/`)) throw Error(`Unsafe manifest file: ${file}`);
        const data = await readFile(absolute);
        assets.set(file, { bytes: data.length, gzipBytes: gzipSync(data, { level: 9 }).length, sha256: createHash('sha256').update(data).digest('hex') });
      }
      const data = assets.get(file), type = file.endsWith('.css') ? 'css' : 'js';
      if (!data) throw Error(`Missing measured asset: ${file}`);
      result[`${type}Bytes`] += data.bytes;
      result[`${type}GzipBytes`] += data.gzipBytes;
    }
    return result;
  };
  /** @type {Record<string,{cold:Awaited<ReturnType<typeof measure>>,additionalToShell:Awaited<ReturnType<typeof measure>>,deferred:string[]}>} */
  const pages = {};
  for (const route of routes) {
    const cold = manifestFiles(manifest, ['index.html', route]);
    pages[route.split('/')[2]] = { cold: await measure(cold), additionalToShell: await measure(cold.filter(file => !entry.includes(file))),
      deferred: manifest[route].dynamicImports ?? [] };
  }
  return { shell: await measure(entry), pages, assets: Object.fromEntries([...assets].sort()),
    limitations: 'gzip level 9 per file, deduplicated static-import closures. Cold = shell + requested route, not all dynamic routes. Excludes images/fonts/data and later optional imports; not measured network transfer.' };
}
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--json', '--build'].includes(arg))) throw Error('Usage: node scripts/audit-ui-motion.mjs [--json] [--build]');
  const files = await Promise.all((await listFiles(resolve(projectRoot, 'src'))).filter(production).map(async path => ({
    path: relative(projectRoot, path).replaceAll('\\', '/'), source: await readFile(path, 'utf8'),
  })));
  const report = { source: inspectMotionSources(files), ...(args.includes('--build') ? { build: await inspectMotionBuild(resolve(projectRoot, 'dist/game')) } : {}) };
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('UI motion audit — read-only candidates, NEVER automatic deletion');
    console.log(report.source.counts);
    for (const key of /** @type {const} */ (['unreferencedCandidates', 'duplicateNames', 'allowedReduced', 'identicalBodyCandidates'])) console.log(`${key}: ${JSON.stringify(report.source[key])}`);
    if (report.build) for (const [page, value] of Object.entries(report.build.pages)) console.log(`${page}: cold gzip JS ${value.cold.jsGzipBytes} / CSS ${value.cold.cssGzipBytes} bytes; additional-to-shell JS ${value.additionalToShell.jsGzipBytes} / CSS ${value.additionalToShell.cssGzipBytes}`);
    console.log(report.source.limitations);
  }
}
