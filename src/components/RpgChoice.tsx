import { forwardRef, useId } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type RpgRadioVariant = "gray" | "dark" | "teal";
export type RpgCheckboxVariant = "empty" | "dark" | "teal";

interface ChoiceProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "defaultChecked" | "onChange"> {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  watermark?: DiamondWatermarkConfig;
}

export interface RpgRadioProps extends ChoiceProps {
  variant?: RpgRadioVariant;
}

export interface RpgCheckboxProps extends ChoiceProps {
  variant?: RpgCheckboxVariant;
}

export const RpgRadio = forwardRef<HTMLInputElement, RpgRadioProps>(
  function RpgRadio(
    {
      label,
      checked,
      defaultChecked = false,
      onCheckedChange,
      onChange,
      variant = "dark",
      watermark,
      className,
      disabled,
      ...props
    },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 16, outerOpacity: 0.72, innerOpacity: 0.62 });
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-radio-watermark-${uid}`;

    return (
      <label className={cx("abyssa-choice", "abyssa-choice--radio", className)} data-variant={variant} data-disabled={disabled || undefined}>
        <input
          ref={ref}
          type="radio"
          aria-label={label}
          checked={checked}
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          disabled={disabled}
          onChange={(event) => {
            onChange?.(event);
            if (!event.defaultPrevented) onCheckedChange?.(event.currentTarget.checked);
          }}
          {...props}
        />
        <svg viewBox="0 0 48 48" aria-hidden="true">
          {watermarkOptions && <defs><DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-choice-pattern-outer)" innerFill="var(--abyssa-choice-pattern-inner)" {...watermarkOptions} /></defs>}
          <circle cx="24" cy="24" r="18" fill="var(--abyssa-choice-fill)" />
          {watermarkOptions && <circle cx="24" cy="24" r="18" fill={`url(#${patternId})`} />}
          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="5" />
          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--abyssa-choice-middle)" strokeWidth="2.8" />
          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.2" />
          <circle cx="24" cy="24" r="14.5" fill="none" stroke="var(--abyssa-choice-accent)" strokeWidth=".9" opacity=".7" />
          <circle className="abyssa-choice__mark" cx="24" cy="24" r="10.5" fill="var(--abyssa-choice-core)" />
        </svg>
      </label>
    );
  }
);

export const RpgCheckbox = forwardRef<HTMLInputElement, RpgCheckboxProps>(
  function RpgCheckbox(
    {
      label,
      checked,
      defaultChecked = false,
      onCheckedChange,
      onChange,
      variant = "dark",
      watermark,
      className,
      disabled,
      ...props
    },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 16, outerOpacity: 0.72, innerOpacity: 0.62 });
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-checkbox-watermark-${uid}`;

    return (
      <label className={cx("abyssa-choice", "abyssa-choice--checkbox", className)} data-variant={variant} data-disabled={disabled || undefined}>
        <input
          ref={ref}
          type="checkbox"
          aria-label={label}
          checked={checked}
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          disabled={disabled}
          onChange={(event) => {
            onChange?.(event);
            if (!event.defaultPrevented) onCheckedChange?.(event.currentTarget.checked);
          }}
          {...props}
        />
        <svg viewBox="0 0 48 48" aria-hidden="true">
          {watermarkOptions && <defs><DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-choice-pattern-outer)" innerFill="var(--abyssa-choice-pattern-inner)" {...watermarkOptions} /></defs>}
          <rect x="6" y="6" width="36" height="36" fill="var(--abyssa-choice-fill)" />
          {watermarkOptions && <rect x="6" y="6" width="36" height="36" fill={`url(#${patternId})`} />}
          <rect x="6" y="6" width="36" height="36" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="5" />
          <rect x="6" y="6" width="36" height="36" fill="none" stroke="var(--abyssa-choice-middle)" strokeWidth="2.8" />
          <rect x="6" y="6" width="36" height="36" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.2" />
          <rect x="10" y="10" width="28" height="28" fill="none" stroke="var(--abyssa-choice-accent)" strokeWidth=".9" opacity=".75" />
          <path className="abyssa-choice__mark" d="M15.5 24.5 L21.5 30.5 L33 18" fill="none" stroke="var(--abyssa-choice-check)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </label>
    );
  }
);

export const RetroRpgRadio = RpgRadio;
export const RetroRpgCheckbox = RpgCheckbox;
