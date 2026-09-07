import { activeRunId } from "../../game-client/session";
import manorHall from "../../assets/backgrounds/old-manor/welcoming-hall.jpg";
import manorMapIcon from "../../assets/map/landmarks/old-manor.png";
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
import { liveParty } from "./sortie/live-roster";
import type { SortieParty } from "./sortie/sortie-model";
import { GameProvider, GameGate, useGameSession, useGameState } from "../../game-client/react";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { gameContent } from "../../game-runtime/views";
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
  const session = useGameSession(), game = useGameState(), record = game.record!;
  const manor = useMemo(() => record.schemaVersion !== 1 ? session.runtime.queries.journey(record) : null, [session, record]);
  const { roster: sortieRoster, leader: sortieLeader } = useMemo(() => liveParty(session.runtime.queries.archive(record)), [session, record]);
  const [itemIds, setItemIds] = useState<string[]>(manor?.defaultItems ?? []), [equipmentIds, setEquipmentIds] = useState<string[]>([]);

  const locations = useMemo(() => cloneMapLocations().map(location => location.id === "tower" ? { ...location, name: manor ? manor.maintenance ? "旧庄园·维护委托" : "克雷格旧庄园" : "裂隙远征", englishName: manor ? "The Old Manor" : "Rift Expedition", imageUrl: manor ? manorMapIcon : location.imageUrl } : location), [!!manor, manor?.maintenance]);
  const nodeIds = useMemo<MapLocationId[]>(() => ["tower"], []);

  const handleDepart = useCallback(
    (nodeId: MapLocationId, party: SortieParty) => {
      if (nodeId !== "tower" || game.status !== "ready" || activeRunId(record)) return;
      const expeditionId = session.runtime.newId();
      if (record.schemaVersion !== 1 && manor) {
        void session.dispatch({type: "start-expedition", runId: expeditionId, routeId: manor.defaultRouteId,
          partyIds: [manor.leaderId, ...party.memberIds], itemIds, seed: session.runtime.newSeed(),
        }).then(result => {
          if (result && result.after.schemaVersion !== 1 && activeRunId(result.after) === expeditionId)
            navigate(gameHref("battle", recordLocator(result.after)), {channel: "正在出发", destination: "克雷格旧庄园"});
        });
        return;
      }
      if (record.schemaVersion !== 1) return;
      void session.dispatch({ type: "start-expedition", expeditionId, routeId: gameContent.defaultRouteId,
        partyIds: [gameContent.leaderId, ...party.memberIds], itemIds, equipmentIds: equipmentIds.filter(id => record.snapshot.campaign.inventory.equipment.some(item => item.instanceId === id && [gameContent.leaderId, ...party.memberIds].includes(item.ownerId))), seed: session.runtime.newSeed(),
      }).then(result => {
        if (result?.after.schemaVersion === 1 && result.after.snapshot.expedition?.id === expeditionId) navigate(gameHref("battle", recordLocator(result.after)), { channel: "正在出发", destination: "裂隙遠征" });
      });
    },
    [session, game.status, record, itemIds, equipmentIds, navigate, manor]
  );

  const sortie = useSortie({ roster: sortieRoster, nodeIds, onDepart: handleDepart, persistOrder: false, personalOnly: true, initialMemberIds: manor?.initialParty.filter(id => id !== manor.leaderId) });
  const { mode, activeNode, openNode } = sortie;

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    const controller = createMapScene(container, {
      locations: locations.map(location => ({ ...location })),
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
  }, [openNode, locations]);

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
              delegateLocked
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
                inspectHref={id => gameHref("character-status", recordLocator(record), {characterId: id, tab: "summary", from: "map"})}
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
                rejection={activeRunId(record) ? "已有远征，请先继续或完成结算。" : game.status !== "ready" ? "正在保存或恢复进度。" : activeNode !== "tower" ? "此处暂未开放远征。" : sortie.rejection}
                briefOverride={{ nodeId: activeLocation.id, sceneImageUrl: manor && activeNode === "tower" ? manorHall : undefined, flavor: activeNode === "tower" ? (manor ? manor.brief.flavor : "带上伙伴进入裂隙，在出口层选择带宝离场或继续深入。") : "此处暂未开放远征。", threats: activeNode === "tower" ? (manor ? ["举盘蓄力，缝补修复", manor.maintenance ? "清理五层支线残余，不再重开家宴" : manor.fullManor ? "三层管家考核，五层千金的举杯随宾客增减" : "落幕管家封锁下一回合命数骰"] : ["敌人会公开下一步意图", "拖延回合可能使敌人狂暴"]) : [], yields: [], event: activeNode === "tower" ? (manor ? manor.brief.event : "各层独立入袋，回馆后统一结算；沿用当前裂隙规则。") : undefined }}
                onEditParty={() => sortie.openTeam(activeLocation.id)}
                onDepart={sortie.depart}
                onClose={sortie.closeAll}
              />
            )}
          </section>
        </MapWoodFrame>
        {record.schemaVersion !== 1 && manor ? <details className="map-loadout game-client-panel"><summary>携带配给（{itemIds.length}/4）</summary>
          <p>{record.contentRef.rulesVersion === 4 && record.contentRef.contentVersion === 3 ? "食物和药水出发时补足；战术补给按库存携带，最多四种。" : "出发前将所选配给免费补足，最多携带四种。"}</p>
          {manor.items.map(item => <label key={item.id}><input type="checkbox" checked={itemIds.includes(item.id)}
            disabled={game.status !== "ready" || !!activeRunId(record) || !itemIds.includes(item.id) && (itemIds.length >= 4 || !item.availableCharges)}
            onChange={e => setItemIds(ids => e.target.checked ? [...ids,item.id] : ids.filter(id => id !== item.id))} />{item.name} ×{item.availableCharges}{item.free ? " · 配给" : " · 库存"}</label>)}
        </details> : record.schemaVersion === 1 ? <details className="map-loadout game-client-panel"><summary>携带物品与装备</summary>
          {[...record.snapshot.campaign.inventory.items, ...record.snapshot.campaign.inventory.equipment].map(item => {
            const equipment = "durability" in item, selected = equipment ? equipmentIds : itemIds, update = equipment ? setEquipmentIds : setItemIds;
            const ownerReady = !equipment || [gameContent.leaderId, ...sortie.party.memberIds].includes(item.ownerId!);
            return <label key={item.instanceId}><input type="checkbox" checked={ownerReady && selected.includes(item.instanceId)} disabled={!ownerReady || game.status !== "ready" || Boolean(record.snapshot.expedition)} onChange={e => update(current => e.target.checked ? [...current, item.instanceId] : current.filter(id => id !== item.instanceId))} />{item.definitionId} · {item.instanceId}{!ownerReady ? "（所属伙伴未编入）" : ""}</label>;
          })}
          {!record.snapshot.campaign.inventory.items.length && !record.snapshot.campaign.inventory.equipment.length && <p>营地暂无物品，可以空包出征。</p>}
        </details> : null}
        <CampaignPanel />
      </AbyssaProvider>
    </Stage>
  );
}

export function MapPage() {
  return (
    <SceneTransitionProvider>
      <GameProvider><GameGate><MapPageBody /></GameGate></GameProvider>
    </SceneTransitionProvider>
  );
}
