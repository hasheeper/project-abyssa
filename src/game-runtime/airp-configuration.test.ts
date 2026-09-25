import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { createConnectionVault, type ConnectionVault } from "../game-infrastructure/airp-direct/connection-vault";
import { assertNoCredentialInPublicConfig, createAiConfiguration, effectiveAiConnection, effectiveAiConfiguration } from "./airp-configuration";

function setup() {
  const vault = createConnectionVault({ indexedDB: new IDBFactory(), crypto: webcrypto as unknown as Crypto });
  vi.spyOn(vault, "write");
  return { vault, fresh: () => createAiConfiguration(vault) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const config = JSON.stringify({ version: 1, connection: { baseUrl: "https://shared.invalid/v1", apiKey: "synthetic-shared-key" },
  models: { planning: { model: "gm" }, writing: { model: "writer", baseUrl: "https://writing.invalid/v1", apiKey: "synthetic-writing-key", temperature: 0.9 }, updater: { model: "small" } } });

it("rejects a credential pasted into reconnectable public model fields without echoing it", () => {
  const key = "synthetic-private-credential";
  expect(() => assertNoCredentialInPublicConfig({model: key, baseUrl: "https://shared.invalid/v1"}, [key])).toThrow();
  try { assertNoCredentialInPublicConfig({model: key}, [key]); } catch (error) { expect(String(error)).not.toContain(key); }
  expect(() => assertNoCredentialInPublicConfig({model: "writer"}, [key])).not.toThrow();
});

it("requires explicit save and restores all slots automatically, without touching presets or calling models", async () => {
  const f = setup(), first = f.fresh(), preset = first.getSnapshot().preset;
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  first.importConfig(config);
  await first.persistence.initialize();
  expect(f.vault.write).not.toHaveBeenCalled();
  expect(effectiveAiConnection(first.getSnapshot()).keys.writing).toBe("synthetic-writing-key");
  expect(await first.persistence.save()).toBe(true);
  const fresh = f.fresh();
  // Creation starts local restoration, even when the Settings page was never opened.
  await vi.waitFor(() => expect(fresh.getSnapshot().commonKey).toBe("synthetic-shared-key"));
  expect(fresh.persistence.getSnapshot()).toMatchObject({ initialized: true, saved: true, dirty: false, busy: false });
  expect(effectiveAiConfiguration(fresh.getSnapshot())).toEqual(effectiveAiConfiguration(first.getSnapshot()));
  expect(fresh.getSnapshot().preset).toEqual(preset);
  expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
});
it("marks edits unsaved and persists the latest address/key on the next Save", async () => {
  const f = setup(), store = f.fresh(); store.importConfig(config);
  await store.persistence.save();
  store.patch({baseUrl: "https://new.invalid/v1", commonKey: "synthetic-updated-key"});
  expect(store.persistence.getSnapshot().dirty).toBe(true);
  const old = f.fresh(); await old.persistence.initialize();
  expect(old.getSnapshot().commonKey).toBe("synthetic-shared-key");
  expect(await store.persistence.save()).toBe(true);
  const fresh = f.fresh(); await fresh.persistence.initialize();
  expect(fresh.getSnapshot().commonKey).toBe("synthetic-updated-key");
  expect(fresh.getSnapshot().baseUrl).toBe("https://new.invalid/v1");
});
it("a slow auto-restore cannot overwrite new input, and repeated initialization shares one read", async () => {
  const pending = deferred<string | null>();
  const vault: ConnectionVault = {read: vi.fn(() => pending.promise), write: vi.fn(), remove: vi.fn(), legacyExists: () => false};
  const store = createAiConfiguration(vault);
  const first = store.persistence.initialize(), second = store.persistence.initialize();
  store.patch({baseUrl: "https://typed.invalid/v1", commonKey: "synthetic-typed-key"});
  pending.resolve(config); await first; await second;
  expect(vault.read).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().commonKey).toBe("synthetic-typed-key");
  expect(store.persistence.getSnapshot()).toMatchObject({saved: true, dirty: true});
  expect(vault.write).not.toHaveBeenCalled();
});
it("edits arriving during Save stay dirty and are not falsely marked as persisted", async () => {
  const pending = deferred<void>();
  const vault: ConnectionVault = {read: async () => null, write: vi.fn(() => pending.promise), remove: vi.fn(), legacyExists: () => false};
  const store = createAiConfiguration(vault); store.importConfig(config);
  await store.persistence.initialize();
  const saving = store.persistence.save();
  await vi.waitFor(() => expect(vault.write).toHaveBeenCalledTimes(1));
  expect(await store.persistence.save()).toBe(false);
  store.patch({commonKey: "synthetic-later-edit"});
  pending.resolve(); expect(await saving).toBe(true);
  expect(store.persistence.getSnapshot()).toMatchObject({saved: true, dirty: true, busy: false});
  expect(store.getSnapshot().commonKey).toBe("synthetic-later-edit");
  expect(vi.mocked(vault.write).mock.calls[0][0]).not.toContain("synthetic-later-edit");
});
it("failed writes and invalid connection fields preserve the previous saved configuration", async () => {
  const f = setup(), store = f.fresh(); store.importConfig(config); await store.persistence.save();
  const original = await f.vault.read();
  store.patch({commonKey: "synthetic-new-key"});
  vi.mocked(f.vault.write).mockRejectedValueOnce(Error("synthetic-storage-error"));
  expect(await store.persistence.save()).toBe(false);
  expect(await f.vault.read()).toBe(original);
  expect(store.persistence.getSnapshot()).toMatchObject({dirty: true, busy: false});
  expect(store.persistence.getSnapshot().error).not.toContain("synthetic");
  store.patch({baseUrl: "not-an-address"});
  expect(await store.persistence.save()).toBe(false);
  expect(await f.vault.read()).toBe(original);
});
it("restore failure exposes no secrets and does not block re-entering and saving the connection", async () => {
  const f = setup();
  vi.spyOn(f.vault, "read").mockRejectedValueOnce(Error("synthetic-secret-error"));
  const store = f.fresh(); await store.persistence.initialize();
  expect(store.persistence.getSnapshot().error).not.toContain("synthetic");
  store.importConfig(config);
  expect(await store.persistence.save()).toBe(true);
  expect(store.persistence.getSnapshot().error).toBeNull();
});
it("legacy password storage does not prompt for a password or prevent a new Save", async () => {
  const f = setup(); vi.spyOn(f.vault, "legacyExists").mockReturnValue(true);
  const store = f.fresh(); await store.persistence.initialize();
  expect(store.persistence.getSnapshot().error).toContain("重新填写或导入");
  store.importConfig(config);
  expect(await store.persistence.save()).toBe(true);
  expect(store.persistence.getSnapshot().error).toBeNull();
});
it("explicit deletion clears connections only; presets are unchanged", async () => {
  const f = setup(), store = f.fresh(), preset = store.getSnapshot().preset;
  store.importConfig(config); await store.persistence.save();
  expect(await store.persistence.forget()).toBe(true);
  expect(await f.vault.read()).toBeNull();
  expect(store.getSnapshot().preset).toBe(preset); expect(store.getSnapshot().commonKey).toBe("");
  expect(Object.values(effectiveAiConnection(store.getSnapshot()).keys)).toEqual(["", "", ""]);
  expect(store.persistence.getSnapshot()).toMatchObject({ saved: false, dirty: false, busy: false });
});
