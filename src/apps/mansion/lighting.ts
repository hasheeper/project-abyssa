import type { MansionPhaseId } from "./data";

/**
 * 洋馆夜间灯光表。
 *
 * ============ 数据从哪来 ============
 * 文案决定用途,原画决定有没有可见发光体。具体锚点与作用范围集中在
 * mansion-light-sources.ts,不可再用房间中心制造一个泛光光团。
 *
 *   hall       「壁炉**全年不熄**」        -> 必亮,暖橙,有火焰摇曳
 *   array      「红线如**脉搏明暗起伏**」  -> 必亮,赤红,缓慢呼吸
 *   kaelHut    原画右侧炉膛               -> 暖橙,贴合炉口
 *   workshop   原画左侧锻炉               -> 暖橙,贴合炉内火焰
 *   library    原画四盏蓝色火灯           -> 蓝焰,不使用驻在默认暖灯
 *   towerHall  「墙上挂着海图与**信号灯**」-> 必亮,冷白
 *   seal       原画门缝、锁链与符纹        -> 局部赤红封印光
 *   towerTop   「烽火台**从未点燃**」      -> **不点火**,仅自然夜色
 *   cellar     「**从不开锁**」            -> 不亮
 *   kitchen    「炊烟一起」                -> 夜间灶火余温
 *
 * towerTop 那条尤其要守住:烽火台不亮是**世界观设定**,不能为了好看点上。
 *
 * ============ 亮灯的两个来源 ============
 * 1. 固定光源(本表)—— 壁炉/篝火/结界这类不随人走的光。
 * 2. 驻在驱动 —— 夜相位有人的房间默认点灯(见 resolveRoomLight)。
 * 无可见灯具的驻在房间只给很弱的窗边反光,形成明暗错落。
 */

export type LightTone =
  /** 壁炉、篝火、油灯 —— 暖橙。 */
  | "hearth"
  /** 室内常规照明 —— 暖黄,比 hearth 淡。 */
  | "lamp"
  /** 信号灯、法术光 —— 冷白偏青。 */
  | "cold"
  /** 地下书库和结界侧灯的蓝色火焰。 */
  | "blue"
  /** 结界红线 —— 赤红。 */
  | "arcane"
  /** 符纸、幽光 —— 惨白偏绿,极弱。 */
  | "spectral"
  /** 熟睡中的微光 —— 极弱暖色。 */
  | "dim";

export interface RoomLight {
  tone: LightTone;
  /** 光强 0~1。会乘进最终不透明度。 */
  intensity: number;
  /** 缓慢呼吸。只给有明确可见火焰/脉搏的主光源。 */
  flicker?: "flame" | "pulse";
}

/**
 * 固定光源。与「有没有人」无关。
 * 键是 defaultRegions 的房间 id。
 */
const FIXED_ROOM_LIGHTS: Partial<Record<string, RoomLight>> = {
  // 「壁炉全年不熄」—— 全场最暖最亮的一处,是「家」的锚点。
  hall: { tone: "hearth", intensity: 0.95, flicker: "flame" },
  kaelHut: { tone: "hearth", intensity: 0.86, flicker: "flame" },
  workshop: { tone: "hearth", intensity: 0.9 },
  library: { tone: "blue", intensity: 0.95 },
  // 温室不点室内灯；原画两株植物自身分别发蓝光和金光。
  greenhouse: { tone: "blue", intensity: 0.86 },
  // 「红线如脉搏明暗起伏」—— 文案直接指定了呼吸。
  array: { tone: "arcane", intensity: 0.82, flicker: "pulse" },
  // 「墙上挂着海图与信号灯」。
  towerHall: { tone: "cold", intensity: 0.5 },
  // 原画为红色封印；沿门缝与两侧符纹发光，不照亮整面墙。
  seal: { tone: "arcane", intensity: 0.76 },
  // 「炊烟一起」—— 夜里是灶膛余火,不是全亮。
  kitchen: { tone: "hearth", intensity: 0.42 },
  // 缇比的黑店「古龙没有这种世俗的作息」—— 通夜营业。
  tibby: { tone: "lamp", intensity: 0.72 },
};

/**
 * 明确**不点灯**的房间。即使夜里有人也不点(或只给极弱微光)。
 * 这些都有文案依据,不是随手挑的。
 */
const LIGHT_OVERRIDES: Partial<Record<string, RoomLight | null>> = {
  // 敞开瞭望台没有点燃的烽火,由自然月光负责。
  towerTop: null,
  // 原画为床头冷色晶灯；保持熟睡时的弱光。
  abyssa: { tone: "cold", intensity: 0.26 },
  // 文案提及篝火/红线,但当前原画只有长椅食物托盘/普通缝纫机。
  // 不在它们上面凭空画出火球；等美术有明确发光体再登记源点。
  plaza: null,
  maid: null,
  // 「铜锁边缘有极细的划痕——女仆长每月查库存,从不开锁」。
  cellar: null,
  // 露台是室外平台。
  terrace: null
};

/**
 * 算出某房间在某相位的灯光。
 *
 * 只有夜相位才有灯光层 —— 晨/昼/昏由天光负责。
 * 「昏」本来也可以给一点点,但实测会让暮色显得脏,所以只在夜间点灯。
 */
export function resolveRoomLight(
  roomId: string,
  phase: MansionPhaseId,
  occupied: boolean
): RoomLight | null {
  if (phase !== "night") return null;

  // 覆盖优先:世界观设定不能被驻在规则推翻。
  if (roomId in LIGHT_OVERRIDES) return LIGHT_OVERRIDES[roomId] ?? null;

  const fixed = FIXED_ROOM_LIGHTS[roomId];
  if (fixed) return fixed;

  // 驻在驱动:夜里有人 -> 点一盏常规灯。
  if (occupied) return { tone: "lamp", intensity: 0.62 };

  return null;
}
