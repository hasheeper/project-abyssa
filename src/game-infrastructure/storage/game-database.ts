export const GAME_DATABASE = "abyssa-game-v1";
export const GAME_DATABASE_VERSION = 3;

/** Slots and archive maintenance share the snapshot/receipt transaction. */
export function upgradeGameDatabase(db: IDBDatabase, oldVersion = 0) {
  // Explicit 2026-09-25 DEMO fresh-start cutover. Upgrade transactions are
  // atomic: if they abort, all old stores remain intact. Never touch the API DB.
  if (db.name === GAME_DATABASE && oldVersion > 0 && oldVersion < 3) {
    for (const name of ["saves", "receipts", "archive"]) {
      if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
    }
  }
  for (const name of ["saves", "receipts", "archive"]) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
  }
}

export function openGameDatabase(factory: IDBFactory = indexedDB, name = GAME_DATABASE): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, GAME_DATABASE_VERSION);
    let blocked = false;
    request.onupgradeneeded = event => upgradeGameDatabase(request.result, event.oldVersion);
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("请关闭旧版游戏页面后重试存档操作。")); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
