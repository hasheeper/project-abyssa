import { useId } from "react";
import type { HTMLAttributes } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { useControllableState } from "../hooks/useControllableState";
import { cx } from "../utils/cx";

export type RpgDirection = "up" | "right" | "down" | "left";

export interface RpgDirectionPadProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Visual label at the centre of the control. */
  label?: string;
  /** Accessible name for the four directional controls. */
  ariaLabel?: string;
  variant?: Extract<AbyssaVariant, "dark" | "teal" | "light">;
  size?: AbyssaSize;
  value?: RpgDirection;
  defaultValue?: RpgDirection;
  onValueChange?: (direction: RpgDirection) => void;
  disabled?: boolean;
}

const directions: ReadonlyArray<{
  id: RpgDirection;
  label: string;
  transform: string;
}> = [
  { id: "up", label: "Up", transform: "translate(165 63)" },
  { id: "right", label: "Right", transform: "translate(267 165) rotate(90)" },
  { id: "down", label: "Down", transform: "translate(165 267) rotate(180)" },
  { id: "left", label: "Left", transform: "translate(63 165) rotate(-90)" }
];

const arrowPath = "M 0 -50 L 49 -1 L 39 9 L 46 16 L 33 29 L 0 -4 L -33 29 L -46 16 L -39 9 L -49 -1 Z";
const ornamentPath = "M -34 13 L 0 -21 L 34 13";
const highlightPath = "M -27 13 L 0 -14 L 27 13";
const directionMark = "M 0 -38 L 4 -31 L -4 -31 Z";

export function RpgDirectionPad({
  label = "MOVE",
  ariaLabel = "Direction controls",
  variant = "teal",
  size = "md",
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  className,
  ...props
}: RpgDirectionPadProps) {
  const initial = defaultValue ?? "up";
  const [selectedDirection, setSelectedDirection] = useControllableState({
    value,
    defaultValue: initial,
    onChange: onValueChange
  });
  const patternId = `abyssa-direction-pad-pattern-${useId().replace(/:/g, "")}`;

  return (
    <div
      className={cx("abyssa-direction-pad", className)}
      role="group"
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      <svg className="abyssa-direction-pad__art" viewBox="0 0 330 330" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M15 0 30 15 15 30 0 15Z" fill="rgb(23 78 81 / 8.5%)" />
            <path d="M15 7 23 15 15 23 7 15Z" fill="rgb(255 255 255 / 7%)" />
          </pattern>
        </defs>
        {directions.map((direction) => {
          const selected = direction.id === selectedDirection;
          return (
            <g
              key={direction.id}
              className="abyssa-direction-pad__arrow"
              data-direction={direction.id}
              data-selected={selected || undefined}
              transform={direction.transform}
            >
              <path className="abyssa-direction-pad__arrow-fill" d={arrowPath} />
              <path d={arrowPath} fill={`url(#${patternId})`} />
              <path d={arrowPath} fill="none" stroke="var(--abyssa-direction-frame-outer)" strokeWidth="8" strokeLinejoin="round" />
              <path d={arrowPath} fill="none" stroke="var(--abyssa-direction-frame-middle)" strokeWidth="4.2" strokeLinejoin="round" />
              <path d={arrowPath} fill="none" stroke="var(--abyssa-direction-frame-inner)" strokeWidth="1.6" strokeLinejoin="round" />
              <path d={ornamentPath} fill="none" stroke="var(--abyssa-direction-ornament)" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
              <path d={highlightPath} fill="none" stroke="var(--abyssa-direction-highlight)" strokeWidth=".7" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
              <path d={directionMark} fill="var(--abyssa-direction-ornament)" />
            </g>
          );
        })}
        <text className="abyssa-direction-pad__label" x="165" y="166">{label}</text>
      </svg>
      {directions.map((direction) => {
        const selected = direction.id === selectedDirection;
        return (
          <button
            key={direction.id}
            type="button"
            className="abyssa-direction-pad__button"
            data-direction={direction.id}
            data-selected={selected || undefined}
            aria-label={direction.label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => setSelectedDirection(direction.id)}
          />
        );
      })}
    </div>
  );
}

export const RetroRpgDirectionPad = RpgDirectionPad;
