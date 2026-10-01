
/* 日志的统一格式:各来源只提供「人物或来源 / 类别 / 状态」,目录副标题、
   阅读区语境行和图标都由这里按同一规则生成,不再各自拼字符串。 */

/** 类别决定阅读区语境行里的类别名,以及目录图标的素材库检索词。 */
export const JOURNAL_CATEGORIES = {
  companion: {label: "同伴片段", icon: "打开的书"},
  gift: {label: "整备赠礼", icon: "赠礼"},
  commission: {label: "委托", icon: "封缄卷轴"},
  schedule: {label: "馆内安排", icon: "记录簿"},
  return: {label: "远征归来", icon: "行囊"},
  appraisal: {label: "带回物品", icon: "财宝箱"},
  memory: {label: "回忆", icon: "怀表"},
  milestone: {label: "羁绊里程碑", icon: "羁绊钥匙"},
} as const satisfies Record<string, {label: string; icon: string}>;
export type JournalCategory = keyof typeof JOURNAL_CATEGORIES;

/** 状态词只有这一本字典。同义的说法(待交谈 / 有事相谈 / 可交谈)合并为一个。
 *  运行时视图自带的状态(例如委托进度)原样使用,不在这里改写。 */
export const JOURNAL_STATUS = {
  available: "可交谈",
  resume: "待继续",
  appraise: "待鉴定",
  deliver: "待交付",
  wrapUp: "待收尾",
  schedule: "待安排",
  organize: "待整理记忆",
  feedback: "有新反馈",
  ongoing: "进行中",
  waiting: "待行动",
  frozen: "归来后继续",
  scheduled: "已安排",
  done: "已完成",
  closed: "已结束",
  settled: "已结算",
  locked: "尚未开放",
} as const;

/** 目录分组。顺序即显示顺序;分组只改变归属,不改变条目自身的版式。 */
export const JOURNAL_GROUPS = [
  {id: "current", label: "当前事项"},
  {id: "archive", label: "已归档"},
  {id: "locked", label: "尚未开放"},
] as const;
export type JournalGroup = (typeof JOURNAL_GROUPS)[number]["id"];

/** 状态的视觉强弱:可处理 > 进行中 > 已归档 > 未开放。 */
export type JournalTone = "action" | "ongoing" | "done" | "locked";

/** 地点的图标:有操作时地点写在操作栏左端。只认这本表,条目里不另配图标。 */
export const JOURNAL_PLACE_ICONS: Readonly<Record<string, string>> = {
  公共休息室: "茶壶",
  旧日回廊: "蜡烛",
  洋馆: "灯笼",
  杂货铺: "钱袋",
};

/** 小节标签用到的通用图标,同样走素材库检索,不直接引用文件。 */
export const JOURNAL_GLYPHS = {
  condition: "挂锁",
  result: "赠礼",
  record: "卷轴",
  loot: "货箱",
  receipt: "钱袋",
} as const;
