import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { RpgDialogue } from "../../ui/primitives/RpgDialogue";
import { PaperDoll } from "../../ui/patterns/PaperDoll";
import { deriveRpStage } from "../../ui/patterns/RpScene";
import type { RpActor, RpMessage, RpSeat } from "../../ui/patterns/RpScene";
import type { ExpressionId } from "../../ui/patterns/expressions";
import "./adv-stage.css";

/**
 * ADV 版式舞台。
 *
 * ADV(adventure)是视觉小说的标准术语:立绘 + 底部对话框,
 * 一次一句。与之相对的 NVL(novel)是整屏文本流 —— 本项目的
 * NVL 消息流即属此类。两者是同一场演出的两种呈现。
 *
 * 与 NVL 版式是**同一场演出的两种呈现**,不是另一个流程:
 * 共享同一个 messages 游标、同一套席位推导(deriveRpStage),
 * 所以任意时刻切换,台上是谁、站左还是站右都完全一致 ——
 * 这是切换动画能对上位的前提。
 *
 * 形态:背景 / 左右立绘 / 底部一个对话框。
 * 旁白、系统、骰子结果**一律进同一个对话框**,只是名牌换成对应的
 * 标签(旁白无名牌、系统与骰子用标签名),不另起浮层 —— ADV 版式的
 * 全部信息都从这一个框里出。
 */

/** 退场时长,与 app.css 的 rp-adv-leave 关键帧对齐。 */
const LEAVE_MS = 420;

export interface AdvStageProps {
  actors: RpActor[];
  messages: RpMessage[];
  background?: string;
  /** 打字机是否运行;false = 直接呈现终态(切模式/回看时不重打)。 */
  typing: boolean;
  /**
   * 挂载时已在场的立绘是否跳过进场演出。
   * 切版式时为真:人物在两个版式里是同一个,镜头切换后它不该
   * 再从侧面滑入一次 —— 那会读成"过场结束后又演了一遍"。
   */
  hydrate?: boolean;
  /** 当前条打字机走完。 */
  onTypingEnd?: () => void;
}

/** 走中央浮窗而非对话框的条目 —— 它们是**系统反馈**,不是叙述。
    骰子结果与系统提示塞进台词框会污染叙述流:
    读者刚建立"这个框里是有人在说话"的预期,下一条却是 1d20+6,
    语义直接断裂。AVG 的惯例是把它们提到画面中央做浮窗。 */
function isOverlayKind(message: RpMessage | undefined) {
  return message?.kind === "roll" || message?.kind === "system";
}

/** 当前条在 ADV 框里怎么显示:名牌文本 + 正文 + 是否挂名牌。 */
function resolveFrame(message: RpMessage | undefined, actorById: Map<string, RpActor>) {
  if (!message) return null;
  switch (message.kind) {
    case "say": {
      const actor = actorById.get(message.actorId);
      return {
        name: actor?.name ?? message.actorId,
        secondaryName: actor?.secondaryName,
        text: message.text,
        nameplate: true
      };
    }
    case "narration":
      // 旁白同框,只是摘掉名牌 —— 面板体量不变,不跳动。
      return { name: "", text: message.text, nameplate: false };
    case "chapter":
      return { name: "", text: message.text, nameplate: false };
    default:
      // roll / system 不进框,走中央浮窗。
      return null;
  }
}

export function AdvStage({ actors, messages, background, typing, hydrate = false, onTypingEnd }: AdvStageProps) {
  const actorById = useMemo(() => {
    const map = new Map<string, RpActor>();
    for (const actor of actors) map.set(actor.id, actor);
    return map;
  }, [actors]);

  // 站位与分屏完全同源。
  const { slots } = useMemo(() => deriveRpStage(messages), [messages]);

  const current = messages[messages.length - 1];
  const overlay = isOverlayKind(current) ? current : undefined;

  /* 浮窗当前在场时,对话框保留**上一条叙述**不动 ——
     AVG 惯例:系统浮窗浮在画面上,底下的台词框不清空、不跳。
     若把框清掉,画面会先塌一块再弹浮窗,那是两次跳变。 */
  const frameSource = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (!isOverlayKind(messages[i])) return messages[i];
    }
    return undefined;
  }, [messages]);

  const frame = resolveFrame(frameSource, actorById);
  const speakerId = frameSource?.kind === "say" ? frameSource.actorId : undefined;

  // 表情记忆:未说话者沿用其最近一次表情,而非回落默认。
  const expressionByActor = useMemo(() => {
    const map = new Map<string, ExpressionId>();
    for (const message of messages) {
      if (message.kind === "say" && message.expression) map.set(message.actorId, message.expression);
    }
    return map;
  }, [messages]);

  // —— 换人时旧立绘留在 DOM 里播完退场,与新人同帧并存 ——
  // 与分屏的 departing 同则。key 绑角色 id(而不是槽位),
  // 换人才会真正重挂载、重放进场;绑槽位的话只是原地换图,毫无过渡。
  const [departing, setDeparting] = useState<Record<RpSeat, string | null>>({ left: null, right: null });
  const prevSlots = useRef<Record<RpSeat, string | null>>({ left: null, right: null });

  useEffect(() => {
    const leaving: Partial<Record<RpSeat, string>> = {};
    for (const seat of ["left", "right"] as RpSeat[]) {
      const previous = prevSlots.current[seat];
      if (previous && previous !== slots[seat]) leaving[seat] = previous;
    }
    prevSlots.current = { ...slots };
    if (Object.keys(leaving).length) {
      setDeparting((current) => ({ ...current, ...leaving }));
      const timer = window.setTimeout(
        () =>
          setDeparting((current) => {
            const next = { ...current };
            for (const seat of Object.keys(leaving) as RpSeat[]) {
              if (next[seat] === leaving[seat]) next[seat] = null;
            }
            return next;
          }),
        LEAVE_MS
      );
      return () => window.clearTimeout(timer);
    }
  }, [slots]);

  /* 出生即在场的立绘。hydrate 时它们不播进场动画。

     ============ 这里曾经有个 bug ============
     早先存的是**角色 id 的永久集合**,于是切版式时在场的那两个角色,
     此后无论何时、在哪一侧重新上台,都会被判成"出生即在场"而跳过淡入
     —— 表现为轮换到这些角色时淡入淡出整个失效。

     标记必须绑到**具体的挂载实例**(席位 + 角色),而不是角色本身;
     而且只对首帧有效 —— 首帧过后集合清空,后续所有上台都是真进场。 */
  const [hydratedKeys, setHydratedKeys] = useState<Set<string>>(() =>
    hydrate
      ? new Set(
          (["left", "right"] as RpSeat[])
            .filter((seat) => slots[seat])
            .map((seat) => `${seat}:${slots[seat]}`)
        )
      : new Set()
  );

  /* 标记**不能定时过期**。
     曾经用 setTimeout 到点清空,后果是:过场结束后标记一脱落,
     animation-name 就从 none 变回 rp-adv-enter,浏览器把它当成
     一个新动画从头播 —— 表现就是「人已经在场上了,又演了一遍」。

     正确的失效条件不是时间,而是**这个席位换人**:
     换人后新实例本就该演进场,老标记自然作废。
     在席位未换人期间标记一直有效,rp-adv-enter 始终被压住。 */
  useEffect(() => {
    setHydratedKeys((prev) => {
      if (!prev.size) return prev;
      let next: Set<string> | null = null;
      for (const key of prev) {
        const seat = key.slice(0, key.indexOf(":")) as RpSeat;
        if (`${seat}:${slots[seat]}` !== key) {
          next ??= new Set(prev);
          next.delete(key);
        }
      }
      return next ?? prev;
    });
  }, [slots]);

  const renderDoll = (actorId: string, seat: RpSeat, phase: "enter" | "leave") => {
    const actor = actorById.get(actorId);
    if (!actor) return null;
    const active = phase === "enter" && actorId === speakerId;
    return (
      <div
        className="rp-adv__actor"
        data-seat={seat}
        data-phase={phase}
        data-settled={
          (phase === "enter" && hydratedKeys.has(`${seat}:${actorId}`)) || undefined
        }
        data-active={active ? "true" : "false"}
        data-character={actorId}
        key={`${phase}-${seat}-${actorId}`}
        aria-hidden={phase === "leave" || undefined}
      >
        <div className="rp-adv__actor-body">
          {actor.portrait ? (
            <img
              className="rp-adv__portrait"
              src={actor.portrait}
              alt={actor.name}
              draggable={false}
            />
          ) : (
            <PaperDoll
              characterId={actorId}
              expression={expressionByActor.get(actorId) ?? actor.expression ?? "a"}
              crop="knee"
              alt={actor.name}
              spriteBaseUrl={actor.spriteBaseUrl}
            />
          )}
        </div>
      </div>
    );
  };

  const renderActor = (seat: RpSeat) => {
    const actorId = slots[seat];
    const leavingId = departing[seat];
    return (
      <Fragment key={seat}>
        {leavingId && leavingId !== actorId && renderDoll(leavingId, seat, "leave")}
        {actorId && renderDoll(actorId, seat, "enter")}
      </Fragment>
    );
  };

  /* 打字机 key 绑**框内那条**的 id:浮窗条目不换框,框就不该重打。
     (roll 出现时 frameSource 仍是上一条 say,key 不变 -> 打字机不重启) */
  const dialogueKey = frameSource?.id ?? "empty";
  const settledRef = useRef(onTypingEnd);
  settledRef.current = onTypingEnd;

  /* 终态上报:
       · 非打字态(切版式进来)-> 立刻
       · 当前条是浮窗 -> 立刻(它没有打字机,不报会把推进卡死)
     依赖里带 current?.id,每条浮窗都要报一次。 */
  useEffect(() => {
    if (!typing || overlay) settledRef.current?.();
  }, [typing, overlay, dialogueKey, current?.id]);

  return (
    <div className="rp-adv">
      {background && (
        <div
          className="rp-adv__bg"
          style={{ backgroundImage: `url(${background})` }}
          aria-hidden="true"
        />
      )}

      <div className="rp-adv__cast" aria-hidden="true">
        {renderActor("left")}
        {renderActor("right")}
      </div>

      {/* 舞台画框的四角括号。框体本身是 .rp-adv::after 的 inset 描边。 */}
      <span className="rp-adv__frame-ornaments" aria-hidden="true">
        <i data-corner="tl" />
        <i data-corner="tr" />
        <i data-corner="bl" />
        <i data-corner="br" />
      </span>

      {frame && (
        <div className="rp-adv__dialogue" data-kind={frameSource?.kind}>
          <RpgDialogue
            key={dialogueKey}
            name={frame.name}
            secondaryName={frame.secondaryName}
            showNameplate={frame.nameplate}
            text={frame.text}
            typing={typing}
            typingSpeed={28}
            onTypingEnd={onTypingEnd}
            variant="dark"
          />
        </div>
      )}

      {/* 系统 / 骰子:画面中央浮窗。key 绑条目 id 让每条重放入场。 */}
      {overlay && (
        <div className="rp-adv__overlay" key={overlay.id} role="status">
          {overlay.kind === "roll" ? (
            // 横排一条:检定名 · 总值 · 明细 · 判定。
            // 与系统浮窗同形态,只有总值染判定色作唯一强调。
            <div className="rp-adv__roll" data-outcome={overlay.outcome}>
              <span className="rp-adv__roll-label">{overlay.label}</span>
              <span className="rp-adv__roll-total">{overlay.total}</span>
              <span className="rp-adv__roll-formula">{overlay.detail}</span>
              <span className="rp-adv__roll-tag">
                {overlay.outcome === "success" ? "成功" : "失败"}
              </span>
            </div>
          ) : (
            <div className="rp-adv__system">
              <span className="rp-adv__system-text">{overlay.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
