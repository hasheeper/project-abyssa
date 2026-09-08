/** Keep the exact MPA cascade while lazy-loaded CSS remains in the document.
 * Shared component styles stay shared. Only application-owned rules are gated.
 * The zero-specificity gate preserves the original selector specificity.
 * @returns {import('postcss').Plugin}
 */
export function gamePageStyles() {
  return {
    postcssPlugin: 'abyssa-game-page-styles',
    Once(root) {
      root.walkRules(rule => {
        const owner = /\/src\/apps\/([^/]+)\//.exec(rule.source?.input.file ?? '')?.[1];
        if (!owner || rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
        const gate = `:where([data-game-page="${owner}"])`;
        rule.selectors = rule.selectors.map(selector => /^(?:html|:root)(?=[\s:.#[>+~]|$)/.test(selector)
          ? selector.replace(/^(html|:root)/, `$1${gate}`)
          : `:where(html[data-game-page="${owner}"]) ${selector}`);
      });
    },
  };
}
