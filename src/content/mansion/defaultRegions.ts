import type {
  MansionRectangle,
  MansionRegion,
  MansionRegionKind,
  NormalizedPoint
} from "../../shared/domain/mansion/regions";

const CANVAS_WIDTH = 5162;
const CANVAS_HEIGHT = 1910;

function point(x: number, y: number): NormalizedPoint {
  return {
    x: Number((x / CANVAS_WIDTH).toFixed(6)),
    y: Number((y / CANVAS_HEIGHT).toFixed(6))
  };
}

function rectangle(
  id: string,
  label: string,
  kind: MansionRegionKind,
  x: number,
  y: number,
  width: number,
  height: number
): MansionRectangle {
  return {
    id,
    label,
    kind,
    rect: {
      x: Number((x / CANVAS_WIDTH).toFixed(6)),
      y: Number((y / CANVAS_HEIGHT).toFixed(6)),
      width: Number((width / CANVAS_WIDTH).toFixed(6)),
      height: Number((height / CANVAS_HEIGHT).toFixed(6))
    }
  };
}

function polygon(
  id: string,
  label: string,
  kind: MansionRegionKind,
  points: Array<[number, number]>
): MansionRegion {
  return { id, label, kind, points: points.map(([x, y]) => point(x, y)) };
}

/**
 * Initial correspondence between the v8 layout skeleton and map.psd.
 * These are deliberately ordinary editor data: the user is expected to tune
 * them against the final art, then export a reviewed parameter file.
 */
export const DEFAULT_MANSION_RECTANGLES: MansionRectangle[] = [
  rectangle("tibby", "缇比的杂货铺", "building", 0.036396 * CANVAS_WIDTH, 0.642165 * CANVAS_HEIGHT, 0.058658 * CANVAS_WIDTH, 0.152263 * CANVAS_HEIGHT),
  rectangle("dock", "小码头", "building", 0, 0.759162 * CANVAS_HEIGHT, 0.09105 * CANVAS_WIDTH, 0.157068 * CANVAS_HEIGHT),

  // 主宅二层：统一 y=710 → 1020。
  rectangle("bath", "大浴室", "room", 0.269127 * CANVAS_WIDTH, 710, 0.044334 * CANVAS_WIDTH, 310),
  rectangle("lounge", "二层起居室【美术补充】", "room", 0.315528 * CANVAS_WIDTH, 710, 0.050716 * CANVAS_WIDTH, 310),
  rectangle("abyssa", "魔王寝室", "room", 0.369583 * CANVAS_WIDTH, 710, 0.063428 * CANVAS_WIDTH, 310),
  // 露台是室外平台，保留用户校准的独立上下界。
  rectangle("terrace", "日光露台", "room", 0.435811 * CANVAS_WIDTH, 0.372999 * CANVAS_HEIGHT, 0.152889 * CANVAS_WIDTH, 0.156422 * CANVAS_HEIGHT),

  // 主宅一层：统一 y=1030 → 1330。
  rectangle("hall", "大厅", "room", 0.26869 * CANVAS_WIDTH, 1030, 0.08044 * CANVAS_WIDTH, 300),
  rectangle("kitchen", "厨房", "room", 0.352215 * CANVAS_WIDTH, 1030, 0.075213 * CANVAS_WIDTH, 300),
  rectangle("dining", "餐厅", "room", 0.429444 * CANVAS_WIDTH, 1030, 0.051217 * CANVAS_WIDTH, 300),
  rectangle("salon", "沙龙【薇薇安的岗位】", "room", 0.483963 * CANVAS_WIDTH, 1030, 0.048217 * CANVAS_WIDTH, 300),
  rectangle("foyer", "门厅", "room", 0.534702 * CANVAS_WIDTH, 1030, 0.050609 * CANVAS_WIDTH, 300),

  rectangle("armory", "武备库", "room", 0.158398 * CANVAS_WIDTH, 0.532917 * CANVAS_HEIGHT, 0.083328 * CANVAS_WIDTH, 0.166385 * CANVAS_HEIGHT),

  // 地下一层：统一 y=1350 → 1630。
  rectangle("workshop", "工坊【美术补充】", "room", 0.269522 * CANVAS_WIDTH, 1350, 0.061594 * CANVAS_WIDTH, 280),
  rectangle("storage", "储藏室", "room", 0.334694 * CANVAS_WIDTH, 1350, 0.053498 * CANVAS_WIDTH, 280),
  rectangle("laundry", "洗衣房", "room", 0.390561 * CANVAS_WIDTH, 1350, 0.054626 * CANVAS_WIDTH, 280),
  rectangle("maid", "女仆工作间【玛丽埃塔的岗位】", "room", 0.448904 * CANVAS_WIDTH, 1350, 0.05607 * CANVAS_WIDTH, 280),
  rectangle("cellar", "酒窖", "room", 0.507645 * CANVAS_WIDTH, 1350, 0.080965 * CANVAS_WIDTH, 280),

  // 地下二层：统一 y=1645 → 1910。
  rectangle("library", "禁书库【蕾诺尔的岗位】", "room", 0.350674 * CANVAS_WIDTH, 1645, 0.072988 * CANVAS_WIDTH, 265),
  rectangle("array", "结界核心室", "room", 0.427154 * CANVAS_WIDTH, 1645, 0.069982 * CANVAS_WIDTH, 265),
  rectangle("seal", "封印之门", "room", 0.500909 * CANVAS_WIDTH, 1645, 0.069103 * CANVAS_WIDTH, 265),

  rectangle("kaelHut", "凯尔的小屋", "building", 0.70436 * CANVAS_WIDTH, 0.54811 * CANVAS_HEIGHT, 0.056144 * CANVAS_WIDTH, 0.09103 * CANVAS_HEIGHT),
  rectangle("plaza", "小广场", "building", 0.778432 * CANVAS_WIDTH, 0.573166 * CANVAS_HEIGHT, 0.04583 * CANVAS_WIDTH, 0.078112 * CANVAS_HEIGHT),

  // 女子宿舍二层与一层分别统一。
  rectangle("eustice", "尤斯缇丝的房间", "room", 0.829229 * CANVAS_WIDTH, 879, 0.038809 * CANVAS_WIDTH, 166),
  rectangle("norma", "诺玛的房间", "room", 0.870468 * CANVAS_WIDTH, 879, 0.038919 * CANVAS_WIDTH, 166),
  rectangle("elora", "艾洛拉的房间", "room", 0.82868 * CANVAS_WIDTH, 1060, 0.038993 * CANVAS_WIDTH, 165),
  rectangle("kororo", "柯萝萝的房间", "room", 0.870611 * CANVAS_WIDTH, 1060, 0.041001 * CANVAS_WIDTH, 165),
  rectangle("gate", "正门", "building", 0.917585 * CANVAS_WIDTH, 0.3163 * CANVAS_HEIGHT, 0.082415 * CANVAS_WIDTH, 0.387889 * CANVAS_HEIGHT)
];

export const DEFAULT_MANSION_REGIONS: MansionRegion[] = [
  polygon("towerTop", "瞭望台【阿尔薇特的岗位】", "building", [
    [0.207424 * CANVAS_WIDTH, 0.148914 * CANVAS_HEIGHT],
    [0.242484 * CANVAS_WIDTH, 0],
    [0.271936 * CANVAS_WIDTH, 0.147291 * CANVAS_HEIGHT],
    [0.269316 * CANVAS_WIDTH, 0.191387 * CANVAS_HEIGHT],
    [0.214539 * CANVAS_WIDTH, 0.188092 * CANVAS_HEIGHT]
  ]),
  polygon("towerHall", "岗哨厅", "building", [
    [0.223922 * CANVAS_WIDTH, 0.191626 * CANVAS_HEIGHT],
    [0.261104 * CANVAS_WIDTH, 0.191334 * CANVAS_HEIGHT],
    [0.267027 * CANVAS_WIDTH, 0.698661 * CANVAS_HEIGHT],
    [0.22032 * CANVAS_WIDTH, 0.698888 * CANVAS_HEIGHT],
    [0.222355 * CANVAS_WIDTH, 0.525007 * CANVAS_HEIGHT]
  ]),
  polygon("attic", "阁楼观星室【美术补充】", "room", [
    [0.269824 * CANVAS_WIDTH, 0.362118 * CANVAS_HEIGHT],
    [0.269893 * CANVAS_WIDTH, 0.289669 * CANVAS_HEIGHT],
    [0.345933 * CANVAS_WIDTH, 0.203215 * CANVAS_HEIGHT],
    [0.37856 * CANVAS_WIDTH, 0.236599 * CANVAS_HEIGHT],
    [0.416982 * CANVAS_WIDTH, 0.289059 * CANVAS_HEIGHT],
    [0.415732 * CANVAS_WIDTH, 0.360857 * CANVAS_HEIGHT]
  ]),
  polygon("greenhouse", "温室药圃", "building", [
    [0.617337 * CANVAS_WIDTH, 0.645111 * CANVAS_HEIGHT],
    [0.616586 * CANVAS_WIDTH, 0.539776 * CANVAS_HEIGHT],
    [0.668394 * CANVAS_WIDTH, 0.517815 * CANVAS_HEIGHT],
    [0.667846 * CANVAS_WIDTH, 0.650648 * CANVAS_HEIGHT]
  ])
];

export function cloneDefaultMansionRegions() {
  return {
    rectangles: DEFAULT_MANSION_RECTANGLES.map((item) => ({
      ...item,
      rect: { ...item.rect }
    })),
    regions: DEFAULT_MANSION_REGIONS.map((item) => ({
      ...item,
      points: item.points.map((itemPoint) => ({ ...itemPoint }))
    }))
  };
}
