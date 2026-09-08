import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { parseSource, visitSource } from './source-ast.mjs';

/** @typedef {{type: string, [key: string]: any}} AstNode */
/** @typedef {{parent: Scope | null, names: Set<string>}} Scope */
/** @typedef {{file: string, line: number, code: string, message: string}} Violation */
/** @typedef {{specifier: string | null, line: number, typeOnly: boolean}} ImportEdge */
const legacyApps = new Set(['battle', 'character-status', 'demo', 'dice', 'mansion', 'map', 'novel', 'rp', 'shop']);
const legacyTools = new Set(['mansion-editor', 'studio']);
const legacyShared = new Set(['components', 'hooks', 'stage', 'styles', 'utils']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const forbiddenGlobals = new Set([
  'window', 'document', 'globalThis', 'global', 'self', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'Storage', 'HTMLElement', 'Element', 'Document', 'Window',
  'fetch', 'WebSocket', 'XMLHttpRequest', 'Worker', 'EventSource', 'ResizeObserver',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'process', 'Buffer', 'console', 'performance', 'crypto', 'Date', 'eval', 'Function'
]);
const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod', 'TSDeclareFunction', 'TSFunctionType']);
/** @param {string} path */
const slash = path => path.split(sep).join('/');
/** @param {string} path */
export const isTestSupport = path => /(?:^|\/)testing\/|\.(?:test|bench|stories)\.[^/]+$/.test(slash(path));

/** @param {string} directory @returns {string[]} */
function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : sourceExtensions.has(extname(path)) ? [path] : [];
  }).sort();
}
/** @param {string} path */
function owner(path) {
  const [root, first, second] = slash(path).split('/');
  if (root !== 'src') return { kind: 'external', name: path };
  if (first === 'game-core') return { kind: 'core', name: first };
  if (first === 'game-application') return { kind: 'application', name: first };
  if (first === 'game-infrastructure') return { kind: 'adapter', name: second };
  if (first === 'game-runtime') return { kind: 'runtime', name: first };
  if (first === 'game-client') return { kind: 'client', name: first };
  if (first === 'game-shell') return { kind: 'shell', name: first };
  if (first === 'apps') return { kind: 'app', name: second };
  if (first === 'tools') return { kind: 'tool', name: second };
  if (['shared', 'content', 'assets'].includes(first)) return { kind: first, name: first };
  if (legacyApps.has(first)) return { kind: 'app', name: first };
  if (legacyTools.has(first)) return { kind: 'tool', name: first };
  if (legacyShared.has(first)) return { kind: 'shared', name: first };
  return { kind: 'infrastructure', name: first };
}
/** @param {string} from @param {string} to */
function ownershipViolation(from, to, typeOnly = false) {
  const a = owner(from), b = owner(to);
  if (a.kind === 'shell') {
    if (['shell', 'shared'].includes(b.kind) || b.kind === 'app' && /\/route\.tsx$/.test(to)) return null;
    return 'game shell may only compose shared services and application route entries';
  }
  const pureTest = isTestSupport(from) && ['core', 'application', 'runtime', 'adapter'].includes(a.kind);
  if (pureTest && ['core', 'application', 'runtime', 'adapter', 'content'].includes(b.kind)) return null;
  if (isTestSupport(from) && a.kind === 'client' && ['runtime', 'application', 'adapter', 'core'].includes(b.kind)) return null;
  if (b.kind === 'client' && !['app', 'client'].includes(a.kind)) return `${a.kind} must not import game-client`;
  if (a.kind === 'client') {
    if (['client', 'runtime', 'shared', 'content', 'assets'].includes(b.kind)) return null;
    if (typeOnly && ['core', 'application'].includes(b.kind) && /\/index\.ts$/.test(to)) return null;
    return 'client must use runtime and public contract types, never apps or concrete adapters';
  }
  if (a.kind === 'core' && b.kind !== 'core') return 'core may only import game-core';
  if (a.kind === 'application' && !['application', 'core'].includes(b.kind)) return 'application may only import its contracts and pure core';
  if (a.kind === 'application' && b.kind === 'core' && !/^src\/game-core\/(?:index\.ts|(?:contracts|battle|session)\/index\.ts)$/.test(to)) return 'application must use public core entry points';
  if (a.kind === 'adapter' && !['adapter', 'application'].includes(b.kind)) return 'adapters must depend on application ports';
  if (a.kind === 'runtime' && !['core', 'application', 'adapter', 'runtime', 'content'].includes(b.kind)) return 'runtime may only compose game services and content';
  if (['shared', 'tool', 'content'].includes(a.kind) && ['application', 'adapter', 'runtime'].includes(b.kind)) return `${a.kind} must not import game services`;
  if (a.kind === 'app' && b.kind === 'core' && !isTestSupport(from) && from !== 'src/apps/battle/engine.ts' && !typeOnly) return 'apps must obtain read-only game views from runtime';
  if (a.kind === 'app' && b.kind === 'adapter') return 'apps must use runtime, not concrete adapters';
  if (from.startsWith('src/content/gameplay/')) {
    if (b.kind === 'content' && to.startsWith('src/content/gameplay/')) return null;
    if (b.kind === 'core' && typeOnly && to === 'src/game-core/contracts/index.ts') return null;
    return 'gameplay content may only import gameplay data and public core contract types';
  }
  if (a.kind === 'app' && b.kind === 'app' && a.name !== b.name) return `app "${a.name}" must not import app "${b.name}"`;
  if (a.kind === 'app' && b.kind === 'tool') return `app "${a.name}" must not import tools`;
  if (a.kind === 'tool' && b.kind === 'app') return `tool "${a.name}" must not import apps`;
  if (a.kind === 'shared' && ['app', 'tool', 'content', 'core'].includes(b.kind)) return `shared must not import ${b.kind}`;
  if (a.kind === 'content') {
    if (['app', 'tool', 'core'].includes(b.kind)) return `content must not import ${b.kind}`;
    if (b.kind === 'shared' && !to.startsWith('src/shared/domain/')) return 'content may only import shared/domain';
  }
  return null;
}
/** @param {string} source @param {string} file @returns {ImportEdge[]} */
export function sourceImports(source, file) {
  /** @type {ImportEdge[]} */
  const edges = [];
  visitSource(source, file, record => {
    const n = /** @type {AstNode} */ (record);
    let sourceNode, typeOnly = false;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(n.type) && n.source) {
      sourceNode = n.source;
      typeOnly = n.importKind === 'type' || n.exportKind === 'type' || (n.specifiers?.length > 0 && n.specifiers.every(/** @param {AstNode} s */ s => s.importKind === 'type' || s.exportKind === 'type'));
    } else if (n.type === 'TSImportType') {
      sourceNode = n.argument; typeOnly = true;
    } else if (n.type === 'TSExternalModuleReference') {
      sourceNode = n.expression;
    } else if (n.type === 'ImportExpression') {
      sourceNode = n.source;
    } else if (n.type === 'CallExpression' && (n.callee?.type === 'Import' || n.callee?.name === 'require')) {
      sourceNode = n.arguments[0] ?? {};
    } else return;
    edges.push({ specifier: sourceNode?.type === 'StringLiteral' ? sourceNode.value : null, line: n.loc?.start.line ?? 1, typeOnly });
  });
  return edges;
}
/** Only AST children; skip locations/comments. @param {AstNode} node @returns {Array<[string, AstNode]>} */
function children(node) {
  return Object.entries(node).flatMap(([key, value]) => {
    if (['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens'].includes(key)) return [];
    return (Array.isArray(value) ? value : [value]).filter(child => child && typeof child.type === 'string').map(child => /** @type {[string, AstNode]} */ ([key, child]));
  });
}
/** Scope-aware checks: a local `window` parameter is not a browser global.
 * @param {string} source @param {string} file @returns {Violation[]}
 */
function environmentViolations(source, file) {
  const ast = /** @type {AstNode} */ (parseSource(source, file));
  /** @type {Map<AstNode, Scope>} */
  const scopes = new Map();
  /** @type {Set<AstNode>} */
  const declarations = new Set();
  /** @param {AstNode | undefined} pattern @param {Scope} scope */
  function bind(pattern, scope) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') { scope.names.add(pattern.name); declarations.add(pattern); }
    else if (pattern.type === 'RestElement') bind(pattern.argument, scope);
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, scope);
    else if (pattern.type === 'ObjectPattern') for (const p of pattern.properties) bind(p.type === 'RestElement' ? p.argument : p.value, scope);
    else if (pattern.type === 'ArrayPattern') for (const p of pattern.elements) bind(p, scope);
    else if (pattern.type === 'TSParameterProperty') bind(pattern.parameter, scope);
  }
  /** @param {AstNode} node @param {Scope} outer */
  function collect(node, outer) {
    if (['FunctionDeclaration', 'ClassDeclaration', 'TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSEnumDeclaration', 'TSDeclareFunction'].includes(node.type)) bind(node.id, outer);
    const newScope = functionTypes.has(node.type) || ['Program', 'BlockStatement', 'CatchClause', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type);
    const scope = newScope ? { parent: outer, names: new Set() } : outer;
    scopes.set(node, scope);
    if (functionTypes.has(node.type)) {
      bind(node.id, scope);
      for (const p of node.params ?? node.parameters ?? []) bind(p, scope);
    }
    if (node.type === 'CatchClause') bind(node.param, scope);
    if (node.type === 'VariableDeclarator') bind(node.id, scope);
    if (['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(node.type)) bind(node.local, scope);
    if (node.type === 'TSTypeParameter') scope.names.add(node.name);
    for (const [, child] of children(node)) collect(child, scope);
  }
  collect(ast, { parent: null, names: new Set() });
  /** @param {AstNode} node */
  function bound(node) {
    for (let scope = scopes.get(node); scope; scope = scope.parent ?? undefined) if (scope.names.has(node.name)) return true;
    return false;
  }
  /** @type {Violation[]} */
  const result = [];
  /** @param {AstNode} node @param {AstNode | null} parent @param {string} key */
  function check(node, parent, key) {
    let reason = '';
    if (node.type === 'MetaProperty' && node.meta?.name === 'import') reason = 'import.meta is environment-dependent';
    if (node.type.startsWith('JSX')) reason = 'JSX belongs to presentation';
    if (node.type === 'Identifier' && !declarations.has(node) && !bound(node)) {
      const isKey = parent && key === 'key' && !parent.computed;
      const isMember = parent && ['MemberExpression', 'OptionalMemberExpression'].includes(parent.type);
      const isProperty = isMember && key === 'property' && !parent.computed;
      const isLabel = key === 'label' || (parent?.type === 'ExportSpecifier' && key === 'exported');
      if (!isKey && !isProperty && !isLabel) {
        if (forbiddenGlobals.has(node.name)) reason = `${node.name} is an environment global`;
        if (node.name === 'Math') {
          const property = isMember && key === 'object' ? (parent.computed ? parent.property.value : parent.property.name) : null;
          if (typeof property !== 'string' || property === 'random') reason = 'Math must use an explicit deterministic member; Math.random/aliases are forbidden';
        }
        if (node.name === 'require') reason = 'require is forbidden in core';
      }
    }
    if (reason) result.push({ file, line: node.loc?.start.line ?? 1, code: 'core-environment', message: reason });
    for (const [childKey, child] of children(node)) check(child, node, childKey);
  }
  check(ast, null, '');
  return result;
}
/** @param {string} importer @param {string} specifier */
function resolveImport(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx'].map(suffix => base + suffix)];
  const found = candidates.find(path => existsSync(path) && statSync(path).isFile());
  return found ? realpathSync(found) : null;
}
/** @param {string} root @returns {{files: number, coreFiles: number, violations: Violation[]}} */
export function checkModuleBoundaries(root) {
  root = realpathSync(root);
  const files = sourceFiles(resolve(root, 'src'));
  /** @type {Violation[]} */
  const violations = [];
  /** @type {Map<string, string[]>} */
  const graph = new Map();
  const coreFiles = files.filter(f => slash(relative(root, f)).startsWith('src/game-core/') && !isTestSupport(f));
  if (!coreFiles.length) violations.push({ file: 'src/game-core', line: 1, code: 'empty-core', message: 'Core production file set must not be empty' });
  for (const file of files) {
    const name = slash(relative(root, file));
    const core = owner(name).kind === 'core' && !isTestSupport(name);
    const pure = ['core', 'application'].includes(owner(name).kind) && !isTestSupport(name);
    const gameplay = name.startsWith('src/content/gameplay/') && !isTestSupport(name);
    const top = name.split('/')[1];
    if (legacyApps.has(top) || legacyTools.has(top) || legacyShared.has(top)) violations.push({ file: name, line: 1, code: 'legacy-root', message: `legacy source root src/${top} is forbidden` });
    if (core && extname(file) !== '.ts') violations.push({ file: name, line: 1, code: 'core-source', message: 'Core production modules must be plain TypeScript' });
    const source = readFileSync(file, 'utf8');
    graph.set(name, []);
    try {
      if (pure || gameplay) violations.push(...environmentViolations(source, name));
      for (const edge of sourceImports(source, name)) {
        const spec = edge.specifier;
        if (!spec?.startsWith('.')) {
          if (pure || gameplay) violations.push({ file: name, line: edge.line, code: 'core-import', message: `Pure game code requires a literal relative import, received ${spec ?? 'dynamic expression'}` });
          continue;
        }
        const target = resolveImport(file, spec);
        const targetName = slash(relative(root, target ?? resolve(dirname(file), spec)));
        if (!isTestSupport(name) && isTestSupport(targetName)) violations.push({ file: name, line: edge.line, code: 'production-test-dependency', message: `${spec}: production must not import test or story support` });
        const reason = ownershipViolation(name, targetName, edge.typeOnly);
        if (reason) violations.push({ file: name, line: edge.line, code: 'ownership', message: `${spec}: ${reason}` });
        if (core && (!target || !targetName.startsWith('src/game-core/') || extname(target) !== '.ts' || isTestSupport(targetName))) violations.push({ file: name, line: edge.line, code: 'core-dependency', message: `${spec}: must resolve to a production TypeScript module inside core` });
        if (pure && !core && (!target || extname(target) !== '.ts' || isTestSupport(targetName))) violations.push({ file: name, line: edge.line, code: 'application-dependency', message: `${spec}: must resolve to production TypeScript` });
        if (target) graph.get(name)?.push(targetName);
      }
    } catch (error) {
      violations.push({ file: name, line: 1, code: 'source-parse', message: String(error) });
    }
  }
  // Type/runtime edges both count. A facade must not hide a cycle or pull core into the UI library.
  const active = new Set(), complete = new Set();
  /** @param {string} name @param {string[]} path */
  function visit(name, path) {
    if (active.has(name)) { violations.push({ file: name, line: 1, code: 'core-cycle', message: [...path, name].join(' -> ') }); return; }
    if (complete.has(name) || !/^src\/game-(?:core|application)\//.test(name) || isTestSupport(name)) return;
    active.add(name);
    for (const next of graph.get(name) ?? []) visit(next, [...path, name]);
    active.delete(name); complete.add(name);
  }
  for (const file of files) if (["core", "application"].includes(owner(slash(relative(root, file))).kind)) visit(slash(relative(root, file)), []);
  for (const entry of ['src/index.ts', 'src/branding.ts', 'src/patterns.ts', 'src/primitives.ts']) {
    const seen = new Set();
    /** @param {string} name */
    function inspect(name) {
      if (seen.has(name)) return;
      seen.add(name);
      if (/^src\/game-(core|application|infrastructure|runtime|client)\//.test(name)) violations.push({ file: entry, line: 1, code: 'ui-core-dependency', message: `UI public closure reaches ${name}` });
      for (const next of graph.get(name) ?? []) inspect(next);
    }
    inspect(entry);
  }
  // Keep legacy roots for migration fixtures, and audit the real lazy route closure.
  for (const entry of ['src/game-shell/main.tsx', ...['title', 'menu', 'map', 'battle', 'mansion', 'shop'].flatMap(id => [`src/apps/${id}/main.tsx`, `src/apps/${id}/route.tsx`])]) {
    const seen = new Set();
    /** @param {string} name */
    function inspect(name) {
      if (seen.has(name) || isTestSupport(name)) return;
      seen.add(name);
      if (name === 'src/apps/battle/engine.ts' || name === 'src/game-runtime/legacy-battle.ts') violations.push({ file: entry, line: 1, code: 'production-legacy-write', message: `Player entry reaches compatibility mutation surface ${name}` });
      for (const next of graph.get(name) ?? []) inspect(next);
    }
    inspect(entry);
  }
  return { files: files.length, coreFiles: coreFiles.length, violations };
}
