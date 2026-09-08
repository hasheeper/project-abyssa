/**
 * 立绘动作动画 —— 关键帧生成器。
 *
 * ============ 为什么必须分成两层 ============
 * 现有 DOM 上每一层的变换槽都已被占用:
 *   .abyssa-rp__actor       transform = WAAPI 进退场   translate = 说话者上浮
 *   .abyssa-rp__actor-body  translate = doll-x/y       opacity   = 明暗
 *   .__calibration          transform = 逐角色画布校准
 *
 * 而新动画本身还分两类,它们也不能共用一层:
 *   一次性(点头、抖动、跳跃)—— 播完即弃
 *   持续态(呼吸、摇摆、颤抖)—— 无限循环
 * 若持续态是挂在同一属性上的 infinite 动画,一次性动作触发时会被它整条压住。
 * rp.css 里已经记录过三次同类事故(头像弹入 / 菱形节点 / 右席位翻转)。
 *
 * 所以:.actor-idle 承载持续态(CSS infinite),.actor-beat 承载一次性(WAAPI)。
 * 两层各拥有一个 transform,零争抢,且乘性叠加 —— 边呼吸边点头同时成立。
 *
 * ============ 幅度一律用 px,不用百分比 ============
 * 容器是 704:1472 的竖长方形。1440×900 视口下约 395×825,于是
 *   translateY 1% = 8.25px   而   translateX 1% = 3.95px
 * 同一个百分数在两轴上差 2 倍多。双轴动作(剧烈抖动)若两轴都写 1%,
 * 实际得到的是一个斜椭圆而不是预期的圆。用 px 就没有这个坑。
 *
 * ============ 只用 transform,绝不用 filter ============
 * rp.css:129 有实测数据:立绘是 4 层 704×1472 PNG(base 单张 1.4MB),
 * 换人瞬间台上最多 5 人 = 20 张大图。filter 掉帧 37%,opacity 17%。
 */

/** 一次性动作。 */
export type MotionId = "nod" | "waver" | "jump" | "shakeLight" | "shakeHeavy";

/** 持续状态。互斥 —— 它们共用 .actor-idle 这一个 transform。 */
export type IdleId = "none" | "breathe" | "sway" | "tremble";

export interface MotionSpec {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

const NEUTRAL = "translate(0px, 0px) rotate(0deg) scaleY(1)";

function frame(x = 0, y = 0, rot = 0, sy = 1): string {
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scaleY(${sy.toFixed(4)})`;
}

/**
 * 衰减振荡 —— 抖动与摇头共用的发生器。
 *
 * 幅度**必须**逐次递减(1 → 0)。等幅振荡读起来是机械的,
 * 这是抖动最容易做错的一处:真实的抖动是能量耗散过程。
 *
 * 首尾各补一帧中立位:不补的话第 0 帧就跳到满幅,那是一次瞬移。
 */
function oscillate(opts: {
  x: number;
  y?: number;
  rot?: number;
  /** 振荡帧数(不含首尾的中立帧)。越多越细碎。 */
  swings: number;
}): Keyframe[] {
  const { x, y = 0, rot = 0, swings } = opts;
  const frames: Keyframe[] = [{ offset: 0, transform: NEUTRAL }];
  for (let i = 0; i < swings; i += 1) {
    const envelope = 1 - i / swings;
    const sign = i % 2 === 0 ? 1 : -1;
    const k = envelope * sign;
    frames.push({ offset: (i + 1) / (swings + 1), transform: frame(x * k, y * k, rot * k) });
  }
  frames.push({ offset: 1, transform: NEUTRAL });
  return frames;
}

/**
 * 点头 —— 稳稳下沉，短暂停住，再稍快抬起。
 * 基准 30px / 820ms：410ms 下沉、82ms 停顿、246ms 抬起、82ms 收稳。
 * 下沉两端都缓速，不再加速撞底；回程只越过原位 8%，不弹成跳跃。
 * 使用纯位移，避免压缩身高把下沉读成弯折。
 *
 * 用位移而非旋转:扁平 PNG 立绘做旋转点头会让脚跟着甩,
 * 读起来是「歪头」不是「点头」。位移式还有个好处 —— 底部原点就够,
 * 不需要逐角色标注颈部位置。
 */
export function nod(amp = 30): MotionSpec {
  return {
    keyframes: [
      { offset: 0, transform: NEUTRAL, easing: "cubic-bezier(0.32, 0, 0.48, 1)" },
      { offset: 0.5, transform: frame(0, amp), easing: "linear" },
      { offset: 0.6, transform: frame(0, amp), easing: "cubic-bezier(0.22, 0, 0.26, 1)" },
      { offset: 0.9, transform: frame(0, -amp * 0.08), easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
      { offset: 1, transform: NEUTRAL }
    ],
    options: { duration: 820, fill: "none" }
  };
}

/**
 * 左右摇晃 —— 整个身体的横向衰减往复。
 *
 * ============ 这个动作曾经叫「摇头」,那是命名错误 ============
 * 扁平 PNG 立绘只有一个整体图层,头部无法独立于身体运动。所谓「摇头」
 * 在这里实际渲染出来的是**整个人左右平移**,读者看到的是身体在晃,
 * 不是头在转 —— 语义完全不同,不能当作点头的对偶来用。
 *
 * 真正的摇头需要头部单独成层(或骨骼绑定),本项目的素材结构做不到。
 * 与其挂一个名不副实的标签,不如按它实际的样子命名。
 *
 * 现在它的语义是:犹豫、不安、身体的左右摆荡。
 * 与颤抖(持续态、高频小幅)和轻抖(一次性、高频小幅)的区别在**频率**:
 * 这个慢而大,那两个快而小。
 */
export function waver(amp = 8): MotionSpec {
  return {
    keyframes: oscillate({ x: amp, swings: 5 }),
    options: { duration: 640, easing: "ease-in-out", fill: "none" }
  };
}

/**
 * 跳跃 —— 采用 C 方案:保留完整行程,接受头顶溢出。
 *
 * 权衡说明:头顶净空按角色差异很大(实测 base.png 的 alpha 边界 +
 * 逐角色校准值算得,alvitr 说话时已经溢出 35.6px、vivienne 溢出 4.9px)。
 * 既然静态裁切本来就被接受,动态多裁一截也接受。
 *
 * ============ 幅度与形变是两个独立的旋钮 ============
 * 「弹感」不来自跳多高,而来自 **scaleY 的形变量**(squash & stretch)。
 * 之前 0.975 / 1.015 的形变在 825px 立绘上是 ±20px 的身高伸缩,
 * 读起来像橡皮球 —— 这是卡通语汇,与这套写实立绘不搭。
 *
 * 基准行程72px、时长680ms：在1600画布缩至1280时仍有约58px腾空。
 * 沿用原起跳／回落曲线与小幅形变；增加位移，不靠拉伸立绘冒充跳跃。
 * 时长随行程略增，让最高点可读，不把增大的行程压成突然弹射。
 *
 * 下蹲预备(anticipation)一定要保留 —— 它是「起跳」这个动作能被读懂的
 * 关键,删掉之后人会像凭空浮起来。但它只需要读得出来,不需要很深。
 *
 * 向下是完全安全的:立绘下缘本就沉出席位 9%(约 69px)。
 */
export function jump(amp = 72): MotionSpec {
  return {
    keyframes: [
      { offset: 0, transform: NEUTRAL, easing: "cubic-bezier(0.4, 0, 0.7, 1)" },
      // 下蹲预备
      { offset: 0.268, transform: frame(0, amp * 0.3, 0, 0.994), easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
      // 腾空最高点
      { offset: 0.554, transform: frame(0, -amp, 0, 1.006), easing: "cubic-bezier(0.6, 0, 0.9, 0.7)" },
      // 落地压缩，只留「触地」的一下
      { offset: 0.75, transform: frame(0, amp * 0.16, 0, 0.99), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      { offset: 1, transform: NEUTRAL }
    ],
    options: { duration: 680, fill: "none" }
  };
}

/**
 * 轻微抖动 —— 紧张、窘迫、瑟缩。
 *
 * 仅 X 轴,**不加旋转**:825px 高的立绘上,小幅旋转读作「晃」而不是「抖」
 * (1.2° 就能让顶部横移 17px)。高频小幅才是「抖」。
 */
export function shakeLight(amp = 12): MotionSpec {
  return {
    keyframes: oscillate({ x: amp, swings: 8 }),
    options: { duration: 440, easing: "linear", fill: "none" }
  };
}

/**
 * 剧烈抖动 —— 惊骇、受击、暴怒。**纯水平**,不带倾斜。
 *
 * ============ 曾经加过 Y 与 rotate,那是错的 ============
 * 当时的想法是「纯 X 太干净、不像失控」,于是加了 Y 位移和 1.2° 旋转。
 * 但 1.2° 配底部原点会让头部横移 17px,而脚几乎不动 —— 整个人是**斜着
 * 扭动**的,读起来像立绘被拧了一下,不像受到冲击。
 * Y 位移同样有问题:上下晃在扁平立绘上会被读成「跳」,与跳跃动作撞车。
 *
 * 冲击力应该由**幅度和频率**给,不是由额外的轴给。所以现在:
 *   只保留 X,基准幅度28px,摆次14
 * 更宽、更密的纯水平往复,与轻抖是同一种运动的强化版,语义连贯。
 *
 * 与轻抖(±12px / 8 次 / 440ms)保持同轴同性质，幅度与摆次数拉开量级。
 */
export function shakeHeavy(amp = 28): MotionSpec {
  return {
    keyframes: oscillate({ x: amp, swings: 14 }),
    options: { duration: 640, easing: "linear", fill: "none" }
  };
}

const BUILDERS: Record<MotionId, () => MotionSpec> = {
  nod: () => nod(),
  waver: () => waver(),
  jump: () => jump(),
  shakeLight: () => shakeLight(),
  shakeHeavy: () => shakeHeavy()
};

export const MOTION_LABELS: Record<MotionId, string> = {
  nod: "点头",
  waver: "摇晃",
  jump: "跳跃",
  shakeLight: "轻抖",
  shakeHeavy: "剧震"
};

export const IDLE_LABELS: Record<IdleId, string> = {
  none: "无",
  breathe: "呼吸",
  sway: "摇摆",
  tremble: "颤抖"
};

/**
 * 在 .actor-beat 层上播一次动作。
 *
 * fill: "none" 是关键 —— 播完属性交还声明值,元素回到中立位。
 * 这正是流光那个 bug 的反面教训(rp.css:753):fill 用 backwards 而
 * 结束帧又没显式归零,动画播完后元素会永久停在某个偏移上。
 *
 * 重入处理:先 cancel 已有动画再播新的。不 cancel 的话两个动画会叠加,
 * 后者的 from 是「当前计算值」而非中立位,连点会越飘越远。
 *
 * reduced-motion 下整个不播 —— 这些是纯粹的运动,零信息量。
 * 判据沿用 rp.css 全文一致的那条:状态标识保留,纯运动砍掉。
 */
export function playMotion(el: HTMLElement | null, id: MotionId): Animation | null {
  if (!el) return null;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }
  for (const running of el.getAnimations()) running.cancel();
  const { keyframes, options } = BUILDERS[id]();
  return el.animate(keyframes, options);
}
