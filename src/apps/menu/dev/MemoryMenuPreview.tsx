import { useEffect, useState } from "react";
import { GameSessionScope } from "../../../game-client/react";
import { GameSession } from "../../../game-client/session";
import { createMenuPreviewRuntime, createMenuBackendPreviewRuntime } from "../../../game-runtime/menu-preview";
import { memoryFixtures } from "./memory-samples";
import { SceneTransitionProvider } from "../../../shared/transition";
import { MenuPageContent } from "../MenuPage";

export default function MemoryMenuPreview({ sample }: { sample: string }) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, instance: GameSession | undefined;
    void (sample === "backend-shop" ? createMenuBackendPreviewRuntime("shop") : sample === "backend-skip" ? createMenuBackendPreviewRuntime("skip") : sample === "backend" ? createMenuBackendPreviewRuntime(true) : createMenuPreviewRuntime(sample === "long" ? 365 : sample === "one-day" ? 1 : sample === "gap" ? 12 : 9)).then(async ({ runtime, locator }) => {
      const values = new Map<string, string>();
      instance = new GameSession(runtime, locator, { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } });
      await instance.refresh();
      if (active) setSession(instance); else instance.dispose();
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; instance?.dispose(); };
  }, [sample]);
  if (failed) return <p role="alert">无法载入记忆布局样本，请刷新重试。</p>;
  if (!session) return null;
  const entries = sample === "empty" ? [] : sample === "sparse" ? memoryFixtures.slice(0, 1)
    : sample === "one-day" ? memoryFixtures.filter(entry => entry.day === 1 || entry.day === null)
    : sample === "long" ? memoryFixtures.map((entry, index) => ({ ...entry, day: entry.day === null ? null : 360 - index * 37 })) : memoryFixtures;
  return <SceneTransitionProvider><GameSessionScope session={session}>
    <MenuPageContent memoryData={sample.startsWith("backend") ? undefined : { status: "ready", entries }} preview/>
  </GameSessionScope></SceneTransitionProvider>;
}
