/**
 * 漫符(头顶气泡/符号)注册表与位置模型。
 *
 * 漫符是叠在立绘头顶的循环 APNG:害羞的红晕、疑问的「?」、沮丧的低气压。
 * 素材由 scripts/build-emotes.mjs 从混合来源(GIF + APNG)统一成
 * 30 帧 / 67ms / 192px,输出到 src/assets/emote/<id>.png。
 *
 * ============ 位置为什么必须分成两级 ============
 * 「漫符该放哪」由两个互不相关的因素决定,混成一张表就再也拆不开:
 *
 *   基准 (EMOTE_PLACEMENT)   逐**漫符**
 *     漫符自身画布里的留白与构图各不相同 —— 有的符号偏画布上缘、
 *     有的居中、有的本体只占画布一角。这部分与角色无关。
 *
 *   偏移 (EMOTE_ADJUST)      逐**角色 × 漫符**
 *     头顶的实际位置按角色差异很大(发型高度、头身比、立绘校准值),
 *     而且同一个角色对不同漫符的合适位置也不同(大符号要抬高,
 *     小符号可以贴头皮)。这正是「每个气泡针对每个人都可以调整」。
 *
 * 最终值 = 基准 + 偏移。改错了层会有明确后果:把角色问题补在基准上,
 * 会让其余九人一起歪;把漫符构图问题补在偏移上,就得给十个角色各补一遍。
 * 这与 spriteCalibration(画布级)/ rp.css(舞台级)的分工是同一个道理。
 *
 * ============ 坐标系（沿用工作台现行 CSS，不重解释既有校准） ============
 * 原点为立绘盒子的顶部中心。size 是立绘宽度百分比；x/y 是漫符
 * 自身边长百分比（CSS translate 的参照），不是立绘宽度百分比。
 * 最终边长 S = 立绘宽 × size/100；左上角 = (立绘宽/2 + S×(x-50)/100, S×y/100)。
 * 基准与角色增量先相加，再交给 Emote 渲染。左右席位不翻转或另加偏移。
 */

export interface EmotePlacement {
  x: number;
  y: number;
  size: number;
}

export interface EmoteDef {
  id: string;
  /** 面板与 aria 用的中文名。 */
  label: string;
  /** 日文原名。重新导入一批素材时靠它与源文件核对。 */
  origin: string;
}

/**
 * 十五个漫符。顺序按语义分组(情绪 → 状态 → 符号),不是字母序 ——
 * 面板上是一排按钮,相近的情绪挨着放才好找。
 */
export const EMOTES: EmoteDef[] = [
  { id: "blush", label: "害羞", origin: "はずかし" },
  { id: "heart", label: "爱心", origin: "ハートB 3連" },
  { id: "glitter", label: "闪耀", origin: "キラキラA 一部" },
  { id: "sparkle", label: "星光", origin: "キラキラ" },
  { id: "note", label: "音符", origin: "音符A2 1個 黄色" },
  // sweat(あせあせA 連続)是连续多滴的冷汗,sweatdrop(あせ)是单股流汗 ——
  // 两者画面与语义都不同,不能合并成一个 id。
  { id: "sweat", label: "冷汗", origin: "あせあせA 連続" },
  { id: "sweatdrop", label: "流汗", origin: "あせ" },
  { id: "anger", label: "愤怒", origin: "怒" },
  { id: "gloom", label: "沮丧", origin: "がっかりB ぐねぐね" },
  { id: "sleepy", label: "困倦", origin: "ねむけ" },
  { id: "dizzy", label: "晕眩", origin: "ぐるぐる" },
  { id: "exclaim", label: "惊讶", origin: "びっくり" },
  { id: "question", label: "疑问", origin: "はてな" },
  { id: "idea", label: "灵光", origin: "ぴこん" },
  { id: "ellipsis", label: "无言", origin: "てんてんてん" }
];

export const EMOTE_IDS = EMOTES.map((e) => e.id);

export const EMOTE_LABELS: Record<string, string> = Object.fromEntries(
  EMOTES.map((e) => [e.id, e.label])
);

/** 用户于 2026-09-08 从工作台重新校准并提供；基准与偏移必须一起更新。 */
const START: EmotePlacement = { x: 0, y: -26, size: 34 };

export const EMOTE_PLACEMENT: Record<string, EmotePlacement> = {
  blush:      { x: -24.5,   y: 39,      size: 31.5 },   // 害羞
  heart:      { x: 57,      y: 18.5,    size: 35.5 },   // 爱心
  glitter:    { x: -18,     y: 38.5,    size: 33.5 },   // 闪耀
  sparkle:    { x: -45,     y: 40,      size: 20 },   // 星光
  note:       { x: 14.5,    y: -16,     size: 61.5 },   // 音符
  sweat:      { x: 22,      y: 40,      size: 33 },   // 冷汗
  sweatdrop:  { x: 42,      y: 31,      size: 34 },   // 流汗
  anger:      { x: -40.5,   y: 30.5,    size: 34 },   // 愤怒
  gloom:      { x: 32,      y: 37,      size: 34 },   // 沮丧
  sleepy:     { x: -22.5,   y: 16,      size: 59.5 },   // 困倦
  dizzy:      { x: -54,     y: 40,      size: 23.5 },   // 晕眩
  exclaim:    { x: 60,      y: 40,      size: 24 },   // 惊讶
  question:   { x: 60,      y: 22.5,    size: 25 },   // 疑问
  idea:       { x: 48.5,    y: 1.5,     size: 31.5 },   // 灵光
  ellipsis:   { x: -42,     y: 40,      size: 32.5 },   // 无言
};

/**
 * 逐角色 × 漫符偏移 —— 叠加在基准之上的**增量**。
 *
 * 存增量而不是最终值,有两个后果是我们要的:
 *   ① 空对象 = 「这个组合没调过」,与「调过但恰好等于基准」可区分;
 *   ② 之后调整某个漫符的基准(比如整体抬高),十个角色的偏移仍然有效,
 *      不需要逐个跟着改。存最终值的话基准就成了死数据。
 *
 * 稀疏结构:只写调过的组合。10 × 15 = 150 个组合全列出来的话,
 * 表会有 150 行而其中大部分是零,真正调过的那几行反而找不到。
 */
export type EmoteAdjustTable = Record<string, Record<string, Partial<EmotePlacement>>>;

export const EMOTE_ADJUST: EmoteAdjustTable = {
  abyssa: {
    blush:      { x: 0.5, y: 6, size: 3.5 },
    sparkle:    { x: -20.5, y: 30 },
    sweat:      { y: 20 },
    sweatdrop:  { y: 1 },
    anger:      { y: 16.5 },
    dizzy:      { y: 30 },
    exclaim:    { x: 20.5, y: 16 },
    question:   { x: 10, y: 30 },
    idea:       { x: 9, y: 30 },
    ellipsis:   { y: 14 }
  },
  alvitr: {
    blush:      { x: -9, y: 13.5 },
    glitter:    { x: -16, y: 4, size: -3 },
    sparkle:    { x: -26.5, y: 26.5 },
    note:       { y: 9.5 },
    sweatdrop:  { y: -3.5 },
    gloom:      { y: -17 },
    dizzy:      { y: 6 },
    question:   { y: 14.5 }
  },
  elora: {
    blush:      { x: -2, y: 30 },
    heart:      { y: 27.5 },
    glitter:    { x: -10.5, y: 18 },
    sparkle:    { x: -24.5, y: 30 },
    note:       { y: 23 },
    sweat:      { y: 30 },
    sweatdrop:  { y: 25 },
    anger:      { x: 3.5, y: 30 },
    gloom:      { y: 17 },
    sleepy:     { y: 13 },
    dizzy:      { x: -6, y: 30 },
    exclaim:    { x: 20, y: 30 },
    question:   { x: 13, y: 30 },
    idea:       { x: 9, y: 30 },
    ellipsis:   { x: -5, y: 30 }
  },
  eustice: {
    blush:      { x: -14.5 },
    heart:      { y: -15.5 },
    glitter:    { x: -17, y: -18 },
    sparkle:    { x: -30, y: -1.5 },
    sweat:      { y: -16 },
    sweatdrop:  { y: -23 },
    anger:      { x: -15, y: -14 },
    gloom:      { x: -5.5, y: -30 },
    sleepy:     { y: -27.5 },
    dizzy:      { x: -9, y: -17 },
    exclaim:    { y: -24 },
    question:   { x: -5.5, y: -6.5 },
    idea:       { x: -3.5, y: -10.5 },
    ellipsis:   { x: -6.5, y: -14.5 }
  },
  kororo: {
    blush:      { x: -4, y: 30 },
    heart:      { y: 30 },
    glitter:    { x: -11.5, y: 21.5 },
    sparkle:    { x: -27.5, y: 30 },
    note:       { y: 22 },
    sweat:      { y: 30 },
    sweatdrop:  { y: 25.5 },
    anger:      { x: -2, y: 28 },
    gloom:      { x: 4.5, y: 11.5 },
    sleepy:     { y: -3 },
    dizzy:      { x: -5.5, y: 30 },
    exclaim:    { x: 18.5, y: 30 },
    question:   { x: 30, y: 30 },
    idea:       { x: 13.5, y: 30 },
    ellipsis:   { y: 30 }
  },
  lenore: {
    blush:      { x: -17, y: 20 },
    heart:      { y: 10 },
    glitter:    { x: -24.5, y: 14.5 },
    sparkle:    { x: -25, y: 30 },
    note:       { y: 20.5 },
    sweat:      { y: 15 },
    sweatdrop:  { y: 20 },
    anger:      { x: -11.5, y: 17 },
    gloom:      { y: -11.5 },
    sleepy:     { y: -6.5 },
    dizzy:      { x: -17.5, y: 30 },
    question:   { x: 16.5, y: 19.5 },
    idea:       { x: -8.5, y: 13.5 },
    ellipsis:   { x: -12, y: 1 }
  },
  marietta: {
    blush:      { x: -14 },
    glitter:    { x: -14, y: -22 },
    sparkle:    { x: -30, y: 1.5 },
    anger:      { y: -5.5 },
    gloom:      { y: -29.5 },
    sleepy:     { y: -24 },
    dizzy:      { x: -5, y: -8.5 },
    exclaim:    { y: -21 },
    question:   { x: 13, y: 4 },
    idea:       { x: 8, y: -11 },
    ellipsis:   { x: -2, y: -17 }
  },
  norma: {
    blush:      { x: -16, y: 30 },
    heart:      { y: 19 },
    glitter:    { x: -27, y: 23.5, size: -3.5 },
    sparkle:    { x: -30, y: 30 },
    note:       { y: 22 },
    sweat:      { y: 15.5 },
    sweatdrop:  { y: 18.5 },
    anger:      { x: -7.5, y: 23 },
    gloom:      { y: -7.5 },
    sleepy:     { y: -9 },
    dizzy:      { x: -5, y: 30 },
    exclaim:    { y: 13.5 },
    question:   { x: 21, y: 21 },
    idea:       { x: -6.5, y: 18 },
    ellipsis:   { x: -8.5, y: 15 }
  },
  tibby: {
    blush:      { x: -3, y: 16.5 },
    heart:      { y: 11.5 },
    glitter:    { x: -5, y: 6.5, size: -2.5 },
    sparkle:    { x: -25, y: 30 },
    note:       { y: 7 },
    sweat:      { y: 15.5 },
    sweatdrop:  { y: 13.5 },
    anger:      { y: 8 },
    gloom:      { y: -8.5 },
    sleepy:     { y: -16.5 },
    dizzy:      { x: -1, y: 14.5 },
    exclaim:    { y: 14 },
    question:   { x: 14, y: 16.5 },
    idea:       { x: 2.5, y: 19 }
  },
  vivienne: {
    blush:      { x: -20, y: 7.5 },
    heart:      { x: -11.5, y: 8 },
    glitter:    { x: -26.5, y: -19 },
    sparkle:    { x: -30, y: 30 },
    sweat:      { y: 5.5 },
    anger:      { x: -11.5, y: -3 },
    gloom:      { x: -13.5, y: -30 },
    dizzy:      { x: -16.5, y: 13 },
    ellipsis:   { x: -10.5, y: -7.5 }
  }
};

/** 基准 + 偏移。渲染与 studio 预览都走这一个函数,避免两处算法漂移。 */
export function resolveEmotePlacement(characterId: string, emoteId: string): EmotePlacement {
  const base = EMOTE_PLACEMENT[emoteId] ?? START;
  const adj = EMOTE_ADJUST[characterId]?.[emoteId];
  if (!adj) return { ...base };
  return {
    x: base.x + (adj.x ?? 0),
    y: base.y + (adj.y ?? 0),
    size: base.size + (adj.size ?? 0)
  };
}

export function hasEmote(emoteId: string): boolean {
  return emoteId in EMOTE_PLACEMENT;
}
