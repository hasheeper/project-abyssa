import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { AI_CONNECTION_DATABASE, createConnectionVault } from "./connection-vault";

const cryptography = webcrypto as unknown as Crypto;
const plaintext = JSON.stringify({ baseUrl: "https://private.example.invalid/v1", apiKey: "synthetic-secret-key", model: "test-model" });
type Envelope = { version: number; key: CryptoKey; iv: Uint8Array; ciphertext: ArrayBuffer };
async function record(factory: IDBFactory, edit?: (e: Envelope, store: IDBObjectStore) => void): Promise<Envelope> {
  return new Promise((resolve, reject) => {
    const request = factory.open(AI_CONNECTION_DATABASE, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("connection", edit ? "readwrite" : "readonly");
      const store = tx.objectStore("connection"), item = store.get("current");
      item.onsuccess = () => edit?.(item.result as Envelope, store);
      tx.oncomplete = () => { db.close(); resolve(item.result as Envelope); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
describe("browser-managed AI connection storage", () => {
  it("stores ciphertext and a non-extractable key, then restores without any password", async () => {
    const disk = new IDBFactory(), vault = createConnectionVault({ indexedDB: disk, crypto: cryptography });
    expect(await vault.read()).toBeNull();
    await vault.write(plaintext);
    const raw = await record(disk);
    expect(Object.keys(raw).sort()).toEqual(["ciphertext", "iv", "key", "version"]);
    for (const secret of ["private.example", "synthetic-secret-key", "test-model"]) {
      expect(new TextDecoder().decode(raw.ciphertext)).not.toContain(secret);
      expect(JSON.stringify(raw)).not.toContain(secret);
    }
    expect(raw.key.extractable).toBe(false);
    await expect(cryptography.subtle.exportKey("raw", raw.key)).rejects.toThrow();
    expect(await createConnectionVault({ indexedDB: disk, crypto: cryptography }).read()).toBe(plaintext);
  });
  it("uses fresh randomness and rejects tampered ciphertext", async () => {
    const disk = new IDBFactory(), vault = createConnectionVault({ indexedDB: disk, crypto: cryptography });
    await vault.write(plaintext); const first = await record(disk);
    await vault.write(plaintext); const second = await record(disk);
    expect(second.iv).not.toEqual(first.iv); expect(new Uint8Array(second.ciphertext)).not.toEqual(new Uint8Array(first.ciphertext));
    await record(disk, (e, store) => { new Uint8Array(e.ciphertext)[0] ^= 1; store.put(e, "current"); });
    await expect(vault.read()).rejects.toThrow();
  });
  it("does not fall back to plaintext when crypto or storage fails; the previous record survives", async () => {
    const disk = new IDBFactory(), vault = createConnectionVault({ indexedDB: disk, crypto: cryptography });
    await vault.write(plaintext);
    await expect(createConnectionVault({ indexedDB: disk, crypto: {} as Crypto }).write("synthetic-new-secret")).rejects.toThrow();
    const failingOpen = vi.spyOn(disk, "open").mockImplementationOnce(() => { throw Error("storage-blocked"); });
    await expect(vault.write("synthetic-new-secret")).rejects.toThrow();
    failingOpen.mockRestore();
    expect(await vault.read()).toBe(plaintext);
    await expect(vault.write("x".repeat(32769))).rejects.toThrow();
    expect(await vault.read()).toBe(plaintext);
  });
  it("removes only the connection record and leaves unrelated data untouched", async () => {
    const disk = new IDBFactory(), vault = createConnectionVault({ indexedDB: disk, crypto: cryptography });
    await vault.write(plaintext);
    await record(disk, (_, store) => { store.put("preserved", "game-save"); });
    await vault.remove(); expect(await vault.read()).toBeNull();
    await record(disk, (_, store) => {
      const saved = store.get("game-save"); saved.onsuccess = () => expect(saved.result).toBe("preserved");
    });
  });
});
