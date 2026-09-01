import type { CSSProperties } from "react";
import type { RpActor, RpMessage, RpSeat, RpStageState } from "../rp-stage";
import type { RpMode } from "./types";

const AVATAR_PATH = "M22 8 H137 V122 L122 137 H8 V22 Z";
const AVATAR_INNER_PATH = "M24 16 H129 V118 L118 129 H16 V24 Z";
const AVATAR_BRACKETS = "M20 34 V20 H34 M111 129 H125 V115";

/** 朝左的非对称矛尖；右席位由 CSS 镜像。 */
const SPEAR_PATH = "M2 25 L29 9 L45 25 L29 41 Z";
const SPEAR_EDGE = "M29 9 L2 25 L29 41";
const SPEAR_CORE = "M27 19 L33 25 L27 31 L21 25 Z";
const TYPED_SKIP = /\s/;

/** 参与打字的字符数；流光等待时间由 CSS 结合该值计算。 */
export function countTypedChars(text: string) {
  let count = 0;
  for (const char of text) if (!TYPED_SKIP.test(char)) count += 1;
  return count;
}

function TypedText({ text }: { text: string }) {
  const chars = Array.from(text);
  let index = 0;

  return (
    <>
      {chars.map((char, position) => {
        if (TYPED_SKIP.test(char)) return char;
        const characterIndex = index;
        index += 1;
        return (
          <span
            key={position}
            className="abyssa-rp__type-char"
            style={{ "--i": characterIndex } as CSSProperties}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

/** 头像框三层描边使用同一路径叠加，保持激活态交叉淡入所需的双层结构。 */
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

function RpArrow() {
  return (
    <span className="abyssa-rp__arrow" aria-hidden="true">
      <svg viewBox="0 0 50 50">
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
        <path
          d={SPEAR_EDGE}
          fill="none"
          stroke="var(--abyssa-rp-node-arrow)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        <path className="abyssa-rp__arrow-core" d={SPEAR_CORE} fill="var(--abyssa-rp-node-core)" />
      </svg>
    </span>
  );
}

interface RpMessageViewProps {
  message: RpMessage;
  actorById: ReadonlyMap<string, RpActor>;
  sideByMessage: ReadonlyMap<string, RpSeat>;
  slots: RpStageState["slots"];
  focusId?: string;
  litAux: ReadonlySet<string>;
  mode: RpMode;
  settled?: boolean;
}

export function RpMessageView({
  message,
  actorById,
  sideByMessage,
  slots,
  focusId,
  litAux,
  mode,
  settled
}: RpMessageViewProps) {
  if (message.kind === "say") {
    const actor = actorById.get(message.actorId);
    const seat = sideByMessage.get(message.id) ?? "left";
    const shortName = actor?.name ?? message.actorId;
    const onStage = slots[seat] === message.actorId;

    return (
      <div
        className="abyssa-rp__message"
        data-kind="say"
        data-settled={settled}
        data-seat={seat}
        data-current={message.id === focusId || undefined}
        data-onstage={onStage || undefined}
        style={actor?.accent ? ({ "--abyssa-rp-accent": actor.accent } as CSSProperties) : undefined}
      >
        <div className="abyssa-rp__row">
          <span className="abyssa-rp__avatar" aria-hidden="true">
            <span className="abyssa-rp__avatar-inner">
              <AvatarFrameArt state="idle" />
              <AvatarFrameArt state="active" />
              <span className="abyssa-rp__avatar-photo">
                {actor?.avatar ? <img src={actor.avatar} alt="" draggable={false} /> : shortName.slice(0, 1)}
              </span>
            </span>
          </span>
          <div
            className="abyssa-rp__bubble"
            style={{ "--n": countTypedChars(message.text) } as CSSProperties}
          >
            <span className="abyssa-rp__bubble-fx" aria-hidden="true">
              <span className="abyssa-rp__bubble-sweep" />
              <span className="abyssa-rp__bubble-edge" />
              <i data-corner="tl" />
              <i data-corner="tr" />
              <i data-corner="bl" />
              <i data-corner="br" />
            </span>
            <RpArrow />
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
        className="abyssa-rp__message"
        data-kind="roll"
        data-settled={settled}
        data-outcome={message.outcome}
        data-recent={(mode === "play" && litAux.has(message.id)) || undefined}
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
      <div className="abyssa-rp__message" data-kind="chapter" data-settled={settled}>
        <span>{message.text}</span>
      </div>
    );
  }

  return (
    <div
      className="abyssa-rp__message"
      data-kind={message.kind}
      data-settled={settled}
      data-recent={(mode === "play" && litAux.has(message.id)) || undefined}
    >
      <TypedText text={message.text} />
    </div>
  );
}
