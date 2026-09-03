import type { MapLocationId } from "../types";
import abandonedWatchtowerSceneUrl from "../../../assets/map/quest-backgrounds/abandoned-watchtower.jpg";
import tidecallGrottoSceneUrl from "../../../assets/map/quest-backgrounds/tidecall-grotto.jpg";
import weatheredSanctumSceneUrl from "../../../assets/map/quest-backgrounds/weathered-sanctum.jpg";

/* ============ 委托占位文案 ============
 *
 * 这是**占位**，不是定稿：机制与数值都还没对齐，所以这里刻意
 * 一个数字都不给 —— 没有难度星级、没有推荐等级、没有胜率、没有金币数额。
 * 「编队即难度」是设计护栏（DESIGN_REFERENCE_LOG.md 六），
 * 用数字替玩家把牌读完就废了这条。
 *
 * 收益只给一至三星的相对刻度，不给绝对值：
 * 远征结算是「金币 x 累计倍率」，倍率由玩家走多深决定，
 * 出发前根本不存在一个可写的确定数额。
 *
 * 威胁写的是「敌人做什么」而不是属性：
 * 敌人靠行为区分，没有属性克制也没有前后排（同上，三·回合流程）。
 *
 * 真数据落地时整个文件会被替换，届时 nodeId 之外的字段可能全变。 */

export type QuestYieldGrade = 1 | 2 | 3;

/** 收益种类。图标由展示层映射，内容层只声明是哪一种。 */
export type QuestSpoil = "coin" | "material" | "crystal";

export interface QuestYieldEntry {
  spoil: QuestSpoil;
  label: string;
  grade: QuestYieldGrade;
}

export interface QuestBrief {
  nodeId: MapLocationId;
  /** 侧板顶部场景横幅；未配置时展示正式占位构图。 */
  sceneImageUrl?: string;
  /** 一句风味。 */
  flavor: string;
  /** 敌人会做什么，两到三条。 */
  threats: string[];
  /** 收益相对刻度。 */
  yields: QuestYieldEntry[];
  /** 有值就多一行事件提示。 */
  event?: string;
}

const QUEST_BRIEFS: QuestBrief[] = [
  {
    nodeId: "church",
    sceneImageUrl: weatheredSanctumSceneUrl,
    flavor: "钟楼塌了半边，钟还挂着。风穿过去的时候，整座山谷都听得见。",
    threats: ["列队推进，前排举盾", "唱诗声起时全体回复", "钟响那回合集火最前的人"],
    yields: [
      { spoil: "coin", label: "金币", grade: 2 },
      { spoil: "material", label: "素材", grade: 1 },
      { spoil: "crystal", label: "晶石", grade: 2 }
    ],
    event: "祭坛还亮着，像是有人刚走。"
  },
  {
    nodeId: "tower",
    sceneImageUrl: abandonedWatchtowerSceneUrl,
    flavor: "哨塔空了三年，瞭望窗口的刻痕停在第四百一十二道。",
    threats: ["蓄力两回合后放一记重击", "封锁点数最高的那枚骰", "残血时召唤替补"],
    yields: [
      { spoil: "coin", label: "金币", grade: 1 },
      { spoil: "material", label: "素材", grade: 3 },
      { spoil: "crystal", label: "晶石", grade: 1 }
    ]
  },
  {
    nodeId: "cave",
    sceneImageUrl: tidecallGrottoSceneUrl,
    flavor: "涨潮时洞口会被淹掉。当地人说，退潮后有时会多出些不属于海的东西。",
    threats: ["水位上涨，每回合压缩可用骰位", "群体袭来，数量多但单个脆", "倒计时结束吞掉囊袋"],
    yields: [
      { spoil: "coin", label: "金币", grade: 3 },
      { spoil: "material", label: "素材", grade: 2 },
      { spoil: "crystal", label: "晶石", grade: 3 }
    ],
    event: "潮声里混着别的声音。"
  }
];

export function findQuestBrief(nodeId: MapLocationId): QuestBrief | undefined {
  return QUEST_BRIEFS.find((brief) => brief.nodeId === nodeId);
}
