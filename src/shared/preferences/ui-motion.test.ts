import { expect, it, vi } from "vitest";
import { createUiMotionPreferenceStore, UI_MOTION_STORAGE_KEY } from "./ui-motion";

it.each([null, "broken", "true", '"reduced"'])("defaults invalid stored value %s to system", value => {
  const store = createUiMotionPreferenceStore(() => ({ getItem: () => value, setItem() {} }));
  expect(store.getSnapshot()).toEqual({ preference: "system", saved: true });
  expect(store.getSnapshot()).toBe(store.getSnapshot());
});
it("persists only the UI preference and can read it in a fresh store", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const store = createUiMotionPreferenceStore(() => storage);
  store.set("reduced");
  expect([...data]).toEqual([[UI_MOTION_STORAGE_KEY, "reduced"]]);
  expect(createUiMotionPreferenceStore(() => storage).getSnapshot()).toEqual({ preference: "reduced", saved: true });
  store.set("system");
  expect(data.get(UI_MOTION_STORAGE_KEY)).toBe("system");
});
it("keeps the session choice if storage cannot be read or written", () => {
  const store = createUiMotionPreferenceStore(() => { throw new Error("blocked"); });
  expect(store.getSnapshot()).toEqual({ preference: "system", saved: false });
  store.set("reduced");
  expect(store.getSnapshot()).toEqual({ preference: "reduced", saved: false });
});
it("subscribes to other-tab changes and removes the listener on unsubscribe", () => {
  const store = createUiMotionPreferenceStore(() => ({ getItem: () => null, setItem() {} }));
  const listener = vi.fn(), unsubscribe = store.subscribe(listener);
  window.dispatchEvent(new StorageEvent("storage", { key: "game-record", newValue: "reduced" }));
  expect(listener).not.toHaveBeenCalled();
  window.dispatchEvent(new StorageEvent("storage", { key: UI_MOTION_STORAGE_KEY, newValue: "reduced" }));
  expect(store.getSnapshot().preference).toBe("reduced");
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
  expect(store.getSnapshot().preference).toBe("system");
  unsubscribe();
  window.dispatchEvent(new StorageEvent("storage", { key: UI_MOTION_STORAGE_KEY, newValue: "reduced" }));
  expect(listener).toHaveBeenCalledTimes(2);
});
