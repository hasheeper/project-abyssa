import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { motionAuditOverrides } from '../../scripts/serve-motion-audit.mjs';
import { createArtifactServer } from '../../scripts/serve-built.mjs';

test('local profiling preserves real startup hashes without editing disk artifacts', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-motion-profile-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const game = resolve(root, 'game'); await mkdir(game);
  const html = '<html><head></head><body>QA</body></html>';
  const manifest = {version:'original', development:false, assets:[{url:'./index.html', bytes:html.length, revision:'original'}]};
  const worker = `const GAME_ASSETS = ${JSON.stringify(manifest)};\n// worker integrity logic`;
  await Promise.all([
    writeFile(resolve(game, 'index.html'), html), writeFile(resolve(game, 'game-assets.json'), JSON.stringify(manifest)),
    writeFile(resolve(game, 'game-cache.js'), worker),
  ]);
  const overrides = await motionAuditOverrides(game, '/* passive probe */');
  assert.deepEqual(Object.keys(overrides), ['game/index.html','game/game-assets.json','game/game-cache.js']);
  const measured = JSON.parse(overrides['game/game-assets.json'].toString());
  assert.equal(measured.development, false);
  assert.equal(measured.assets[0].bytes, overrides['game/index.html'].length);
  assert.equal(measured.assets[0].revision, createHash('sha256').update(overrides['game/index.html']).digest('hex'));
  assert.ok(overrides['game/game-cache.js'].toString().startsWith(`const GAME_ASSETS = ${JSON.stringify(measured)};\n`));
  assert.equal(await readFile(resolve(game, 'index.html'), 'utf8'), html);
  assert.equal(await readFile(resolve(game, 'game-cache.js'), 'utf8'), worker);
  assert.deepEqual(JSON.parse(await readFile(resolve(game, 'game-assets.json'), 'utf8')), manifest);
  // Ordinary artifact serving remains byte-identical; QA opt-in changes only the response.
  for (const options of [{}, {overrides}]) {
    const server = createArtifactServer(root, options);
    await new Promise(accept => server.listen(0, '127.0.0.1', () => accept(undefined)));
    try {
      const address = /** @type {import('node:net').AddressInfo} */ (server.address());
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'overrides' in options ? overrides['game/index.html'].toString() : html);
    } finally { await new Promise(accept => server.close(() => accept(undefined))); }
  }
});

test('passive probe records bounded entries/stages and disconnects without scheduling frames', async () => {
  const output = {textContent:'', id:'', type:''};
  /** @type {Map<string,()=>void>} */
  const events = new Map();
  /** @type {FakeObserver[]} */
  const observers = [];
  class FakeObserver {
    static supportedEntryTypes = ['longtask', 'long-animation-frame'];
    disconnected = false;
    /** @param {(list:{getEntries:()=>object[]})=>void} callback */
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  /** @type {FakeMutation[]} */
  const mutations = [];
  class FakeMutation {
    disconnected = false;
    /** @param {(records:{attributeName:string,target:{getAttribute:()=>string}}[])=>void} callback */
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const noScheduling = () => { throw Error('unexpected scheduling'); };
  runInNewContext(await readFile(new URL('../../scripts/lib/motion-audit-probe.js', import.meta.url), 'utf8'), {
    document:{createElement:()=>output, head:{append(){}}, hidden:false, addEventListener(){}, removeEventListener(){}, querySelector(){return null;}},
    performance:{now:()=>42}, location:{hash:'#/shop?save=private-id'},
    PerformanceObserver:FakeObserver, MutationObserver:FakeMutation,
    window:{addEventListener:(/** @type {string} */ type, /** @type {()=>void} */ callback)=>events.set(type,callback)},
    requestAnimationFrame:noScheduling, setTimeout:noScheduling, setInterval:noScheduling,
  });
  mutations[0].callback([{attributeName:'data-shop-intro', target:{getAttribute:()=> 'playing'}}]);
  observers[0].callback({getEntries:() => Array.from({length:305}, (_, i) => ({startTime:i, duration:51}))});
  const report = JSON.parse(output.textContent);
  assert.equal(report.entries.length, 300); assert.equal(report.truncated, true);
  assert.equal(report.stages[0].state, 'playing'); assert.equal(report.stages[0].route, '#/shop');
  events.get('pagehide')?.();
  assert.ok([...observers, ...mutations].every(observer => observer.disconnected));
  assert.equal(JSON.parse(output.textContent).stopped, true);
});
