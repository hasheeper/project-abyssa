import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import type { RpActor, RpMessage } from "../../shared/ui/patterns/RpScene";
import kaelPortrait from "../../assets/characters/portraits/kael.png";
import {
  DEFAULT_MANSION_RECTANGLES,
  DEFAULT_MANSION_REGIONS
} from "../../content/mansion/defaultRegions";
import type {
  MansionPsdManifest
} from "../../shared/domain/mansion/regions";
import { Stage } from "../../shared/stage";
import { MansionLedger } from "./MansionLedger";
import { resolveRoomLight } from "./lighting";
import type { RoomLight } from "./lighting";
import { InventoryDialog } from "../../shared/ui/patterns/InventoryDialog";
import { MansionPhaseBar } from "./MansionPhaseBar";
import { AdvStage } from "../../shared/presentation/adv/AdvStage";
import {
  fallbackRoomDetail,
  MANSION_CHARACTERS,
  MANSION_PHASES,
  MANSION_ITEM_CATEGORIES,
  MANSION_ROOM_DETAILS,
  MANSION_WORLD_HEIGHT,
  MANSION_WORLD_WIDTH
} from "./data";
import type {
  MansionCharacter,
  MansionPhaseId
} from "./data";
import {
  CHARACTER_AVATAR,
  MIN_PAN,
  PAN_KEY_STEP,
  PAN_STEP,
  regionAnchor,
  regionBounds,
  roomFocusTransform
} from "./mansion-geometry";
import type { DrawerSide, SceneRegion } from "./mansion-geometry";
import { useMansionViewport } from "./useMansionViewport";
import { useMansionEstate } from "./useMansionEstate";
import {
  MAX_FACILITY_LEVEL,
  REPAIR_STEPS,
  STOCK_CAPACITY,
  STOCK_COLUMNS,
  STOCK_ROWS
} from "./mansion-state";
import { MansionWorld, type CharacterPlacement } from "./MansionWorld";
import { MansionRoomDrawer } from "./MansionRoomDrawer";

/** 右侧宿舍群与大门会被右侧详情卡遮挡，因此只为这五个区域换到左侧。 */
const LEFT_DRAWER_REGION_IDS = new Set(["eustice", "norma", "elora", "kororo", "gate"]);

const MANSION_SPRITE_BASE = import.meta.env.DEV
  ? "/src/assets/characters/paper-dolls/"
  : `${import.meta.env.BASE_URL}character-art/`;

export function MansionPage() {
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueStageRef = useRef<HTMLDivElement>(null);

  const [manifest, setManifest] = useState<MansionPsdManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [loadedLayers, setLoadedLayers] = useState<Set<string>>(() => new Set());
  const [failedLayers, setFailedLayers] = useState<Set<string>>(() => new Set());
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const {
    viewportRef,
    panX,
    dragging,
    shiftPan,
    isClickSuppressed,
    handlePointerDown,
    handlePointerMove,
    finishPointerDrag,
    handleWheel
  } = useMansionViewport({ roomFocused: selectedRegionId !== null });
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [dialogueTyping, setDialogueTyping] = useState(false);
  const [dialogueSettled, setDialogueSettled] = useState(false);
  const estate = useMansionEstate();
  const {
    phase,
    day,
    funds,
    levels,
    upgrading,
    repairProgress,
    damaged,
    readyProduction,
    stockOpen,
    toast,
    inventoryEntries,
    stockTotal
  } = estate;
  const stockButtonRef = useRef<HTMLButtonElement>(null);

  const sceneRegions = useMemo<SceneRegion[]>(
    () => [
      ...DEFAULT_MANSION_RECTANGLES.map((region) => ({ ...region, shape: "rectangle" as const })),
      ...DEFAULT_MANSION_REGIONS.map((region) => ({ ...region, shape: "polygon" as const }))
    ],
    []
  );

  const regionById = useMemo(
    () => new Map(sceneRegions.map((region) => [region.id, region])),
    [sceneRegions]
  );

  const visibleLayers = useMemo(
    () => manifest?.layers
      .filter((layer) => layer.visible)
      .sort((left, right) => left.order - right.order) ?? [],
    [manifest]
  );

  const characterPlacements = useMemo<CharacterPlacement[]>(() => {
    const active = MANSION_CHARACTERS
      .map((character) => ({ character, roomId: character.schedule[phase] }))
      .filter((item): item is { character: MansionCharacter; roomId: string } => Boolean(item.roomId));
    const roomTotals = new Map<string, number>();
    const roomIndexes = new Map<string, number>();

    active.forEach(({ roomId }) => roomTotals.set(roomId, (roomTotals.get(roomId) ?? 0) + 1));

    return active.flatMap(({ character, roomId }) => {
      const region = regionById.get(roomId);
      if (!region) return [];
      const total = roomTotals.get(roomId) ?? 1;
      const index = roomIndexes.get(roomId) ?? 0;
      roomIndexes.set(roomId, index + 1);
      const anchor = regionAnchor(region, "bottom-center");
      /* 间距按房间宽度自适应。
         定值 114 时,昏相位的小广场(237 宽)挤 5 人 -> 跨度 544,
         实测 4 个头像横向溢出房间。
         5 x 88 = 440 塞进 237 物理上必须重叠,所以**不设下限**:
         直接按房间可用宽平分,头像重叠一部分但保证全部在房间内。 */
      const bounds = regionBounds(region);
      const usable = bounds.right - bounds.left - CHARACTER_AVATAR;
      const step = total > 1 ? Math.min(126, usable / (total - 1)) : 0;
      return [{
        character,
        roomId,
        x: anchor.x + (index - (total - 1) / 2) * step,
        y: anchor.y
      }];
    });
  }, [phase, regionById]);

  /**
   * 夜间亮灯的房间。
   * 两个来源合并:lighting.ts 的固定光源(壁炉/篝火/结界/信号灯/符纸)
   * + 驻在驱动(夜里有人就点一盏常规灯)。
   * 世界观覆盖优先 —— 烽火台有人也不点火。
   */
  const roomLights = useMemo(() => {
    if (phase !== "night") return [];
    const occupied = new Set(
      MANSION_CHARACTERS
        .map((character) => character.schedule.night)
        .filter((roomId): roomId is string => Boolean(roomId))
    );
    return sceneRegions
      .map((region) => ({
        region,
        light: resolveRoomLight(region.id, phase, occupied.has(region.id))
      }))
      .filter((item): item is { region: SceneRegion; light: RoomLight } =>
        item.light !== null
      );
  }, [phase, sceneRegions]);

  const selectedRegion = selectedRegionId ? regionById.get(selectedRegionId) ?? null : null;
  const selectedDetail = selectedRegion
    ? MANSION_ROOM_DETAILS[selectedRegion.id] ?? fallbackRoomDetail(selectedRegion.kind)
    : null;
  const selectedDrawerSide: DrawerSide = selectedRegion && LEFT_DRAWER_REGION_IDS.has(selectedRegion.id)
    ? "left"
    : "right";
  const roomCamera = selectedRegion
    ? roomFocusTransform(selectedRegion, selectedDrawerSide)
    : { x: panX, y: 0, zoom: 1 };
  const activeCharacter = activeCharacterId
    ? MANSION_CHARACTERS.find((character) => character.id === activeCharacterId) ?? null
    : null;
  const activeDialogueActors = useMemo<RpActor[]>(() => activeCharacter ? [{
    id: activeCharacter.id,
    name: activeCharacter.name,
    secondaryName: activeCharacter.secondaryName,
    expression: "a",
    portrait: activeCharacter.id === "kael" ? kaelPortrait : undefined,
    spriteBaseUrl: activeCharacter.id === "kael" ? undefined : MANSION_SPRITE_BASE
  }] : [], [activeCharacter]);
  const activeDialogueMessages = useMemo<RpMessage[]>(() => activeCharacter ? [{
    id: `${activeCharacter.id}-${phase}`,
    kind: "say",
    actorId: activeCharacter.id,
    expression: "a",
    text: activeCharacter.lines[phase]
  }] : [], [activeCharacter, phase]);
  /** 对话开启时,世界与四角挂件一律退出可交互与无障碍树。
   *  原先这个三元在 7 处重复写成 `activeCharacter ? true : undefined`。 */
  const chromeInert = activeCharacter ? true : undefined;

  useEffect(() => {
    if (selectedRegionId) {
      const raf = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
      return () => window.cancelAnimationFrame(raf);
    }
    return undefined;
  }, [selectedRegionId]);

  useEffect(() => {
    if (activeCharacterId) {
      const raf = window.requestAnimationFrame(() => dialogueStageRef.current?.focus());
      return () => window.cancelAnimationFrame(raf);
    }
    return undefined;
  }, [activeCharacterId]);

  useEffect(() => {
    const manifestUrl = `${import.meta.env.BASE_URL}mansion-map/manifest.json`;
    let active = true;
    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        return response.json() as Promise<MansionPsdManifest>;
      })
      .then((value) => {
        if (!active) return;
        if (value.width !== MANSION_WORLD_WIDTH || value.height !== MANSION_WORLD_HEIGHT) {
          throw new Error("unexpected mansion canvas size");
        }
        setManifest(value);
      })
      .catch(() => {
        if (active) setManifestError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const restoreLastFocus = () => {
    window.requestAnimationFrame(() => lastFocusRef.current?.focus());
  };

  const closeRegion = () => {
    setSelectedRegionId(null);
    restoreLastFocus();
  };

  const closeCharacter = () => {
    setActiveCharacterId(null);
    setDialogueTyping(false);
    setDialogueSettled(false);
    restoreLastFocus();
  };

  const advanceCharacterDialogue = () => {
    if (!dialogueSettled) {
      setDialogueTyping(false);
      return;
    }
    closeCharacter();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isControl = target?.matches("button, input, textarea, select, [contenteditable='true']");
      if (event.key === "Escape") {
        if (activeCharacterId) closeCharacter();
        else if (selectedRegionId) closeRegion();
        return;
      }
      if (activeCharacterId) {
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
          if (isControl) return;
          event.preventDefault();
          advanceCharacterDialogue();
        }
        return;
      }
      if (selectedRegionId) return;
      if (isControl) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftPan(PAN_KEY_STEP);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftPan(-PAN_KEY_STEP);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCharacterId, dialogueSettled, selectedRegionId, shiftPan]);

  const openRegion = (regionId: string) => {
    if (isClickSuppressed()) return;
    if (selectedRegionId === regionId) {
      closeRegion();
      setHoveredRegionId(regionId);
      return;
    }
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setActiveCharacterId(null);
    setHoveredRegionId(null);
    setSelectedRegionId(regionId);
  };

  const previewPhase = (nextPhase: MansionPhaseId) => {
    if (nextPhase === phase) return;
    estate.previewPhase(nextPhase);
    setActiveCharacterId(null);
  };

  const advancePhase = () => {
    estate.advancePhase();
    setActiveCharacterId(null);
  };

  const collectProduction = estate.collectProduction;
  const startUpgrade = estate.startUpgrade;
  const promoteFacility = estate.promoteFacility;

  const activateCharacter = (character: MansionCharacter) => {
    if (isClickSuppressed()) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelectedRegionId(null);
    setDialogueTyping(true);
    setDialogueSettled(false);
    setActiveCharacterId(character.id);
  };

  const selectedOccupants = selectedRegion
    ? characterPlacements
      .filter((placement) => placement.roomId === selectedRegion.id)
      .map((placement) => placement.character)
    : [];
  const selectedLevel = selectedRegion && selectedDetail
    ? levels[selectedRegion.id] ?? selectedDetail.level
    : 0;
  const selectedUpgradeRemaining = selectedRegion ? upgrading[selectedRegion.id] : undefined;
  /** 已达最高档:修缮与升级都到顶。 */
  const selectedRepairComplete = selectedLevel >= MAX_FACILITY_LEVEL;
  const selectedRepairSteps = selectedRegion ? repairProgress[selectedRegion.id] ?? 0 : 0;
  /** 进度满格且未到顶 -> 该出现升级键。 */
  const selectedCanPromote = selectedRepairSteps >= REPAIR_STEPS && !selectedRepairComplete;

  const navigateTo = (href: string) => {
    window.location.assign(href);
  };

  const useCompositeFallback = manifestError || failedLayers.size > 0;
  const loading = !useCompositeFallback && (!manifest || loadedLayers.size < visibleLayers.length);

  const markLayerLoaded = (layerId: string) => {
    setLoadedLayers((current) => {
      if (current.has(layerId)) return current;
      const next = new Set(current);
      next.add(layerId);
      return next;
    });
  };

  const markLayerFailed = (layerId: string) => {
    setFailedLayers((current) => {
      if (current.has(layerId)) return current;
      const next = new Set(current);
      next.add(layerId);
      return next;
    });
  };

  return (
    <Stage background="#0a1114" canvasClassName="mansion-stage-canvas">
      <AbyssaProvider className="mansion-app" density="compact" data-phase={phase}>
        <MansionWorld
          viewportRef={viewportRef}
          dragging={dragging}
          roomFocused={Boolean(selectedRegion)}
          inert={chromeInert}
          roomCamera={roomCamera}
          visibleLayers={visibleLayers}
          loadedLayerCount={loadedLayers.size}
          useCompositeFallback={useCompositeFallback}
          loading={loading}
          sceneRegions={sceneRegions}
          selectedRegionId={selectedRegionId}
          hoveredRegionId={hoveredRegionId}
          readyProduction={readyProduction}
          levels={levels}
          repairProgress={repairProgress}
          damaged={damaged}
          upgrading={upgrading}
          characterPlacements={characterPlacements}
          roomLights={roomLights}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onWheel={handleWheel}
          onLayerLoad={markLayerLoaded}
          onLayerError={markLayerFailed}
          onHoverRegion={setHoveredRegionId}
          onOpenRegion={openRegion}
          onCollectProduction={collectProduction}
          onActivateCharacter={activateCharacter}
        />

        {/* 上下边缘 scrim —— 只负责让浮层文字在任意美术上可读。
            pointer-events:none 且不占布局高度,所以世界仍是满幅的。
            这是「不加底板也能读」的关键:底板会吞点击,scrim 不会。 */}
        <div className="mansion-scrim" aria-hidden="true" data-edge="top" />
        <div className="mansion-scrim" aria-hidden="true" data-edge="bottom" />

        {/* ============ 左上:身份 ============ */}
        <div
          className="mansion-corner mansion-corner--identity"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
        >
          <Nameplate
            className="mansion-identity__plate"
            name="守望者之崖"
            secondaryName="WATCHERS' BLUFF"
          />
        </div>

        {/* ============ 顶部中央:相位(时间) ============
            时间归顶部中央是经典 RPG 定式。整条栏是一张 SVG 金属牌,
            构造与 RpgHeader 同源(三层描边 7/4/2 + 装饰线 + 铆点),
            不是 div+border 的网页顶栏。详见 MansionPhaseBar 顶部。 */}
        <div
          className="mansion-corner mansion-corner--phase"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
        >
          <MansionPhaseBar
            phases={MANSION_PHASES}
            value={phase}
            day={day}
            onSelect={previewPhase}
            onAdvance={advancePhase}
          />
        </div>

        {/* ============ 右上:状态 + 资源 + 库存 ============ */}
        <div
          className="mansion-corner mansion-corner--status"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
        >
          <MansionLedger
            publicFund={funds.public}
            partyFund={funds.party}
            stockTotal={stockTotal}
            stockOpen={stockOpen}
            onToggleStock={estate.toggleStock}
            stockButtonRef={stockButtonRef}
          />
        </div>

        {/* ============ 左右边缘:平移 ============
            不再用实心 ArrowButton。改成「边缘黑色滤罩 + 无边框键」:
            整条边缘是一块渐隐暗罩,箭头直接画在上面,没有底板也没有描边。
            实心键压在满幅世界上会像贴了两枚贴纸;暗罩本身就是「画面到此为止」
            的视觉提示,顺带压暗边缘让中央更亮。 */}
        <button
          type="button"
          className="mansion-pan-edge mansion-pan-edge--left"
          aria-label="向左浏览"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
          onClick={() => shiftPan(PAN_STEP)}
          disabled={Boolean(selectedRegion) || panX >= 0}
        >
          <svg viewBox="0 0 24 40" aria-hidden="true">
            <path d="M16 5 L7 20 L16 35" />
          </svg>
        </button>
        <button
          type="button"
          className="mansion-pan-edge mansion-pan-edge--right"
          aria-label="向右浏览"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
          onClick={() => shiftPan(-PAN_STEP)}
          disabled={Boolean(selectedRegion) || panX <= MIN_PAN}
        >
          <svg viewBox="0 0 24 40" aria-hidden="true">
            <path d="M8 5 L17 20 L8 35" />
          </svg>
        </button>

        {selectedRegion && selectedDetail && (
          <MansionRoomDrawer
            region={selectedRegion}
            detail={selectedDetail}
            side={selectedDrawerSide}
            inert={chromeInert}
            closeButtonRef={drawerCloseRef}
            occupants={selectedOccupants}
            level={selectedLevel}
            upgradeRemaining={selectedUpgradeRemaining}
            repairComplete={selectedRepairComplete}
            repairSteps={selectedRepairSteps}
            canPromote={selectedCanPromote}
            funds={funds}
            readyProduction={readyProduction}
            onClose={closeRegion}
            onCollectProduction={collectProduction}
            onStartUpgrade={startUpgrade}
            onPromoteFacility={promoteFacility}
            onNavigate={navigateTo}
          />
        )}

        {activeCharacter && (
          <div
            ref={dialogueStageRef}
            className="mansion-adv-dialogue"
            data-no-pan
            data-state={dialogueSettled ? "settled" : "typing"}
            role="dialog"
            aria-modal="true"
            aria-label={`与${activeCharacter.name}交谈`}
            tabIndex={-1}
            onClick={advanceCharacterDialogue}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                dialogueCloseRef.current?.focus();
              }
            }}
          >
            <AdvStage
              key={`${activeCharacter.id}-${phase}`}
              actors={activeDialogueActors}
              messages={activeDialogueMessages}
              typing={dialogueTyping}
              onTypingEnd={() => setDialogueSettled(true)}
            />
            <IconButton
              ref={dialogueCloseRef}
              className="mansion-adv-dialogue__close"
              label="关闭对话"
              icon="close"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                closeCharacter();
              }}
            />
            <div className="mansion-adv-dialogue__cue" aria-hidden="true">
              <span>{dialogueSettled ? "点击返回洋馆" : "点击显示全文"}</span>
              <small>SPACE / ENTER</small>
            </div>
          </div>
        )}

        {/* 物品栏挂在四角挂件**之外** —— 挂件在对话开启时会被 inert,
            而库存弹窗自己就是模态,不该继承那份 inert。 */}
        <InventoryDialog
          open={stockOpen}
          onClose={estate.closeStock}
          title="领地库存"
          signboard="领地库存"
          signboardSecondary="ESTATE STORAGE"
          entries={inventoryEntries}
          columns={STOCK_COLUMNS}
          rows={STOCK_ROWS}
          capacity={STOCK_CAPACITY}
          categories={MANSION_ITEM_CATEGORIES}
          emptyHint="尚未收取本轮产出。到各房间的产出图钉上收取。"
          returnFocusRef={stockButtonRef}
        />

        {toast && <div className="mansion-toast" role="status" data-no-pan>{toast}</div>}
      </AbyssaProvider>
    </Stage>
  );
}
