import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import type { RpActor, RpMessage } from "../../shared/ui/patterns/RpScene";
import kaelPortrait from "../../assets/png/kael.png";
import abyssaAvatar from "../../assets/avatar/abyssa.png";
import alvitrAvatar from "../../assets/avatar/alvitr.png";
import eloraAvatar from "../../assets/avatar/elora.png";
import eusticeAvatar from "../../assets/avatar/eustice.png";
import kororoAvatar from "../../assets/avatar/kororo.png";
import lenoreAvatar from "../../assets/avatar/lenore.png";
import mariettaAvatar from "../../assets/avatar/marietta.png";
import normaAvatar from "../../assets/avatar/norma.png";
import vivienneAvatar from "../../assets/avatar/vivienne.png";
import {
  DEFAULT_MANSION_RECTANGLES,
  DEFAULT_MANSION_REGIONS
} from "../../content/mansion/defaultRegions";
import type {
  MansionPsdManifest,
  MansionRectangle,
  MansionRegion
} from "../../shared/domain/mansion/regions";
import { Stage, STAGE_CANVAS_HEIGHT, STAGE_CANVAS_WIDTH } from "../../shared/stage";
import { MansionLedger } from "./MansionLedger";
import { resolveRoomLight } from "./lighting";
import type { RoomLight } from "./lighting";
import {
  DialogueBubble,
  MARKER_SIZE,
  PRODUCTION_GLYPHS,
  ProductionIcon,
  PromoteIcon,
  RepairIcon
} from "./MansionMarkers";
import { InventoryDialog } from "../../shared/ui/patterns/InventoryDialog";
import type { InventoryEntry } from "../../shared/ui/patterns/InventoryGrid";
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
  MansionFund,
  MansionPhaseId,
  MansionProduction
} from "./data";

/* ============ 几何:全部从共享画布推导,不写死任何一个数 ============
 *
 * 洋馆是**满幅铺底**型界面:世界铺满整块共享画布,UI 作为四角挂件浮在上面。
 * 因此它**不接入** stage.css 的画框契约(--abyssa-frame-interior 1250x787、
 * rail 22、k 0.78024)—— 那套令牌是给 shop/dice/map/character-status 这类
 * 有画框的板式界面用的,目标与「满幅」正相反。洋馆仍用 Stage 提供的
 * 1600x900 等比缩放,但可用区就是整块画布。
 * 若日后有人来「统一对齐画框」,等于把上下 190px 留白装回去,方向是错的。
 *
 * 世界 5162x1910 = 2.70:1,画布 1600x900 = 1.78:1。比例差太远,「吃满高度」
 * 与「一屏看全宽」物理上不可兼得,这里选满高:
 *   世界显示高 900(原 710),缩放 0.4712(原 0.3717,+26.8%)
 *   代价是一屏可见 65.8%(原 83.4%),横向拖拽成为核心操作 —— 而这本就是
 *   一张横向长卷剖面图,拖拽是它的第一交互。
 *
 * 这些量曾在 mansion.css 里各写一份死值(width:1918.86px、
 * scale(0.3717277487)),而 TSX 又用内联 style 写同样的值 —— 内联优先,
 * 于是 CSS 那两行是**无效的死代码**,只起误导作用。现已删除,单一来源在此。
 */
const WORLD_DISPLAY_HEIGHT = STAGE_CANVAS_HEIGHT;
const WORLD_SCALE = WORLD_DISPLAY_HEIGHT / MANSION_WORLD_HEIGHT;
const WORLD_DISPLAY_WIDTH = MANSION_WORLD_WIDTH * WORLD_SCALE;
const MIN_PAN = STAGE_CANVAS_WIDTH - WORLD_DISPLAY_WIDTH;

/** 平移步长 = 视口宽的 40%。曾写死 220,在 pan 范围翻到 -832 后要按 3.8 次
 *  才能到底;按视口比例推导后,不论世界多宽都稳定在 2.5 屏/全程。 */
const PAN_STEP = Math.round(STAGE_CANVAS_WIDTH * 0.4);
const PAN_KEY_STEP = Math.round(STAGE_CANVAS_WIDTH * 0.09);
const ROOM_FOCUS_ZOOM = 1.45;
const ROOM_FOCUS_CENTER_X = 590;
const ROOM_FOCUS_CENTER_Y = STAGE_CANVAS_HEIGHT / 2;
const ROOM_PREVIEW_WIDTH = 148;
const ROOM_PREVIEW_HEIGHT = 94;

/** 右侧宿舍群与大门会被右侧详情卡遮挡，因此只为这五个区域换到左侧。 */
const LEFT_DRAWER_REGION_IDS = new Set(["eustice", "norma", "elora", "kororo", "gate"]);
type DrawerSide = "left" | "right";

/** 初始视角对准主宅(hall 的横向中心 ≈ 世界 30% 处),而非原先拍出来的 -12。
 *  clampPan 是函数声明,已提升,此处调用安全;它依赖的 MIN_PAN 也已初始化。 */
const INITIAL_PAN = clampPan(STAGE_CANVAS_WIDTH / 2 - 0.3 * WORLD_DISPLAY_WIDTH);

/**
 * 角色头像。src/assets/avatar/ 的既有资产(battle 与 demo 已在用),
 * 236~280px 方图,正好够 44px 圆形标识用。
 * kael 与 tibby 无头像素材 -> 组件里降级为姓氏首字。
 */
const MANSION_AVATARS: Record<string, string> = {
  abyssa: abyssaAvatar,
  alvitr: alvitrAvatar,
  elora: eloraAvatar,
  eustice: eusticeAvatar,
  kororo: kororoAvatar,
  lenore: lenoreAvatar,
  marietta: mariettaAvatar,
  norma: normaAvatar,
  vivienne: vivienneAvatar
};

function ResidentAvatar({ character }: { character: MansionCharacter }) {
  const avatar = MANSION_AVATARS[character.id];
  return (
    <span className="mansion-room-card__resident-avatar" role="listitem" title={character.name}>
      {avatar ? (
        <img src={avatar} alt={character.name} draggable={false} />
      ) : (
        <span
          className="mansion-room-card__resident-placeholder"
          role="img"
          aria-label={`${character.name}头像待补`}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="11" r="6" />
            <path d="M5 29c.8-7.2 4.5-11 11-11s10.2 3.8 11 11" />
          </svg>
        </span>
      )}
    </span>
  );
}

const DRAG_THRESHOLD = 7;
const MAX_FACILITY_LEVEL = 4;
/* ============ 升级机制 ============
 * 原先是「付钱 -> 2 相位 -> 自动 +1 级」,一次修缮就跳一档。
 * 现在拆成两段:
 *   1. 修缮 REPAIR_STEPS 次,每次推进 1 格进度(付钱、等 1 相位施工)
 *   2. 进度满 -> 出现**独立的升级按钮**,点它才真正 +1 级并清零进度
 * 这样「档位」是离散的成果,「修缮进度」是通向下一档的过程,两条量分开表达。 */
const REPAIR_STEPS = 3;
/** 单次修缮的施工相位数。 */
const REPAIR_PHASES = 1;
/** 升级费用 = 单次修缮费 x 此系数。升级不是免费的,它是最后一笔大额投入。 */
const PROMOTE_COST_FACTOR = 2;
const promoteCost = (upgradeCost: number) => upgradeCost * PROMOTE_COST_FACTOR;
/** 同时受损的房间上限。低频的量化定义 —— 见 advancePhase 里的说明。 */
const MAX_DAMAGED = 3;

/* ============ 产出物索引 ============
 * 两张表都**从 MANSION_ROOM_DETAILS 推导**,不手写 —— 房间文案是唯一来源,
 * 手抄一份 id 列表迟早与 data.ts 漂移。
 *   MANSION_PRODUCTS        物品 id -> 产出定义
 *   MANSION_PRODUCT_ORIGINS 物品 id -> 产地房间名(填详情栏的「产地」)
 */
const MANSION_PRODUCTS: Record<string, MansionProduction> = Object.fromEntries(
  Object.values(MANSION_ROOM_DETAILS)
    .filter((detail) => detail.production)
    .map((detail) => [detail.production!.id, detail.production!])
);

const MANSION_PRODUCT_ORIGINS: Record<string, string> = Object.fromEntries(
  Object.entries(MANSION_ROOM_DETAILS)
    .filter(([, detail]) => detail.production)
    .map(([roomId, detail]) => [
      detail.production!.id,
      DEFAULT_MANSION_RECTANGLES.find((rect) => rect.id === roomId)?.label ?? roomId
    ])
);

/** 仓储容量。6x4=24 格一页,上限 48 格(两页)。
    当前只有 5 种产出,24 格已留足生长空间;再多就是满屏空槽。 */
const STOCK_COLUMNS = 6;
const STOCK_ROWS = 4;
const STOCK_CAPACITY = STOCK_COLUMNS * STOCK_ROWS * 2;

/* ============ 地下区域(世界坐标) ============
 * 真正的地下只有洋馆地基**内**的 8 间:
 *   workshop storage laundry maid cellar library array seal
 * 实测它们只占 x 27.0%..58.9%,纵向 1350..1910。
 *
 * 上一版遮罩写成 left:0 right:0 **全宽**,于是左边的码头/海、
 * 右边的海崖/村舍外景也被一起压暗 —— 在 y=1340 处形成一条横贯全图的
 * 硬分割线。而且 dock(小码头)被我误判成地下,它其实是**室外**水岸。 */
const UNDERGROUND_TOP = 1350;
const UNDERGROUND_BOTTOM = MANSION_WORLD_HEIGHT;
/** 左右各外扩一点,给羽化留余量,避免竖直硬边。 */
const UNDERGROUND_LEFT = 0.270 * MANSION_WORLD_WIDTH - 110;
const UNDERGROUND_RIGHT = 0.589 * MANSION_WORLD_WIDTH + 110;

/* ============ 角色占位(世界坐标,屏上 = 本值 x 0.4712) ============
 * 整组 = 头像 100 + 间隙 6 + 名字 30 + 底部留白(自适应 0~26)。
 * 必须塞进最矮的房间 —— 小广场只有 149 高,留白会自动压到 13。
 * 上一版头像 110 + 名字 36 且留白固定,实测名字穿进下一层楼 14px。 */
const CHARACTER_AVATAR = 100;
const CHARACTER_NAME_FS = 30;
/** 想要的底部留白。整组上移就靠它 —— 之前只有 10,贴房间地板太紧。 */
const CHARACTER_BOTTOM_PAD = 26;
/** 头像顶到房间顶至少留这么多,避免头像顶出房间。 */
const CHARACTER_TOP_CLEARANCE = 6;

/**
 * 名字带 = 名字高 + 底部留白。头像底落在 bottom - 这个值。
 *
 * 留白**按房间高度自适应**:小广场只有 149 高(全场最矮),
 * 固定 26 留白会让整组 162 > 149,实测头像顶溢出房间 7px。
 * 所以矮房间自动减小留白,高房间用足 26 —— 保证「尽量上移」的同时不越界。
 */
function characterNameBand(region: SceneRegion) {
  const bounds = regionBounds(region);
  const height = bounds.bottom - bounds.top;
  const need = CHARACTER_AVATAR + 6 + CHARACTER_NAME_FS + CHARACTER_TOP_CLEARANCE;
  const pad = Math.max(0, Math.min(CHARACTER_BOTTOM_PAD, height - need));
  return CHARACTER_NAME_FS + pad;
}
const MANSION_SPRITE_BASE = import.meta.env.DEV
  ? "/src/assets/png/"
  : `${import.meta.env.BASE_URL}character-art/`;

type SceneRegion =
  | ({ shape: "rectangle" } & MansionRectangle)
  | ({ shape: "polygon" } & MansionRegion);

interface DragState {
  pointerId: number;
  startClientX: number;
  startPan: number;
  moved: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface CharacterPlacement extends Point {
  character: MansionCharacter;
  roomId: string;
}

function clampPan(value: number) {
  return Math.max(MIN_PAN, Math.min(0, value));
}

function cleanRegionLabel(label: string) {
  return label.replace(/【.*?】/g, "").trim();
}

function regionBounds(region: SceneRegion) {
  if (region.shape === "rectangle") {
    return {
      left: region.rect.x * MANSION_WORLD_WIDTH,
      top: region.rect.y * MANSION_WORLD_HEIGHT,
      right: (region.rect.x + region.rect.width) * MANSION_WORLD_WIDTH,
      bottom: (region.rect.y + region.rect.height) * MANSION_WORLD_HEIGHT
    };
  }

  const xs = region.points.map((point) => point.x * MANSION_WORLD_WIDTH);
  const ys = region.points.map((point) => point.y * MANSION_WORLD_HEIGHT);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

function roomFocusTransform(region: SceneRegion, drawerSide: DrawerSide) {
  const bounds = regionBounds(region);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const scaledWidth = WORLD_DISPLAY_WIDTH * ROOM_FOCUS_ZOOM;
  const scaledHeight = WORLD_DISPLAY_HEIGHT * ROOM_FOCUS_ZOOM;
  const focusCenterX = drawerSide === "left"
    ? STAGE_CANVAS_WIDTH - ROOM_FOCUS_CENTER_X
    : ROOM_FOCUS_CENTER_X;
  const targetX = focusCenterX - centerX * WORLD_SCALE * ROOM_FOCUS_ZOOM;
  const targetY = ROOM_FOCUS_CENTER_Y - centerY * WORLD_SCALE * ROOM_FOCUS_ZOOM;

  return {
    x: Math.max(STAGE_CANVAS_WIDTH - scaledWidth, Math.min(0, targetX)),
    y: Math.max(STAGE_CANVAS_HEIGHT - scaledHeight, Math.min(0, targetY)),
    zoom: ROOM_FOCUS_ZOOM
  };
}

function roomPreviewImageStyle(region: SceneRegion) {
  const bounds = regionBounds(region);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const cropScale = Math.max(
    ROOM_PREVIEW_WIDTH / (width * 1.18),
    ROOM_PREVIEW_HEIGHT / (height * 1.18)
  );

  return {
    width: MANSION_WORLD_WIDTH * cropScale,
    height: MANSION_WORLD_HEIGHT * cropScale,
    left: ROOM_PREVIEW_WIDTH / 2 - centerX * cropScale,
    top: ROOM_PREVIEW_HEIGHT / 2 - centerY * cropScale
  };
}

function MansionRoomPreview({ region, label }: { region: SceneRegion; label: string }) {
  return (
    <div className="mansion-room-card__preview" role="img" aria-label={`${label}房间预览`}>
      <img
        src={`${import.meta.env.BASE_URL}mansion-map/composite-reference.png`}
        alt=""
        draggable={false}
        style={roomPreviewImageStyle(region)}
      />
      <span aria-hidden="true">ROOM VIEW</span>
    </div>
  );
}

function regionAnchor(region: SceneRegion, edge: "top-right" | "bottom-center"): Point {
  const bounds = regionBounds(region);
  if (edge === "top-right") {
    return { x: bounds.right - 28, y: bounds.top + 30 };
  }
  return {
    x: (bounds.left + bounds.right) / 2,
    /* 头像**底边**落在这里,名字挂在其下。
       原来是 bottom-12,导致名字底 = bottom+34 —— 实测穿进下一层楼 14px
       (hall 底 1330,而地下层 workshop 顶 1350,名字底 1364)。
       现在留出 名字 + 自适应底部留白。 */
    y: bounds.bottom - characterNameBand(region)
  };
}

/* ============ 图钉排位 ============
 * 上一版名字与图钉共用同一条水平线,而且修缮是在 top-right 上再硬减 100:
 *     修缮 x = right - 128     名字 x = (left + right) / 2
 * 房间宽普遍 200~400,宽 250 时两者只差 2~4px —— 实测 **22/27 个房间的
 * 修缮标记压住名字**(salon / foyer / dining 是完全盖住)。
 * 这不是偶发,是锚点设计错误。
 *
 * 现在彻底分层:
 *   名字  -> 房间**底部内侧**(regionLabelAnchor)
 *   图钉  -> 房间**顶部一条水平槽**,多个图钉从右往左**排队**
 * 两者不再共享任何一条线,几何上不可能再撞。
 */
/** 图钉距房间右上角的内缩。18 比原来的 26 更贴角 —— 「显眼但不喧宾夺主」
 *  靠的是**贴角 + 小尺寸**,而不是把它做大。 */
const MARKER_SLOT_INSET = 18;
const MARKER_SLOT_STEP = MARKER_SIZE + 8;

/** 图钉槽:第 index 个图钉的中心。从右往左排队。 */
function markerSlot(region: SceneRegion, index: number): Point {
  const bounds = regionBounds(region);
  return {
    x: bounds.right - MARKER_SLOT_INSET - MARKER_SIZE / 2 - index * MARKER_SLOT_STEP,
    y: bounds.top + MARKER_SLOT_INSET + MARKER_SIZE / 2
  };
}

/** 房间名:底部内侧。与图钉槽分处房间上下两端。 */
function regionLabelY(region: SceneRegion) {
  return regionBounds(region).bottom - 16;
}

function fundName(fund: MansionFund) {
  return fund === "public" ? "维稳公款" : "小队资金";
}

export function MansionPage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueCloseRef = useRef<HTMLButtonElement>(null);
  const dialogueStageRef = useRef<HTMLDivElement>(null);

  const [manifest, setManifest] = useState<MansionPsdManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [loadedLayers, setLoadedLayers] = useState<Set<string>>(() => new Set());
  const [failedLayers, setFailedLayers] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<MansionPhaseId>("day");
  const [panX, setPanX] = useState(INITIAL_PAN);
  const [dragging, setDragging] = useState(false);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [dialogueTyping, setDialogueTyping] = useState(false);
  const [dialogueSettled, setDialogueSettled] = useState(false);
  const [funds, setFunds] = useState<Record<MansionFund, number>>({
    public: 12800,
    party: 1450
  });
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(MANSION_ROOM_DETAILS).map(([id, detail]) => [id, detail.level])
    )
  );
  const [upgrading, setUpgrading] = useState<Record<string, number>>({});
  /** 天数。四个相位走完一轮(夜->晨)才 +1。 */
  const [day, setDay] = useState(1);
  /** 每间房通向下一档的修缮进度 0..REPAIR_STEPS。满了才能升级。 */
  const [repairProgress, setRepairProgress] = useState<Record<string, number>>({});
  /**
   * 受损的房间。**只有受损的才显示修缮图钉。**
   *
   * 上一版 14 个可修缮房间全部常态挂标记,同屏 14 个图钉纯噪音,
   * 而且「修缮」在世界观里本该是**事件**而不是常态。
   * 现在改随机损坏:推进相位时随机让 1~2 处受损。玩家看到图钉 = 真有事。
   *
   * 视觉原型阶段刻意保持简单:不做损坏程度、不做连锁、不做维护度衰减。
   * 初始给两处,让首屏就能看到这个机制。
   */
  const [damaged, setDamaged] = useState<Set<string>>(() => new Set(["kitchen", "laundry"]));
  const [readyProduction, setReadyProduction] = useState<Set<string>>(() =>
    new Set(
      Object.entries(MANSION_ROOM_DETAILS)
        .filter(([, detail]) => detail.production)
        .map(([id]) => id)
    )
  );
  /** 库存以**物品 id** 为键(不是房间 id),见 MansionProduction.id 的说明。 */
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [stockOpen, setStockOpen] = useState(false);
  const stockButtonRef = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState("");

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

  const productionRoomIds = useMemo(
    () => Object.entries(MANSION_ROOM_DETAILS)
      .filter(([, detail]) => detail.production)
      .map(([id]) => id),
    []
  );

  /** 可修缮的房间池。14 个 —— 但**不再全部常态显示标记**,见 damaged。 */
  const repairableRoomIds = useMemo(
    () => Object.entries(MANSION_ROOM_DETAILS)
      .filter(([, detail]) => detail.upgradeCost && detail.fund && !detail.state)
      .map(([id]) => id),
    []
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
  const currentPhase = MANSION_PHASES.find((item) => item.id === phase) ?? MANSION_PHASES[1];
  /* 库存 view-model。shared 层不认识 MansionProduction(模块边界禁止
     shared 反向 import apps),所以映射在这里做,喂给 InventoryDialog 的
     是朴素的 InventoryEntry。 */
  const inventoryEntries = useMemo<InventoryEntry[]>(
    () =>
      Object.entries(inventory)
        .filter(([itemId, amount]) => amount > 0 && MANSION_PRODUCTS[itemId] != null)
        .map(([itemId, amount]): InventoryEntry => {
          const production = MANSION_PRODUCTS[itemId];
          return {
            id: itemId,
            name: production.label,
            icon: PRODUCTION_GLYPHS[production.icon],
            rarity: production.rarity ?? "bronze",
            quantity: amount,
            unit: production.unit,
            description: production.description,
            category: production.category,
            meta: {
              产地: MANSION_PRODUCT_ORIGINS[itemId] ?? "—",
              单位: production.unit,
              每相位: `${production.amount}${production.unit}`
            }
          };
        }),
    [inventory]
  );
  const stockTotal = inventoryEntries.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);

  /** 对话开启时,世界与四角挂件一律退出可交互与无障碍树。
   *  原先这个三元在 7 处重复写成 `activeCharacter ? true : undefined`。 */
  const chromeInert = activeCharacter ? true : undefined;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

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

  const shiftPan = useCallback((delta: number) => {
    setPanX((value) => clampPan(value + delta));
  }, []);

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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (selectedRegionId) return;
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (
      target.closest("[data-no-pan]") &&
      !target.closest(".mansion-region")
    ) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startPan: panX,
      moved: false
    };
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewportWidth = viewportRef.current?.getBoundingClientRect().width ?? STAGE_CANVAS_WIDTH;
    const stagePerClientPixel = STAGE_CANVAS_WIDTH / viewportWidth;
    const delta = (event.clientX - drag.startClientX) * stagePerClientPixel;
    if (!drag.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    }
    setPanX(clampPan(drag.startPan + delta));
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (selectedRegionId) return;
    const viewportWidth = viewportRef.current?.getBoundingClientRect().width ?? STAGE_CANVAS_WIDTH;
    const stagePerClientPixel = STAGE_CANVAS_WIDTH / viewportWidth;
    const input = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    shiftPan(-input * stagePerClientPixel * 0.7);
  };

  const openRegion = (regionId: string) => {
    if (suppressClickRef.current) return;
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
    setPhase(nextPhase);
    setActiveCharacterId(null);
  };

  const advancePhase = () => {
    const currentIndex = MANSION_PHASES.findIndex((item) => item.id === phase);
    const nextIndex = (currentIndex + 1) % MANSION_PHASES.length;
    const nextPhase = MANSION_PHASES[nextIndex];
    // 回绕到第一个相位 = 过了一天。
    if (nextIndex === 0) setDay((current) => current + 1);
    const completed = Object.entries(upgrading)
      .filter(([, remaining]) => remaining <= 1)
      .map(([id]) => id);
    // 施工结束只推进**修缮进度**,不再自动升级 —— 升级要玩家点按钮。
    if (completed.length) {
      setRepairProgress((current) => {
        const next = { ...current };
        completed.forEach((id) => {
          next[id] = Math.min((next[id] ?? 0) + 1, REPAIR_STEPS);
        });
        return next;
      });
    }
    setUpgrading((current) => Object.fromEntries(
      Object.entries(current)
        .filter(([, remaining]) => remaining > 1)
        .map(([id, remaining]) => [id, remaining - 1])
    ));
    setReadyProduction(new Set(productionRoomIds));

    /* 随机损坏。
       **必须自限**:实测第一版只增不减(2→4→5→7→9),因为只有「修缮完成」
       才清除受损,玩家不修就无限堆积 —— 那就退回成上一版「14 个常态图钉」
       的噪音了,与「低频」的初衷相反。
       所以设上限:同时最多 MAX_DAMAGED 处,满了就不再新增。
       视觉原型阶段刻意保持简单:不做损坏程度、不做连锁、不做维护度衰减。 */
    let newlyDamaged = 0;
    setDamaged((current) => {
      const next = new Set(current);
      completed.forEach((id) => next.delete(id));
      if (next.size >= MAX_DAMAGED) return next;
      const pool = repairableRoomIds.filter(
        (id) => !next.has(id) && !upgrading[id]
      );
      // 有空位才抽,且不超过上限。
      const room = MAX_DAMAGED - next.size;
      const wanted = Math.min(room, Math.random() < 0.35 ? 2 : 1);
      for (let i = 0; i < wanted && pool.length; i += 1) {
        const [picked] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        next.add(picked);
        newlyDamaged += 1;
      }
      return next;
    });

    setPhase(nextPhase.id);
    setActiveCharacterId(null);
    showToast(
      completed.length
        ? `${nextPhase.label}相位 · ${completed.length}处修缮完成`
        : newlyDamaged
          ? `${nextPhase.label}相位 · ${newlyDamaged}处出现损坏`
          : `${nextPhase.label}相位 · 产出结算，角色已换位`
    );
  };

  const collectProduction = (roomId: string) => {
    const detail = MANSION_ROOM_DETAILS[roomId];
    if (!detail?.production || !readyProduction.has(roomId)) return;
    setReadyProduction((current) => {
      const next = new Set(current);
      next.delete(roomId);
      return next;
    });
    // 按**物品 id** 累加,不再按房间 id —— 这样同一物品若日后由多个房间产出
    // 会正确归并到同一格,而不是各记一笔。
    setInventory((current) => ({
      ...current,
      [detail.production!.id]: (current[detail.production!.id] ?? 0) + detail.production!.amount
    }));
    showToast(`已收取 ${detail.production.label} ×${detail.production.amount}${detail.production.unit}`);
  };

  /** 修缮一次:推进 1 格进度。满格后不再接受修缮,改由 promoteFacility 升级。 */
  const startUpgrade = (roomId: string) => {
    const detail = MANSION_ROOM_DETAILS[roomId];
    if (!detail?.upgradeCost || !detail.fund || upgrading[roomId]) return;
    if ((levels[roomId] ?? detail.level) >= MAX_FACILITY_LEVEL) {
      showToast("该设施已达到当前最高档位");
      return;
    }
    if ((repairProgress[roomId] ?? 0) >= REPAIR_STEPS) {
      showToast("修缮已完成，可以升级了");
      return;
    }
    if (funds[detail.fund] < detail.upgradeCost) {
      showToast(`${fundName(detail.fund)}不足`);
      return;
    }
    setFunds((current) => ({
      ...current,
      [detail.fund!]: current[detail.fund!] - detail.upgradeCost!
    }));
    setUpgrading((current) => ({ ...current, [roomId]: REPAIR_PHASES }));
    // 一旦开工就不再显示「受损」图钉,改由施工中状态表达。
    setDamaged((current) => {
      if (!current.has(roomId)) return current;
      const next = new Set(current);
      next.delete(roomId);
      return next;
    });
    const step = Math.min((repairProgress[roomId] ?? 0) + 1, REPAIR_STEPS);
    showToast(
      `${cleanRegionLabel(regionById.get(roomId)?.label ?? roomId)}修缮中 · 第 ${step}/${REPAIR_STEPS} 步`
    );
  };

  /** 进度满格后的升级:**付费** +1 档并清零进度。玩家的独立决策,不自动发生。 */
  const promoteFacility = (roomId: string) => {
    const detail = MANSION_ROOM_DETAILS[roomId];
    if (!detail?.upgradeCost || !detail.fund) return;
    const level = levels[roomId] ?? detail.level;
    if (level >= MAX_FACILITY_LEVEL) return;
    if ((repairProgress[roomId] ?? 0) < REPAIR_STEPS) return;
    const cost = promoteCost(detail.upgradeCost);
    if (funds[detail.fund] < cost) {
      showToast(`${fundName(detail.fund)}不足，升级需 ${cost} 金币`);
      return;
    }
    setFunds((current) => ({
      ...current,
      [detail.fund!]: current[detail.fund!] - cost
    }));
    setLevels((current) => ({ ...current, [roomId]: level + 1 }));
    setRepairProgress((current) => ({ ...current, [roomId]: 0 }));
    showToast(
      `${cleanRegionLabel(regionById.get(roomId)?.label ?? roomId)}已升级至 Lv.${level + 1}`
    );
  };

  const activateCharacter = (character: MansionCharacter) => {
    if (suppressClickRef.current) return;
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

  return (
    <Stage background="#0a1114" canvasClassName="mansion-stage-canvas">
      <AbyssaProvider className="mansion-app" density="compact" data-phase={phase}>
        <main
          ref={viewportRef}
          className={`mansion-viewport${dragging ? " is-dragging" : ""}${selectedRegion ? " is-room-focused" : ""}`}
          aria-label="守望者之崖洋馆总览"
          inert={chromeInert}
          aria-hidden={chromeInert}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onWheel={handleWheel}
        >
          <div
            className="mansion-world-pan"
            style={{
              width: WORLD_DISPLAY_WIDTH,
              transform: `translate3d(${roomCamera.x}px, ${roomCamera.y}px, 0) scale(${roomCamera.zoom})`
            }}
          >
            <div
              className="mansion-world-plane"
              style={{ transform: `scale(${WORLD_SCALE})` }}
            >
              {/* ============ 天空盒 ============
                  必须画在**世界平面内部、美术图层之下**。
                  之前挂在 .mansion-app(世界的祖先)上,而 layer-21 是一张
                  5162x1910 的满幅底图 —— 世界在任何 pan 位置都盖满画布,
                  于是天空盒永远在美术下面,一次都没露出来过。
                  好在美术的天空区是**透明的**(实测前 200 行 98.7% alpha=0),
                  所以垫在下面就能透出来。 */}
              <div className="mansion-sky" aria-hidden="true" />
              {useCompositeFallback ? (
                <img
                  className="mansion-world-composite"
                  src={`${import.meta.env.BASE_URL}mansion-map/composite-reference.png`}
                  alt=""
                  draggable={false}
                />
              ) : visibleLayers.map((layer) => (
                <img
                  key={layer.id}
                  className="mansion-world-layer"
                  src={`${import.meta.env.BASE_URL}mansion-map/${layer.src}`}
                  alt=""
                  draggable={false}
                  onLoad={() => setLoadedLayers((current) => {
                    if (current.has(layer.id)) return current;
                    const next = new Set(current);
                    next.add(layer.id);
                    return next;
                  })}
                  onError={() => setFailedLayers((current) => {
                    if (current.has(layer.id)) return current;
                    const next = new Set(current);
                    next.add(layer.id);
                    return next;
                  })}
                  style={{
                    left: layer.x,
                    top: layer.y,
                    width: layer.width,
                    height: layer.height,
                    opacity: layer.opacity,
                    zIndex: layer.order
                  }}
                />
              ))}

              <svg
                className="mansion-region-layer"
                viewBox={`0 0 ${MANSION_WORLD_WIDTH} ${MANSION_WORLD_HEIGHT}`}
                aria-label="可交互房间"
              >
                {sceneRegions.map((region) => {
                  const selected = selectedRegionId === region.id;
                  const detail = MANSION_ROOM_DETAILS[region.id] ?? fallbackRoomDetail(region.kind);
                  const bounds = regionBounds(region);
                  const labelX = (bounds.left + bounds.right) / 2;
                  // 名字在**底部内侧**;图钉在顶部槽。两者分处房间上下两端。
                  const labelY = regionLabelY(region);
                  const commonProps = {
                    className: `mansion-region${selected ? " is-selected" : ""}${hoveredRegionId === region.id ? " is-hovered" : ""}${detail.state === "sealed" ? " is-sealed" : ""}`,
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `查看${cleanRegionLabel(region.label)}`,
                    "aria-pressed": selected,
                    "data-no-pan": true,
                    onPointerEnter: () => {
                      if (!selectedRegionId) setHoveredRegionId(region.id);
                    },
                    onPointerMove: () => {
                      if (!selectedRegionId && hoveredRegionId !== region.id) {
                        setHoveredRegionId(region.id);
                      }
                    },
                    onPointerLeave: () => setHoveredRegionId((current) =>
                      current === region.id ? null : current
                    ),
                    onClick: () => openRegion(region.id),
                    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRegion(region.id);
                      }
                    }
                  };
                  return (
                    <g key={region.id} {...commonProps}>
                      {region.shape === "rectangle" ? (
                        <rect
                          x={region.rect.x * MANSION_WORLD_WIDTH}
                          y={region.rect.y * MANSION_WORLD_HEIGHT}
                          width={region.rect.width * MANSION_WORLD_WIDTH}
                          height={region.rect.height * MANSION_WORLD_HEIGHT}
                        />
                      ) : (
                        <polygon points={region.points
                          .map((point) => `${point.x * MANSION_WORLD_WIDTH},${point.y * MANSION_WORLD_HEIGHT}`)
                          .join(" ")} />
                      )}
                      <text x={labelX} y={labelY}>{cleanRegionLabel(region.label)}</text>
                    </g>
                  );
                })}
              </svg>

              {/* ============ 世界图钉 ============
                  按房间聚合后统一排队,同一房间的多个图钉在顶部槽里从右往左
                  依次落位 —— 名字已移到房间底部,两者不再共享任何一条线。
                  上一版实测 22/27 个房间的修缮标记压住名字。 */}
              {sceneRegions.map((region) => {
                const detail = MANSION_ROOM_DETAILS[region.id];
                if (!detail) return null;

                const pins: Array<{ kind: "production" | "repair" | "promote"; node: React.ReactNode }> = [];

                if (detail.production && readyProduction.has(region.id)) {
                  pins.push({
                    kind: "production",
                    node: (
                      <button
                        type="button"
                        className="mansion-marker mansion-marker--production"
                        data-no-pan
                        aria-label={`收取${cleanRegionLabel(region.label)}的${detail.production.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          collectProduction(region.id);
                        }}
                      >
                        <ProductionIcon icon={detail.production.icon} />
                        <b className="mansion-marker__badge">{detail.production.amount}</b>
                      </button>
                    )
                  });
                }

                /* 可升级图钉:修缮进度满格且未到顶。它先于修缮图钉判断 ——
                   两者互斥,满格后就不该再显示「去修缮」。 */
                const roomLevel = levels[region.id] ?? detail.level;
                if (
                  detail.upgradeCost &&
                  detail.fund &&
                  (repairProgress[region.id] ?? 0) >= REPAIR_STEPS &&
                  roomLevel < MAX_FACILITY_LEVEL
                ) {
                  pins.push({
                    kind: "promote",
                    node: (
                      <button
                        type="button"
                        className="mansion-marker mansion-marker--promote"
                        data-no-pan
                        aria-label={`${cleanRegionLabel(region.label)}可升级至 Lv.${roomLevel + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRegion(region.id);
                        }}
                      >
                        <PromoteIcon />
                      </button>
                    )
                  });
                }

                /* 修缮图钉只在**受损**或**施工中**时出现。
                   14 个可修缮房间不再全部常态挂标记。 */
                const isDamaged = damaged.has(region.id);
                const isUpgrading = Boolean(upgrading[region.id]);
                if (
                  (isDamaged || isUpgrading) &&
                  (repairProgress[region.id] ?? 0) < REPAIR_STEPS &&
                  roomLevel < MAX_FACILITY_LEVEL
                ) {
                  pins.push({
                    kind: "repair",
                    node: (
                      <button
                        type="button"
                        className="mansion-marker mansion-marker--repair"
                        data-state={isUpgrading ? "working" : "damaged"}
                        data-no-pan
                        aria-label={isUpgrading
                          ? `${cleanRegionLabel(region.label)}修缮中，还需 ${upgrading[region.id]} 相位`
                          : `${cleanRegionLabel(region.label)}出现损坏，查看修缮`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRegion(region.id);
                        }}
                      >
                        <RepairIcon />
                        {isUpgrading && (
                          <b className="mansion-marker__badge">{upgrading[region.id]}</b>
                        )}
                      </button>
                    )
                  });
                }

                return pins.map((pin, index) => {
                  const slot = markerSlot(region, index);
                  return (
                    <span
                      key={`${pin.kind}-${region.id}`}
                      className="mansion-marker-slot"
                      style={{ left: slot.x, top: slot.y }}
                    >
                      {pin.node}
                    </span>
                  );
                });
              })}

              {/* ============ 角色:圆形头像标识 ============
                  上一版是 166x194 的三段几何体(57 圆头 + 102x80 梯形身
                  + 110x21 椭圆脚),比多数房间的一半还大(房间才 200~400 宽),
                  11 个同屏把世界糊住。
                  现在用 src/assets/avatar/ 的真头像,面积降到约 1/16。 */}
              {characterPlacements.map(({ character, roomId, x, y }) => {
                const avatar = MANSION_AVATARS[character.id];
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`mansion-character${hoveredRegionId === roomId ? " is-room-muted" : ""}`}
                    data-faction={character.faction}
                    data-room={roomId}
                    data-no-pan
                    style={{ left: x, top: y }}
                    aria-label={`与${character.name}交谈`}
                    onClick={(event) => {
                      event.stopPropagation();
                      activateCharacter(character);
                    }}
                  >
                    <span className="mansion-character__disc">
                      {/* 三层描边环由 CSS 的 box-shadow 叠出(见 mansion.css),
                          与铭牌/图钉的 dark/edge/deep 同族。 */}
                      {avatar ? (
                        <img src={avatar} alt="" draggable={false} />
                      ) : (
                        /* kael 与 tibby 没有头像素材,降级为姓氏首字。
                           不用几何小人 —— 那正是上一版的问题。 */
                        <b aria-hidden="true">{character.name.slice(0, 1)}</b>
                      )}
                    </span>
                    <span className="mansion-character__bubble" aria-hidden="true">
                      <DialogueBubble />
                    </span>
                    <span className="mansion-character__name">{character.name}</span>
                  </button>
                );
              })}

              {/* ============ 地下近似隔离 ============
                  地下 8 个房间(workshop/storage/laundry/maid/cellar/library/
                  array/seal)没有窗,昼夜对它们**不该有区别**。
                  注意范围只到 x 27%..59%(洋馆地基内)—— 上一版做成全宽,
                  把左边的海、右边的海崖也压暗了,于是拉出一条横贯全图的硬边。
                  但滤镜挂在整块 world-plane 上,而房间是美术图层不是独立 DOM,
                  没法真正隔离。这里用一层遮罩做近似:在地下区域补上均匀暗色,
                  抵消天光滤镜的影响 —— 于是地下读起来始终是「不见天日」的。 */}
              <div
                className="mansion-underground"
                aria-hidden="true"
                style={{
                  left: UNDERGROUND_LEFT,
                  top: UNDERGROUND_TOP,
                  width: UNDERGROUND_RIGHT - UNDERGROUND_LEFT,
                  height: UNDERGROUND_BOTTOM - UNDERGROUND_TOP
                }}
              />

              {/* 相位色调。压在美术之上、灯光之下。 */}
              <div className="mansion-phase-light" aria-hidden="true" />

              {/* ============ 房间灯光 ============
                  只在夜相位出现。逐房间数据见 lighting.ts —— 那些设定
                  全部来自房间文案(壁炉全年不熄 / 篝火 / 红线脉搏 / 信号灯 /
                  符纸 / 烽火台从未点燃),不是随手挑的。 */}
              {roomLights.length > 0 && (
                <div className="mansion-lights" aria-hidden="true">
                  {roomLights.map(({ region, light }) => {
                    const bounds = regionBounds(region);
                    return (
                      <span
                        key={`light-${region.id}`}
                        className="mansion-light"
                        data-tone={light.tone}
                        data-flicker={light.flicker}
                        style={{
                          left: bounds.left,
                          top: bounds.top,
                          width: bounds.right - bounds.left,
                          height: bounds.bottom - bounds.top,
                          opacity: light.intensity
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="mansion-loading" role="status" data-no-pan>
              <span />洋馆剖面装配中 · {loadedLayers.size}/{visibleLayers.length || "—"}
            </div>
          )}
        </main>

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
            onToggleStock={() => setStockOpen((open) => !open)}
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
          <aside
            className="mansion-room-drawer"
            data-side={selectedDrawerSide}
            data-no-pan
            role="dialog"
            aria-modal="false"
            aria-labelledby={`mansion-room-title-${selectedRegion.id}`}
            inert={chromeInert}
            aria-hidden={chromeInert}
          >
            {/* 关闭键必须在 RpgFrame **之外**:Frame 的 __content 是
                overflow:auto 的滚动容器,负偏移的角标放里面会被裁掉。
                实测过 —— 这就是"ROOM 被裁剪"的成因。 */}
            <IconButton
              ref={drawerCloseRef}
              className="mansion-room-card__close"
              label="关闭房间详情"
              icon="close"
              size="sm"
              onClick={closeRegion}
            />
            <RpgFrame className="mansion-room-card" padding="md" variant="dark">
              <div className="mansion-room-card__hero">
                <MansionRoomPreview
                  region={selectedRegion}
                  label={cleanRegionLabel(selectedRegion.label)}
                />
                <div className="mansion-room-card__identity">
                  <small>{selectedDetail.subtitle}</small>
                  <h2 id={`mansion-room-title-${selectedRegion.id}`}>{cleanRegionLabel(selectedRegion.label)}</h2>
                  <div className="mansion-room-card__residents">
                    <span>当前驻在</span>
                    {selectedOccupants.length ? (
                      <div className="mansion-room-card__resident-list" role="list" aria-label="当前驻在角色">
                        {selectedOccupants.map((character) => (
                          <ResidentAvatar key={character.id} character={character} />
                        ))}
                      </div>
                    ) : (
                      <small className="mansion-room-card__resident-empty">无人驻在</small>
                    )}
                  </div>
                </div>
              </div>

              {selectedDetail.state === "sealed" && (
                <div className="mansion-room-card__warning">最高禁约 · 仅可查看封印状态</div>
              )}
              {selectedDetail.state === "provisional" && (
                <div className="mansion-room-card__provisional">美术补充区域 · 正式设定待确认</div>
              )}

              <div className="mansion-room-card__brief">
                <small>房间职能</small>
                <p className="mansion-room-card__description">{selectedDetail.description}</p>
              </div>

              <div className="mansion-room-card__trace">
                <small><i aria-hidden="true" />生活痕迹</small>
                <p>{selectedDetail.trace}</p>
              </div>

              {selectedDetail.production && (
                <div className="mansion-room-card__harvest">
                  <small>本相位产出</small>
                <button
                  type="button"
                  className="mansion-room-card__collect"
                  data-ready={readyProduction.has(selectedRegion.id) || undefined}
                  aria-label={readyProduction.has(selectedRegion.id)
                    ? `收取${selectedDetail.production.label} ${selectedDetail.production.amount}${selectedDetail.production.unit}`
                    : `${selectedDetail.production.label}本相位已收取`}
                  disabled={!readyProduction.has(selectedRegion.id)}
                  onClick={() => collectProduction(selectedRegion.id)}
                >
                  {/* 图标就是那张 game-icons SVG,用 mask 上色 —— 与全库
                      其他图标同一手法。**不用 ItemSlotStatic**:那是背包格位,
                      六层堆叠 + 光环 + 宝石,压到 48 又重又繁复,而且以后要排
                      多条收取项时每条都套一个画框会糊成一片。 */}
                  <i
                    className="mansion-room-card__collect-glyph"
                    style={{
                      WebkitMaskImage: `url("${PRODUCTION_GLYPHS[selectedDetail.production.icon]}")`,
                      maskImage: `url("${PRODUCTION_GLYPHS[selectedDetail.production.icon]}")`
                    }}
                    aria-hidden="true"
                  />
                  <span className="mansion-room-card__collect-name">
                    {selectedDetail.production.label}
                  </span>
                  <span className="mansion-room-card__collect-amount">
                    ×{selectedDetail.production.amount}
                    <i>{selectedDetail.production.unit}</i>
                  </span>
                  <span className="mansion-room-card__collect-state">
                    {readyProduction.has(selectedRegion.id) ? "收取" : "已收"}
                  </span>
                </button>
                </div>
              )}

              {/* 设施档位:**离散刻度**,不是百分比进度条。
                  MAX_FACILITY_LEVEL 是 4,原先用 `level*25` 折成 25%/50%/…
                  再配一条通用 Progress —— 那是把"第几档"硬掰成"完成度",
                  语义错了,观感也是网页 meter。现在四格刻面,点亮到当前档,
                  与顶部相位刻度同一语汇(那里也是离散的四相位)。
                  位置固定在卡片最底部,压在修缮键上方。
                  外层是 group 而非 progressbar —— 里面有**两条**独立的
                  progressbar(档位、修缮进度),progressbar 不能嵌套。 */}
              {selectedDetail.state !== "sealed" && selectedDetail.state !== "provisional" && (
                <div className="mansion-room-card__tier" role="group" aria-label="设施状态">
                  <span className="mansion-room-card__tier-label">设施档位</span>
                  <span
                    className="mansion-room-card__tier-track"
                    role="progressbar"
                    aria-label={`设施档位 · Lv.${selectedLevel}`}
                    aria-valuemin={1}
                    aria-valuemax={MAX_FACILITY_LEVEL}
                    aria-valuenow={selectedLevel}
                  >
                    {Array.from({ length: MAX_FACILITY_LEVEL }, (_, index) => (
                      <i key={index} data-on={index < selectedLevel || undefined} />
                    ))}
                  </span>
                  <span className="mansion-room-card__tier-value" aria-hidden="true">
                    <em>Lv</em>
                    <b>{selectedLevel}</b>
                    <s>/ {MAX_FACILITY_LEVEL}</s>
                  </span>

                  {/* 第二条:通向下一档的修缮进度。与上面的档位刻度是**两个量** ——
                      档位是已达成的离散成果,这条是过程。到顶后整条隐去。 */}
                  {!selectedRepairComplete && (
                    <>
                      <span className="mansion-room-card__tier-label" data-sub="">
                        修缮进度
                      </span>
                      <span
                        className="mansion-room-card__tier-track"
                        data-sub=""
                        role="progressbar"
                        aria-label={`修缮进度 ${selectedRepairSteps}/${REPAIR_STEPS}`}
                        aria-valuemin={0}
                        aria-valuemax={REPAIR_STEPS}
                        aria-valuenow={selectedRepairSteps}
                      >
                        {Array.from({ length: REPAIR_STEPS }, (_, index) => (
                          <i
                            key={index}
                            data-on={index < selectedRepairSteps || undefined}
                            data-busy={
                              index === selectedRepairSteps && selectedUpgradeRemaining
                                ? ""
                                : undefined
                            }
                          />
                        ))}
                      </span>
                      <span className="mansion-room-card__tier-value" data-sub="" aria-hidden="true">
                        <b>{selectedRepairSteps}</b>
                        <s>/ {REPAIR_STEPS}</s>
                      </span>
                    </>
                  )}
                </div>
              )}

              {(selectedDetail.upgradeCost || (selectedDetail.href && selectedDetail.actionLabel)) && (
                <div className="mansion-room-card__footer">
                  <div className="mansion-room-card__actions">
                    {/* 进度满格 -> 换成**独立的升级键**(金色、不花钱、点了才升档)。
                        否则显示修缮键(花钱推进 1 格)。两者互斥,不同时出现 ——
                        同时摆两个动作会让「该点哪个」变成猜谜。 */}
                    {selectedDetail.upgradeCost && selectedDetail.fund && selectedCanPromote && (
                      <button
                        type="button"
                        className="mansion-room-card__promote"
                        aria-label={`升级至 Lv.${selectedLevel + 1}，花费 ${promoteCost(selectedDetail.upgradeCost)} 金币`}
                        disabled={funds[selectedDetail.fund] < promoteCost(selectedDetail.upgradeCost)}
                        onClick={() => promoteFacility(selectedRegion.id)}
                      >
                        <span className="mansion-room-card__promote-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 4 L12 20" />
                            <path d="M5 11 L12 4 L19 11" />
                          </svg>
                        </span>
                        <strong>升级建筑</strong>
                        <CurrencyAmount
                          value={promoteCost(selectedDetail.upgradeCost)}
                          label={`金币 ${promoteCost(selectedDetail.upgradeCost)}`}
                        />
                      </button>
                    )}
                    {selectedDetail.upgradeCost && selectedDetail.fund && !selectedCanPromote && (
                      <button
                        type="button"
                        className="mansion-room-card__repair"
                        aria-label={selectedUpgradeRemaining
                          ? `修缮中，还需 ${selectedUpgradeRemaining} 相位`
                          : selectedRepairComplete
                            ? `修缮已完成，Lv.${MAX_FACILITY_LEVEL}`
                            : `修缮，花费 ${selectedDetail.upgradeCost} 金币`}
                        disabled={Boolean(selectedUpgradeRemaining) || selectedRepairComplete}
                        onClick={() => startUpgrade(selectedRegion.id)}
                      >
                        <span className="mansion-room-card__repair-icon"><RepairIcon /></span>
                        <strong>{selectedUpgradeRemaining ? "施工中" : selectedRepairComplete ? "已满档" : "修缮"}</strong>
                        {selectedUpgradeRemaining ? (
                          <small>{selectedUpgradeRemaining} 相位</small>
                        ) : selectedRepairComplete ? (
                          <small>Lv.{MAX_FACILITY_LEVEL}</small>
                        ) : (
                          <CurrencyAmount
                            value={selectedDetail.upgradeCost}
                            label={`金币 ${selectedDetail.upgradeCost}`}
                          />
                        )}
                      </button>
                    )}
                    {selectedDetail.href && selectedDetail.actionLabel && (
                      <RpgNotchedPillButton
                        className="mansion-room-card__action"
                        variant="teal"
                        label={selectedDetail.actionLabel}
                        onClick={() => navigateTo(selectedDetail.href!)}
                      />
                    )}
                  </div>
                </div>
              )}
            </RpgFrame>
          </aside>
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
          onClose={() => setStockOpen(false)}
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
