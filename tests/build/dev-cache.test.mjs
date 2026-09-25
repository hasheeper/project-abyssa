import test from 'node:test';
import assert from 'node:assert/strict';
import { createTargetConfig } from '../../config/vite/create-config.mjs';
import { aggregateIds } from '../../config/targets.mjs';
import { entries } from '../../config/entries.mjs';

test('concurrent targets and AI variants own separate dependency caches', () => {
  const ids = [...aggregateIds, ...entries.map(entry => `entry:${entry.id}`)];
  const directories = ids.flatMap(id => [false, true].map(enableAi => createTargetConfig(id, {enableAi}).cacheDir));
  assert.equal(new Set(directories).size, directories.length);
  const game = createTargetConfig('game').cacheDir;
  const shop = createTargetConfig('entry:new-shop').cacheDir;
  assert.notEqual(game, shop);
  assert.equal(createTargetConfig('game', {port: 5290}).cacheDir, game);
});
