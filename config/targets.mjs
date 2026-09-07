import { resolve } from 'node:path';
import { entries, entryClosure } from './entries.mjs';
import { distRoot } from './paths.mjs';

export const aggregateIds = ['ui', 'game', 'lab', 'tools'];
/** @param {string} id @returns {import('./types.js').Target} */
export function resolveTarget(id) {
  if (id === 'ui') return { id, entries: [], home: 'index.html', outDir: resolve(distRoot, 'ui'), port: 5173, open: false, profile: 'ui' };
  const group = /** @type {Record<string, {kind: import('./types.js').EntryKind, port: number, home: string}>} */ ({
    game: { kind: 'game', port: 5190, home: 'title.html' },
    lab: { kind: 'lab', port: 5191, home: 'index.html' },
    tools: { kind: 'tool', port: 5192, home: 'tools-index' },
  })[id];
  if (group) return { id, entries: entryClosure(entries.filter(entry => entry.kind === group.kind).map(entry => entry.id)), home: group.home, outDir: resolve(distRoot, id), port: group.port, open: true, profile: 'release' };
  if (!id.startsWith('entry:')) throw new Error(`Unknown target: ${id}`);
  const entry = entries.find(entry => entry.id === id.slice(6));
  if (!entry) throw new Error(`Unknown target: ${id}`);
  return {
    id, entries: entryClosure([entry.id]), home: entry.html,
    outDir: resolve(distRoot, 'entries', entry.id), port: entry.port, open: entry.open ?? false,
    profile: ['novel', 'rp', 'studio'].includes(entry.id) ? 'readable' : 'release',
  };
}
