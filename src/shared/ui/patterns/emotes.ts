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
 * ============ 坐标系 ============
 * 原点是**立绘盒子的顶部中心**,不是席位框 —— 立绘盒子的宽高由取景比例
 * 决定、与席位尺寸解耦,所以同一组数值换取景、换视口都成立。
 *   x     水平偏移,正 = 右移。相对立绘盒子宽度。
 *   y     垂直偏移,正 = 下移。相对立绘盒子宽度(**不是高度**,见下)。
 *   size  漫符边长,相对立绘盒子宽度。
 *
 * y 也用宽度作基准,是因为立绘盒子是竖长方形(knee 取景 704:1178)。
 * 若 y 用高度、size 用宽度,那么「把漫符往上挪一个自身高度」在两个取景下
 * 得到的像素量不同 —— 调好的值换取景就散了。统一用宽度,x/y/size
 * 三者同基准,数值之间可以直接加减。
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
 * 十三个漫符。顺序按语义分组(情绪 → 状态 → 符号),不是字母序 ——
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

/**
 * 逐漫符基准位置。
 *
 * ============ 当前全部是同一组起始值,尚未逐个校准 ============
 * 这十三个数值现在是统一的 { x: 0, y: -26, size: 34 },意思是
 * 「边长 34% 立绘宽、悬在头顶上方」。它是一个**能显示出来的起点**,
 * 不是校准结果 —— 各漫符画布内的构图差异还没有反映进来。
 *
 * 之所以不预先猜出十三组不同的值:那会是凭空编造的精度。
 * 一组明显统一的数值能让人一眼看出「这里还没调」,
 * 十三组似是而非的数值反而会让人以为已经调过了。
 *
 * 校准方式:npm run dev:studio,选角色 → 选漫符 → 拖三个滑块,
 * 面板会分列「基准」与「逐角色偏移」两组,调完从导出弹窗取表体回填。
 */
const START: EmotePlacement = { x: 0, y: -26, size: 34 };

export const EMOTE_PLACEMENT: Record<string, EmotePlacement> = {
  blush: { ...START },
  heart: { ...START },
  glitter: { ...START },
  sparkle: { ...START },
  note: { ...START },
  sweat: { ...START },
  sweatdrop: { ...START },
  anger: { ...START },
  gloom: { ...START },
  sleepy: { ...START },
  dizzy: { ...START },
  exclaim: { ...START },
  question: { ...START },
  idea: { ...START },
  ellipsis: { ...START }
};

/**
 * 逐角色 × 漫符偏移 —— 叠加在基准之上的**增量**。
 *
 * 存增量而不是最终值,有两个后果是我们要的:
 *   ① 空对象 = 「这个组合没调过」,与「调过但恰好等于基准」可区分;
 *   ② 之后调整某个漫符的基准(比如整体抬高),十个角色的偏移仍然有效,
 *      不需要逐个跟着改。存最终值的话基准就成了死数据。
 *
 * 稀疏结构:只写调过的组合。10 × 13 = 130 个组合全列出来的话,
 * 表会有 130 行而其中大部分是零,真正调过的那几行反而找不到。
 */
export type EmoteAdjustTable = Record<string, Record<string, Partial<EmotePlacement>>>;

export const EMOTE_ADJUST: EmoteAdjustTable = {};

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
