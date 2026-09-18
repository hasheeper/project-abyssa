import { useCallback, useEffect, useRef, useState } from "react";
import { prepareImages } from "../../../shared/loading/images";
import { useSceneReady } from "../../../shared/transition";

type Status = "loading" | "ready" | "error";
/** Failed art is a retryable preparation error, never a successful empty battlefield. */
export function useBattleSceneAssets(assets: readonly string[] | undefined) {
  const key = JSON.stringify(assets ?? []);
  const [attempt, setAttempt] = useState(0);
  const prepared = useRef(new Set<string>());
  const [result, setResult] = useState<{key: string; attempt: number; status: Status}>();
  const status: Status = !assets?.some(url => !prepared.current.has(url)) ? "ready" : result?.key === key && result.attempt === attempt ? result.status : "loading";
  // Release the curtain on error so the player can see and use Retry.
  useSceneReady(status !== "loading");
  useEffect(() => {
    const urls = JSON.parse(key) as string[];
    if (urls.every(url => prepared.current.has(url))) return;
    let active = true;
    void prepareImages(urls).then(
      () => { if (active) { urls.forEach(url => prepared.current.add(url)); setResult({key, attempt, status: "ready"}); } },
      () => { if (active) setResult({key, attempt, status: "error"}); },
    );
    return () => { active = false; };
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return {status, retry};
}
