import type { HTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import type { PanelVariant } from "../types";
import { cx } from "../utils/cx";
import { RpgPanel } from "./RpgPanel";

export interface CharacterOption {
  id: string;
  number: string;
  label: string;
  variant?: PanelVariant;
  disabled?: boolean;
}

export interface CharacterSelectorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: CharacterOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  selectedVariant?: PanelVariant;
  columns?: number;
  label?: string;
}

export function CharacterSelector({
  items,
  value,
  defaultValue,
  onValueChange,
  selectedVariant = "teal",
  columns = 1,
  label = "角色选择",
  className,
  style,
  ...props
}: CharacterSelectorProps) {
  const initialValue = defaultValue ?? items.find((item) => !item.disabled)?.id ?? "";
  const [selectedId, setSelectedId] = useControllableState({
    value,
    defaultValue: initialValue,
    onChange: onValueChange
  });

  return (
    <div
      className={cx("abyssa-character-selector", className)}
      role="group"
      aria-label={label}
      style={{ ...style, "--abyssa-selector-columns": columns } as React.CSSProperties}
      {...props}
    >
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <RpgPanel
            key={item.id}
            number={item.number}
            variant={isSelected ? selectedVariant : (item.variant ?? "dark")}
            selected={isSelected}
            disabled={item.disabled}
            aria-label={item.label}
            aria-current={isSelected ? "true" : undefined}
            watermark={false}
            onClick={() => setSelectedId(item.id)}
          />
        );
      })}
    </div>
  );
}
