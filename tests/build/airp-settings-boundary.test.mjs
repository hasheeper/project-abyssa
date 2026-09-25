import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** @param {string} path */
const read = path => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
test('current AIRP windows use the shared Settings instead of embedding API forms', () => {
  for (const path of ['game-client/airp-director/DirectorControls.tsx', 'game-client/airp-game/AirpGameGate.tsx',
    'game-client/airp-generation/DirectControls.tsx', 'game-client/AirpPoolPanel.tsx', 'game-client/airp-generation/GenerationWorkbench.tsx']) {
    const source = read(path);
    assert.doesNotMatch(source, /DirectAiSettings|ModelConnectionFields|type="password"|type="url"/, path);
    assert.match(source, /AiSettingsButton|useAiSettingsScene/, path);
  }
  assert.match(read('game-client/settings/sections/AiServiceSection.tsx'), /<DirectAiSettings/);
  assert.match(read('game-client/airp-generation/GenerationWorkbench.tsx'), /effectiveAiConnection\(config\)/);
});

test('connection Save reuses the Settings footer and shared button instead of a new opaque panel', () => {
  const settings = read('game-client/settings/SettingsPanel.tsx');
  assert.match(settings, /footer=\{<>\{shownTab === "ai" && <AiConnectionStorage\//);
  assert.match(read('game-client/settings/sections/AiServiceSection.tsx'), /fixedR8 saveInFooter/);
  const storage = read('game-client/airp-generation/AiConnectionStorage.tsx');
  assert.match(storage, /<RpgHexButton className="airp-settings-save"/);
  assert.doesNotMatch(storage, /解锁|确认口令|type="password"/);
  const css = read('game-client/airp-generation/direct-settings.css');
  assert.doesNotMatch(css, /position:\s*sticky/);
  assert.doesNotMatch(css, /\.airp-settings-storage\s*\{[^}]*background:/);
});
