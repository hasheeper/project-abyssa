import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { Nameplate } from "./Nameplate";
import { PaperDoll } from "./PaperDoll";
import type { ExpressionId } from "./expressions";

/**
 * 跑团 / AI RP 分屏场景。
 *
 * 与 VisualNovelScene 的区别是状态模型:后者游标驱动(只存在当前行),
 * 这里是追加驱动——消息只增不减,可回看。
 *
 * 舞台固定左右两栏,角色轮换上台:新发言者优先进空栏,两栏都满则顶掉
 * 更久未发言的一侧。气泡侧别 = 说话者当时所站的栏位,历史消息保留
 * 其发生时的站位,回看时不会错位。
 *
 * 动画分层(这是本组件最容易踩坑的地方):
 *   .abyssa-rp__actor       定位层 —— 进退场由 WAAPI 驱动 transform,
 *                           说话者上浮由 CSS 过渡驱动 translate。两者是独立属性,可同时生效。
 *   .abyssa-rp__actor-body  表现层 —— 只管明暗(opacity)。
 * 属性作用域完全不重叠,不会互相覆盖或提前中断。
 */

export type RpSeat = "left" | "right";

const ENTER_MS = 680;
const LEAVE_MS = 420;

/**
 * 头像框几何 —— 与组件库 RpgShapeButton 的 square 形完全一致。
 * 直接复用它的路径数据而不是引组件本身:那是个 <button>,
 * 带 hover/active/focus 与点击语义,塞进只读的消息流里语义不对。
 */
const AVATAR_PATH = "M22 8 H137 V122 L122 137 H8 V22 Z";
const AVATAR_INNER_PATH = "M24 16 H129 V118 L118 129 H16 V24 Z";
/** 左上、右下两处角括号,与 square 形同款(非对称,呼应切角方向)。 */
const AVATAR_BRACKETS = "M20 34 V20 H34 M111 129 H125 V115";

/**
 * 气泡指示器的矛尖(viewBox 50×50,朝左;右席位由 CSS 的 scaleX(-1) 镜像)。
 *
 * 前身是组件库 RpgDiamondNode 的正菱形 `M25 3 L47 25 L25 47 L3 25 Z`,
 * 换掉它是因为**菱形有 4 重旋转对称,轮廓本身不指向任何方向**。
 * 方向全押在内部那支雪佛龙上,而它 strokeWidth 只有 2.4——
 * 在 22px 的盒子里(viewBox 50 → 缩放 0.44)实际只有 1.06px,
 * 比包着它的 7px 外描边(3.08px)还细三倍,根本没机会被看见。
 *
 * 所以改成让**轮廓自己不对称**:左顶点拉长成矛尖,右侧收成钝背。
 *   尖 (2,25) → 肩 (29,9)/(29,41) → 背 (45,25)
 * 前段锥长 27、后段仅 16,约 2:1,一眼读得出朝向。
 * 尖端夹角 61°,配 miter 连接仍是锐角,不会在尖上鼓成一坨。
 *
 * 横向占位与原菱形基本持平(视觉尖端外探 12.7px vs 原 11.9px),
 * 所以 left/right 的 -box/2 偏移不用改,也不会在窄屏碰到面板边框。
 */
const SPEAR_PATH = "M2 25 L29 9 L45 25 L29 41 Z";

/**
 * 矛尖的两条前缘。与 SPEAR_PATH 的前半段完全重合,
 * 用更亮的颜色再描一道:前缘亮、后缘暗,方向感再加一层。
 * 单独一条 path 而不是给整个轮廓换色——后缘保持暗,对比才立得住。
 */
const SPEAR_EDGE = "M29 9 L2 25 L29 41";

/**
 * 矛身内部的小菱形。当前态填强调色并做呼吸,历史态填黑静止。
 *
 * 位置定在 (27,25) 而不是 viewBox 正心 (25,25):矛尖最宽处在肩线 x=29,
 * 往那儿靠才落在矛身的「肚子」里,四周留白才均匀。半径 6 是按余量定的——
 * 上顶点 (27,19) 到该处矛身上缘 y=10.19 有 8.8 的间隙,
 * 减去内层 1.2 描边的一半仍余 8.2,不会与轮廓黏在一起。
 *
 * 用回菱形是刻意的:矛尖的外形已经承担了「方向」,这里只需要表达「活着」,
 * 而菱形是这套 UI 里表示节点/状态的既有语汇(组件库 RpgDiamondNode、
 * DiamondWatermark 都是它),不必再引入一个新形状。
 */
const SPEAR_CORE = "M27 19 L33 25 L27 31 L21 25 Z";

/**
 * 打字机文本 —— 把每个字包一层 span,各自持有独立的淡入窗口,按序错峰。
 *
 * 为什么必须逐字拆,不能用遮罩:
 * 之前那版用一条倾斜的 linear-gradient 遮罩自上而下扫过(倾角还按
 * atan(行高/内容宽) 精确算过)。角度是对的,机制是错的——遮罩本质是
 * 一条贯穿全宽的直边在整块文字上平移,任一个字的明暗只由「它落在这条边
 * 的哪一侧」决定,它没有自己的时间轴。于是软边窄就是硬切、软边宽就是
 * 柔和的切,出不了这两者。逐字才能让每个字有自己的相位。
 *
 * 布局安全:排版在挂载时一次成型,此后每帧只有 opacity 在变,
 * 没有任何一帧发生折行。这与「逐字 append DOM」有本质区别——
 * 后者每加一个字都在改内容宽度、每帧重新折行,是 rp.css 通篇禁止的做法。
 *
 * 空白字符不包 span:
 * 空格本身不可见,包了只是白占一个 --i 索引,让后面所有字整体延后一拍。
 * 换行符更要紧——inline 元素里的 \n 依赖 white-space: pre-wrap 生效,
 * 包进 span 虽然仍能换行,但会多出一个不可见的动画层,没有任何收益。
 * 它们直接作为裸文本节点输出,与 span 混排不影响排版。
 */
const TYPED_SKIP = /\s/;

/**
 * 参与打字的字符数(不含空白)。
 *
 * 流光要等打字打完才起步,而「打完」= lead + (n-1)×step + dur。
 * 这里面只有 n 是 CSS 数不出来的,所以在 JS 里算好、以变量传给气泡,
 * 让 CSS 自己推出那个时刻(见 rp.css 的 --abyssa-rp-sweep-wait)。
 * 这样时序仍然只有一份定义在 CSS 里,JS 不参与编排、不需要定时器。
 *
 * 跳过空白的判断必须与 TypedText 用**同一个** TYPED_SKIP:
 * 两边数出的 n 不一致,流光就会早于或晚于最后一个字。
 */
function countTypedChars(text: string) {
  let count = 0;
  // for...of 按码点迭代,与 TypedText 的 Array.from 切分方式一致。
  for (const char of text) if (!TYPED_SKIP.test(char)) count += 1;
  return count;
}

function TypedText({ text }: { text: string }) {
  // 逐字符切分用 Array.from 而不是 split(""):后者按 UTF-16 码元切,
  // 会把 emoji、部分生僻汉字这类代理对拆成两个半字符,渲染出乱码。
  // Array.from 按码点切分,代理对保持完整。
  const chars = Array.from(text);
  let index = 0;

  return (
    <>
      {chars.map((char, position) => {
        if (TYPED_SKIP.test(char)) return char;
        const i = index;
        index += 1;
        return (
          // key 用位置而非字符:同一段文本里重复字很常见,字符做 key 会撞。
          // 文本变化时整条消息会重建,这里不存在「同 key 不同内容」的复用问题。
          <span
            key={position}
            className="abyssa-rp__type-char"
            style={{ "--i": i } as CSSProperties}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

/**
 * 头像框art。三层描边靠「同一路径反复描边、宽度递减」叠出来:
 * 外 9px 深色打底 → 中 5px 亮色 → 内 2px 极深收边,
 * 每层都压在前一层中线上,于是形成深-亮-深的三道带子。
 */
function AvatarFrameArt({ state }: { state: "idle" | "active" }) {
  return (
    <svg className="abyssa-rp__avatar-art" data-state={state} viewBox="0 0 145 145" aria-hidden="true">
      <path d={AVATAR_PATH} fill="var(--abyssa-rp-avatar-fill)" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="9" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-rp-avatar-middle)" strokeWidth="5" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" />
      <path
        d={AVATAR_INNER_PATH}
        fill="none"
        stroke="var(--abyssa-rp-avatar-ornament)"
        strokeWidth="1.15"
        opacity="0.9"
      />
      <path d={AVATAR_BRACKETS} fill="none" stroke="var(--abyssa-rp-avatar-ornament)" strokeWidth="1" opacity="0.75" />
      <g fill="var(--abyssa-rp-avatar-ornament)">
        <circle cx="65" cy="132" r="1.1" />
        <circle cx="72.5" cy="132.5" r="1.55" />
        <circle cx="80" cy="132" r="1.1" />
      </g>
    </svg>
  );
}

/** 进场滑入距离(占席位框宽百分比)。与 novel.css 的 AVG 基线一致。 */
const ENTER_FROM = 30;

export interface RpActor {
  id: string;
  /** 短名,用于气泡上的说话者标签。 */
  name: string;
  /** 席位名牌的主名,通常是全名。不传则退回 name。 */
  fullName?: string;
  /** 席位名牌的副名(英文)。 */
  secondaryName?: string;
  /** 气泡头像 url。不传则退化为短名首字。 */
  avatar?: string;
  /** 气泡标签与尾巴的强调色。席位名牌不用,那里走组件库配色。 */
  accent?: string;
  /** 未指定表情时的默认值。 */
  expression?: ExpressionId;
}

export type RpMessage =
  | { id: string; kind: "say"; actorId: string; text: string; expression?: ExpressionId }
  | { id: string; kind: "narration"; text: string }
  | { id: string; kind: "chapter"; text: string }
  | { id: string; kind: "system"; text: string }
  | {
      id: string;
      kind: "roll";
      label: string;
      formula: string;
      detail: string;
      total: number;
      outcome: "success" | "fail";
    };

export interface RpSceneProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  actors: RpActor[];
  messages: RpMessage[];
  /** 背景图 url。 */
  background?: string;
  /**
   * 立绘取景距离,默认 knee(中距离,切在膝下)。
   *   knee   中距离 —— 默认。去掉脚与小腿,人物占框更满
   *   upper  近距离 —— 切在大腿中部,更贴脸
   *   full   全身   —— 完整画布,人物会显得很小
   * 切口靠框底的预留(--abyssa-rp-doll-bleed)藏在框外。
   */
  crop?: "full" | "upper" | "knee";
  /** 日志顶部插槽(章节标题、连接状态等)。 */
  header?: ReactNode;
}

/**
 * 重放消息推导两栏站位。
 * 返回当前台上的角色,以及每条对白发生时说话者所站的栏位。
 */
function useStage(messages: RpMessage[]) {
  return useMemo(() => {
    const slots: Record<RpSeat, string | null> = { left: null, right: null };
    const lastSpoke: Record<RpSeat, number> = { left: -1, right: -1 };
    const sideByMessage = new Map<string, RpSeat>();
    let tick = 0;

    for (const message of messages) {
      if (message.kind !== "say") continue;
      let side: RpSeat;
      if (slots.left === message.actorId) side = "left";
      else if (slots.right === message.actorId) side = "right";
      else if (slots.left === null) side = "left";
      else if (slots.right === null) side = "right";
      else side = lastSpoke.left <= lastSpoke.right ? "left" : "right";

      slots[side] = message.actorId;
      lastSpoke[side] = tick++;
      sideByMessage.set(message.id, side);
    }

    return { slots, sideByMessage };
  }, [messages]);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface SeatActorProps {
  actor: RpActor;
  seat: RpSeat;
  phase: "enter" | "leave";
  active: boolean;
  expression: ExpressionId;
  crop: "full" | "upper" | "knee";
  onExited?: () => void;
}

/**
 * 一个在台上的立绘。进退场动画走 WAAPI:
 * 关键帧只碰 transform / opacity,且只作用于本元素,不与内层的 CSS 过渡争抢属性。
 */
function SeatActor({ actor, seat, phase, active, expression, crop, onExited }: SeatActorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // 位移方向:左栏从左侧画外进来,右栏从右侧进来。
    const dir = seat === "left" ? -1 : 1;
    const reduce = prefersReducedMotion();

    // 不在 cleanup 里 cancel():StrictMode 下 effect 会 mount→unmount→mount,
    // cancel 会把刚起步的动画掐掉重放,表现为闪一下再跳到位。
    // host 元素随组件卸载一同消失,动画自然终止,无需手动清理。
    // 动效减弱时退化为纯淡入淡出,而不是把时长清零——
    // 清零等于硬切,减弱的诉求是「不要大幅位移」,不是「不要过渡」。
    if (phase === "enter") {
      host.animate(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { transform: `translate3d(${dir * ENTER_FROM}%, 0, 0)`, opacity: 0 },
              {
                transform: `translate3d(${dir * ENTER_FROM * -0.06}%, 0, 0)`,
                opacity: 1,
                offset: 0.58,
                easing: "cubic-bezier(0.5, 0, 0.2, 1)"
              },
              { transform: "translate3d(0, 0, 0)", opacity: 1 }
            ],
        {
          duration: reduce ? 300 : ENTER_MS,
          easing: reduce ? "ease" : "cubic-bezier(0.16, 0.84, 0.3, 1)",
          fill: "both"
        }
      );
      return;
    }

    const animation = host.animate(
      reduce
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: "translate3d(0, 0, 0)", opacity: 1 },
            { transform: `translate3d(${dir * ENTER_FROM * 0.8}%, 0, 0)`, opacity: 0 }
          ],
      {
        duration: reduce ? 240 : LEAVE_MS,
        easing: reduce ? "ease" : "cubic-bezier(0.4, 0, 0.75, 0.5)",
        fill: "forwards"
      }
    );
    animation.finished.then(() => exitedRef.current?.()).catch(() => {});
  }, [phase, seat]);

  return (
    <div
      ref={hostRef}
      className="abyssa-rp__actor"
      data-character={actor.id}
      data-phase={phase}
      data-active={active ? "true" : "false"}
      aria-hidden={phase === "leave" || undefined}
    >
      <div className="abyssa-rp__actor-body">
        {/* 两层专职动画层。为什么必须分开、以及为什么不能挂在已有的三层上,
            见 motions.ts 顶部的说明 —— 简言之:actor 的 transform/translate
            已归进退场与上浮所有,body 的 translate 归 doll-x/y,
            calibration 的 transform 归画布校准,三层都没有空槽。
            而「持续态」(infinite)与「一次性动作」两者也不能共用一层,
            否则循环动画会把一次性动作整条压住。 */}
        <div className="abyssa-rp__actor-idle">
          <div className="abyssa-rp__actor-beat">
            <PaperDoll characterId={actor.id} expression={expression} crop={crop} alt={actor.name} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 「功能气泡」—— 旁白、判定、系统提示。它们不是某个角色在说话,
 * 而是场面本身在发生。
 *
 * chapter 刻意不在其中:它是横跨整栏的**结构分隔**,职责是始终当锚点。
 * 拉进来会让章节标题在滚动历史里忽明忽暗。它也因此天然充当「段的边界」
 * —— 跨过一个章节就不再是同一拍了(见 useLitAux)。
 */
const AUX_KINDS = new Set<RpMessage["kind"]>(["narration", "roll", "system"]);

function isAux(message: RpMessage) {
  return AUX_KINDS.has(message.kind);
}

/**
 * 哪些功能气泡该亮 —— **按与焦点的距离**,不是按年龄。
 *
 * ============ 这里曾经是错的,别改回去 ============
 * 前一版把功能气泡建模成一条**独立的时间线**,各自有自己的「最新一条」。
 * 结果是:一条十条之前的判定,只要它之后没有别的判定,就一直亮着 ——
 * 一个注解,飘在离被注解对象十条远的地方发光。
 *
 * 根子在于建模错了。功能气泡不是独立轨,而是对白轨的**注解**:
 * 旁白交代场面、判定解释结果,都在服务某句台词。既然是注解,亮暗就不该由
 * 它自己的时间顺序决定,而该由「离被注解的那句有多近」决定。
 *
 * ============ 这本质上是 focus + context ============
 * 画面同一时刻只允许**一个**视觉重心,重心周围是焦点区,其余降级为背景
 * 上下文。摄影上的同义词是景深:只有一个焦平面是实的。
 *
 * 而「连续的两条一起亮」来自格式塔的接近性 —— 相邻元素会被读成一个整体。
 * 所以亮的不是「一条消息」,而是**当前这一拍**:台词 + 紧贴它的旁白/判定,
 * 一起亮、一起退,读者感知为一个叙事单元。
 *
 * ============ 规则 ============
 *   1. 锚点 = 最后一条 say
 *   2. 取锚点**之后**紧贴的连续 aux 段 → 非空则它就是亮集
 *   3. 否则取锚点**之前**紧贴的连续 aux 段
 *   4. 其余全部压暗
 *
 * 下方优先,因为阅读自上而下、新消息从底部追加:锚点下方的 aux 是那句话
 * 尚未被后续内容取代的余波;上方的 aux 是铺垫,已经被紧随其后的台词
 * 「消费」掉了。优先未被取代的一侧。
 *
 * 因为锚点是**最后**一条 say、它之后不可能再有 say,所以「下方段非空」
 * 等价于「整个日志的末尾是 aux」。
 */
function useLitAux(messages: RpMessage[]) {
  return useMemo(() => {
    const lit = new Set<string>();

    let anchor = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].kind === "say") {
        anchor = i;
        break;
      }
    }

    const hasAnchor = anchor !== -1;

    // 下方段:锚点之后紧贴的连续 aux。
    // 无锚点时整个跳过 —— 否则会从下标 0 往下扫,取到的是**开头**那一段,
    // 而无锚点时的焦点应该在末尾(见下)。
    if (hasAnchor) {
      for (let i = anchor + 1; i < messages.length; i += 1) {
        if (!isAux(messages[i])) break;
        lit.add(messages[i].id);
      }
      if (lit.size > 0) return lit;
    }

    // 上方段:锚点之前紧贴的连续 aux。
    //
    // 起点是 anchor - 1,不是 anchor —— 后者就是那条 say,循环第一步就 break,
    // 这个分支会永远返回空集。曾经写错成 anchor 且被退化路径掩盖过:
    // 「末尾是 aux」的用例走的是下方段或下面这条无锚点路径,都绕开了它。
    //
    // 无锚点时(整段都是旁白/判定)从末尾往回扫,取尾部的连续段 ——
    // 以日志末尾为焦点,与「新消息从底部追加」一致。
    for (let i = hasAnchor ? anchor - 1 : messages.length - 1; i >= 0; i -= 1) {
      if (!isAux(messages[i])) break;
      lit.add(messages[i].id);
    }
    return lit;
  }, [messages]);
}

export const RpScene = forwardRef<HTMLDivElement, RpSceneProps>(function RpScene(
  { actors, messages, background, crop = "knee", header, className, ...props },
  ref
) {
  const logRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const actorById = useMemo(() => {
    const map = new Map<string, RpActor>();
    for (const actor of actors) map.set(actor.id, actor);
    return map;
  }, [actors]);

  const { slots, sideByMessage } = useStage(messages);

  // 被顶下台的角色要留在 DOM 里播完退场,与新角色同帧并存。
  const [departing, setDeparting] = useState<Record<RpSeat, { actorId: string; token: number } | null>>({
    left: null,
    right: null
  });
  const prevSlots = useRef<Record<RpSeat, string | null>>({ left: null, right: null });
  const tokenRef = useRef(0);

  useEffect(() => {
    const leaving: Partial<Record<RpSeat, { actorId: string; token: number }>> = {};
    for (const seat of ["left", "right"] as RpSeat[]) {
      const previous = prevSlots.current[seat];
      if (previous && previous !== slots[seat]) {
        tokenRef.current += 1;
        leaving[seat] = { actorId: previous, token: tokenRef.current };
      }
    }
    prevSlots.current = { left: slots.left, right: slots.right };
    if (Object.keys(leaving).length > 0) setDeparting((current) => ({ ...current, ...leaving }));
  }, [slots]);

  const clearDeparting = useCallback((seat: RpSeat, token: number) => {
    setDeparting((current) => (current[seat]?.token === token ? { ...current, [seat]: null } : current));
  }, []);

  // 最后一条对白 —— 它是「当前发言」,居中展开并带激活态的菱形节点。
  const currentSay = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.kind === "say") return message;
    }
    return undefined;
  }, [messages]);

  const lastSpeakerId = currentSay?.actorId;

  // 该亮的功能气泡 —— 紧贴当前发言的那一段(见 useLitAux 的说明)。
  const litAux = useLitAux(messages);

  // 每个角色沿用最近一次发言的表情,未发言者不回落到默认值。
  const expressionByActor = useMemo(() => {
    const map = new Map<string, ExpressionId>();
    for (const message of messages) {
      if (message.kind === "say" && message.expression) map.set(message.actorId, message.expression);
    }
    return map;
  }, [messages]);

  const onScroll = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    setStick(log.scrollHeight - log.scrollTop - log.clientHeight < 48);
  }, []);

  // 跟随最新消息滚动。
  //
  // 必须用 scrollTo({behavior:"smooth"}),不能直接赋值 scrollTop——
  // 后者是同步硬跳:每来一条消息,屏幕上所有内容瞬间上移一整条的高度,
  // 而且这一跳与新消息的淡入同帧发生。那个「啪」的位置突变,
  // 就是最后一处顿挫感的来源,它不在 CSS 里,所以改多少样式都无效。
  useEffect(() => {
    const log = logRef.current;
    if (!log || !stick) return;
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, stick]);

  const jumpToLatest = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    setStick(true);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, []);

  const renderSeat = (seat: RpSeat) => {
    const actorId = slots[seat];
    const actor = actorId ? actorById.get(actorId) : undefined;
    const leaving = departing[seat];
    const leavingActor = leaving ? actorById.get(leaving.actorId) : undefined;

    return (
      <div
        className="abyssa-rp__seat abyssa-frame"
        data-seat={seat}
        style={actor?.accent ? ({ "--abyssa-rp-accent": actor.accent } as CSSProperties) : undefined}
      >
        <span className="abyssa-frame__ornaments" aria-hidden="true">
          <i data-corner="tl" />
          <i data-corner="tr" />
          <i data-corner="bl" />
          <i data-corner="br" />
        </span>
        {leaving && leavingActor && (
          <SeatActor
            key={`leave-${leaving.token}`}
            actor={leavingActor}
            seat={seat}
            phase="leave"
            active={false}
            expression={expressionByActor.get(leavingActor.id) ?? leavingActor.expression ?? "a"}
            crop={crop}
            onExited={() => clearDeparting(seat, leaving.token)}
          />
        )}
        {actor && (
          // key 绑定角色 id,轮换时重挂载以重放进场动画
          <SeatActor
            key={actor.id}
            actor={actor}
            seat={seat}
            phase="enter"
            active={actor.id === lastSpeakerId}
            expression={expressionByActor.get(actor.id) ?? actor.expression ?? "a"}
            crop={crop}
          />
        )}
        {/* 名牌留在框上不随立绘滑动,换人时淡出淡入 */}
        <Nameplate
          className="abyssa-rp__seat-name"
          data-show={actor ? "true" : "false"}
          name={actor?.fullName ?? actor?.name ?? ""}
          secondaryName={actor?.secondaryName}
        />
      </div>
    );
  };

  const renderMessage = (message: RpMessage) => {
    if (message.kind === "say") {
      const actor = actorById.get(message.actorId);
      const seat = sideByMessage.get(message.id) ?? "left";
      const shortName = actor?.name ?? message.actorId;
      // 说话者此刻是否还站在本条所属的那一栏。人已下台时箭头无所指,不该画。
      const onStage = slots[seat] === message.actorId;
      return (
        <div
          key={message.id}
          className="abyssa-rp__message"
          data-kind="say"
          data-seat={seat}
          data-current={message.id === currentSay?.id || undefined}
          data-onstage={onStage || undefined}
          style={actor?.accent ? ({ "--abyssa-rp-accent": actor.accent } as CSSProperties) : undefined}
        >
          {/* message 是横跨整栏的三列轨道(左空档 / 内容 / 右空档),
              row 是中间那列。居中↔靠边、加宽↔收窄全部由轨道的 fr 插值完成——
              直接在 flex 子项上切 align-self / width 是不可过渡的,那是之前
              「几何在第 0 帧就跳完、只剩文字闪一下」的根因。 */}
          <div className="abyssa-rp__row">
            <span className="abyssa-rp__avatar" aria-hidden="true">
              {/* 外层管「激活前推」,内层 -inner 管「挂载弹入」。
                  必须分两层:transform 是单一属性,两个动作挂在同一元素上时,
                  挂载动画会在整个播放期间接管它、把激活态的 scale 压死,
                  等动画播完才补一段涨大 —— 那就是「弹一下、停、又涨一下」的由来。 */}
              <span className="abyssa-rp__avatar-inner">
                {/* 两层框叠放交叉淡入。不能只换 CSS 变量:变量驱动的是 SVG 的
                    fill / stroke 属性,而自定义属性本身不可过渡,换色会是硬切。 */}
                <AvatarFrameArt state="idle" />
                <AvatarFrameArt state="active" />
                <span className="abyssa-rp__avatar-photo">
                  {actor?.avatar ? <img src={actor.avatar} alt="" draggable={false} /> : shortName.slice(0, 1)}
                </span>
              </span>
            </span>
            <div
              className="abyssa-rp__bubble"
              // 字数交给 CSS,让横扫自己算出「打字结束」那一刻(见 rp.css
              // 的 --abyssa-rp-sweep-wait)。只传这一个数,时序仍然整份定义
              // 在 CSS 里——这里不设定时器,也不参与编排。
              style={{ "--n": countTypedChars(message.text) } as CSSProperties}
            >
              {/* 当前态的一层「聚焦装置」:竖边光条 + 四角括号 + 一道横扫高光。
                  全部绝对定位、pointer-events:none,不占布局、不影响折行——
                  当前气泡与历史气泡的**文字测量宽度完全相同**,这层只负责表现。 */}
              <span className="abyssa-rp__bubble-fx" aria-hidden="true">
                <span className="abyssa-rp__bubble-sweep" />
                <span className="abyssa-rp__bubble-edge" />
                <i data-corner="tl" />
                <i data-corner="tr" />
                <i data-corner="bl" />
                <i data-corner="br" />
              </span>
              {/* 箭头绝对定位在气泡内,不是 flex 子项——
                  作为子项时即便 opacity:0 也仍占着自身宽度与一份 gap,
                  那就是没箭头时中间空出一大块的原因。 */}
              <span className="abyssa-rp__arrow" aria-hidden="true">
                <svg viewBox="0 0 50 50">
                  {/* 三层描边照搬组件库节点的构造:同一路径反复描边、宽度递减,
                      外 7 深打底 → 中 3.5 亮 → 内 1.2 极深收边。
                      strokeLinejoin="miter" 是矛尖的关键:默认的 round 会把
                      61° 的尖端磨成圆头,那正好抹掉方向感最强的那一处。 */}
                  <path d={SPEAR_PATH} fill="var(--abyssa-rp-node-fill)" />
                  <path
                    d={SPEAR_PATH}
                    fill="none"
                    stroke="var(--abyssa-frame-dark)"
                    strokeWidth="7"
                    strokeLinejoin="miter"
                  />
                  <path
                    d={SPEAR_PATH}
                    fill="none"
                    stroke="var(--abyssa-rp-node-middle)"
                    strokeWidth="3.5"
                    strokeLinejoin="miter"
                  />
                  <path
                    d={SPEAR_PATH}
                    fill="none"
                    stroke="var(--abyssa-frame-deep)"
                    strokeWidth="1.2"
                    strokeLinejoin="miter"
                  />
                  {/* 前缘提亮。取代原先那支被三层描边吞掉的内部雪佛龙——
                      与其在轮廓里再画一个小箭头,不如让轮廓的前缘自己发亮:
                      前亮后暗的明暗差,在 22px 这个尺寸下比任何内部图元都读得出来。 */}
                  <path
                    d={SPEAR_EDGE}
                    fill="none"
                    stroke="var(--abyssa-rp-node-arrow)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="miter"
                  />
                  {/* 矛身内的小菱形。排在最后 = 画在所有描边之上,
                      否则会被 7px 外描边压掉一圈。
                      当前态填强调色并呼吸,历史态填黑静止(见 rp.css)。 */}
                  <path
                    className="abyssa-rp__arrow-core"
                    d={SPEAR_CORE}
                    fill="var(--abyssa-rp-node-core)"
                  />
                </svg>
              </span>
              <span className="abyssa-rp__bubble-name">
                <strong>{actor?.fullName ?? shortName}</strong>
                {actor?.secondaryName && <span>{actor.secondaryName}</span>}
              </span>
              <p className="abyssa-rp__bubble-text">
                <TypedText text={message.text} />
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (message.kind === "roll") {
      return (
        <div
          key={message.id}
          className="abyssa-rp__message"
          data-kind="roll"
          data-outcome={message.outcome}
          data-recent={litAux.has(message.id) || undefined}
        >
          <span className="abyssa-rp__roll-label">{message.label}</span>
          <span className="abyssa-rp__roll-formula">
            {message.formula} → {message.detail} = <b>{message.total}</b>
          </span>
          <span className="abyssa-rp__roll-tag">{message.outcome === "success" ? "成功" : "失败"}</span>
        </div>
      );
    }

    if (message.kind === "chapter") {
      return (
        <div key={message.id} className="abyssa-rp__message" data-kind="chapter">
          <span>{message.text}</span>
        </div>
      );
    }

    // 旁白与系统提示。两者都逐字打出——都是叙述性文本。
    // data-recent 标出功能气泡轨的最近一条,亮一档;其余压暗(见 rp.css)。
    return (
      <div
        key={message.id}
        className="abyssa-rp__message"
        data-kind={message.kind}
        data-recent={litAux.has(message.id) || undefined}
      >
        <TypedText text={message.text} />
      </div>
    );
  };

  return (
    <div ref={ref} className={cx("abyssa-rp", className)} {...props}>
      {background && (
        <div className="abyssa-rp__bg" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />
      )}

      {renderSeat("left")}

      <div className="abyssa-rp__center">
        {header && <div className="abyssa-rp__header">{header}</div>}
        <div ref={logRef} className="abyssa-rp__log" onScroll={onScroll} aria-live="polite">
          {messages.map(renderMessage)}
        </div>
        <button type="button" className="abyssa-rp__jump" data-show={!stick || undefined} onClick={jumpToLatest}>
          ▼ 回到最新
        </button>
      </div>

      {renderSeat("right")}
    </div>
  );
});
