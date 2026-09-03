/* 角色记事的**展示**契约（可序列化，无 React 类型）。
   ------------------------------------------------------------------
   为什么放在 shared/domain：
     src/content 只允许 import shared/domain（scripts/check-module-boundaries.mjs:80-85），
     而档案页的记事数据住在 content。所以词表必须落在这里，
     不能从 src/apps/battle 取——app 之间禁止互相 import（同脚本 :60）。

   ============ 刻意不编码任何机制 ============
   这一层**只管排版，不管理解**。

   记忆如何入库、好感如何计量、私约几阶、天数从哪来、什么算一条记事 ——
   这些业务尚未对齐。一旦写进类型就会在机制变更时全线迁移
   （契约 → 内容 → 组件 → CSS → 测试）。

   所以这里没有一个带机械含义的数字：
     level: number   → badge: string    "Lv.4" 原样渲染，不解析不比较
     day: number     → stamp: string    不假设是「第 N 天」
     stage: 1|2|3    → badge: string    "私约 II" 原样渲染
     五种业务 kind   → 两种块 + 四种节点形（视觉分级，非业务分类）

   唯一保留的语义字段是 categories：它只服务「全部 / 羁绊 / 战事 / 私约」
   这组展示筛选，不参与数值推导，也不从标题、badge 或图标反推。

   机制变更时的成本：改内容字符串，类型/组件/CSS/测试零改动。

   组件不校验、不推导、不跨文件比对。要做一致性校验，等业务定了再在
   content 层做——不要放进展示契约。 */

/** 节点形状。**视觉**分级，不是业务分类。
    未知值一律退回 "node"（见 CHRONICLE_MARKERS 的用法）。 */
export type ChronicleMarker = "node" | "milestone" | "hollow" | "alert";

export const CHRONICLE_MARKERS: readonly ChronicleMarker[] = [
  "node",
  "milestone",
  "hollow",
  "alert"
];

/** 色调。三档都有现成令牌，不新增颜色。 */
export type ChronicleTone = "default" | "accent" | "alert";

const CHRONICLE_TONES: readonly ChronicleTone[] = [
  "default",
  "accent",
  "alert"
];

/** 记事页的轻量展示分类。允许一条记事同时属于多个筛选。 */
export type ChronicleCategory = "daily" | "bond" | "battle" | "pact";

export const CHRONICLE_CATEGORIES: readonly ChronicleCategory[] = [
  "daily",
  "bond",
  "battle",
  "pact"
];

export interface ChronicleEntry {
  id: string;
  /** 左栏戳记。任意字符串——**不假设**是「第 N 天」。 */
  stamp?: string;
  /** 徽标短字，如 "Lv.4" / "II"。原样渲染，不解析不比较。 */
  badge?: string;
  title: string;
  body?: string;
  /** 引语，斜体缩进。 */
  voice?: string;
  /** 显式筛选分类；不根据文案猜测。省略时按普通日常处理。 */
  categories?: ChronicleCategory[];
  marker?: ChronicleMarker;
  tone?: ChronicleTone;
  /** mask 图标资源 URL。图标一律走 mask 才能被令牌色着色。 */
  iconUrl?: string;
}

/** 只有两种块级形态：章节分隔 | 条目。不再细分。 */
export type ChronicleBlock =
  | { kind: "chapter"; id: string; title: string; stamp?: string }
  | ({ kind: "entry" } & ChronicleEntry);

export interface CharacterChronicle {
  characterId: string;
  blocks: ChronicleBlock[];
  /** 无记事时展示的说明。 */
  placeholderNote?: string;
}

/** 归一化节点形。未知值退回 "node"，绝不因脏数据崩掉版面。 */
export function chronicleMarker(value: string | undefined): ChronicleMarker {
  return CHRONICLE_MARKERS.includes(value as ChronicleMarker)
    ? (value as ChronicleMarker)
    : "node";
}

/** 归一化色调。未知值退回 "default"。 */
export function chronicleTone(value: string | undefined): ChronicleTone {
  return CHRONICLE_TONES.includes(value as ChronicleTone)
    ? (value as ChronicleTone)
    : "default";
}

/** 归一化展示分类。未知值丢弃；无有效分类时退回普通日常。 */
export function chronicleCategories(
  values: readonly string[] | undefined
): ChronicleCategory[] {
  const valid = values?.filter((value): value is ChronicleCategory =>
    CHRONICLE_CATEGORIES.includes(value as ChronicleCategory)
  );
  return valid?.length ? [...new Set(valid)] : ["daily"];
}

/** 条目数（章节分隔不计）。用于摘要行的「N 则记事」。 */
export function countChronicleEntries(
  blocks: readonly ChronicleBlock[]
): number {
  return blocks.filter((block) => block.kind === "entry").length;
}
