import type { CSSProperties } from "react";
import {
  DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT,
  ExpeditionFlatDieFrame
} from "./ExpeditionFlatDieFrame";
import type {
  ExpeditionDieSeal,
  ExpeditionDieStampAction,
  ExpeditionDieStampLayout,
  ExpeditionDieSuitShape
} from "./ExpeditionFlatDieFrame";
import "./expedition-die-cube.css";

export type ExpeditionDieFaceNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type ExpeditionDieFaceConfig = {
  number: ExpeditionDieFaceNumber;
  fate: number;
  power: number;
  seal: ExpeditionDieSeal;
  action: ExpeditionDieStampAction;
  textureRotation: number;
  suitShape?: ExpeditionDieSuitShape;
  wildPip?: boolean;
  scoring?: boolean;
};

export type ExpeditionDieRotation = {
  x: number;
  y: number;
};

export const EXPEDITION_DIE_FACE_ORIENTATIONS: Record<
  ExpeditionDieFaceNumber,
  ExpeditionDieRotation
> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: 90 },
  4: { x: 0, y: -90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 }
};

export const DEFAULT_EXPEDITION_DIE_FACES: ExpeditionDieFaceConfig[] = [
  { number: 1, fate: 1, power: 1, seal: "none", action: "attack", textureRotation: 0 },
  { number: 2, fate: 2, power: 2, seal: "rust", action: "guard", textureRotation: 90 },
  { number: 3, fate: 3, power: 3, seal: "plain", action: "heal", textureRotation: 180 },
  { number: 4, fate: 4, power: 4, seal: "gild", action: "coin", textureRotation: 270 },
  { number: 5, fate: 5, power: 5, seal: "plain", action: "art", textureRotation: 90 },
  { number: 6, fate: 6, power: 6, seal: "plain", action: "wild", textureRotation: 180 }
];

export type ExpeditionDieCubeProps = {
  faces?: ExpeditionDieFaceConfig[];
  layout?: ExpeditionDieStampLayout;
  rotation?: ExpeditionDieRotation;
  size?: number;
  recessDepth?: number;
  suitShape?: ExpeditionDieSuitShape;
  rollDuration?: number;
  dragging?: boolean;
  showFrame?: boolean;
  showPanel?: boolean;
  showTexture?: boolean;
  showCorners?: boolean;
  showGuides?: boolean;
  themeColor?: string;
  className?: string;
};

export function ExpeditionDieCube({
  faces = DEFAULT_EXPEDITION_DIE_FACES,
  layout = DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT,
  rotation = { x: -18, y: 28 },
  size = 300,
  recessDepth = 6,
  suitShape = "diamond",
  rollDuration = 0.9,
  dragging = false,
  showFrame = true,
  showPanel = true,
  showTexture = true,
  showCorners = true,
  showGuides = false,
  themeColor,
  className
}: ExpeditionDieCubeProps) {
  const rootClass = [
    "expedition-die-cube",
    dragging && "expedition-die-cube--dragging",
    className
  ].filter(Boolean).join(" ");
  const rootStyle = {
    "--expedition-die-cube-size": `${size}px`,
    "--expedition-die-cube-half": `${size / 2}px`,
    "--expedition-die-roll-duration": `${rollDuration}s`,
    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
  } as CSSProperties;

  return (
    <div className={rootClass} style={rootStyle} aria-label="六面战斗骰">
      {faces.map((face) => (
        <article
          key={face.number}
          className={`expedition-die-cube__face expedition-die-cube__face--${face.number}`}
          data-number={face.number}
          aria-label={`骰子第 ${face.number} 面`}
        >
          <ExpeditionFlatDieFrame
            action={face.action}
            fate={face.fate}
            power={face.power}
            seal={face.seal}
            suitShape={face.suitShape ?? suitShape}
            themeColor={themeColor}
            wildPip={face.wildPip}
            scoring={face.scoring}
            layout={layout}
            textureRotation={face.textureRotation}
            recessDepth={recessDepth}
            showFrame={showFrame}
            showPanel={showPanel}
            showTexture={showTexture}
            showCorners={showCorners}
            showGuides={showGuides}
          />
        </article>
      ))}
    </div>
  );
}
