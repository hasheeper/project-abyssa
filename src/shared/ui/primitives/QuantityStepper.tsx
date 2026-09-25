import { IconButton } from "./IconButton";
import "./quantity-stepper.css";

/** Small quantities share the existing button material and never accept invalid drafts. */
export function QuantityStepper({label, value, maximum, disabled, onChange}: {
  label: string; value: number; maximum: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  return <div className="abyssa-quantity-stepper" role="group" aria-label={label}>
    <IconButton label={`减少${label}`} icon="minus" size="sm" variant="dark" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}/>
    <output aria-label={label}>{value}</output>
    <IconButton label={`增加${label}`} icon="plus" size="sm" variant="teal" disabled={disabled || value >= maximum} onClick={() => onChange(value + 1)}/>
  </div>;
}
