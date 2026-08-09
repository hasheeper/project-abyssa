import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import { PaperDoll } from "./PaperDoll";
import { RpgDialogue } from "./RpgDialogue";
import type { ExpressionId } from "./expressions";

/**
 * AVG / GAL 视觉小说场景。
 *
 * 由三部分组成:
 *   1. 背景层(background)
 *   2. 立绘层(纸娃娃 PaperDoll,左 / 右两个槽位)
 *   3. 对话层(RpgDialogue,带打字机效果)
 *
 * 传入一段「剧本」脚本,点击 / 按键推进。每行剧本指定说话角色、表情与台词。
 * 台上只保留**最近的两个对话者**,分列左右;出现新对话者时,快速替换掉最旧的那个。
 */

export interface NovelLine {
  /** 说话角色 id(对应立绘目录)。省略则为旁白。 */
  characterId?: string;
  /** 该行表情代号,默认沿用 "a"。 */
  expression?: ExpressionId;
  /** 台词。 */
  text: string;
  /** 覆盖名字牌显示文本,默认用角色 id。 */
  name?: string;
}

export interface NovelActor {
  characterId: string;
  /** 初始表情。 */
  expression?: ExpressionId;
  /** 名字牌显示名。 */
  name?: string;
}

export interface VisualNovelSceneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onEnd"> {
  /** 角色名册(提供名字/默认表情)。台上站位由剧本自动推导,无需指定槽位。 */
  actors: NovelActor[];
  /** 剧本。 */
  script: NovelLine[];
  /** 背景图 url。 */
  background?: string;
  /** 打字机速度(ms/字)。 */
  typingSpeed?: number;
  /** 是否自动播放。 */
  autoPlay?: boolean;
  /** 自动播放每行停留(ms)。 */
  autoPlayDelay?: number;
  /** 剧本播完回调。 */
  onEnd?: () => void;
  /** 行切换回调。 */
  onLineChange?: (index: number, line: NovelLine) => void;
}

export const VisualNovelScene = forwardRef<HTMLDivElement, VisualNovelSceneProps>(
  function VisualNovelScene(
    {
      actors,
      script,
      background,
      typingSpeed = 32,
      autoPlay = false,
      autoPlayDelay = 1800,
      onEnd,
      onLineChange,
      className,
      ...props
    },
    ref
  ) {
    const [lineIndex, setLineIndex] = useState(0);
    const [lineKey, setLineKey] = useState(0); // 用于重置打字机动画
    const line = script[lineIndex];

    // —— 持久槽位:左 / 右。槽位一旦分配就固定,角色位置不随说话权变化。
    //    新角色:优先进左(空)槽,其次右(空)槽;都满则顶掉进场最早的那个,继承其槽位。 ——
    type SlotSide = "left" | "right";
    interface SlotState { id: string; seq: number; entering: boolean }
    const [slots, setSlots] = useState<{ left: SlotState | null; right: SlotState | null }>({ left: null, right: null });
    const seqRef = useRef(0);
    const lastExprRef = useRef(new Map<string, ExpressionId>());

    const actorById = useMemo(() => {
      const map = new Map<string, NovelActor>();
      for (const a of actors) map.set(a.characterId, a);
      return map;
    }, [actors]);

    // 依据当前行的说话人维护槽位分配
    useEffect(() => {
      const id = line?.characterId;
      if (!id) return;
      setSlots((prev) => {
        // 已在台上:只清除其 entering 标记,位置不动
        if (prev.left?.id === id) {
          return prev.left.entering ? { ...prev, left: { ...prev.left, entering: false } } : prev;
        }
        if (prev.right?.id === id) {
          return prev.right.entering ? { ...prev, right: { ...prev.right, entering: false } } : prev;
        }
        // 新角色进场
        const seq = ++seqRef.current;
        const next = { id, seq, entering: true };
        if (!prev.left) return { ...prev, left: next };
        if (!prev.right) return { ...prev, right: next };
        // 两槽都满:顶掉较旧的(seq 小的)
        return prev.left.seq <= prev.right.seq
          ? { ...prev, left: next }
          : { ...prev, right: next };
      });
      // 进场动画播完后清除 entering,避免后续重渲染误触发
      const t = window.setTimeout(() => {
        setSlots((prev) => ({
          left: prev.left ? { ...prev.left, entering: false } : null,
          right: prev.right ? { ...prev.right, entering: false } : null
        }));
      }, 700);
      return () => window.clearTimeout(t);
    }, [lineIndex, line]);

    const advance = useCallback(() => {
      if (lineIndex < script.length - 1) {
        setLineIndex((i) => i + 1);
        setLineKey((k) => k + 1);
      } else {
        onEnd?.();
      }
    }, [lineIndex, script.length, onEnd]);

    useEffect(() => {
      onLineChange?.(lineIndex, line);
    }, [lineIndex, line, onLineChange]);

    useEffect(() => {
      if (!autoPlay) return;
      const t = window.setTimeout(advance, autoPlayDelay);
      return () => window.clearTimeout(t);
    }, [autoPlay, autoPlayDelay, advance, lineKey]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          advance();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [advance]);

    if (!line) return null;

    // 记住每个角色最近一次说话时的表情;未说话者沿用它,而非回落到默认 "a"。
    const expr = line.expression;
    const cid = line.characterId;
    if (cid && expr) lastExprRef.current.set(cid, expr);

    const speaker = line.characterId ? actorById.get(line.characterId) : undefined;
    const speakerName = line.name ?? speaker?.name ?? line.characterId ?? "??";

    const renderActor = (side: SlotSide, slot: SlotState | null) => {
      if (!slot) return null;
      const actor = actorById.get(slot.id);
      const isSpeaker = slot.id === line.characterId;
      const expr = isSpeaker
        ? line.expression ?? lastExprRef.current.get(slot.id) ?? actor?.expression ?? "a"
        : lastExprRef.current.get(slot.id) ?? actor?.expression ?? "a";
      return (
        <div
          key={`${side}-${slot.id}`}
          className="abyssa-novel__actor"
          data-slot={side}
          data-active={isSpeaker ? "true" : "false"}
          data-entering={slot.entering ? "true" : undefined}
        >
          <PaperDoll
            characterId={slot.id}
            expression={expr}
            crop="upper"
            alt={actor?.name ?? slot.id}
          />
        </div>
      );
    };

    return (
      <div
        ref={ref}
        className={cx("abyssa-novel", className)}
        onClick={advance}
        role="presentation"
        {...props}
      >
        {background && (
          <div className="abyssa-novel__bg" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />
        )}

        <div className="abyssa-novel__stage">
          {renderActor("left", slots.left)}
          {renderActor("right", slots.right)}
        </div>

        <div className="abyssa-novel__dialogue" onClick={(e) => e.stopPropagation()}>
          <RpgDialogue
            key={lineKey}
            name={speakerName}
            text={line.text}
            typing
            typingSpeed={typingSpeed}
            variant="dark"
            onClick={advance}
            style={{ cursor: "pointer" }}
          />
          <div className="abyssa-novel__hint" aria-hidden="true">▼ 点击继续</div>
        </div>
      </div>
    );
  }
);
