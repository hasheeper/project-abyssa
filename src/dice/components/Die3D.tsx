import type { CSSProperties } from "react";
import { PIP_POSITIONS } from "../game";
import type { Rotation, Side } from "../game";

interface Die3DProps {
  side: Side;
  index: number;
  value: number;
  lock: "none" | "public" | "private";
  covered: boolean;
  rolling: boolean;
  rollDuration: number;
  rotation: Rotation;
  disabled: boolean;
  onToggle?: (index: number) => void;
}

export function Die3D({ side, index, value, lock, covered, rolling, rollDuration, rotation, disabled, onToggle }: Die3DProps) {
  const sceneStyle = {
    "--roll-bounce-duration": `${rollDuration * 0.75}s`
  } as CSSProperties;
  const cubeStyle = {
    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
    "--roll-duration": `${rollDuration}s`
  } as CSSProperties;

  return (
    <button
      type="button"
      className="die"
      data-side={side}
      data-held={lock !== "none" ? "true" : "false"}
      data-lock={lock}
      data-covered={covered ? "true" : "false"}
      data-rolling={rolling ? "true" : "false"}
      aria-label={covered ? `${side === "player" ? "你的" : "缇比的"}第 ${index + 1} 枚暗骰` : `${side === "player" ? "你的" : "缇比的"}第 ${index + 1} 枚骰子，点数 ${value}${lock === "public" ? "，公开锁定" : lock === "private" ? "，私密锁定" : ""}`}
      aria-pressed={side === "player" ? lock !== "none" : undefined}
      disabled={disabled}
      style={sceneStyle}
      onClick={() => onToggle?.(index)}
    >
      <span className="die__cube" style={cubeStyle}>
        {[1, 2, 3, 4, 5, 6].map(face => (
          <span className="die__face" data-face={face} data-result={face === value ? "true" : "false"} key={face}>
            {PIP_POSITIONS[face]!.map(position => (
              <i className="die__pip" data-p={position} aria-hidden="true" key={position}>
                <span className="die__pip-light" />
              </i>
            ))}
          </span>
        ))}
      </span>
      {covered && <span className="die__veil" aria-hidden="true"><i>?</i></span>}
      {lock !== "none" && (
        <span className="die__selection" data-kind={lock} aria-hidden="true">
          <span data-part="inner-frame" />
          <i data-corner="tl" />
          <i data-corner="tr" />
          <i data-corner="br" />
          <i data-corner="bl" />
          <span data-part="seal"><i data-part="seal-core" /></span>
        </span>
      )}
      <span className="die__shadow" aria-hidden="true" />
    </button>
  );
}
