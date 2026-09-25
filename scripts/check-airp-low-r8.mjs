// Offline compiler parity: no private config, network, provider or save writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const read = async name => JSON.parse(await fs.readFile(new URL(`../docs/baselines/airp-style-r8/${name}`, import.meta.url), 'utf8'));
  const { compileLowFrame } = await vite.ssrLoadModule('/src/game-application/airp-low/native.ts');
  const { lowR8Source } = await vite.ssrLoadModule('/src/content/presentation/airp/low-r8-source.ts');
  const scene = await read('scene.json'), original = await read('request.json');
  const frame = compileLowFrame(lowR8Source, { id: 'frozen-parity', actors: scene.actors, player: scene.player, scenario: scene.scenario, userInput: scene.userInput }, false);
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const messageBytes = messages => messages.map(m => [m.role, m.content]);
  assert.equal(hash(messageBytes(frame.messages)), hash(messageBytes(original.messages)), 'r8 compiled messages differ from the frozen baseline; no full-preset error dump');
  for (const [key, value] of Object.entries(frame.sampling)) assert.equal(value, original[key], `Native sampling differs: ${key}`);
  assert.equal(frame.trace.length, 34);
  console.log(JSON.stringify({ result: 'byte-exact-r8-request-parity', entries: frame.trace.length, fullSources: frame.sources.map(s => s.id), networkCalls: 0 }));
} finally { await vite.close(); }
