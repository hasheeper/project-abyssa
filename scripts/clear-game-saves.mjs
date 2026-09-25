/** Development-only, user-triggered maintenance. Never clears preferences or resource caches. */
export const GAME_DATABASE = 'abyssa-game-v1';
export const SAVE_SLOT_DATABASE = 'abyssa-save-slots-v1';

export function clearSaveHints(local, session) {
  for (const storage of [local, session]) {
    const keys = Array.from({length: storage.length}, (_, index) => storage.key(index));
    for (const key of keys) if (key && (['abyssa:recent-save:v1', 'abyssa:archived-saves:v1'].includes(key) ||
      /^(?:abyssa:new-save:|abyssa:import-save:|abyssa:continue:|abyssa:pending:|abyssa:scene-reading:|abyssa:departure-loadout:)/.test(key))) storage.removeItem(key);
  }
}

export function deleteGameDatabase(factory, onBlocked) {
  return deleteDatabase(factory, GAME_DATABASE, onBlocked);
}

export function deleteSaveSlotDatabase(factory, onBlocked) {
  return deleteDatabase(factory, SAVE_SLOT_DATABASE, onBlocked);
}

function deleteDatabase(factory, name, onBlocked) {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? Error('存档数据库删除失败'));
    // Do not report a timeout as cancellation: an IndexedDB delete request cannot be cancelled.
    request.onblocked = onBlocked;
  });
}

export function readSaveCounts(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(GAME_DATABASE);
    let absent = false;
    request.onupgradeneeded = () => {absent = true; request.transaction.abort();};
    request.onerror = () => absent ? resolve({saves:0, receipts:0}) : reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      try {
        const transaction = database.transaction(['saves','receipts'], 'readonly');
        const saves = transaction.objectStore('saves').count(), receipts = transaction.objectStore('receipts').count();
        transaction.oncomplete = () => {database.close(); resolve({saves:saves.result, receipts:receipts.result});};
        transaction.onabort = () => {database.close(); reject(transaction.error);};
      } catch (error) {database.close(); reject(error);}
    };
  });
}
