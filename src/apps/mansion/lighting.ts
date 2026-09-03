import type { MansionPhaseId } from "./data";

/**
 * 洋馆夜间灯光表。
 *
 * ============ 数据从哪来 ============
 * **不是我编的** —— 逐条来自 data.ts 里已有的房间文案。文案早就把光照
 * 设定写好了,这里只是把它翻译成可渲染的参数:
 *
 *   hall       「壁炉**全年不熄**」        -> 必亮,暖橙,有火焰摇曳
 *   array      「红线如**脉搏明暗起伏**」  -> 必亮,赤红,缓慢呼吸
 *   plaza      「一堆**篝火**」            -> 必亮,暖橙,火焰摇曳
 *   towerHall  「墙上挂着海图与**信号灯**」-> 必亮,冷白
 *   seal       「**符纸**无风自动」        -> 惨白微光(不是"灯")
 *   towerTop   「烽火台**从未点燃**」      -> **不点火**,只有窗内微光
 *   cellar     「**从不开锁**」            -> 不亮
 *   kitchen    「炊烟一起」                -> 夜间灶火余温
 *
 * towerTop 那条尤其要守住:烽火台不亮是**世界观设定**,不能为了好看点上。
 *
 * ============ 亮灯的两个来源 ============
 * 1. 固定光源(本表)—— 壁炉/篝火/结界这类不随人走的光。
 * 2. 驻在驱动 —— 夜相位有人的房间默认点灯(见 resolveRoomLight)。
 * 两者合并后约 14 亮 / 17 暗,形成明暗错落。
 */

export type LightTone =
  /** 壁炉、篝火、油灯 —— 暖橙。 */
  | "hearth"
  /** 室内常规照明 —— 暖黄,比 hearth 淡。 */
  | "lamp"
  /** 信号灯、法术光 —— 冷白偏青。 */
  | "cold"
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
  /** 缓慢呼吸。只给「文案里明确是活火/脉搏」的三处。 */
  flicker?: "flame" | "pulse";
}

/**
 * 固定光源。与「有没有人」无关。
 * 键是 defaultRegions 的房间 id。
 */
const FIXED_ROOM_LIGHTS: Partial<Record<string, RoomLight>> = {
  // 「壁炉全年不熄」—— 全场最暖最亮的一处,是「家」的锚点。
  hall: { tone: "hearth", intensity: 0.95, flicker: "flame" },
  // 「一堆篝火」—— 村舍中心。
  plaza: { tone: "hearth", intensity: 0.88, flicker: "flame" },
  // 「红线如脉搏明暗起伏」—— 文案直接指定了呼吸。
  array: { tone: "arcane", intensity: 0.82, flicker: "pulse" },
  // 「墙上挂着海图与信号灯」。
  towerHall: { tone: "cold", intensity: 0.5 },
  // 「符纸无风自动」—— 惨白,弱到几乎看不见才对。
  seal: { tone: "spectral", intensity: 0.34 },
  // 「炊烟一起」—— 夜里是灶膛余火,不是全亮。
  kitchen: { tone: "hearth", intensity: 0.42 },
  // 缇比的黑店「古龙没有这种世俗的作息」—— 通夜营业。
  tibby: { tone: "lamp", intensity: 0.72 },
  // 女仆工作间的红线织机,夜里仍在运转。
  maid: { tone: "arcane", intensity: 0.4 }
};

/**
 * 明确**不点灯**的房间。即使夜里有人也不点(或只给极弱微光)。
 * 这些都有文案依据,不是随手挑的。
 */
const LIGHT_OVERRIDES: Partial<Record<string, RoomLight | null>> = {
  // 「烽火台从未点燃过——但愿永远如此」。有人但不点火,只有窗内微光。
  towerTop: { tone: "dim", intensity: 0.3 },
  // 「熟睡中」—— 极弱微光,不是正常照明。
  abyssa: { tone: "dim", intensity: 0.26 },
  // 「铜锁边缘有极细的划痕——女仆长每月查库存,从不开锁」。
  cellar: null,
  // 玻璃房夜里不点灯(月光会打在玻璃上,那由天光层负责)。
  greenhouse: null,
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
