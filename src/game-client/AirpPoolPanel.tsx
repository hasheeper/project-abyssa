import type { AirpPoolView } from "../game-runtime/airp-pool-view";
import { useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";

export function AirpPoolPanel({ view }: { view: AirpPoolView }) {
  const { record } = useGameState();
  if (!view.patrol) return null;
  return <section className="airp-panel airp-panel--compact" aria-label="巡守委托"><h3>{view.patrol.title}</h3><p>{view.patrol.objective}</p>
    {view.cue && <details><summary>巡守便条</summary><p>{view.cue}</p></details>}
    {view.patrol.instance.status === "ready" && <a href={gameHref("mansion", recordLocator(record!))}>回洋馆交付</a>}
  </section>;
}
