import { useCallback, useEffect, useRef, useState } from "react";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { SceneArrivalTitle, SceneTransition } from "../../shared/transition";
import type { SceneTransitionPhase } from "../../shared/transition";

type DemoScene = "hub" | "mansion";

const CLOSE_MS = 560;
const HOLD_MS = 1_250;
const OPEN_MS = 620;

export function LoadingPage() {
  const [phase, setPhase] = useState<SceneTransitionPhase>("idle");
  const [scene, setScene] = useState<DemoScene>("hub");
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const play = useCallback(() => {
    clearTimers();
    setScene("hub");
    setPhase("idle");

    // 两帧间隔保证连续重放时浏览器重新建立 idle → closing 的起始帧。
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPhase("closing"));
    });

    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("closed");
        setScene("mansion");
      }, CLOSE_MS),
      window.setTimeout(() => setPhase("opening"), CLOSE_MS + HOLD_MS),
      window.setTimeout(() => setPhase("idle"), CLOSE_MS + HOLD_MS + OPEN_MS)
    );
  }, [clearTimers]);

  useEffect(() => {
    const autoplay = window.setTimeout(play, 650);
    return () => {
      window.clearTimeout(autoplay);
      clearTimers();
    };
  }, [clearTimers, play]);

  return (
    <main className="loading-lab" data-scene={scene}>
      <div
        className="loading-lab__scene loading-lab__scene--hub"
        style={{ backgroundImage: `url("${manorNightGallery}")` }}
      />
      <div
        className="loading-lab__scene loading-lab__scene--mansion"
        style={{
          backgroundImage: `url("${import.meta.env.BASE_URL}mansion-map/composite-reference.png")`
        }}
      />
      <div className="loading-lab__scene-grade" />

      <SceneArrivalTitle
        eyebrow={scene === "hub" ? "WATCHER'S CLIFF" : "MANOR SECTION"}
        title={scene === "hub" ? "NIGHT HALL" : "ESTATE OVERVIEW"}
        staticDisplay
      />

      <button
        type="button"
        className="loading-lab__replay"
        disabled={phase !== "idle"}
        onClick={play}
      >
        <i aria-hidden="true" />
        <span>重新播放</span>
      </button>

      <SceneTransition
        phase={phase}
        channel="正在返回"
        destination="守望者之崖洋馆"
      />
    </main>
  );
}
