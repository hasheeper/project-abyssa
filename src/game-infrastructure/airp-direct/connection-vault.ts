/** Browser-managed encryption, separate from game saves. No user password.
 * The non-extractable key is stored alongside ciphertext: same-origin code can
 * decrypt it. This is not protection against XSS or a compromised browser. */
export const AI_CONNECTION_DATABASE = "abyssa-ai-connection";
const storeName = "connection", recordId = "current", context = "abyssa.ai-connection.v2";
const legacyStorageKey = "abyssa.ai-connection.v1";
type ConnectionEnvelope = { version: 2; key: CryptoKey; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };

export function createConnectionVault(options: { indexedDB?: IDBFactory; crypto?: Crypto } = {}) {
  const cryptography = () => {
    const api = options.crypto ?? globalThis.crypto;
    if (!api?.subtle) throw Error("secure-context-required");
    return api;
  };
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = (options.indexedDB ?? globalThis.indexedDB).open(AI_CONNECTION_DATABASE, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(Error("connection-storage-blocked")); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }
  async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode), request = action(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error ?? Error("connection-storage-aborted"));
        tx.onerror = () => reject(tx.error ?? Error("connection-storage-failed"));
      });
    } finally { db.close(); }
  }
  return {
    legacyExists() {
      try { return typeof window !== "undefined" && window.localStorage.getItem(legacyStorageKey) !== null; }
      catch { return false; }
    },
    async read(): Promise<string | null> {
      const e: ConnectionEnvelope | undefined = await transact("readonly", store => store.get(recordId));
      if (e === undefined) return null;
      if (!e || e.version !== 2 || e.key?.extractable !== false || e.key.algorithm?.name !== "AES-GCM" ||
        e.iv?.byteLength !== 12 || !e.ciphertext || e.ciphertext.byteLength < 16 || e.ciphertext.byteLength > 32784) throw Error("invalid-connection-record");
      const bytes = new Uint8Array(await cryptography().subtle.decrypt({ name: "AES-GCM", iv: e.iv,
        additionalData: new TextEncoder().encode(context) }, e.key, e.ciphertext));
      try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      finally { bytes.fill(0); }
    },
    async write(text: string) {
      const bytes = new TextEncoder().encode(text);
      try {
        if (bytes.length > 32768) throw Error("connection-too-large");
        const api = cryptography(), key = await api.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        const iv = api.getRandomValues(new Uint8Array(12));
        const ciphertext = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, key, bytes);
        // One atomic record prevents a key/ciphertext mismatch if the write fails.
        await transact("readwrite", store => store.put({ version: 2, key, iv, ciphertext } satisfies ConnectionEnvelope, recordId));
      } finally { bytes.fill(0); }
    },
    async remove() { await transact("readwrite", store => store.delete(recordId)); },
  };
}
export type ConnectionVault = ReturnType<typeof createConnectionVault>;
