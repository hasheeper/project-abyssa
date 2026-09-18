import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';

/** @param {string} path */
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
/** @param {string} path */
const css = path => postcss.parse(read(path));
const tokens = JSON.parse(read('src/shared/ui/motion/tokens.json'));
const boardPath = 'src/shared/ui/motion/page-board.css';
const modalPath = 'src/shared/ui/motion/modal-tokens.css';
/** @param {import('postcss').Root|import('postcss').AtRule} root @param {string} selector @param {string} prop */
const values = (root, selector, prop) => {
  /** @type {string[]} */
  const found = [];
  root.walkRules(selector, rule => { rule.walkDecls(prop, decl => { found.push(decl.value); }); });
  return found;
};
const preset = '--abyssa-motion-page-board-enter';

test('motion:check verifies all generated preset styles against one JSON source', () => {
  execFileSync(process.execPath, [new URL('../../scripts/sync-motion-tokens.mjs', import.meta.url).pathname], { stdio: 'pipe' });
  const board = css(boardPath), t = tokens.pageBoard;
  assert.deepEqual(values(board, ':root, [data-ui-motion="full"]', preset), [
    `abyssa-page-board-settle ${t.settleMs}ms cubic-bezier(${t.settleEase.join(', ')}) both,\n    abyssa-ui-appear ${t.appearMs}ms cubic-bezier(${t.appearEase.join(', ')}) both`,
    'none', // System reduced motion overrides the default.
  ]);
  assert.deepEqual(values(board, '[data-ui-motion="reduced"]', preset), ['none']);
  /** @type {Record<string,import('postcss').AtRule>} */
  const frames = {};
  board.walkAtRules('keyframes', rule => { frames[rule.params] = rule; });
  assert.deepEqual(Object.keys(frames), ['abyssa-page-board-settle', 'abyssa-ui-appear']);
  assert.deepEqual(values(frames['abyssa-page-board-settle'], 'from', 'translate'), [`0 -${t.distancePx}px`]);
  assert.deepEqual(values(frames['abyssa-page-board-settle'], 'to', 'translate'), ['0 0']);
  assert.deepEqual(values(frames['abyssa-ui-appear'], 'from', 'opacity'), ['0']);
  assert.deepEqual(values(frames['abyssa-ui-appear'], 'to', 'opacity'), ['1']);
});

test('the three real pages opt into shared board motion without retaining duplicate keyframes', () => {
  const consumers = [
    ['character-status/character-motion.css', '.character-status-app__main[data-character-intro="playing"] .abyssa-character-screen', 'character-status/CharacterBoardScreen.tsx'],
    ['shop/shop-motion.css', '.shop-counter-page[data-shop-intro="playing"]', 'shop/ShopCounter.tsx'],
    ['map/map-motion.css', '.map-board[data-map-intro="playing"]', 'map/route.tsx'],
  ];
  for (const [path, selector, entry] of consumers) {
    const source = read(`src/apps/${path}`);
    assert.deepEqual(values(postcss.parse(source), selector, 'animation'), [`var(${preset})`]);
    assert.doesNotMatch(source, /(?:character|shop|map)-board-(?:settle|appear)/);
    assert.match(read(`src/apps/${entry}`), /import "\.\.\/\.\.\/shared\/ui\/motion\/page-board\.css"/);
  }
  assert.match(read('src/shared/ui/styles/index.css'), /@import "\.\.\/motion\/page-board\.css"/);
  // These child fades reuse the action, not the main board's duration/delay.
  assert.deepEqual(values(css('src/apps/shop/shop-motion.css'), '.shop-counter-page[data-shop-intro="playing"] .shop-counter__balances', 'animation'), ['abyssa-ui-appear 340ms 480ms ease-out both']);
  assert.deepEqual(values(css('src/apps/map/map-motion.css'), '.map-board[data-map-intro="playing"] .abyssa-map-scene', 'animation'), ['abyssa-ui-appear 540ms 180ms ease-out both']);
});

test('existing page completion clocks still outlast the shared board and local CSS groups', () => {
  /** @type {[string,string,string,RegExp][]} */
  const pages = [
    ['character-status', 'character-motion.css', 'useCharacterIntro.ts', /CHARACTER_INTRO_END_MS = (\d+)/],
    ['shop', 'shop-motion.css', 'useShopIntro.ts', /SHOP_INTRO_END_MS = (\d+)/],
    ['map', 'map-motion.css', 'map-landmark-intro.ts', /MAP_INTRO_DURATION_MS = (\d+)/],
  ];
  for (const [page, style, clock, pattern] of pages) {
    const end = Number(read(`src/apps/${page}/${clock}`).match(pattern)?.[1]);
    assert.ok(end > Math.max(tokens.pageBoard.settleMs, tokens.pageBoard.appearMs), page);
    css(`src/apps/${page}/${style}`).walkDecls('animation', decl => {
      const times = [...decl.value.matchAll(/(\d+)ms/g)].map(match => Number(match[1]));
      assert.ok(times.reduce((sum, time) => sum + time, 0) < end, `${page}: ${decl.value}`);
    });
  }
});

test('manor body and chrome consume generated timing while the default surface remains opt-in', () => {
  const generated = css(modalPath), actual = css('src/shared/ui/motion/modal-motion.css'), t = tokens.manorWindow;
  const selector = '.abyssa-modal[data-ui-motion-preset="manor"]';
  for (const region of ['body', 'chrome']) {
    assert.deepEqual(values(generated, selector, `--abyssa-motion-manor-${region}-enter`), [
      `manor-window-contents-in ${t[`${region}Ms`]}ms ${t[`${region}DelayMs`]}ms cubic-bezier(${t.contentEase.join(', ')}) backwards`,
    ]);
  }
  assert.deepEqual(values(generated, selector, '--abyssa-motion-manor-content-distance'), [`${t.contentDistancePx}px`]);
  assert.deepEqual(values(actual, `${selector} .abyssa-modal__body`, 'animation'), ['var(--abyssa-motion-manor-body-enter)']);
  assert.deepEqual(values(actual, `${selector} :is(.abyssa-modal__head, .abyssa-modal__foot, .abyssa-modal__navigation)`, 'animation'), ['var(--abyssa-motion-manor-chrome-enter)']);
  assert.match(read('src/shared/ui/motion/UiModal.tsx'), /import "\.\/modal-tokens\.css"/);
});

test('component-library previews call the actual presets, with normal and reduced variants', () => {
  const story = read('src/shared/ui/motion/UiMotion.stories.tsx');
  assert.match(story, /animation: "var\(--abyssa-motion-page-board-enter\)"/);
  assert.match(story, /motionPreset=\{preset\}/);
  for (const name of ['PageBoard', 'PageBoardReduced', 'Manor', 'ManorReduced']) assert.ok(story.includes(`export const ${name}: Story`));
  assert.doesNotMatch(story, /@keyframes|\.animate\(/);
});
