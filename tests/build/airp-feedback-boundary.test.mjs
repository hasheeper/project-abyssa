import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** @param {string} path */
const read = path => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
test('operation errors and confirmations use a Stage-level layer and existing dialog', () => {
  for (const path of ['game-client/GameOperationFeedback.tsx', 'game-client/airp-generation/DirectControls.tsx', 'game-client/airp-generation/AiConnectionStorage.tsx']) {
    const source = read(path);
    assert.match(source, /<SceneLayer/);
    assert.match(source, /<ConfirmationDialog/);
  }
  assert.match(read('game-client/settings/AiSettingsButton.tsx'), /<SceneLayer/);
  const error = read('game-client/GameOperationFeedback.tsx');
  assert.doesNotMatch(error, /InlineFeedback|secondaryAction|重新读取 \/ 重试/);
  assert.match(error, /confirmLabel="重新读取" cancelLabel="关闭"/);
});
test('AIRP layout does not repaint shared errors or buttons with ancestor selectors', () => {
  const game = read('game-client/airp-generation/direct-game.css');
  assert.doesNotMatch(game, /body:has\(|\.airp-direct-command|\.airp-direct-action(?=[\s.:{])/);
  assert.doesNotMatch(read('game-client/airp.css'), /\.airp-panel button:not\(\.abyssa-ribbon-button\)/);
  const settings = read('game-client/airp-generation/direct-settings.css');
  assert.doesNotMatch(settings, /\.airp-direct-settings (?:summary|pre|details)[\s:{]/);
});
