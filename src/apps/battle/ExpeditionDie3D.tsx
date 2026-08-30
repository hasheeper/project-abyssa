import type { CSSProperties } from "react";
import plainDaggerIcon from "../../assets/svg/items/game-icons/plain-dagger.svg";
import swapBagIcon from "../../assets/svg/items/game-icons/swap-bag.svg";
import crossShieldIcon from "../../assets/svg/ui/game-icon-cross-shield.svg";
import hospitalCrossIcon from "../../assets/svg/ui/game-icon-hospital-cross.svg";
import magicPalmIcon from "../../assets/svg/ui/game-icon-magic-palm.svg";

export type ExpeditionDieSuit = "holy" | "earth" | "abyss" | "beyond";
export type ExpeditionDieQuality = "plain" | "rust" | "gild" | "none";
export type ExpeditionDieVerb = "attack" | "guard" | "heal" | "coin" | "art" | "blank" | "wild";

export type ExpeditionDieFace = {
  verb: ExpeditionDieVerb;
  power: number;
  quality: ExpeditionDieQuality;
  /** 命数为万能点数（凯尔·静谧之楔）：角标渲染为宝石而非数字 */
  wildPip?: boolean;
};

export type ExpeditionDieRotation = {
  x: number;
  y: number;
};

type ExpeditionDie3DProps = {
  index: number;
  value: number;
  characterName: string;
  themeColor: string;
  suit: ExpeditionDieSuit;
  faces: readonly ExpeditionDieFace[];
  held: boolean;
  /** 该骰参与当前牌型：点亮右上角命数角标 */
  scoring?: boolean;
  rotation?: ExpeditionDieRotation;
  rolling?: boolean;
  rollDuration?: number;
  disabled?: boolean;
  downed?: boolean;
  rustFaces?: number;
  gildFaces?: number;
  onToggle?: (index: number) => void;
};

const FACE_ROTATIONS: Record<number, readonly [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180]
};

export function getExpeditionDieRotation(value: number): ExpeditionDieRotation {
  const [x, y] = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];
  return { x, y };
}

export function nextExpeditionDieRotation(
  rotation: ExpeditionDieRotation,
  value: number,
  random: () => number = Math.random
): ExpeditionDieRotation {
  const [targetX, targetY] = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];
  const normalize = (number: number) => ((number % 360) + 360) % 360;
  return {
    x: rotation.x + (2 + Math.floor(random() * 2)) * 360 + ((normalize(targetX) - normalize(rotation.x) + 360) % 360),
    y: rotation.y + (2 + Math.floor(random() * 2)) * 360 + ((normalize(targetY) - normalize(rotation.y) + 360) % 360)
  };
}

const SUIT_COLORS: Record<ExpeditionDieSuit, string> = {
  holy: "#e8c87a",
  earth: "#6fa08b",
  abyss: "#a43c4b",
  beyond: "#8e7bb8"
};

const VERB_ICONS: Partial<Record<ExpeditionDieVerb, string>> = {
  attack: plainDaggerIcon,
  coin: swapBagIcon,
  guard: crossShieldIcon,
  heal: hospitalCrossIcon,
  art: magicPalmIcon
};

function VerbIcon({ verb }: { verb: ExpeditionDieVerb }) {
  const iconUrl = VERB_ICONS[verb];
  if (iconUrl) {
    return (
      <i
        className="expedition-die__verb-glyph"
        style={{ "--expedition-die-verb-icon": `url("${iconUrl}")` } as CSSProperties}
      />
    );
  }
  if (verb === "wild") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2 1.6 6.2 5.9-2.7-3.7 4.9L22 12l-6.2 1.6 3.7 4.9-5.9-2.7L12 22l-1.6-6.2-5.9 2.7 3.7-4.9L2 12l6.2-1.6-3.7-4.9 5.9 2.7Z" data-fill="true" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" data-heavy="true" />
    </svg>
  );
}

function DiamondStud({
  on = false,
  wild = false,
  grand = false
}: {
  on?: boolean;
  wild?: boolean;
  /** 高power面（4/5）升格为一颗大菱形，而非退化成数字 */
  grand?: boolean;
}) {
  return (
    <i
      className="expedition-die__stud"
      data-on={on || undefined}
      data-wild={wild || undefined}
      data-grand={grand || undefined}
    >
      {wild ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 .8 23.2 12 12 23.2.8 12Z" data-fill="true" />
          <path d="m12 5.4 6.6 6.6-6.6 6.6L5.4 12Z" data-gem-core="true" />
          <path d="M12 .2V-2M12 26v-2.2M-2 12H.2M26 12h-2.2" data-wild-rays="true" />
        </svg>
      ) : on ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1.6 22.4 12 12 22.4 1.6 12Z" data-fill="true" />
          <path d="m12 5.6 6.4 6.4-6.4 6.4L5.6 12Z" data-gem-shine="true" />
          <path d="M12 1.6 22.4 12 12 22.4 1.6 12Z" data-gem-edge="true" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" data-gem-off-fill="true" />
          <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" data-gem-off-edge="true" />
        </svg>
      )}
    </i>
  );
}

function SuitIcon({ suit, sealed = false }: { suit: ExpeditionDieSuit; sealed?: boolean }) {
  if (sealed) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" data-wax="true" />
        <path d="m12 7.4 1.1 3.5 3.5 1.1-3.5 1.1-1.1 3.5-1.1-3.5L7.4 12l3.5-1.1Z" data-wax-mark="true" />
      </svg>
    );
  }
  if (suit === "holy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 4.8 7.2 7.2-7.2 7.2L4.8 12Z" data-fill="true" />
        <path d="M12 .8V3m0 18v2.2M.8 12H3m18 0h2.2" />
      </svg>
    );
  }
  if (suit === "earth") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.6" y="4.6" width="14.8" height="14.8" />
        <rect x="9.6" y="9.6" width="4.8" height="4.8" data-fill="true" />
      </svg>
    );
  }
  if (suit === "abyss") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 9.5 17.4h-19Z" data-fill="true" />
        <path d="m12 9.4 4.6 8.2H7.4Z" data-cut="true" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.6" />
      <path d="M15.6 6.6a6.2 6.2 0 0 0 0 10.8" data-fine="true" />
    </svg>
  );
}

function RankRail({ face }: { face: ExpeditionDieFace }) {
  const wild = face.verb === "wild";
  const blank = face.verb === "blank";
  /* 4 及以上：不再排小菱形，升格为一颗大菱形 */
  const grand = !wild && !blank && face.power >= 4;

  return (
    <span
      className="expedition-die__rail"
      data-wild={wild || undefined}
      data-blank={blank || undefined}
      data-grand={grand || undefined}
      data-power={!wild ? face.power : undefined}
      aria-hidden="true"
    >
      {blank ? (
        <i className="expedition-die__unusable-mark">
          <svg viewBox="0 0 24 24">
            <path
              d="M3.4 6.7 6.7 3.4 20.7 19.2 19.2 20.7ZM17.3 3.4 20.6 6.7 4.8 20.7 3.3 19.2Z"
              data-unusable-cut="true"
            />
            <path d="m5.1 5.2 14.2 14M18.9 5.2 4.7 19.2" data-unusable-bevel="true" />
          </svg>
        </i>
      ) : wild ? (
        <DiamondStud on wild />
      ) : grand ? (
        <DiamondStud on grand />
      ) : (
        [0, 1, 2].map((rank) => (
          <DiamondStud on={rank < face.power} key={rank} />
        ))
      )}
    </span>
  );
}

function SelectionFrame() {
  return (
    <span className="expedition-die__selection" aria-hidden="true">
      <span data-part="inner-frame" />
      <i data-corner="tl" />
      <i data-corner="tr" />
      <i data-corner="br" />
      <i data-corner="bl" />
      <span data-part="seal"><i data-part="seal-core" /></span>
    </span>
  );
}

export function ExpeditionDie3D({
  index,
  value,
  characterName,
  themeColor,
  suit,
  faces,
  held,
  scoring = false,
  rotation,
  rolling = false,
  rollDuration = 0.9,
  disabled = false,
  downed = false,
  rustFaces = 0,
  gildFaces = 0,
  onToggle
}: ExpeditionDie3DProps) {
  const resolvedRotation = rotation ?? getExpeditionDieRotation(value);
  const currentFace = faces[value - 1] ?? faces[0];
  const unusable = currentFace?.verb === "blank";
  const style = {
    "--expedition-die-theme": themeColor,
    "--expedition-die-suit": SUIT_COLORS[suit],
    "--expedition-die-roll-duration": `${rollDuration}s`
  } as CSSProperties;
  const cubeStyle = {
    transform: `rotateX(${resolvedRotation.x}deg) rotateY(${resolvedRotation.y}deg)`
  } as CSSProperties;

  return (
    <button
      type="button"
      className="expedition-die"
      data-held={held || undefined}
      data-rolling={rolling || undefined}
      data-downed={downed || undefined}
      data-unusable={unusable || undefined}
      aria-label={`${characterName}命数骰，第 ${index + 1} 槽，当前 ${value} 点${
        rustFaces > 0 ? `，锈铭 ${rustFaces} 面` : ""
      }${
        gildFaces > 0 ? `，金铭 ${gildFaces} 面` : ""
      }${unusable ? "，无行动面，无法指挥角色" : ""}${downed ? "，力竭不可用" : ""}`}
      aria-pressed={held}
      disabled={disabled}
      style={style}
      onClick={() => onToggle?.(index)}
    >
      <span className="expedition-die__cube" style={cubeStyle}>
        {[1, 2, 3, 4, 5, 6].map((pip) => {
          const face = faces[pip - 1] ?? faces[0];
          return (
            <span
              className="expedition-die__face"
              data-face={pip}
              data-verb={face.verb}
              data-quality={face.quality}
              data-result={pip === value || undefined}
              data-scoring={(scoring && pip === value) || undefined}
              key={pip}
            >
              <span className="expedition-die__gloss" aria-hidden="true" />
              <span className="expedition-die__corner" aria-hidden="true">
                <b data-wild-pip={face.wildPip || undefined}>
                  {face.wildPip ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 1.6 22.4 12 12 22.4 1.6 12Z" data-fill="true" />
                      <path d="m12 5.6 6.4 6.4-6.4 6.4L5.6 12Z" data-gem-shine="true" />
                    </svg>
                  ) : (
                    pip
                  )}
                </b>
                <i><SuitIcon suit={suit} sealed={face.quality === "none"} /></i>
              </span>
              <span className="expedition-die__verb" aria-hidden="true">
                <VerbIcon verb={face.verb} />
              </span>
              <RankRail face={face} />
            </span>
          );
        })}
      </span>
      {held && <SelectionFrame />}
      <span className="expedition-die__shadow" aria-hidden="true" />
      {(rustFaces > 0 || gildFaces > 0) && (
        <span className="expedition-die__quality-counts" aria-hidden="true">
          {rustFaces > 0 && (
            <span
              className="expedition-die__quality-count"
              data-quality="rust"
              title={`${characterName}的命数骰有 ${rustFaces} 面锈铭`}
            >
              {rustFaces}
            </span>
          )}
          {gildFaces > 0 && (
            <span
              className="expedition-die__quality-count"
              data-quality="gild"
              title={`${characterName}的命数骰有 ${gildFaces} 面金铭`}
            >
              {gildFaces}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
