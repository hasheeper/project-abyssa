import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { Stage } from "../../shared/stage";
import { SceneTransitionProvider, useSceneTransition } from "../../shared/transition";
import { createMapScene } from "./createMapScene";
import type { MapSceneController } from "./createMapScene";
import { MapWoodFrame } from "./MapWoodFrame";
import { cloneMapLocations } from "./types";
import type { MapLocationId } from "./types";
import { SortiePartyStage } from "./sortie/SortiePartyStage";
import { SortieQuestPanel } from "./sortie/SortieQuestPanel";
import { SortieRosterPanel } from "./sortie/SortieRosterPanel";
import { sortieLeader, sortieRoster } from "./sortie/sortie-roster";
import { useSortie } from "./sortie/useSortie";

/** 委托侧板靠哪边：地标在画面右半就贴左，免得侧板压住刚点的地标。 */
const QUEST_SIDE: Record<MapLocationId, "left" | "right"> = {
  church: "right",
  tower: "right",
  cave: "left"
};

function MapPageBody() {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapSceneController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { navigate } = useSceneTransition();

  const locations = useMemo(() => cloneMapLocations(), []);
  const nodeIds = useMemo(() => locations.map((location) => location.id), [locations]);

  const handleDepart = useCallback(
    (nodeId: MapLocationId) => {
      const location = locations.find((entry) => entry.id === nodeId);
      /* 出击令已写入 sessionStorage。battle 端目前还没有读取逻辑，
         所以这一跳只是进入效果，不构成已完成的跨页交接
         （docs/CODE_MAINTENANCE_AUDIT.md 8.2 列了读取端的完成标准）。 */
      navigate("./battle.html", {
        channel: "正在出发",
        destination: location?.name ?? "裂隙"
      });
    },
    [locations, navigate]
  );

  const sortie = useSortie({ roster: sortieRoster, nodeIds, onDepart: handleDepart });
  const { mode, activeNode, openNode } = sortie;

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    const controller = createMapScene(container, {
      locations: cloneMapLocations(),
      onReady: () => setLoading(false),
      onError: () => {
        setError(true);
        setLoading(false);
      },
      onLocationSelect: (location) => openNode(location.id)
    });
    sceneRef.current = controller;
    return () => {
      sceneRef.current = null;
      controller.destroy();
    };
  }, [openNode]);

  /* 选中高亮住在 Three 侧：地标是 WebGL 纸片，HTML 遮罩盖不住 canvas 内部。
     浮层展开时同时关掉拾取，否则点面板会穿透到地图上换节点。 */
  useEffect(() => {
    sceneRef.current?.setSelected(
      activeNode,
      activeNode ? QUEST_SIDE[activeNode] : undefined
    );
  }, [activeNode]);

  useEffect(() => {
    sceneRef.current?.setInteractive(mode === "map");
  }, [mode]);

  const activeLocation = activeNode
    ? locations.find((location) => location.id === activeNode)
    : undefined;
  const activeQuestSide = activeLocation ? QUEST_SIDE[activeLocation.id] : undefined;

  return (
    <Stage background="var(--abyssa-map-backdrop)">
      <AbyssaProvider className="abyssa-map-page" density="compact">
        {/* 招牌与 shop 同构:absolute 挂墙,不参与流,允许压住画框上沿。 */}
        <header className="abyssa-map-heading">
          <RpgHeader
            className="abyssa-map-heading__bar"
            label="守望者之崖"
            description="守望者之崖"
            variant="dark"
          />
        </header>

        <MapWoodFrame>
          <section
            className="abyssa-map-viewport"
            aria-label="守望者之崖副本地图"
            data-mode={mode}
          >
            <div ref={sceneContainerRef} className="abyssa-map-scene" />
            <div className="abyssa-map-vignette" aria-hidden="true" />

            {(loading || error) && (
              <div className="abyssa-map-loading" role="status">
                {error ? "素材加载失败，请刷新" : "地图展开中..."}
              </div>
            )}

            {/* 遮罩只压 UI 层与地图底板，不压被选中的地标 —— 那张纸片
                由 Three 侧提亮，从暗场里自己浮出来。 */}
            <button
              className="abyssa-map-dim"
              data-focus-side={mode === "pop" ? activeQuestSide : undefined}
              type="button"
              tabIndex={mode === "map" ? -1 : 0}
              aria-label="关闭当前面板"
              aria-hidden={mode === "map"}
              onClick={sortie.dismiss}
            />

            <SortiePartyStage
              mode={mode}
              questSide={mode === "pop" ? activeQuestSide : undefined}
              roster={sortieRoster}
              leader={sortieLeader}
              party={sortie.party}
              /* 委托态点人物也能进编队，并且编完要回到当前委托。 */
              onOpen={() => sortie.openTeam(activeNode)}
              onRemoveMember={sortie.toggleMember}
              onToggleCommand={sortie.toggleCommand}
            />

            {mode === "team" && (
              <SortieRosterPanel
                roster={sortieRoster}
                leader={sortieLeader}
                party={sortie.party}
                onToggleMember={sortie.toggleMember}
                onClose={sortie.finishTeam}
              />
            )}

            {mode === "pop" && activeLocation && (
              <SortieQuestPanel
                location={activeLocation}
                side={activeQuestSide!}
                roster={sortieRoster}
                leader={sortieLeader}
                party={sortie.party}
                rejection={sortie.rejection}
                onEditParty={() => sortie.openTeam(activeLocation.id)}
                onDepart={sortie.depart}
                onClose={sortie.closeAll}
              />
            )}
          </section>
        </MapWoodFrame>
      </AbyssaProvider>
    </Stage>
  );
}

export function MapPage() {
  return (
    <SceneTransitionProvider>
      <MapPageBody />
    </SceneTransitionProvider>
  );
}
