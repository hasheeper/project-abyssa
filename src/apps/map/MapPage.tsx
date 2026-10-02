import { activeRunId } from "../../game-client/session";
import { usePlayerName } from "../../shared/domain/PlayerIdentity";
import manorHallPrint from "../../assets/map/dossier/print-old-manor-hall.webp";
import manorMapIcon from "../../assets/map/landmarks/old-manor.png";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { CSSProperties } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { Stage } from "../../shared/stage";
import { SceneTransitionProvider, useSceneReady, useSceneTransition } from "../../shared/transition";
import { supplyArt } from "../../content/presentation/supply-icons";
import { MapLoadoutPanel, type MapLoadoutItem } from "./MapLoadoutPanel";
import { MapPanel } from "./MapPanel";
import { useMapIntro } from "./useMapIntro";
import { MAP_FOCUS_EASE, MAP_FOCUS_MS } from "./map-motion";
import { createMapScene } from "./createMapScene";
import type { MapSceneController } from "./createMapScene";
import { MapWoodFrame } from "./MapWoodFrame";
import { cloneMapLocations } from "./types";
import type { MapLocationId } from "./types";
import { SortiePartyStage } from "./sortie/SortiePartyStage";
import { SortieDossier, type SortieDossierStatus } from "./sortie/SortieDossier";
import { SortieRosterPanel } from "./sortie/SortieRosterPanel";
import { liveParty } from "./sortie/live-roster";
import type { SortieParty } from "./sortie/sortie-model";
import { GameProvider, GameGate, useGameSession, useGameState } from "../../game-client/react";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { AirpPanel } from "../../game-client/AirpPanel";
import { CommissionList } from "../../game-client/airp-director/CommissionList";
import { directorCommissions } from "../../game-runtime/airp-commission-view";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { gameContent } from "../../game-runtime/views";
import { useSortie } from "./sortie/useSortie";
import { useDepartureLoadout } from "../../game-client/useDepartureLoadout";
import { departureDestination, departureNodes } from "./sortie/live-destinations";
import { findQuestBrief, type QuestBrief } from "./sortie/sortie-quests";

/** 委托侧板靠哪边：地标在画面右半就贴左，免得侧板压住刚点的地标。 */
const QUEST_SIDE: Record<MapLocationId, "left" | "right"> = {
  church: "right",
  tower: "right",
  cave: "left"
};

function MapPageBody() {
  const playerName = usePlayerName();
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapSceneController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [airpError, setAirpError] = useState("");
  /* ref 是同步闸门，防连点；state 只给委托书画「正在安排」。 */
  const airpPreparing = useRef(false);
  const [airpBusy, setAirpBusy] = useState(false);
  useSceneReady(!loading);
  const intro = useMapIntro(!loading);
  const introState = useRef(intro.state);
  introState.current = intro.state;
  const supplyTrigger = useRef<HTMLButtonElement>(null);
  const { navigate } = useSceneTransition();
  const session = useGameSession(), game = useGameState(), record = game.record!;
  const manor = useMemo(() => record.schemaVersion !== 1 ? session.runtime.queries.journey(record) : null, [session, record]);
  const { roster: sortieRoster, leader: sortieLeader } = useMemo(() => liveParty(session.runtime.queries.archive(record), playerName), [session, record, playerName]);
  const loadout = useDepartureLoadout(record,manor);
  const [legacyItemIds, setLegacyItemIds] = useState<string[]>([]), [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const itemIds = record.schemaVersion === 1 ? legacyItemIds : loadout.ids;
  const setItemIds = record.schemaVersion === 1 ? setLegacyItemIds : loadout.setIds;

  const locations = useMemo(() => cloneMapLocations().map(location => location.id === "tower" ? { ...location, name: manor ? manor.maintenance ? "旧庄园·维护委托" : "克雷格旧庄园" : "裂隙远征", englishName: manor ? "The Old Manor" : "Rift Expedition", imageUrl: manor ? manorMapIcon : location.imageUrl } : location), [!!manor, manor?.maintenance]);
  const nodeIds = useMemo(() => departureNodes(manor, record.schemaVersion === 1), [manor, record.schemaVersion]);

  const handleDepart = useCallback(
    (nodeId: MapLocationId, party: SortieParty) => {
      if (game.status !== "ready" || activeRunId(record) || airpPreparing.current) return;
      const expeditionId = session.runtime.newId();
      if (record.schemaVersion !== 1 && manor) {
        const destination = departureDestination(manor, nodeId);
        if (!destination) return;
        if (record.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion ?? 0) && "airpGame" in session.runtime) {
          setAirpError("");
          airpPreparing.current = true;
          setAirpBusy(true);
          void session.runtime.airpGame.forSave(record.head.saveId, record.contentRef.contentVersion).prepare({ runId: expeditionId, routeId: destination.routeId, partyIds: [manor.leaderId, ...party.memberIds], itemIds, ...loadout.selection, seed: session.runtime.newSeed() })
            .then(() => session.refresh({ background: true, notify: true })).catch(e => setAirpError(e instanceof Error ? e.message : "出征安排未保存。"))
            .finally(() => { airpPreparing.current = false; setAirpBusy(false); });
          return;
        }
        void session.dispatch({type: "start-expedition", runId: expeditionId, routeId: destination.routeId,
          partyIds: [manor.leaderId, ...party.memberIds], itemIds, ...loadout.selection, seed: session.runtime.newSeed(),
        }).then(result => {
          if (result && result.after.schemaVersion !== 1 && activeRunId(result.after) === expeditionId)
            navigate(gameHref("battle", recordLocator(result.after)), {channel: "正在出发", destination: destination.name, battleEntrance: "open-box"});
        });
        return;
      }
      if (record.schemaVersion !== 1 || nodeId !== "tower") return;
      void session.dispatch({ type: "start-expedition", expeditionId, routeId: gameContent.defaultRouteId,
        partyIds: [gameContent.leaderId, ...party.memberIds], itemIds, equipmentIds: equipmentIds.filter(id => record.snapshot.campaign.inventory.equipment.some(item => item.instanceId === id && [gameContent.leaderId, ...party.memberIds].includes(item.ownerId))), seed: session.runtime.newSeed(),
      }).then(result => {
        if (result?.after.schemaVersion === 1 && result.after.snapshot.expedition?.id === expeditionId) navigate(gameHref("battle", recordLocator(result.after)), { channel: "正在出发", destination: "裂隙遠征" });
      });
    },
    [session, game.status, record, itemIds, equipmentIds, navigate, manor, loadout.selection]
  );

  const sortie = useSortie({ roster: sortieRoster, nodeIds, onDepart: handleDepart, persistOrder: false, personalOnly: true, initialMemberIds: manor?.initialParty.filter(id => id !== manor.leaderId) });
  const { mode, activeNode, openNode } = sortie;
  const stageMode = mode === "loadout" ? sortie.loadoutReturnMode : mode;
  const loadoutLocked = game.status !== "ready" ? "正在保存或恢复进度" : activeRunId(record) ? "远征进行中，无法更改行囊" : undefined;
  const supplies: MapLoadoutItem[] = record.schemaVersion !== 1 ? (manor?.items ?? []).map(item => ({
    id: item.id, name: item.name, icon: supplyArt[item.kind]?.icon,
    description: supplyArt[item.kind]?.description ?? "", quantity: loadout.quantities[item.id] ?? item.availableCharges, maximum: item.availableCharges, stock: item.storedCharges,
    source: item.free ? "免费配给" : "战术补给", selected: itemIds.includes(item.id),
    blocked: loadoutLocked ?? (!itemIds.includes(item.id) ? !item.availableCharges ? "暂无库存，可返回洋馆补充" : itemIds.length >= loadout.itemLimit ? "行囊已满，请先移出一种" : undefined : undefined),
  })) : [...record.snapshot.campaign.inventory.items, ...record.snapshot.campaign.inventory.equipment].map(item => {
    const equipment = "durability" in item;
    const ownerReady = !equipment || [gameContent.leaderId, ...sortie.party.memberIds].includes(item.ownerId!);
    return { id: item.instanceId, name: item.definitionId, description: item.instanceId, quantity: 1,
      source: equipment ? "随身装备" : "营地物品", selected: ownerReady && (equipment ? equipmentIds : itemIds).includes(item.instanceId),
      blocked: !ownerReady ? "所属伙伴未编入" : loadoutLocked };
  });
  const toggleSupply = (id: string) => {
    if (supplies.find(item => item.id === id)?.blocked) return;
    const equipment = record.schemaVersion === 1 && record.snapshot.campaign.inventory.equipment.some(item => item.instanceId === id);
    (equipment ? setEquipmentIds : setItemIds)(ids => ids.includes(id) ? ids.filter(current => current !== id) : [...ids, id]);
  };

  useEffect(() => {
    if (mode !== "loadout") return;
    intro.ref.current?.querySelector<HTMLButtonElement>('.map-supplies button[aria-label="关闭出征行囊"]')?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest(".map-supplies")) supplyTrigger.current?.focus({ preventScroll: true });
    };
  }, [mode, intro.ref]);

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    const controller = createMapScene(container, {
      intro: true,
      locations: locations.map(location => ({ ...location })),
      onReady: () => setLoading(false),
      onError: () => {
        setError(true);
        setLoading(false);
      },
      onLocationSelect: (location) => openNode(location.id)
    });
    sceneRef.current = controller;
    controller.setIntroState(introState.current);
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
  useEffect(() => { sceneRef.current?.setReducedMotion(intro.reduced); }, [intro.reduced, locations]);
  useLayoutEffect(() => { sceneRef.current?.setIntroState(intro.state); }, [intro.state]);

  const activeLocation = activeNode
    ? locations.find((location) => location.id === activeNode)
    : undefined;
  const activeQuestSide = activeLocation ? QUEST_SIDE[activeLocation.id] : undefined;
  const destination = activeNode ? departureDestination(manor, activeNode) : undefined;
  /* 进行中的远征会让所有路线暂不可选，委托书仍要认得这里的路线：
     先取可出发的那条，否则按当前路线的简报认回同一条。 */
  const nodeRoutes = manor && activeNode ? manor.destinations.filter(d => d.nodeId === activeNode) : [];
  const knownRoute = destination ?? nodeRoutes.find(d => d.brief.flavor === manor?.brief.flavor) ?? nodeRoutes[0];
  const commissions = directorCommissions(record, knownRoute?.routeId);
  const dossier = activeLocation && (() => {
    const id = activeLocation.id, plain = findQuestBrief(id);
    const hasRoute = record.schemaVersion === 1 ? nodeIds.includes(id) : !!knownRoute;
    const status: SortieDossierStatus = !hasRoute ? "closed" : activeRunId(record) ? "active" : game.status !== "ready" ? "saving" : airpBusy ? "preparing" : "ready";
    const brief: QuestBrief = knownRoute
      ? {nodeId: id, sceneImageUrl: id === "tower" ? manorHallPrint : plain?.sceneImageUrl, ...knownRoute.brief, yields: id === "cave" && destination ? plain!.yields : []}
      : {nodeId: id, sceneImageUrl: plain?.sceneImageUrl, flavor: hasRoute ? "带上伙伴进入裂隙，在出口层选择带宝离场或继续深入。" : "", threats: [], yields: []};
    const activeRef = record.schemaVersion !== 1 ? record.snapshot.campaign.activeRunRef as {kind?: string} | null : null;
    return {
      status, brief,
      route: knownRoute && {layerCount: knownRoute.layerCount, exitLayers: knownRoute.exitLayers, ending: knownRoute.ending},
      notice: status === "closed" ? "此处当前未开放远征。" : status !== "ready" ? null
        : !nodeIds.includes(id) ? "此处当前无法出发，请先完成开场或进行中的剧情。" : sortie.rejection,
      resumeLabel: activeRef?.kind === "memory" ? "继续回忆" : "继续远征",
    };
  })();
  const bag = manor || record.schemaVersion === 1 ? {
    items: supplies.filter(item => item.selected).map(({id, name, icon, quantity}) => ({id, name, icon, quantity})),
    limit: record.schemaVersion === 1 ? supplies.length : loadout.itemLimit,
  } : undefined;

  return (
    <Stage canvasClassName="abyssa-map-canvas">
      <AbyssaProvider className="abyssa-map-page" density="compact" data-map-reduced={intro.reduced}>
        <div ref={intro.ref} className="map-board" data-map-intro={intro.state}
          onKeyDown={event => { if (event.key === "Escape" && mode !== "map") { event.preventDefault(); event.stopPropagation(); sortie.dismiss(); } }}>
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
            style={{ "--map-focus-duration": `${MAP_FOCUS_MS}ms`, "--map-focus-ease": `cubic-bezier(${MAP_FOCUS_EASE.join(",")})` } as CSSProperties}
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
              inert={mode === "loadout"}
              mode={stageMode}
              questSide={stageMode === "pop" ? activeQuestSide : undefined}
              roster={sortieRoster}
              leader={sortieLeader}
              party={sortie.party}
              delegateLocked
              /* 委托态点人物也能进编队，并且编完要回到当前委托。 */
              onOpen={() => sortie.openTeam(activeNode)}
              onRemoveMember={sortie.toggleMember}
              onToggleCommand={sortie.toggleCommand}
            />

            <AnimatePresence initial={false}>
            {mode === "team" && <MapPanel key="team" kind="team">
              <SortieRosterPanel
                roster={sortieRoster}
                leader={sortieLeader}
                party={sortie.party}
                onToggleMember={sortie.toggleMember}
                inspectHref={id => gameHref("character-status", recordLocator(record), {characterId: id, tab: "summary", from: "map"})}
                onClose={sortie.finishTeam}
              />
            </MapPanel>}

            {mode === "pop" && activeLocation && dossier && <MapPanel key={`quest-${activeNode}`} kind="quest" side={activeQuestSide}>
              <SortieDossier
                location={activeLocation}
                side={activeQuestSide!}
                {...dossier}
                commissions={commissions?.some(task => task.active) && <CommissionList tasks={commissions} title="路线委托"/>}
                roster={sortieRoster}
                leader={sortieLeader}
                party={sortie.party}
                bag={bag}
                error={airpError || undefined}
                bagTriggerRef={supplyTrigger}
                onEditParty={() => sortie.openTeam(activeLocation.id)}
                onEditBag={sortie.openLoadout}
                onDepart={sortie.depart}
                onResume={() => navigate(gameHref("battle", recordLocator(record)), {channel: dossier.resumeLabel, entry: "restore"})}
                onClose={sortie.closeAll}
              />
            </MapPanel>}
            {mode === "loadout" && <MapPanel key="loadout" kind="loadout"><MapLoadoutPanel items={supplies} onQuantity={manor?.facilities ? loadout.setQuantity : undefined}
              limit={record.schemaVersion === 1 ? Math.max(6, supplies.length) : loadout.itemLimit}
              notice={loadout.storageUnavailable ? "此窗口无法保留方案，请在本页确认后出发。" : record.schemaVersion === 1 ? "携带已编入伙伴的物品与装备；出发前仍可调整。" : record.contentRef.rulesVersion === 4 && record.contentRef.contentVersion >= 3 ? undefined : "出发前将所选配给免费补足。"}
              onToggle={toggleSupply} onClose={sortie.finishLoadout}/></MapPanel>}
            </AnimatePresence>
          </section>
        </MapWoodFrame>
        </div>
        <CampaignPanel />
        {!commissions && <aside className="airp-map-note"><AirpPanel/></aside>}
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
