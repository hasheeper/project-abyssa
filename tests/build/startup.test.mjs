import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { productionAssets, developmentAssets } from '../../config/vite/game-startup.mjs';
import { resolveTarget } from '../../config/targets.mjs';

test('release asset manifest covers copied art and chunks with content revisions, excluding itself and source maps', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'abyssa-startup-'));
  t.after(() => rm(root, {recursive:true,force:true}));
  await mkdir(resolve(root,'assets'));await mkdir(resolve(root,'character-art'));
  for(const [name,body] of [['index.html','home'],['assets/page.js','page'],['assets/font.woff2','font'],['character-art/base.png','image'],['assets/page.js.map','map'],['game-assets.json','manifest'],['game-cache.js','worker']]) await writeFile(resolve(root,name),body);
  const first=await productionAssets(root);
  assert.deepEqual(first.map(a=>a.url),['./assets/font.woff2','./assets/page.js','./character-art/base.png','./index.html']);
  await writeFile(resolve(root,'character-art/base.png'),'new image');
  const next=await productionAssets(root);
  assert.equal(next[0].revision,first[0].revision);assert.notEqual(next[2].revision,first[2].revision);
});
test('development covers the prologue glob, dynamic expression layers and local fonts without source PNGs', async () => {
  const assets=await developmentAssets(resolveTarget('game'));
  assert(assets.some(a=>a.url.endsWith('/01-cathedral.webp')));
  assert(assets.some(a=>a.url.endsWith('/abyssa/eyes_6.png')));
  assert(assets.some(a=>a.url.endsWith('.woff2')));
  assert(!assets.some(a=>a.url.includes('/sources/')));
  assert.equal(new Set(assets.map(a=>a.url)).size,assets.length);
});
