import { navigateTo as navigateGame } from "../../shared/routing/location";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import type { RpActor, RpMessage } from "../../shared/ui/patterns/RpScene";
import { Stage } from "../../shared/stage";
import { MansionLedger } from "./MansionLedger";
import { MansionUtilityRail } from "./MansionUtilityRail";
import type { CampaignReportControls, CampaignReportView } from "../../game-client/CampaignJournal";
import { MANSION_ATMOSPHERE, MANSION_NIGHT_LIGHTS, MANSION_SCENE_REGIONS } from "./mansion-scenery";
import { InventoryDialog } from "../../shared/ui/patterns/InventoryDialog";
import { ResourceInventoryDialog } from "../../shared/ui/patterns/ResourceInventoryDialog";
import { MansionPhaseBar } from "./MansionPhaseBar";
import { AdvStage } from "../../shared/presentation/adv/AdvStage";
import { CHARACTER_EMOTION_PROFILES } from "../../content/presentation/character-emotions";
import { MANSION_EMOTIONS } from "../../content/presentation/mansion-emotions";
import {
  fallbackRoomDetail,
  MANSION_CHARACTERS,
  MANSION_PHASES,
  MANSION_ITEM_CATEGORIES,
  MANSION_ROOM_DETAILS
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
import type { DrawerSide } from "./mansion-geometry";
import { useMansionViewport } from "./useMansionViewport";
import { useMansionEstate } from "./useMansionEstate";
import { GameProvider, GameGate, useGameSession, useGameState } from "../../game-client/react";
import { AirpStory } from "../../game-client/AirpStory";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { GrowthStory } from "../../game-client/GrowthStory";
import { FirstMorningStory } from "../../game-client/FirstMorningStory";
import { growthStories, teamMilestoneStory } from "../../content/presentation/growth-stories";
import {
  MAX_FACILITY_LEVEL,
  REPAIR_STEPS,
  STOCK_COLUMNS,
  STOCK_ROWS
} from "./mansion-state";
import { MansionWorld, type CharacterPlacement } from "./MansionWorld";
import { MansionRoomDrawer } from "./MansionRoomDrawer";
import { useMansionPresentation } from "./useMansionPresentation";
import { MansionTimeLoading } from "./MansionTimeLoading";
import { MansionWeatherDebug } from "./MansionWeatherDebug";
import { weatherLabel, type MansionWeather } from "./mansion-weather";
import { useMansionIntro } from "./useMansionIntro";

const ResidentCampaignPanel = memo(CampaignPanel);
const ResidentInventory = memo(ResourceInventoryDialog);

/** 右侧宿舍群与大门会被右侧详情卡遮挡，因此只为这五个区域换到左侧。 */
const LEFT_DRAWER_REGION_IDS = new Set(["eustice", "norma", "elora", "kororo", "gate"]);

const MANSION_SPRITE_BASE = import.meta.env.DEV
  ? "/src/assets/characters/paper-dolls/"
  : `${import.meta.env.BASE_URL}character-art/`;

export function MansionPage() {
  return <GameProvider><GameGate allowOpening allowAirp><MansionEntry /></GameGate></GameProvider>;
}
function MansionEntry() {
  const {record}=useGameState();
  const session = useGameSession(), narrative = record && session.runtime.queries.narrative(record);
  // Keep the outgoing opening mounted while its cinematic handoff completes.
  const opening=useRef(record?.schemaVersion===4 && record.snapshot.campaign.opening?.status==="playing");
  if (opening.current) return <FirstMorningStory/>;
  const locked = !!narrative?.locked;
  return <>
    <div className="mansion-scene-resident" hidden={locked}><MansionScene suspended={locked}/></div>
    {locked && <AirpStory/>}
  </>;
}
function MansionScene({suspended = false}: {suspended?: boolean}) {
  const game = useGameState();
  const session = useGameSession();
  const [weather,setWeather]=useState<MansionWeather>("clear");
  const [growthReview,setGrowthReview] = useState<string|null>(null);
  const [growthNotice,setGrowthNotice] = useState<string|null>(null);
  const [reportView, setReportView] = useState<CampaignReportView | null>(null);
  const [stockPresented, setStockPresented] = useState(false);
  const [reportsPresented, setReportsPresented] = useState({journal: false, preparation: false});
  const utilityPresented = stockPresented || reportsPresented.journal || reportsPresented.preparation;
  const campaign = game.record?.schemaVersion===4 ? game.record.snapshot.campaign : null;
  const growthSession = campaign?.stories.find(s=>s.id===campaign.activeStoryId && growthStories[s.eventId]);
  const growthEventId = growthReview ?? growthSession?.eventId;
  useEffect(() => { if (growthEventId || suspended) setReportView(null); }, [growthEventId, suspended]);
  useEffect(()=>{
    if(!growthNotice) return;
    const timer=window.setTimeout(()=>setGrowthNotice(null),6000);
    return ()=>window.clearTimeout(timer);
  },[growthNotice]);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueStageRef = useRef<HTMLDivElement>(null);

  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const clearRoomHover = useCallback(() => setHoveredRegionId(null), []);
  const {
    viewportRef,
    panX,
    dragging,
    hoverSuppressed,
    isHoverSuppressed,
    resumeHover,
    shiftPan,
    isClickSuppressed,
    handlePointerDown,
    handlePointerMove,
    finishPointerDrag,
    handleWheel
  } = useMansionViewport({ roomFocused: selectedRegionId !== null, onDragStart: clearRoomHover });
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [dialogueTyping, setDialogueTyping] = useState(false);
  const [dialogueSettled, setDialogueSettled] = useState(false);
  const estate = useMansionEstate();
  const {
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
  const presentation = useMansionPresentation({
    weather,
    clock: {day: estate.day, phase: estate.phase},
    next: estate.time?.next ?? null,
    canAdvance: game.status === "ready" && !!estate.time && !estate.time.blocked && !activeCharacterId && !growthEventId && !stockOpen && !reportView,
    suspended,
    sceneRef: viewportRef,
    advance: estate.advancePhase,
    refresh: async () => {
      await session.refresh();
      if (session.getSnapshot().status !== "ready") throw Error("读取进度尚未完成");
    }
  });
  const {day, phase} = presentation.clock;
  const intro = useMansionIntro(presentation.step === "ready", suspended, viewportRef);
  const stockButtonRef = useRef<HTMLButtonElement>(null);
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  const preparationButtonRef = useRef<HTMLButtonElement>(null);

  const sceneRegions = MANSION_SCENE_REGIONS;

  const regionById = useMemo(
    () => new Map(sceneRegions.map((region) => [region.id, region])),
    [sceneRegions]
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

  // Static lighting is baked into the scenery. Only three small, unfiltered
  // opacity glows remain live, and none is mounted outside the night phase.
  const roomLights = useMemo(() => phase === "night" ? MANSION_NIGHT_LIGHTS.filter(item => item.light.flicker) : [], [phase]);

  const selectedRegion = selectedRegionId ? regionById.get(selectedRegionId) ?? null : null;
  const selectedDetail = selectedRegion
    ? MANSION_ROOM_DETAILS[selectedRegion.id] ?? fallbackRoomDetail(selectedRegion.kind)
    : null;
  const selectedDrawerSide: DrawerSide = selectedRegion && LEFT_DRAWER_REGION_IDS.has(selectedRegion.id)
    ? "left"
    : "right";
  const roomCamera = useMemo(() => selectedRegion
    ? roomFocusTransform(selectedRegion, selectedDrawerSide)
    : { x: panX, y: 0, zoom: 1 }, [selectedRegion, selectedDrawerSide, panX]);
  const activeCharacter = activeCharacterId
    ? MANSION_CHARACTERS.find((character) => character.id === activeCharacterId) ?? null
    : null;
  const activeDialogueActors = useMemo<RpActor[]>(() => activeCharacter ? [{
    id: activeCharacter.id,
    name: activeCharacter.name,
    secondaryName: activeCharacter.secondaryName,
    expression: "a",
    emotionProfile: CHARACTER_EMOTION_PROFILES[activeCharacter.id],
    spriteBaseUrl: MANSION_SPRITE_BASE
  }] : [], [activeCharacter]);
  const activeDialogueMessages = useMemo<RpMessage[]>(() => activeCharacter ? [{
    id: `${activeCharacter.id}-${phase}`,
    kind: "say",
    actorId: activeCharacter.id,
    emotion: MANSION_EMOTIONS[activeCharacter.id]?.[phase] ?? "neutral",
    text: activeCharacter.lines[phase]
  }] : [], [activeCharacter, phase]);
  /** 对话开启时,世界与四角挂件一律退出可交互与无障碍树。
   *  原先这个三元在 7 处重复写成 `activeCharacter ? true : undefined`。 */
  const chromeInert = activeCharacter || growthEventId || presentation.blocked || reportView || stockOpen || utilityPresented ? true : undefined;

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

  const restoreLastFocus = useCallback(() => {
    window.requestAnimationFrame(() => lastFocusRef.current?.focus());
  }, []);

  const closeRegion = useCallback(() => {
    setSelectedRegionId(null);
    restoreLastFocus();
  }, [restoreLastFocus]);

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
      if (growthEventId || presentation.blocked || reportView || stockOpen || utilityPresented) return;
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
  }, [activeCharacterId, dialogueSettled, selectedRegionId, shiftPan, growthEventId, presentation.blocked, reportView, stockOpen, utilityPresented]);

  const openRegion = useCallback((regionId: string) => {
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
  }, [isClickSuppressed, selectedRegionId, closeRegion]);
  const hoverRegion = useCallback((regionId: string | null) => {
    if (!isHoverSuppressed()) setHoveredRegionId(regionId);
  }, [isHoverSuppressed]);

  const previewPhase = (nextPhase: MansionPhaseId) => {
    if (nextPhase === phase) return;
    estate.previewPhase(nextPhase);
    setActiveCharacterId(null);
  };

  const advancePhase = () => {
    if (game.status !== "ready" || !estate.time || estate.time.blocked) return;
    setHoveredRegionId(null);
    presentation.advance();
  };

  const collectProduction = estate.collectProduction;
  const startUpgrade = estate.startUpgrade;
  const promoteFacility = estate.promoteFacility;

  const activateCharacter = useCallback((character: MansionCharacter) => {
    if (isClickSuppressed()) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelectedRegionId(null);
    setDialogueTyping(true);
    setDialogueSettled(false);
    setActiveCharacterId(character.id);
  }, [isClickSuppressed]);

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
    if (href.includes("dice")) return;
    navigateGame(gameHref(href.includes("shop") ? "shop" : "map", recordLocator(game.record!)));
  };

  const menuHref = gameHref("menu", recordLocator(game.record!));
  const {closeStock, toggleStock} = estate;
  // Room hover/camera movement must not rerun the journal/expedition queries.
  const reportControls = useMemo<CampaignReportControls>(() => ({
    view: reportView, onViewChange: setReportView,
    onPresentChange: (view, present) => setReportsPresented(previous => previous[view] === present ? previous : {...previous, [view]: present}),
    returnFocusRefs: {journal: journalButtonRef, preparation: preparationButtonRef},
    renderEntries: actionable => <MansionUtilityRail active={stockOpen ? "stock" : reportView}
      stockTotal={stockTotal} actionable={actionable} inert={chromeInert}
      buttonRefs={{stock: stockButtonRef, journal: journalButtonRef, preparation: preparationButtonRef}}
      onOpen={entry => {
        if (chromeInert) return;
        setHoveredRegionId(null); setSelectedRegionId(null);
        if (entry === "stock") { setReportView(null); toggleStock(); }
        else { closeStock(); setReportView(entry); }
      }}/>,
  }), [reportView, stockOpen, stockTotal, chromeInert, closeStock, toggleStock]);

  return (
    <Stage background="#0a1114" canvasClassName="mansion-stage-canvas">
      <AbyssaProvider className="mansion-app" density="compact" data-phase={phase} data-weather={presentation.artwork?.weather??"clear"}
        data-ui-intro={intro} data-world-paused={!!chromeInert || suspended || intro !== "ready" || undefined}
        style={{"--mansion-grade": MANSION_ATMOSPHERE[phase].grade} as CSSProperties}
        inert={presentation.blocked || undefined}
        data-presentation={presentation.step} aria-busy={presentation.blocked}>
        <MansionWorld
          viewportRef={viewportRef}
          dragging={dragging}
          hoverSuppressed={hoverSuppressed}
          onResumeHover={resumeHover}
          roomFocused={Boolean(selectedRegion)}
          inert={chromeInert}
          roomCamera={roomCamera}
          artwork={presentation.artwork}
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
          onHoverRegion={hoverRegion}
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
            readOnly
            advanceDisabled={!estate.time || !!estate.time.blocked || game.status !== "ready" || presentation.blocked}
            advanceHint={estate.time?.blocked ?? (estate.time ? `推进至第 ${estate.time.next.day} 天 · ${MANSION_PHASES.find(p => p.id === estate.time!.next.phase)?.label}` : "此旧版档案不支持手动推进")}
            phases={MANSION_PHASES}
            value={phase}
            day={day}
            onSelect={previewPhase}
            onAdvance={advancePhase}
          />
        </div>

        <MansionWeatherDebug value={weather} disabled={!!chromeInert || !!selectedRegionId} onChange={setWeather}/>

        {/* ============ 右上:资源账簿 ============ */}
        <div
          className="mansion-corner mansion-corner--status"
          data-no-pan
          inert={chromeInert}
          aria-hidden={chromeInert}
        >
          <MansionLedger
            publicFund={funds.public}
            partyFund={funds.party}
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
            readOnly
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
        {game.record?.schemaVersion === 1 ? <InventoryDialog
          className="manor-utility"
          motionPreset="manor"
          open={stockOpen}
          onPresentChange={setStockPresented}
          onClose={estate.closeStock}
          title="领地库存"
          signboard="领地库存"
          signboardVariant="slim"
          entries={inventoryEntries}
          columns={STOCK_COLUMNS}
          rows={STOCK_ROWS}
          capacity={estate.capacity}
          categories={MANSION_ITEM_CATEGORIES}
          emptyHint="营地暂无物品。建设与生产尚未开放。"
          returnFocusRef={stockButtonRef}
        /> : <ResidentInventory
          className="manor-utility"
          motionPreset="manor"
          open={stockOpen}
          onPresentChange={setStockPresented}
          onClose={estate.closeStock}
          fixedEntries={estate.fixedEntries}
          entries={estate.sandboxEntries}
          returnFocusRef={stockButtonRef}
        />}

        {(growthNotice || toast) && <div className="mansion-toast" role="status" data-no-pan>{growthNotice || toast}</div>}
        <div inert={!!activeCharacter || !!growthEventId || presentation.blocked || stockOpen || stockPresented || undefined}>
          <ResidentCampaignPanel onReviewGrowth={setGrowthReview} report={reportControls}/>
        </div>
        {growthEventId && <div style={{position:"absolute",inset:0,zIndex:610,display:"grid",placeItems:"center",background:"var(--abyssa-rp-backdrop)"}}>
          <GrowthStory key={`${growthEventId}:${!!growthReview}`} eventId={growthEventId} review={!!growthReview} onClose={()=>{if(growthEventId===teamMilestoneStory.eventId)setGrowthNotice(teamMilestoneStory.resultText);setGrowthReview(null);}} onCompleted={milestone=>{
            setGrowthNotice(growthStories[growthEventId].resultText);
            setGrowthReview(milestone ? teamMilestoneStory.eventId : null);
          }}/>
        </div>}
      </AbyssaProvider>
      {presentation.step !== "ready" && <MansionTimeLoading
        key={presentation.id}
        phase={presentation.destination.phase} day={presentation.destination.day}
        fromPhase={presentation.origin.phase} step={presentation.step} motionPaused={presentation.motionPaused} suspended={suspended}
        weather={presentation.job==="weather" ? weather : undefined}
        state={presentation.step === "error" ? "error" : "loading"}
        message={presentation.step === "reveal" ? "景致已就绪" : presentation.job==="weather" ? `正在准备${weatherLabel(weather)}景致` : presentation.job === "advance" && (presentation.step === "cover" || presentation.step === "work") ? "正在确认时段" : "正在准备洋馆景致"}
        error={presentation.error} onRetry={presentation.retry} menuHref={menuHref} />}
    </Stage>
  );
}
