import { useSyncExternalStore } from "react";
import type { UiMotionPreference } from "../ui/motion/UiMotionProvider";

export const UI_MOTION_STORAGE_KEY = "abyssa:ui-motion:v1";
interface Snapshot { preference: UiMotionPreference; saved: boolean }
const defaultSnapshot: Snapshot = { preference: "system", saved: true };
const parse = (value: string | null): UiMotionPreference => value === "reduced" ? "reduced" : "system";

/** UI-only preference; no game session, save identity, or gameplay dependency. */
export function createUiMotionPreferenceStore(storage: () => Pick<Storage, "getItem" | "setItem">) {
  let snapshot: Snapshot | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    if (snapshot?.preference === next.preference && snapshot.saved === next.saved) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const getSnapshot = () => {
    if (!snapshot) {
      try { snapshot = { preference: parse(storage().getItem(UI_MOTION_STORAGE_KEY)), saved: true }; }
      catch { snapshot = { ...defaultSnapshot, saved: false }; }
    }
    return snapshot;
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== UI_MOTION_STORAGE_KEY) return;
    publish({ preference: parse(event.newValue), saved: true });
  };
  return {
    getSnapshot,
    getServerSnapshot: () => defaultSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (!listeners.size && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    set(preference: UiMotionPreference) {
      let saved = true;
      try { storage().setItem(UI_MOTION_STORAGE_KEY, preference); } catch { saved = false; }
      publish({ preference, saved });
    }
  };
}

const store = createUiMotionPreferenceStore(() => window.localStorage);
export const setUiMotionPreference = store.set;
export function useUiMotionPreference() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
