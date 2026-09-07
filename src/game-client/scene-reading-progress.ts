import { useState } from "react";
/** Tab-local reading positions, never game outcomes. A new tab can replay the same committed event safely. */
export function useSceneReadingProgress(save: string) {
  const key = `abyssa:scene-reading:v1:${save}`;
  const [progress, setProgress] = useState<Record<string, number>>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([,v]) => Number.isSafeInteger(v) && (v as number) >= 0));
    } catch { return {}; }
  });
  const write = (id: string, cursor: number) => setProgress(previous => {
    const next = Object.fromEntries([...Object.entries(previous).filter(([k]) => k !== id).slice(-63), [id,cursor]]);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Reading still works without browser storage. */ }
    return next;
  });
  return {read: (id:string) => progress[id] ?? 0, write};
}
