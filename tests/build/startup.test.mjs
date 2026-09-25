import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { productionAssets, developmentAssets, cachedDevelopmentManifest } from '../../config/vite/game-startup.mjs';
import { resolveTarget } from '../../config/targets.mjs';

test('release asset manifest covers copied art and chunks with content revisions, excluding itself and source maps', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-startup-'));
  t.after(() => rm(root, {recursive:true,force:true}));
  await mkdir(resolve(root,'assets'));await mkdir(resolve(root,'character-art'));
  for(const [name,body] of [['index.html','home'],['assets/page.js','page'],['assets/font.woff2','font'],['character-art/base.png','image'],['assets/page.js.map','map'],['game-assets.json','manifest'],['game-cache.js','worker']]) await writeFile(resolve(root,name),body);
  const first=await productionAssets(root);
  assert.deepEqual(first.map(a=>a.url).sort(),['./assets/font.woff2','./assets/page.js','./character-art/base.png','./index.html']);
  assert(first.findIndex(a=>a.url==='./assets/page.js') < first.findIndex(a=>a.url==='./character-art/base.png'));
  await writeFile(resolve(root,'character-art/base.png'),'new image');
  const next=await productionAssets(root);
  assert.equal(next.find(a=>a.url==='./assets/font.woff2')?.revision,first.find(a=>a.url==='./assets/font.woff2')?.revision);
  assert.notEqual(next.find(a=>a.url==='./character-art/base.png')?.revision,first.find(a=>a.url==='./character-art/base.png')?.revision);
});
test('development covers the prologue glob, dynamic expression layers and local fonts without source PNGs', async () => {
  const assets=await developmentAssets(resolveTarget('game'));
  assert(assets.some(a=>a.url.endsWith('/01-cathedral.webp')));
  assert(assets.some(a=>a.url.endsWith('/abyssa/eyes_6.png')));
  assert(assets.some(a=>a.url.endsWith('.woff2')));
  assert(!assets.some(a=>a.url.includes('/sources/')));
  assert(!assets.some(a=>a.url.endsWith('/composite-reference.png') || a.url.endsWith('/layers/layer-21.png')));
  assert(assets.some(a=>a.url.endsWith('/composite-materials-v1.png')));
  assert(assets.some(a=>a.url.endsWith('/layers/layer-21-materials-v1.png')));
  assert(assets.findIndex(a=>a.url.includes('/cg-b-3.')) < assets.findIndex(a=>a.url.includes('/battle/')));
  assert.equal(new Set(assets.map(a=>a.url)).size,assets.length);
});

test('development snapshots coalesce requests, invalidate changes and retry errors', async () => {
  let calls=0;
  const cache=cachedDevelopmentManifest(async()=>++calls);
  const first=cache.read();assert.equal(first,cache.read());
  assert.equal(await first,1);assert.equal(await cache.read(),1);
  cache.invalidate();assert.equal(await cache.read(),2);
  let failing=true;
  const retries=cachedDevelopmentManifest(async()=>{if(failing)throw Error('read failed');return 'ok';});
  await assert.rejects(retries.read());failing=false;assert.equal(await retries.read(),'ok');
});

test('release mansion filtering follows the emitted manifest instead of mutable source art', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'abyssa-mansion-manifest-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(resolve(root,'mansion-map/layers'),{recursive:true});
  for(const name of ['layers/runtime.png','layers/hidden.png','layers/editor.png','composite-reference.png','composite-materials-v1.png']) {
    await writeFile(resolve(root,'mansion-map',name),name);
  }
  await writeFile(resolve(root,'mansion-map/manifest-materials-v1.json'),JSON.stringify({layers:[
    {visible:true,src:'layers/runtime.png'},{visible:false,src:'layers/hidden.png'},
  ]}));
  const urls=(await productionAssets(root)).map(a=>a.url);
  assert.deepEqual(urls.sort(),['./mansion-map/composite-materials-v1.png','./mansion-map/layers/runtime.png','./mansion-map/manifest-materials-v1.json']);
});
