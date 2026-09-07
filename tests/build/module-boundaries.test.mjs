import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkModuleBoundaries } from '../../scripts/lib/module-boundaries.mjs';

/** @param {import('node:test').TestContext} t @param {Record<string, string>} files */
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'abyssa-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}

test('accepts deterministic helpers, native clone, fields and locally bound window', t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export { apply } from "./rules";',
    'src/game-core/rules.ts': `type Effect = { window: string }; export function apply(window: Effect) { return structuredClone({ window: window.window, n: Math.floor(2.4) }); }`,
    'src/apps/battle/engine.ts': 'export * from "../../game-core";'
  });
  assert.deepEqual(checkModuleBoundaries(root).violations, []);
});

const cases = [
  ['React', 'import { useState } from "react";', 'core-import'],
  ['host alias', 'import type { Pipeline } from "@host/contracts";', 'core-import'],
  ['source alias', 'export * from "@/apps/a/state";', 'core-import'],
  ['Node IO', 'import { readFileSync } from "node:fs";', 'core-import'],
  ['dynamic import', 'const p = "./rules"; import(p);', 'core-import'],
  ['require', 'const x = require("./rules");', 'core-environment'],
  ['TS require', 'import x = require("node:fs");', 'core-import'],
  ['window', 'export const x = window.location;', 'core-environment'],
  ['document', 'export const x = document.body;', 'core-environment'],
  ['DOM type', 'export type X = Pick<Storage, "getItem">;', 'core-environment'],
  ['fetch', 'export const f = fetch;', 'core-environment'],
  ['timer', 'setTimeout(() => {}, 1);', 'core-environment'],
  ['clock', 'export const t = Date.now();', 'core-environment'],
  ['new clock', 'export const t = new Date();', 'core-environment'],
  ['random', 'export const n = Math.random();', 'core-environment'],
  ['computed random', 'export const n = Math["random"]();', 'core-environment'],
  ['dynamic Math', 'const name = "random"; export const n = Math[name]();', 'core-environment'],
  ['Math alias', 'const { random } = Math; export const n = random();', 'core-environment'],
  ['global alias', 'const w = globalThis; export const x = w["fetch"];', 'core-environment'],
  ['process env', 'export const x = process.env.X;', 'core-environment'],
  ['Vite env', 'export const x = import.meta.env.MODE;', 'core-environment'],
  ['shadow is not global exemption', 'function f(window: number) { return window; } export const x = window.location;', 'core-environment'],
  ['type import from UI', 'import type { X } from "../shared/ui/x";', 'ownership'],
  ['type query from UI', 'type X = import("../shared/ui/x").X;', 'ownership'],
  ['type re-export from UI', 'export type { X } from "../shared/ui/x";', 'ownership'],
  ['asset', 'import "./art.css";', 'core-dependency'],
  ['missing dependency', 'export * from "./missing";', 'core-dependency'],
  ['test dependency', 'export * from "./testing/fixture";', 'core-dependency'],
  ['JSX', 'export const element = <div />;', 'core-environment']
];
for (const [name, source, code] of cases) test(`rejects ${name} with the expected boundary reason`, t => {
  const root = fixture(t, {
    'src/game-core/index.ts': source,
    'src/game-core/rules.ts': 'export const value = 1;',
    'src/game-core/testing/fixture.ts': 'export const x = 2;',
    'src/game-core/art.css': 'body {}',
    'src/shared/ui/x.ts': 'export type X = string;'
  });
  const result = checkModuleBoundaries(root);
  assert.ok(result.violations.some(v => v.file === 'src/game-core/index.ts' && v.code === code), JSON.stringify(result));
  assert.ok(!result.violations.some(v => v.code === 'source-parse'), JSON.stringify(result));
});

test('rejects a type-only cycle', t => {
  const root = fixture(t, {
    'src/game-core/a.ts': 'import type { B } from "./b"; export type A = B[];',
    'src/game-core/b.ts': 'import type { A } from "./a"; export type B = A[];'
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'core-cycle'));
});

test('rejects an empty core instead of passing vacuously', t => {
  assert.ok(checkModuleBoundaries(fixture(t, {})).violations.some(v => v.code === 'empty-core'));
});

test('rejects core hidden behind a UI public barrel', t => {
  const root = fixture(t, {
    'src/index.ts': 'export * from "./bridge";',
    'src/bridge.ts': 'export * from "./game-core";',
    'src/game-core/index.ts': 'export const x = 1;'
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'ui-core-dependency'));
});

test('resolves symlinks before allowing a core dependency', t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export * from "./link";',
    'src/apps/a/state.ts': 'export const x = 1;'
  });
  symlinkSync(join(root, 'src/apps/a/state.ts'), join(root, 'src/game-core/link.ts'));
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'ownership'));
});

test('rejects a sibling directory also named game-core outside the repository', t => {
  const outer = fixture(t, {
    'project/src/game-core/index.ts': 'export * from "../../../game-core/external";',
    'game-core/external.ts': 'export const x = 1;'
  });
  const result = checkModuleBoundaries(join(outer, 'project'));
  assert.ok(result.violations.some(v => v.code === 'ownership'));
  assert.ok(result.violations.some(v => v.code === 'core-dependency'));
});

test('preserves app/tool/shared/content and legacy-root restrictions', t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export const x = 1;',
    'src/apps/a/index.ts': 'import "../b/index"; import "../../tools/editor/index";',
    'src/apps/b/index.ts': 'export const x = 1;',
    'src/tools/editor/index.ts': 'import "../../apps/b/index";',
    'src/shared/x.ts': 'import "../content/x"; import "../game-core";',
    'src/content/x.ts': 'import "../shared/ui/x";',
    'src/shared/ui/x.ts': 'export const x = 1;',
    'src/battle/old.ts': 'export const x = 1;'
  });
  const violations = checkModuleBoundaries(root).violations;
  assert.equal(violations.filter(v => v.code === 'ownership').length, 6);
  assert.equal(violations.filter(v => v.code === 'legacy-root').length, 1);
});

test('allows explicit game composition and type-only Catalog contracts', t => {
  const root = fixture(t, {
    'src/game-core/contracts/index.ts':'export type Catalog = { id: string };',
    'src/game-core/battle/index.ts':'export const dispatch = () => 1;',
    'src/content/gameplay/legacy/catalog.ts':'import type { Catalog } from "../../../game-core/contracts"; export const c: Catalog = {id:"v1"};',
    'src/game-application/index.ts':'import { dispatch } from "../game-core/battle"; export const run = dispatch;',
    'src/game-infrastructure/storage/memory.ts':'import type * as Port from "../../game-application"; export type P = typeof Port;',
    'src/game-runtime/browser.ts':'import "../game-application"; import "../game-infrastructure/storage/memory"; import "../content/gameplay/legacy/catalog";',
    'src/apps/battle/engine.ts':'export * from "../../game-runtime/browser";'
  });
  assert.deepEqual(checkModuleBoundaries(root).violations, []);
});

for (const [name, file, source] of [
  ['application IO','src/game-application/index.ts','export const io = fetch;'],
  ['application concrete content','src/game-application/index.ts','import "../content/gameplay/a";'],
  ['application deep core','src/game-application/index.ts','import "../game-core/private";'],
  ['application adapter','src/game-application/index.ts','import "../game-infrastructure/storage/a";'],
  ['content runtime core','src/content/gameplay/a.ts','import "../../game-core/contracts";'],
  ['content presentation','src/content/gameplay/a.ts','import "../../shared/ui";'],
  ['adapter business rules','src/game-infrastructure/storage/a.ts','import "../../game-core/private";'],
  ['shared service leak','src/shared/ui.ts','import "../game-application";']
]) test(`rejects ${name}`, t => {
  const root = fixture(t, {
    'src/game-core/contracts/index.ts':'export type C = string;',
    'src/game-core/private.ts':'export const x = 1;',
    'src/game-application/index.ts':'export const x = 1;',
    'src/game-infrastructure/storage/a.ts':'export const x = 1;',
    'src/content/gameplay/a.ts':'export const x = 1;',
    'src/shared/ui.ts':'export const x = 1;',
    [file]:source
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.file === file && ['ownership','core-environment'].includes(v.code)));
});


test('rejects application cycles including type-only edges', t => {
  const root = fixture(t, {
    'src/game-core/contracts/index.ts': 'export type Id = string;',
    'src/game-application/a.ts': 'export type { B } from "./b"; export type A = string;',
    'src/game-application/b.ts': 'export type { A } from "./a"; export type B = string;'
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'core-cycle' && v.file.startsWith('src/game-application/')));
});

test('allows client composition and public contract types', t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export type X = string;',
    'src/game-runtime/browser.ts': 'export const create = () => 1;',
    'src/game-client/session.ts': 'import { create } from "../game-runtime/browser"; import type { X } from "../game-core"; export const session = create();',
    'src/apps/battle/main.tsx': 'import "../../game-client/session";'
  });
  assert.deepEqual(checkModuleBoundaries(root).violations, []);
});
for (const [file, source] of [
  ['src/game-client/session.ts', 'import "../game-infrastructure/storage/memory";'],
  ['src/game-client/session.ts', 'import "../game-core";'],
  ['src/game-client/session.ts', 'import "../apps/battle/main";'],
  ['src/game-runtime/browser.ts', 'import "../game-client/session";'],
  ['src/shared/ui.ts', 'import "../game-client/session";'],
]) test(`rejects client ownership leak: ${file} ${source}`, t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export const x = 1;',
    'src/game-runtime/browser.ts': 'export const x = 1;',
    'src/game-client/session.ts': 'export const x = 1;',
    'src/game-infrastructure/storage/memory.ts': 'export const x = 1;',
    'src/apps/battle/main.tsx': 'export const x = 1;',
    [file]: source
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'ownership'));
});
for (const syntax of ['export * from', 'export { dispatch as hidden } from', 'import']) test(`rejects legacy mutation hidden through ${syntax}`, t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export const x = 1;',
    'src/apps/battle/main.tsx': 'import "./bridge";',
    'src/apps/battle/bridge.ts': `${syntax} "../../game-runtime/legacy-battle";`,
    'src/game-runtime/legacy-battle.ts': 'export const dispatch = () => 1;'
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'production-legacy-write'));
});

test('production cannot bypass the mutation boundary through a testing facade', t => {
  const root = fixture(t, {
    'src/game-core/index.ts': 'export const x = 1;',
    'src/apps/battle/main.tsx': 'import "../../game-runtime/testing/helper";',
    'src/game-runtime/testing/helper.ts': 'export const fixture = 1;'
  });
  assert.ok(checkModuleBoundaries(root).violations.some(v => v.code === 'production-test-dependency'));
});
