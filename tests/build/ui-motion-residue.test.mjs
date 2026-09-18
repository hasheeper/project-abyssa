import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

/** @param {string} path */
const css = path => postcss.parse(readFileSync(new URL(`../../src/apps/${path}`, import.meta.url), 'utf8'));
/** @param {import('postcss').Root} root @param {string} selector @param {string} property */
const declarations = (root, selector, property) => {
  /** @type {string[]} */
  const values = [];
  root.walkRules(selector, rule => { rule.walkDecls(property, decl => { values.push(decl.value); }); });
  return values;
};
/** @param {import('postcss').Root} root */
const keyframes = root => {
  /** @type {string[]} */
  const names = [];
  root.walkAtRules('keyframes', rule => { names.push(rule.params); });
  return names;
};

test('retired mansion and sortie entrances have neither definitions nor callers', () => {
  const roots = [css('mansion/mansion-dialogue.css'), css('mansion/mansion-room-drawer.css'), css('map/sortie/sortie.css'), css('map/map-motion.css')];
  const retired = /mansion-loading|mansion-room-card-in|abyssa-sortie-(?:drawer-in|quest-in-[lr])/;
  for (const root of roots) {
    root.walkAtRules('keyframes', rule => assert.doesNotMatch(rule.params, retired));
    root.walkDecls(/^animation/, decl => assert.doesNotMatch(decl.value, retired));
    root.walkRules(rule => assert.doesNotMatch(rule.selector, /\.mansion-(?:loading|light)(?![\w-])/));
  }
  assert.deepEqual(declarations(roots[3], '.map-panel-layer :is(.abyssa-sortie-roster, .abyssa-sortie-quest)', 'animation'), []);
});

test('mansion drawer keeps its anchor, current entrance and both reduced-motion guards', () => {
  const layout = css('mansion/mansion-room-drawer.css');
  const motion = css('mansion/mansion-ui-motion.css');
  assert.deepEqual(declarations(layout, '.mansion-room-drawer', 'transform'), ['translateY(-50%)']);
  assert.deepEqual(declarations(layout, '.mansion-room-drawer', 'animation'), []);
  assert.deepEqual(declarations(layout, '.mansion-room-drawer', '--mansion-drawer-enter-x'), []);
  assert.deepEqual(declarations(motion, '.mansion-room-drawer', 'animation'), ['mansion-room-drawer-arrive 560ms cubic-bezier(.28, .08, .24, 1) backwards']);
  assert.deepEqual(declarations(motion, '.mansion-room-drawer[data-side="left"]', '--mansion-drawer-enter-x'), ['-28px']);
  assert.deepEqual(declarations(motion, '.mansion-room-drawer .mansion-room-card > .abyssa-frame__content', 'animation'), ['mansion-room-copy-arrive 340ms 100ms ease-out backwards']);
  /** @type {string[]} */
  const guards = [];
  motion.walkRules(rule => {
    if (rule.selector.includes('.mansion-room-drawer')) rule.walkDecls('animation', decl => {
      if (decl.value === 'none') guards.push(rule.parent?.type === 'atrule' ? /** @type {import('postcss').AtRule} */ (rule.parent).params : rule.selector);
    });
  });
  assert.ok(guards.includes('(prefers-reduced-motion: reduce)'));
  assert.ok(guards.some(selector => selector.includes('[data-ui-motion="reduced"]')));
  assert.ok(keyframes(css('mansion/mansion-dialogue.css')).includes('mansion-ready'));
  assert.ok(keyframes(css('mansion/mansion-dialogue.css')).includes('mansion-toast-in'));
});

test('sortie panels keep layout but no nested arrival; party muster stays independent', () => {
  const root = css('map/sortie/sortie.css');
  for (const selector of ['.abyssa-sortie-roster', '.abyssa-sortie-quest[data-side="left"]', '.abyssa-sortie-quest[data-side="right"]']) {
    assert.deepEqual(declarations(root, selector, 'animation'), []);
  }
  assert.deepEqual(declarations(root, '.abyssa-sortie-quest[data-side="left"]', 'left'), ['var(--sortie-inset)']);
  assert.deepEqual(declarations(root, '.abyssa-sortie-quest[data-side="right"]', 'right'), ['var(--sortie-inset)']);
  assert.ok(keyframes(root).includes('abyssa-sortie-muster-in'));
});

test('hidden route curtains pause status ticks without changing their visible score', () => {
  const root = postcss.parse(readFileSync(new URL('../../src/shared/transition/transition.css', import.meta.url), 'utf8'));
  assert.deepEqual(declarations(root, '.scene-transition__activity i', 'animation'), ['scene-transition-activity 1.35s steps(1, end) infinite']);
  assert.deepEqual(declarations(root, '.scene-transition__activity i:nth-child(2)', 'animation-delay'), ['225ms']);
  assert.deepEqual(declarations(root, '.scene-transition__activity i:nth-child(3)', 'animation-delay'), ['450ms']);
  assert.deepEqual(declarations(root, '.scene-transition:not([data-active]) .scene-transition__activity i', 'animation-play-state'), ['paused']);
  assert.deepEqual(declarations(root, '.scene-transition__activity i', 'animation-play-state'), []);
  assert.ok(keyframes(root).includes('scene-transition-spinner'));
});
