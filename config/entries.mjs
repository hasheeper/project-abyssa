/** @type {import('./types.js').Entry[]} */
export const entries = [
  { id: 'title', html: 'title.html', kind: 'game', port: 5182, open: true, navigationDependencies: ['menu', 'battle', 'prologue'], assetProfiles: [] },
  { id: 'prologue', html: 'prologue.html', kind: 'game', port: 5189, navigationDependencies: ['title', 'mansion'], assetProfiles: [] },
  { id: 'menu', html: 'menu.html', kind: 'game', port: 5173, navigationDependencies: ['mansion', 'shop', 'map', 'battle', 'character-status', 'title'], assetProfiles: [] },
  { id: 'mansion', html: 'mansion.html', kind: 'game', port: 5173, navigationDependencies: ['shop', 'map', 'title', 'dice'], assetProfiles: ['mansion', 'paper-dolls', 'emotes'] },
  { id: 'shop', html: 'shop.html', kind: 'game', port: 5173, navigationDependencies: ['title'], assetProfiles: [] },
  { id: 'dice', html: 'dice.html', kind: 'game', port: 5173, navigationDependencies: ['menu', 'title'], assetProfiles: [] },
  { id: 'battle', html: 'battle.html', kind: 'game', port: 5173, navigationDependencies: ['mansion', 'map', 'title', 'character-status'], assetProfiles: ['paper-dolls', 'emotes'] },
  { id: 'map', html: 'map.html', kind: 'game', port: 5186, open: true, navigationDependencies: ['battle', 'title', 'character-status'], assetProfiles: [] },
  { id: 'character-status', html: 'character-status.html', kind: 'game', port: 5185, navigationDependencies: ['title', 'menu', 'map', 'battle'], assetProfiles: [] },
  { id: 'settings', html: 'settings.html', kind: 'game', port: 5188, navigationDependencies: [], assetProfiles: [] },
  { id: 'catalog', html: 'index.html', kind: 'lab', port: 5173, navigationDependencies: [], assetProfiles: [] },
  { id: 'loading', html: 'loading.html', kind: 'lab', port: 5173, navigationDependencies: [], assetProfiles: [] },
  { id: 'novel', html: 'novel.html', kind: 'lab', port: 5174, navigationDependencies: [], assetProfiles: ['paper-dolls'] },
  { id: 'rp', html: 'rp.html', kind: 'lab', port: 5175, navigationDependencies: [], assetProfiles: ['paper-dolls', 'emotes'] },
  { id: 'mansion-editor', html: 'mansion-editor.html', kind: 'tool', port: 5173, navigationDependencies: [], assetProfiles: [] },
  { id: 'studio', html: 'studio.html', kind: 'tool', port: 5176, navigationDependencies: [], assetProfiles: ['paper-dolls', 'emotes'] },
  { id: 'party-figure-studio', html: 'party-figure-studio.html', kind: 'tool', port: 5187, open: true, navigationDependencies: [], assetProfiles: [] },
  { id: 'logo-studio', html: 'logo-studio.html', kind: 'tool', port: 5181, open: true, navigationDependencies: [], assetProfiles: [] },
  { id: 'dice-studio', html: 'dice-studio.html', kind: 'tool', port: 5184, open: true, navigationDependencies: [], assetProfiles: [] },
];

/** Resolve navigation transitively. Returning to an earlier page is valid. @param {string[]} ids @param {import('./types.js').Entry[]} [catalog] */
export function entryClosure(ids, catalog = entries) {
  const byId = new Map(catalog.map(entry => [entry.id, entry]));
  /** @type {Map<string, import('./types.js').Entry>} */
  const selected = new Map();
  /** @param {string} id */
  function visit(id) {
    if (selected.has(id)) return;
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown entry: ${id}`);
    selected.set(id, entry);
    entry.navigationDependencies.forEach(visit);
  }
  ids.forEach(visit);
  return [...selected.values()];
}
