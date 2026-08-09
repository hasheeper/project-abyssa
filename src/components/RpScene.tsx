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

/** 气泡指示器的菱形,取自组件库 RpgDiamondNode(viewBox 50×50)。 */
const DIAMOND_PATH = "M25 3 L47 25 L25 47 L3 25 Z";

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
  /** 立绘取景,默认 knee(4/5,去掉脚与小腿)。切口靠框底的预留藏在框外。 */
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
        <PaperDoll characterId={actor.id} expression={expression} crop={crop} alt={actor.name} />
      </div>
    </div>
  );
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
            <div className="abyssa-rp__bubble">
              {/* 箭头绝对定位在气泡内,不是 flex 子项——
                  作为子项时即便 opacity:0 也仍占着自身宽度与一份 gap,
                  那就是没箭头时中间空出一大块的原因。 */}
              <span className="abyssa-rp__arrow" aria-hidden="true">
                <svg viewBox="0 0 50 50">
                  <path d={DIAMOND_PATH} fill="var(--abyssa-rp-node-fill)" />
                  <path d={DIAMOND_PATH} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" />
                  <path d={DIAMOND_PATH} fill="none" stroke="var(--abyssa-rp-node-middle)" strokeWidth="3.5" />
                  <path d={DIAMOND_PATH} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.2" />
                  {/* 单向雪佛龙,指向本方立绘。组件库的节点是双向的(左右各一),
                      那表达「可切换」;这里是实指,只保留朝向立绘的那一支。 */}
                  <path
                    d="M29 16 L18 25 L29 34"
                    fill="none"
                    stroke="var(--abyssa-rp-node-arrow)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="abyssa-rp__bubble-name">
                <strong>{actor?.fullName ?? shortName}</strong>
                {actor?.secondaryName && <span>{actor.secondaryName}</span>}
              </span>
              <p className="abyssa-rp__bubble-text">{message.text}</p>
            </div>
          </div>
        </div>
      );
    }

    if (message.kind === "roll") {
      return (
        <div key={message.id} className="abyssa-rp__message" data-kind="roll" data-outcome={message.outcome}>
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

    return (
      <div key={message.id} className="abyssa-rp__message" data-kind={message.kind}>
        {message.text}
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
