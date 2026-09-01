import { forwardRef, useMemo, useRef } from "react";
import { cx } from "../../lib/cx";
import { deriveRpStage } from "./rp-stage";
import type { RpActor, RpMessage } from "./rp-stage";
import {
  deriveExpressionByActor,
  deriveLitAux,
  findCurrentSay
} from "./rp-scene/message-state";
import { RpMessageView } from "./rp-scene/RpMessageView";
import { RpSeatView } from "./rp-scene/RpSeat";
import type { RpSceneProps } from "./rp-scene/types";
import { useRpAutoScroll } from "./rp-scene/useRpAutoScroll";
import { useRpSeatLifecycle } from "./rp-scene/useRpSeatLifecycle";

export { deriveRpStage } from "./rp-stage";
export type { RpActor, RpMessage, RpSeat } from "./rp-stage";
export type { RpSceneProps } from "./rp-scene/types";

/**
 * 跑团 / AI RP 分屏场景。
 *
 * 消息采用追加模型；舞台固定左右两栏，新发言者优先进空栏，两栏都满时
 * 替换更久未发言的一侧。历史对白保留发生时的席位。
 */
export const RpScene = forwardRef<HTMLDivElement, RpSceneProps>(function RpScene(
  { actors, messages, background, crop = "knee", header, mode = "play", hydrate = false, className, ...props },
  ref
) {
  // 挂载时已经存在的消息是一份不再更新的“出生证明”。
  const hydratedIds = useRef<Set<string> | null>(null);
  if (hydratedIds.current === null) {
    hydratedIds.current = hydrate ? new Set(messages.map((message) => message.id)) : new Set();
  }

  const actorById = useMemo(() => {
    const map = new Map<string, RpActor>();
    for (const actor of actors) map.set(actor.id, actor);
    return map;
  }, [actors]);

  const { slots, sideByMessage } = useMemo(() => deriveRpStage(messages), [messages]);
  const { departing, clearDeparting } = useRpSeatLifecycle(slots);
  const currentSay = useMemo(() => findCurrentSay(messages), [messages]);
  const litAux = useMemo(() => deriveLitAux(messages), [messages]);
  const expressionByActor = useMemo(() => deriveExpressionByActor(messages), [messages]);
  const { logRef, stick, onScroll, jumpToLatest } = useRpAutoScroll(messages);

  const lastSpeakerId = currentSay?.actorId;
  const focusId = mode === "play" ? currentSay?.id : undefined;

  return (
    <div ref={ref} className={cx("abyssa-rp", className)} data-mode={mode} {...props}>
      {background && (
        <div className="abyssa-rp__bg" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />
      )}

      <RpSeatView
        seat="left"
        actorId={slots.left}
        actorById={actorById}
        departing={departing.left}
        activeActorId={lastSpeakerId}
        expressionByActor={expressionByActor}
        crop={crop}
        onActorExited={clearDeparting}
      />

      <div className="abyssa-rp__center">
        {header && <div className="abyssa-rp__header">{header}</div>}
        <div ref={logRef} className="abyssa-rp__log" onScroll={onScroll} aria-live="polite">
          {messages.map((message: RpMessage) => (
            <RpMessageView
              key={message.id}
              message={message}
              actorById={actorById}
              sideByMessage={sideByMessage}
              slots={slots}
              focusId={focusId}
              litAux={litAux}
              mode={mode}
              settled={hydratedIds.current?.has(message.id) || undefined}
            />
          ))}
        </div>
        <button type="button" className="abyssa-rp__jump" data-show={!stick || undefined} onClick={jumpToLatest}>
          ▼ 回到最新
        </button>
      </div>

      <RpSeatView
        seat="right"
        actorId={slots.right}
        actorById={actorById}
        departing={departing.right}
        activeActorId={lastSpeakerId}
        expressionByActor={expressionByActor}
        crop={crop}
        onActorExited={clearDeparting}
      />
    </div>
  );
});
