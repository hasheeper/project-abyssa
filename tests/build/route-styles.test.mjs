import test from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { gamePageStyles } from '../../config/vite/game-page-styles.mjs';

test('page CSS is isolated without changing selector specificity, media rules or keyframes', async () => {
  const result = await postcss([gamePageStyles()]).process(':root {--ink:red} html[data-scene-transition] .panel,body{color:red} @media(min-width:1px){.panel:hover{opacity:1}} @keyframes bob{from{opacity:0}to{opacity:1}}', {from:'/repo/src/apps/map/map.css'});
  assert.match(result.css, /:root:where\(\[data-game-page="map"\]\)/);
  assert.match(result.css, /html:where\(\[data-game-page="map"\]\)\[data-scene-transition\]/);
  assert.match(result.css, /:where\(html\[data-game-page="map"\]\) body/);
  assert.match(result.css, /@keyframes bob\{from\{opacity:0\}to\{opacity:1\}\}/);
  const shared = '.abyssa-frame {padding:4px}';
  assert.equal((await postcss([gamePageStyles()]).process(shared,{from:'/repo/src/shared/ui/styles/frame.css'})).css,shared);
});
