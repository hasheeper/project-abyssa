import type { CSSProperties } from "react";
import { ExpeditionFlatDieFrame } from "../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import type { ExpeditionDieSuitShape } from "../../shared/ui/dice-face/ExpeditionFlatDieFrame";

export type ExpeditionDieSuit = "holy" | "earth" | "abyss" | "beyond";
type ExpeditionDieQuality = "plain" | "rust" | "gild" | "none";
type ExpeditionDieVerb = "attack" | "guard" | "heal" | "coin" | "art" | "blank" | "wild";

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

function getExpeditionDieRotation(value: number): ExpeditionDieRotation {
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

const SUIT_SHAPES: Record<ExpeditionDieSuit, ExpeditionDieSuitShape> = {
  holy: "diamond",
  earth: "square",
  abyss: "triangle",
  beyond: "circle"
};

const FACE_TEXTURE_ROTATIONS = [0, 90, 180, 270, 90, 180] as const;

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
              key={pip}
            >
              <ExpeditionFlatDieFrame
                action={face.verb}
                fate={pip}
                power={face.power}
                seal={face.quality}
                suitShape={SUIT_SHAPES[suit]}
                themeColor={themeColor}
                wildPip={face.wildPip}
                scoring={scoring && pip === value}
                textureRotation={FACE_TEXTURE_ROTATIONS[pip - 1]}
                recessDepth={2}
              />
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
