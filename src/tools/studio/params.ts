import { EMOTES, EMOTE_PLACEMENT } from "../../shared/ui/patterns/emotes";
import type { EmoteAdjustTable, EmotePlacement } from "../../shared/ui/patterns/emotes";
import { CHARACTER_CALIBRATION } from "../../shared/ui/patterns/spriteCalibration";
import type { SpriteCalibration } from "../../shared/ui/patterns/spriteCalibration";
import { ROSTER } from "./characters";

/**
 * 立绘参数模型 —— **两级必须分开**,这是本工具最重要的一条约束。
 *
 * spriteCalibration.ts 与 rp.css 里那两组参数看起来都在「挪立绘」,
 * 但语义完全不同,作用域也不同:
 *
 *   画布级 (cal)   scale / x / y
 *     补偿 PSD 画布本身的裁切差异(头发、特效、体型让内容范围各不相同)。
 *     全局生效 —— rp / novel / battle / character-status 都读同一张表。
 *
 *   舞台级 (stage) doll-h / doll-x / doll-y
 *     只管「这个舞台上的观感」:在 rp 的席位框里站多高、偏多少。
 *     仅 rp 生效。
 *
 * rp.css 明确警告过「不要在这里重复补偿画布问题 —— 那个该去改校准表」。
 * 所以面板必须两栏分列、各自导出。混成一栏是设计错误:用户会在舞台级
 * 补画布问题,然后换到 novel/battle 时发现立绘又歪了,而且再也找不回原因。
 */

/** 舞台级参数。单位都是百分比数值(不带 % 号)。 */
export interface StageParams {
  /** 高度占席位框内高度的比例。矮的角色调大,高的调小。 */
  h: number;
  /** 水平偏移,正 = 右移。相对立绘自身宽度。 */
  x: number;
  /** 垂直偏移,正 = 下移。相对立绘自身高度。 */
  y: number;
}

export interface CharacterParams {
  cal: Required<SpriteCalibration>;
  stage: StageParams;
}

export type ParamMap = Record<string, CharacterParams>;

/** rp.css 末尾那张表当前的值 —— 十行全是基准值,一个都没调过。 */
export const DEFAULT_STAGE: StageParams = { h: 100, x: 0, y: 0 };

/** 各控件的范围与步长。范围按现有值的量级留出余量,不是随便定的。 */
export const RANGES = {
  // 现有值 0.96~1.0。给到 ±20% 足够,再大就该去改取景或 doll-h 了。
  scale: { min: 0.8, max: 1.2, step: 0.005 },
  // 现有值 0~0.005。画布级偏移本就是细活,步长必须比舞台级小一个量级。
  calXY: { min: -0.1, max: 0.1, step: 0.001 },
  // 立绘比席位宽、两侧本来就被裁,所以 h 往上给到 130% 仍有意义。
  h: { min: 70, max: 130, step: 0.5 },
  stageXY: { min: -25, max: 25, step: 0.5 }
} as const;

/**
 * 漫符控件范围。
 *
 * 三者都以立绘盒子**宽度**为基准(理由见 emotes.ts 顶部的坐标系说明),
 * 所以数值之间可以直接比较:size 34 配 y -26,意思是「上移约 3/4 个自身高度」。
 *
 * 偏移(adjust)的范围刻意比基准窄一半:它是角色差异的微调量,
 * 给到与基准同宽的话,就可能在偏移里把整个位置重做一遍 ——
 * 那正是两级分开要防的事(见 emotes.ts:「改错了层会有明确后果」)。
 */
export const EMOTE_RANGES = {
  base: { x: { min: -60, max: 60, step: 0.5 }, y: { min: -80, max: 40, step: 0.5 }, size: { min: 10, max: 80, step: 0.5 } },
  adjust: { x: { min: -30, max: 30, step: 0.5 }, y: { min: -30, max: 30, step: 0.5 }, size: { min: -20, max: 20, step: 0.5 } }
} as const;

/** 漫符的两级参数。base 逐漫符(全局),adjust 逐角色 × 漫符(增量)。 */
export interface EmoteState {
  base: Record<string, EmotePlacement>;
  adjust: EmoteAdjustTable;
}

export function buildEmoteDefaults(): EmoteState {
  const base: Record<string, EmotePlacement> = {};
  for (const { id } of EMOTES) base[id] = { ...EMOTE_PLACEMENT[id] };
  // adjust 起始为空对象 —— 稀疏结构,空 = 没调过(见 emotes.ts)。
  return { base, adjust: {} };
}

export function isEmoteDirty(emoteId: string, base: EmotePlacement, defaults: EmoteState): boolean {
  const d = defaults.base[emoteId];
  if (!d) return true;
  return base.x !== d.x || base.y !== d.y || base.size !== d.size;
}

/** 某角色 × 漫符是否有非零偏移。空对象与全零都算「没调过」。 */
export function hasAdjust(adjust: EmoteAdjustTable, characterId: string, emoteId: string): boolean {
  const a = adjust[characterId]?.[emoteId];
  if (!a) return false;
  return Boolean(a.x || a.y || a.size);
}

/** 读某角色 × 漫符的偏移,缺省补零 —— 面板滑块需要一个确定的数值。 */
export function getAdjust(adjust: EmoteAdjustTable, characterId: string, emoteId: string): EmotePlacement {
  const a = adjust[characterId]?.[emoteId];
  return { x: a?.x ?? 0, y: a?.y ?? 0, size: a?.size ?? 0 };
}

/**
 * 写偏移。全零时**删除**该条目而不是留一个 {x:0,y:0,size:0}。
 *
 * 这是稀疏表能成立的前提:导出时「表里有这一行」就意味着调过。
 * 留零值条目的话,导出的 EMOTE_ADJUST 会逐渐堆满无意义的零,
 * 与全列 130 行的写法就没区别了。
 */
export function setAdjust(
  adjust: EmoteAdjustTable,
  characterId: string,
  emoteId: string,
  next: EmotePlacement
): EmoteAdjustTable {
  const out: EmoteAdjustTable = { ...adjust, [characterId]: { ...adjust[characterId] } };
  if (!next.x && !next.y && !next.size) {
    delete out[characterId][emoteId];
    if (!Object.keys(out[characterId]).length) delete out[characterId];
    return out;
  }
  const entry: Partial<EmotePlacement> = {};
  if (next.x) entry.x = next.x;
  if (next.y) entry.y = next.y;
  if (next.size) entry.size = next.size;
  out[characterId][emoteId] = entry;
  return out;
}

export function buildDefaults(): ParamMap {
  const map: ParamMap = {};
  for (const { id } of ROSTER) {
    const c = CHARACTER_CALIBRATION[id];
    map[id] = {
      cal: { scale: c?.scale ?? 1, x: c?.x ?? 0, y: c?.y ?? 0 },
      stage: { ...DEFAULT_STAGE }
    };
  }
  return map;
}

/**
 * 数值格式化。
 *
 * 滑块反复加减 0.005 会让浮点误差累积成 0.9950000000000001 这种东西,
 * 直接写进导出的源码里就是一颗定时炸弹。先按步长的精度截断再去掉尾零。
 */
export function num(value: number, decimals = 3): string {
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

/** 与默认值是否有差异 —— 用于面板上标出「已改动」。 */
export function isDirty(id: string, params: CharacterParams, defaults: ParamMap): boolean {
  const d = defaults[id];
  if (!d) return true;
  return (
    params.cal.scale !== d.cal.scale ||
    params.cal.x !== d.cal.x ||
    params.cal.y !== d.cal.y ||
    params.stage.h !== d.stage.h ||
    params.stage.x !== d.stage.x ||
    params.stage.y !== d.stage.y
  );
}

/**
 * 导出①:spriteCalibration.ts 的表体。
 *
 * 输出**全部十行**而不是只输出改动过的:源文件里这是一张完整表,
 * 局部粘贴会留下新旧混杂的中间状态,比整表替换更容易出错。
 */
export function formatCalibrationTs(params: ParamMap): string {
  const idWidth = Math.max(...ROSTER.map((c) => c.id.length)) + 1;
  const lines = ROSTER.map(({ id, name }) => {
    const { scale, x, y } = params[id].cal;
    const key = `${id}:`.padEnd(idWidth + 1);
    const body = [
      `scale: ${num(scale)},`.padEnd(14),
      `x: ${num(x, 4)},`.padEnd(11),
      `y: ${num(y, 4)}`
    ].join(" ");
    return `  ${key} { ${body} },   // ${name}`;
  });
  return [
    "export const CHARACTER_CALIBRATION: Record<string, SpriteCalibration> = {",
    ...lines,
    "};"
  ].join("\n");
}

/**
 * 导出②:rp.css 末尾那张逐角色表。
 *
 * 保持与原文件一致的单行紧凑格式和 selector 对齐 —— 十行并排时,
 * 对齐能让人一眼扫出哪个值和别人不一样,这是那张表可读性的全部来源。
 */
export function formatStageCss(params: ParamMap): string {
  const selectors = ROSTER.map(({ id }) => `.abyssa-rp__actor[data-character="${id}"]`);
  const width = Math.max(...selectors.map((s) => s.length));
  return ROSTER.map(({ id }, i) => {
    const { h, x, y } = params[id].stage;
    const decl = `--abyssa-rp-doll-h: ${num(h)}%; --abyssa-rp-doll-x: ${num(x)}%; --abyssa-rp-doll-y: ${num(y)}%;`;
    return `${selectors[i].padEnd(width)} { ${decl} }`;
  }).join("\n");
}

/**
 * 导出③:emotes.ts 里的两张漫符表。
 *
 * 两张一起输出,因为它们在同一个源文件里,而且**必须一起替换**:
 * 偏移是相对基准的增量,只回填其中一张会让另一张的参照失效
 * (改了基准而不更新偏移 → 十个角色一起偏;反之则偏移落在旧基准上)。
 */
export function formatEmotesTs(state: EmoteState): string {
  const idWidth = Math.max(...EMOTES.map((e) => e.id.length)) + 2;
  const baseLines = EMOTES.map(({ id, label }) => {
    const { x, y, size } = state.base[id];
    const key = `${id}:`.padEnd(idWidth);
    const body = [`x: ${num(x)},`.padEnd(11), `y: ${num(y)},`.padEnd(11), `size: ${num(size)}`].join(" ");
    return `  ${key} { ${body} },   // ${label}`;
  });

  // 偏移表只写有值的角色。全空时输出 `= {};`,与初始状态一致 ——
  // 输出十个空对象会让人以为「调过但都是零」。
  const charIds = ROSTER.map((c) => c.id).filter((id) => state.adjust[id] && Object.keys(state.adjust[id]).length);
  const adjustBody = charIds.length
    ? charIds.map((id) => {
        const table = state.adjust[id];
        const rows = EMOTES.filter((e) => table[e.id]).map((e) => {
          const a = table[e.id];
          const parts = [
            a.x !== undefined ? `x: ${num(a.x)}` : null,
            a.y !== undefined ? `y: ${num(a.y)}` : null,
            a.size !== undefined ? `size: ${num(a.size)}` : null
          ].filter(Boolean);
          return `    ${`${e.id}:`.padEnd(idWidth)} { ${parts.join(", ")} }`;
        });
        return `  ${id}: {\n${rows.join(",\n")}\n  }`;
      })
    : [];

  return [
    "export const EMOTE_PLACEMENT: Record<string, EmotePlacement> = {",
    ...baseLines,
    "};",
    "",
    adjustBody.length
      ? `export const EMOTE_ADJUST: EmoteAdjustTable = {\n${adjustBody.join(",\n")}\n};`
      : "export const EMOTE_ADJUST: EmoteAdjustTable = {};"
  ].join("\n");
}

/**
 * 导出④:会话快照,给 import 用。带 version 便于日后改结构时识别。
 *
 * emotes 是后加的字段。**没有**跟着把 STORAGE_KEY 提到 v2 ——
 * 那会让已有的立绘校准缓存整份失效,而它们是调了很久的值。
 * parseSnapshot 逐字段回落,读到旧快照时 emotes 自然取默认,不会炸。
 */
export function formatJson(params: ParamMap, emotes?: EmoteState): string {
  const characters: Record<string, unknown> = {};
  for (const { id } of ROSTER) {
    const p = params[id];
    characters[id] = {
      cal: { scale: Number(num(p.cal.scale)), x: Number(num(p.cal.x, 4)), y: Number(num(p.cal.y, 4)) },
      stage: { h: Number(num(p.stage.h)), x: Number(num(p.stage.x)), y: Number(num(p.stage.y)) }
    };
  }
  const payload: Record<string, unknown> = { version: 1, characters };
  if (emotes) {
    const base: Record<string, unknown> = {};
    for (const { id } of EMOTES) {
      const b = emotes.base[id];
      base[id] = { x: Number(num(b.x)), y: Number(num(b.y)), size: Number(num(b.size)) };
    }
    payload.emotes = { base, adjust: emotes.adjust };
  }
  return JSON.stringify(payload, null, 2);
}

/** 解析快照里的漫符块。与 parseSnapshot 同样逐字段校验,理由见那里。 */
export function parseEmotes(text: string, defaults: EmoteState): EmoteState {
  const raw = JSON.parse(text) as { emotes?: { base?: Record<string, unknown>; adjust?: unknown } };
  const srcBase = (raw?.emotes?.base ?? {}) as Record<string, Record<string, unknown>>;
  const pick = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  const base: Record<string, EmotePlacement> = {};
  for (const { id } of EMOTES) {
    const e = srcBase[id] ?? {};
    base[id] = {
      x: pick(e.x, defaults.base[id].x),
      y: pick(e.y, defaults.base[id].y),
      size: pick(e.size, defaults.base[id].size)
    };
  }

  // 偏移表是稀疏的,逐层过滤未知 id 与非数值 —— 不能整块信任。
  const adjust: EmoteAdjustTable = {};
  const srcAdjust = (raw?.emotes?.adjust ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const { id: charId } of ROSTER) {
    const table = srcAdjust[charId];
    if (!table) continue;
    const out: Record<string, Partial<EmotePlacement>> = {};
    for (const { id: emoteId } of EMOTES) {
      const a = table[emoteId];
      if (!a) continue;
      const entry: Partial<EmotePlacement> = {};
      for (const k of ["x", "y", "size"] as const) {
        if (typeof a[k] === "number" && Number.isFinite(a[k])) entry[k] = a[k] as number;
      }
      if (Object.keys(entry).length) out[emoteId] = entry;
    }
    if (Object.keys(out).length) adjust[charId] = out;
  }

  return { base, adjust };
}

/**
 * 解析导入的快照。
 *
 * 逐字段校验并回落到默认值,不整体信任外部输入 —— 一个 NaN 混进 scale
 * 会让整个立绘消失,而且报错点离原因很远,极难排查。
 */
export function parseSnapshot(text: string, defaults: ParamMap): ParamMap {
  const raw = JSON.parse(text) as { characters?: Record<string, unknown> };
  const src = raw?.characters ?? {};
  const out = buildDefaults();
  for (const { id } of ROSTER) {
    const entry = src[id] as { cal?: Partial<StageParams>; stage?: Partial<StageParams> } | undefined;
    const cal = (entry?.cal ?? {}) as Record<string, unknown>;
    const stage = (entry?.stage ?? {}) as Record<string, unknown>;
    const pick = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
    out[id] = {
      cal: {
        scale: pick(cal.scale, defaults[id].cal.scale),
        x: pick(cal.x, defaults[id].cal.x),
        y: pick(cal.y, defaults[id].cal.y)
      },
      stage: {
        h: pick(stage.h, defaults[id].stage.h),
        x: pick(stage.x, defaults[id].stage.x),
        y: pick(stage.y, defaults[id].stage.y)
      }
    };
  }
  return out;
}

/** localStorage 键。带版本号,结构变化时旧数据自然失效而不是解析出半个对象。 */
export const STORAGE_KEY = "abyssa-studio-params-v1";
