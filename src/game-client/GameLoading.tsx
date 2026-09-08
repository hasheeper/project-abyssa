import { readRoute } from "../shared/routing/location";
import { useEffect, useState } from "react";
import { SceneTransition, useSceneReady } from "../shared/transition";

const destinations: Record<string, string> = {
  "menu.html": "守望者之崖", "map.html": "远征地图", "battle.html": "克雷格旧庄园",
  "mansion.html": "守望者之崖洋馆", "shop.html": "守望者杂货铺", "character-status.html": "角色档案",
};

/** Save hydration belongs to the current scene curtain, not a second technical loading page. */
export function GameLoading() {
  const covered = useSceneReady(false);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaiting(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  const destination = destinations[`${readRoute()?.page}.html`] ?? "守望者之崖";
  return <div className="game-client-loading" aria-busy="true">
    {!covered && waiting && <SceneTransition phase="closed" channel="正在进入" destination={destination}/>}
  </div>;
}
