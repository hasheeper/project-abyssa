import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type RpgDiamondNodeVariant = "inactive" | "active" | "teal";

export interface RpgDiamondNodeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  displayLabel?: string;
  variant?: RpgDiamondNodeVariant;
  selected?: boolean;
  watermark?: DiamondWatermarkConfig;
}

export const RpgDiamondNode = forwardRef<HTMLButtonElement, RpgDiamondNodeProps>(
  function RpgDiamondNode(
    {
      label,
      displayLabel,
      variant = "inactive",
      selected,
      watermark,
      className,
      type = "button",
      ...props
    },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 16, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: 4 });
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-diamond-node-pattern-${uid}`;
    const diamond = "M25 3 L47 25 L25 47 L3 25 Z";
    return (
      <button ref={ref} type={type} className={cx("abyssa-diamond-node", className)} data-variant={variant} data-selected={selected || undefined} aria-label={label} aria-pressed={selected === undefined ? undefined : selected} {...props}>
        <svg viewBox="0 0 50 50" aria-hidden="true">
          {watermarkOptions && <defs><DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-node-pattern-dark)" innerFill="var(--abyssa-node-pattern-light)" {...watermarkOptions} /></defs>}
          <path d={diamond} fill="var(--abyssa-node-fill)" />{watermarkOptions && <path d={diamond} fill={`url(#${patternId})`} />}
          <path d={diamond} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" /><path d={diamond} fill="none" stroke="var(--abyssa-node-middle)" strokeWidth={variant === "active" ? 3.5 : 3} /><path d={diamond} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth={variant === "active" ? 1.2 : 1} />
          <path d="M18 19 L12 25 L18 31 M32 19 L38 25 L32 31" fill="none" stroke="var(--abyssa-node-arrow)" strokeWidth={variant === "active" ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          {displayLabel && (
            <text className="abyssa-diamond-node__label" x="25" y="25">
              {displayLabel}
            </text>
          )}
        </svg>
      </button>
    );
  }
);

export interface RpgDiamondNodeItem {
  id: string;
  label: string;
  displayLabel?: string;
  variant?: Exclude<RpgDiamondNodeVariant, "active">;
  disabled?: boolean;
}

export type RpgDiamondNodeTrackOrientation = "horizontal" | "vertical";

export interface RpgDiamondNodeTrackProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: RpgDiamondNodeItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  label?: string;
  orientation?: RpgDiamondNodeTrackOrientation;
  selectedVariant?: Extract<RpgDiamondNodeVariant, "active" | "teal">;
  watermark?: DiamondWatermarkConfig;
}

export function RpgDiamondNodeTrack({
  items,
  value,
  defaultValue,
  onValueChange,
  label = "节点选择器",
  orientation = "horizontal",
  selectedVariant = "active",
  watermark,
  className,
  ...props
}: RpgDiamondNodeTrackProps) {
  const initial = defaultValue ?? items.find((item) => !item.disabled)?.id ?? "";
  const [selectedId, setSelectedId] = useControllableState({ value, defaultValue: initial, onChange: onValueChange });

  return (
    <div
      className={cx("abyssa-diamond-track", className)}
      role="group"
      aria-label={label}
      data-orientation={orientation}
      data-selected-variant={selectedVariant}
      {...props}
    >
      <span className="abyssa-diamond-track__line" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <RpgDiamondNode
            key={item.id}
            label={item.label}
            displayLabel={item.displayLabel}
            variant={selected ? selectedVariant : (item.variant ?? "inactive")}
            selected={selected}
            disabled={item.disabled}
            watermark={watermark}
            data-node-id={item.id}
            data-base-variant={item.variant ?? "inactive"}
            aria-current={selected ? "true" : undefined}
            onClick={() => setSelectedId(item.id)}
          />
        );
      })}
    </div>
  );
}

export const RetroRpgDiamondNode = RpgDiamondNode;
export const RetroRpgDiamondNodeTrack = RpgDiamondNodeTrack;
