import type { RpCrop } from "../../shared/ui/patterns/rp-scene/types";

/**
 * 设置项的事实来源。
 *
 * ============ 每一项都必须有下游 ============
 * 本文件只收录「已经存在可接的旋钮」。判据是能指出确切的下游:某个 CSS
 * 自定义属性、某个组件 prop、或某个 App 里的常量。
 *
 * 这条规则是这个原型的立项前提。设置页最容易长出的东西是从别的游戏抄来的
 * 条目 —— 分辨率、垂直同步、手柄震动。本项目是 web、跑在固定画布上
 * (见 shared/stage),"分辨率"这个概念根本不存在;没有任何音频代码,
 * "音量"也没有下游。这类条目一旦写进来,就是一个永远不会被接上的假开关,
 * 而假开关比缺失更糟:它让人以为调了有用。
 *
 * 所以每个字段下面都注明它接到哪。接不上的一律不写 —— AI 服务那一栏
 * 因此整个是禁用占位,而不是一组猜出来的表单字段。
 */

/** 呈现版式。术语用视觉小说的标准叫法,与 rp 的 App.tsx 一致。 */
export type LayoutPreference = "nvl" | "adv";

export interface SettingsState {
  /* ==================== 演出 ====================
     全部对应 rp.html 的实际旋钮。 */

  /** 默认版式。下游:rp App.tsx 的 useState<"nvl"|"adv"> 初始值。 */
  layout: LayoutPreference;

  /**
   * 打字机步进(ms/字):波前进的速度,决定「打得多快」。
   * 下游:--abyssa-rp-type-step(rp-typing.css,默认 13ms)。
   *
   * 必须与 typeDur 分成两个独立设置项 —— 见 rp-typing.css 的长注释:
   * step 与 dur 是两个正交旋钮,dur/step = 同时处于渐变中的字数(波宽)。
   * 合并成单一的「文本速度」会让两者被迫同向变化,而「更快且更柔和」
   * 恰恰需要它们**反向**调(step 减小 + dur 加大)。合并就调不出来了。
   */
  typeStep: number;

  /**
   * 单字淡入时长(ms):决定「渐变有多软」。
   * 下游:--abyssa-rp-type-dur(rp-typing.css,默认 340ms)。
   */
  typeDur: number;

  /** 自动播放每条停留(ms)。下游:rp App.tsx 的 AUTO_MS(默认 2200)。 */
  autoMs: number;

  /** 版式过场时长(ms)。下游:rp App.tsx 的 MORPH_MS(默认 560)。 */
  morphMs: number;

  /** 立绘取景距离。下游:RpSceneProps.crop,类型直接复用不另造。 */
  crop: RpCrop;

  /* ==================== 显示 ====================
     只做两件事:减弱动画、关掉渲染开销大的样式。 */

  /**
   * 减弱动态效果。
   * 下游:tokens.css 已有 @media (prefers-reduced-motion: reduce) 的整套
   * 实现(把 transition/animation 压到 0.01ms)。这个开关把同一套规则
   * 挂到 [data-reduced-motion="true"] 上,于是它是一个真实生效的功能,
   * 而不是等待接线的占位 —— 系统偏好之外再给一个手动入口。
   */
  reducedMotion: boolean;

  /** 气泡特效。下游:rp-bubble-effects.css(541 行,渲染开销大头)。 */
  bubbleEffects: boolean;

  /** 漫符 / 动态表情。下游:emote.css + rp-motion.css。 */
  emotes: boolean;

  /** 立绘入退场动画。下游:useRpSeatLifecycle 的进退场过渡。 */
  seatTransitions: boolean;

  /** 背景底纹。下游:各 app 的 --abyssa-*-backdrop 网格底纹。 */
  backdropTexture: boolean;
}

/**
 * 默认值。
 *
 * 演出四项的数值**必须**与下游当前的实际值一致,否则设置页一挂载就等于
 * 静默改了一遍演出参数,而使用者以为自己什么都没动。
 * 校对来源:rp-typing.css 的 13ms / 340ms、rp App.tsx 的 2200 / 560。
 */
export const DEFAULT_SETTINGS: SettingsState = {
  layout: "nvl",
  typeStep: 13,
  typeDur: 340,
  autoMs: 2200,
  morphMs: 560,
  crop: "knee",
  reducedMotion: false,
  bubbleEffects: true,
  emotes: true,
  seatTransitions: true,
  backdropTexture: true
};

/** 单项赋值 + 整体恢复默认。设置页没有跨字段联动,不需要更复杂的 action。 */
export type SettingsAction =
  | { type: "set"; patch: Partial<SettingsState> }
  | { type: "reset" };

export function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "reset":
      return DEFAULT_SETTINGS;
  }
}

/** 是否已偏离默认值。用于「恢复默认」的禁用态 —— 无改动时该钮无意义。 */
export function isPristine(state: SettingsState): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof SettingsState)[]).every(
    (key) => state[key] === DEFAULT_SETTINGS[key]
  );
}

/**
 * 把设置投影成 CSS 自定义属性,挂到画布根上。
 *
 * 这样演出预览与真实 rp 界面读的是同一批变量名,预览里看到的就是接上
 * rp.html 之后的效果,不是另画一套近似物。
 */
export function toCssVariables(state: SettingsState): Record<string, string> {
  return {
    "--abyssa-rp-type-step": `${state.typeStep}ms`,
    "--abyssa-rp-type-dur": `${state.typeDur}ms`,
    "--rp-morph-ms": `${state.morphMs}ms`
  };
}

/** 立绘取景的选项表。label 取自 RpSceneProps.crop 的原注释,不另行发明措辞。 */
export const CROP_OPTIONS: { value: RpCrop; label: string; hint: string }[] = [
  { value: "knee", label: "中距离", hint: "切在膝下,人物占框更满" },
  { value: "upper", label: "近距离", hint: "切在大腿中部,更贴脸" },
  { value: "full", label: "全身", hint: "完整画布,人物会显得较小" }
];

export const LAYOUT_OPTIONS: {
  value: LayoutPreference;
  label: string;
  hint: string;
}[] = [
  { value: "nvl", label: "NVL 分屏", hint: "整屏文本流,左右立绘分栏" },
  { value: "adv", label: "ADV 对话", hint: "立绘满幅,底部对话框逐句推进" }
];
