import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import { cx } from "../utils/cx";

export type RpgDiamondNodeVariant = "inactive" | "active" | "teal";

export interface RpgDiamondNodeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: RpgDiamondNodeVariant;
  selected?: boolean;
}

export const RpgDiamondNode = forwardRef<HTMLButtonElement, RpgDiamondNodeProps>(
  function RpgDiamondNode(
    { label, variant = "inactive", selected, className, type = "button", ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-diamond-node-pattern-${uid}`;
    const diamond = "M25 3 L47 25 L25 47 L3 25 Z";
    return (
      <button ref={ref} type={type} className={cx("abyssa-diamond-node", className)} data-variant={variant} data-selected={selected || undefined} aria-label={label} aria-pressed={selected === undefined ? undefined : selected} {...props}>
        <svg viewBox="0 0 50 50" aria-hidden="true">
          <defs><pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8 0 L16 8 L8 16 L0 8 Z" fill="var(--abyssa-node-pattern-dark)" /><path d="M8 4 L12 8 L8 12 L4 8 Z" fill="var(--abyssa-node-pattern-light)" /></pattern></defs>
          <path d={diamond} fill="var(--abyssa-node-fill)" /><path d={diamond} fill={`url(#${patternId})`} />
          <path d={diamond} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" /><path d={diamond} fill="none" stroke="var(--abyssa-node-middle)" strokeWidth={variant === "active" ? 3.5 : 3} /><path d={diamond} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth={variant === "active" ? 1.2 : 1} />
          <path d="M18 19 L12 25 L18 31 M32 19 L38 25 L32 31" fill="none" stroke="var(--abyssa-node-arrow)" strokeWidth={variant === "active" ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
);

export interface RpgDiamondNodeItem {
  id: string;
  label: string;
  variant?: Exclude<RpgDiamondNodeVariant, "active">;
  disabled?: boolean;
}

export interface RpgDiamondNodeTrackProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: RpgDiamondNodeItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  label?: string;
}

export function RpgDiamondNodeTrack({ items, value, defaultValue, onValueChange, label = "节点选择器", className, ...props }: RpgDiamondNodeTrackProps) {
  const initial = defaultValue ?? items.find((item) => !item.disabled)?.id ?? "";
  const [selectedId, setSelectedId] = useControllableState({ value, defaultValue: initial, onChange: onValueChange });
  return (
    <div className={cx("abyssa-diamond-track", className)} role="group" aria-label={label} {...props}>
      <span className="abyssa-diamond-track__line" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.id === selectedId;
        return <RpgDiamondNode key={item.id} label={item.label} variant={selected ? "active" : (item.variant ?? "inactive")} selected={selected} disabled={item.disabled} onClick={() => setSelectedId(item.id)} />;
      })}
    </div>
  );
}

export const RetroRpgDiamondNode = RpgDiamondNode;
export const RetroRpgDiamondNodeTrack = RpgDiamondNodeTrack;
