import { useSyncExternalStore } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> };
type Mode = "windowed" | "native" | "immersive" | "standalone";
interface Snapshot { mode: Mode; enabled: boolean; pending: boolean; error: string | null }

const initial: Snapshot = { mode: "windowed", enabled: false, pending: false, error: null };
let snapshot = initial;
const listeners = new Set<() => void>();
const fullscreenDocument = () => document as FullscreenDocument;
const nativeElement = () => fullscreenDocument().fullscreenElement ?? fullscreenDocument().webkitFullscreenElement;
const standalone = () => window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function publish(patch: Partial<Snapshot>) {
  const next = { ...snapshot, ...patch };
  next.enabled = next.mode !== "windowed";
  if (Object.keys(next).every(key => next[key as keyof Snapshot] === snapshot[key as keyof Snapshot])) return;
  snapshot = next;
  document.documentElement.toggleAttribute("data-abyssa-immersive", next.mode === "immersive");
  listeners.forEach(listener => listener());
}

function currentMode(): Mode {
  if (nativeElement()) return "native";
  if (standalone()) return "standalone";
  return snapshot.mode === "immersive" ? "immersive" : "windowed";
}

const sync = () => publish({ mode: currentMode(), error: null });
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (snapshot.mode !== "immersive" && !nativeElement()) return;
  // The first Escape exits display mode without also closing the active game panel.
  event.preventDefault();
  event.stopImmediatePropagation();
  void setFullscreenEnabled(false);
}

function getSnapshot() {
  if (typeof document === "undefined") return initial;
  const mode = currentMode();
  // Keep a stable snapshot for React, including when settings were closed during Escape.
  if (snapshot.mode !== mode) snapshot = { ...snapshot, mode, enabled: mode !== "windowed" };
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pageshow", sync);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    document.removeEventListener("fullscreenchange", sync);
    document.removeEventListener("webkitfullscreenchange", sync);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("pageshow", sync);
  };
}

/** Session display state, independent of save data. Fullscreen needs a fresh user gesture. */
export async function setFullscreenEnabled(enabled: boolean) {
  if (snapshot.pending || standalone()) return;
  const doc = fullscreenDocument(), root = document.documentElement as FullscreenElement;
  publish({ pending: true, error: null });
  try {
    if (!enabled) {
      if (nativeElement()) {
        const exit = doc.fullscreenElement ? doc.exitFullscreen : doc.webkitExitFullscreen;
        if (!exit) throw new Error("Fullscreen exit unavailable");
        await exit.call(doc);
      }
      publish({ mode: "windowed" });
    } else if (!nativeElement()) {
      const request = typeof root.requestFullscreen === "function" && doc.fullscreenEnabled !== false
        ? root.requestFullscreen
        : doc.webkitFullscreenEnabled !== false ? root.webkitRequestFullscreen : undefined;
      if (request) {
        // Invoke synchronously inside the click; awaiting beforehand loses user activation.
        await request.call(root);
        publish({ mode: currentMode() });
      } else {
        // iPhone Safari cannot hide its browser chrome with the Fullscreen API.
        // Fill the available viewport and explain the Home Screen route in settings.
        publish({ mode: "immersive" });
      }
    }
  } catch {
    publish({ mode: currentMode(), error: enabled
      ? "浏览器未允许进入全屏，请再次点击开关，或使用浏览器的全屏菜单。"
      : "未能退出全屏，请按 Esc 或使用浏览器的退出全屏操作。" });
  } finally {
    publish({ pending: false });
  }
}

export function useFullscreen() {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}
