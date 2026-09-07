import { parse } from '@babel/parser';

/** @param {string} source @param {string} filename */
export function parseSource(source, filename) {
  return parse(source, { sourceFilename: filename, sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
}

/** Parse TS/TSX without depending on TypeScript's removed v7 compiler JS API.
 * @param {string} source @param {string} filename
 * @param {(node: Record<string, unknown>) => void} visitor
 */
export function visitSource(source, filename, visitor) {
  const ast = parseSource(source, filename);
  /** @param {unknown} value */
  function walk(value) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const record = /** @type {Record<string, unknown>} */ (value);
    if (typeof record.type === 'string') visitor(record);
    for (const [key, child] of Object.entries(record)) if (!['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) walk(child);
  }
  walk(ast);
}
