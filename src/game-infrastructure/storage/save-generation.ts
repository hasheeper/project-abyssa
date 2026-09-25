const generationKey = "abyssa:save-generation", generation = "2026-09-25-pool-1";
/** Once per local/session storage area, including each old tab after reload.
 * Exact game-only keys; API settings, other preferences and caches survive. */
export function clearRetiredSaveHints(storage: Storage) {
  if (storage.getItem(generationKey) === generation) return;
  const keys = Array.from({length: storage.length}, (_, i) => storage.key(i));
  for (const key of keys) {
    if (key && (["abyssa:recent-save:v1", "abyssa:archived-saves:v1"].includes(key) ||
      /^(?:abyssa:new-save:|abyssa:import-save:|abyssa:continue:|abyssa:pending:|abyssa:scene-reading:|abyssa:departure-loadout:)/.test(key))) storage.removeItem(key);
  }
  storage.setItem(generationKey, generation);
}
export function prepareBrowserSaveHints() {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { clearRetiredSaveHints(globalThis[name]); } catch { /* Optional hints; IndexedDB remains authoritative. */ }
  }
}
