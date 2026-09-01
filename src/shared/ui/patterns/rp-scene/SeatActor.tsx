import { useEffect, useRef } from "react";
import { PaperDoll } from "../PaperDoll";
import type { ExpressionId } from "../expressions";
import type { RpActor, RpSeat } from "../rp-stage";
import type { RpCrop } from "./types";

const ENTER_MS = 680;
const LEAVE_MS = 420;
/** 进场滑入距离(占席位框宽百分比)。与 novel.css 的 AVG 基线一致。 */
const ENTER_FROM = 30;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface SeatActorProps {
  actor: RpActor;
  seat: RpSeat;
  phase: "enter" | "leave";
  active: boolean;
  expression: ExpressionId;
  crop: RpCrop;
  onExited?: () => void;
}

/**
 * 一个在台上的立绘。进退场动画仅作用于定位层，内层 CSS 仍可独立控制
 * 说话者上浮、明暗和角色动作。
 */
export function SeatActor({ actor, seat, phase, active, expression, crop, onExited }: SeatActorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const direction = seat === "left" ? -1 : 1;
    const reduce = prefersReducedMotion();

    // 不在 cleanup 里 cancel():StrictMode 下 effect 会 mount→unmount→mount，
    // cancel 会把刚起步的动画掐掉重放。元素卸载时动画会自然终止。
    if (phase === "enter") {
      host.animate(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { transform: `translate3d(${direction * ENTER_FROM}%, 0, 0)`, opacity: 0 },
              {
                transform: `translate3d(${direction * ENTER_FROM * -0.06}%, 0, 0)`,
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
            { transform: `translate3d(${direction * ENTER_FROM * 0.8}%, 0, 0)`, opacity: 0 }
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
        <div className="abyssa-rp__actor-idle">
          <div className="abyssa-rp__actor-beat">
            <PaperDoll
              characterId={actor.id}
              expression={expression}
              crop={crop}
              alt={actor.name}
              spriteBaseUrl={actor.spriteBaseUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
