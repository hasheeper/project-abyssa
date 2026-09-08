/* 骰面契约（可序列化，无 React 类型）。
   ------------------------------------------------------------------
   为什么放在 shared/domain：
     src/content 只允许 import shared/domain（scripts/check-module-boundaries.mjs:80-85），
     而档案页的骰装数据住在 content。骰面词表因此必须落在这里，
     不能从 src/apps/battle 取——app 之间禁止互相 import（同脚本 :60）。

   与战斗引擎的关系：
     引擎规则位于 src/game-core/battle，本文件不承担规则计算。
     本文件是**展示层契约**，两处词表必须同序同名。
     已知刻意差异：引擎 Verb 没有 "art"，所以 DieFaceAction 是它的超集。

   两轴正交：
     花色管出身（不可改），命数管修行（可成长）。
     花色不参与任何战斗判定，唯一职能是同花材料与编队策略。 */

/** 命数状态。沉眠面刻痕被岁月磨平，点数不参与牌型识别。
    live 数据中醒眠与品质独立：沉眠面仍保留动作，醒面也可为金或锈。 */
export type DieFateState = "asleep" | "awake";

export const DIE_FATE_STATE_LABELS: Record<DieFateState, string> = {
  asleep: "沉眠",
  awake: "已醒",
};

/** 沉眠面不进牌局。 */
export function fateEntersHand(state: DieFateState): boolean {
  return state === "awake";
}

/** 花色：出身。四色不分贵贱。 */
export type DieSuit = "holy" | "earth" | "abyss" | "beyond";

export const DIE_SUIT_LABELS: Record<DieSuit, string> = {
  holy: "圣辉",
  earth: "尘世",
  abyss: "渊影",
  beyond: "彼岸",
};

/** 与 ExpeditionFlatDieFrame 的 suitShape 对齐（该组件只认这四种字形）。 */
export const DIE_SUIT_SHAPES: Record<
  DieSuit,
  "diamond" | "square" | "triangle" | "circle"
> = {
  holy: "diamond",
  earth: "square",
  abyss: "triangle",
  beyond: "circle",
};

/** 骰面动作。引擎 Verb 的超集（多一个 art）。 */
export type DieFaceAction =
  "attack" | "guard" | "heal" | "coin" | "art" | "wild" | "blank";

export const DIE_FACE_ACTION_LABELS: Record<DieFaceAction, string> = {
  attack: "攻击",
  guard: "格挡",
  heal: "治疗",
  coin: "顺手牵羊",
  art: "术式",
  wild: "命数",
  blank: "空面",
};

export interface DieFace {
  /** Present only for real archive data; legacy visual samples omit it. */
  live?: LiveFaceDetails;
  /** 骰面序号 1–6，同时是立方体的面位。 */
  face: 1 | 2 | 3 | 4 | 5 | 6;
  /** 命数点数 1–6，参与牌型识别。 */
  pip: number;
  /** 玩家位的万能点数（静谧之楔）：角标渲染为宝石而非数字。 */
  wildPip?: boolean;
  action: DieFaceAction;
  /** 战面数值：伤害 / 格挡 / 治疗量。空面为 0。 */
  power: number;
  fate: DieFateState;
  suit: DieSuit;
  /** 战面被饰品改写前的原值。有值即表示这一面被挂坠改写过。 */
  basePower?: number;
  /** 改写来源饰品的 id。 */
  chamedBy?: string;
  /** 检视栏底部的一句风味说明。 */
  note?: string;
}

/** 饰品挂坠。设计上限 3 件。 */
export type CharmKind = "combat-face" | "fate";

export const CHARM_KIND_LABELS: Record<CharmKind, string> = {
  "combat-face": "战面改写",
  fate: "命数修正",
};

/** 挂坠位总数。空位也要显示，玩家得看见还有几个孔。 */
export const CHARM_SLOT_COUNT = 3;

export interface DieCharm {
  id: string;
  name: string;
  secondaryName?: string;
  kind: CharmKind;
  /** 图标键，由展示层映射到 SVG 资源。 */
  icon: DieFaceAction | "book" | "ring" | "scroll";
  effect: string;
  /** 取得来源，例如「守望者杂货铺 · 800 里拉」。 */
  origin?: string;
  /** 轶闻。 */
  lore?: string;
}

/** 一名角色的整套骰装。faces 为空表示本版本没有可展示的骰面。 */
export interface CharacterDiceLoadout {
  live?: {
    scope: string;
    version: 1 | 2;
    slots: ArchiveEquipmentSlot[];
    growth: string;
  };
  characterId: string;
  /** 主、副花色仅用于样稿概览；live 花色按每面分别展示。 */
  primarySuit?: DieSuit;
  secondarySuit?: DieSuit;
  faces: DieFace[];
  charms?: DieCharm[];
  /** 私约一行，显示在总览。 */
  pact?: string;
  /** 无骰面时展示的说明。 */
  placeholderNote?: string;
  placeholderTitle?: string;
}

export type LiveFaceDetails = {
  id: string;
  quality: "none" | "rust" | "plain" | "gild";
  baseQuality: "none" | "rust" | "plain" | "gild";
  pip: { kind: "natural"; value: number } | { kind: "wild" };
  suitKnown: boolean;
  actionLabel: string;
  description: string;
  rust: "none" | "legacy" | "removable" | "permanent" | "temporary";
  replacement?: string;
};
export type ArchiveEquipmentSlot = {
  id: string;
  label: string;
  state: "unavailable" | "inapplicable" | "empty" | "equipped" | "legacy";
  description: string;
  name?: string;
  instanceId?: string;
  icon?: DieFaceAction;
};
/** Live callers must supply every semantic axis; numeric pip is geometry only for wild faces. */
export interface LiveCharacterDiceLoadout extends CharacterDiceLoadout {
  live: NonNullable<CharacterDiceLoadout["live"]>;
  faces: (DieFace & { live: LiveFaceDetails })[];
}

/** 统计某花色占了几面，用于校验主色 4 / 副色 2。 */
export function countSuit(faces: readonly DieFace[], suit: DieSuit): number {
  return faces.filter((face) => face.suit === suit).length;
}

/** 参与牌型识别的面（沉眠不算）。 */
export function awakeFaces(faces: readonly DieFace[]): DieFace[] {
  return faces.filter((face) => fateEntersHand(face.fate));
}
