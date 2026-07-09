import type { HTMLAttributes, ReactNode } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface NameplateProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  secondaryName?: ReactNode;
  variant?: AbyssaVariant;
}

export function Nameplate({
  name,
  secondaryName,
  variant = "teal",
  className,
  ...props
}: NameplateProps) {
  return (
    <div
      className={cx("abyssa-nameplate", className)}
      data-variant={variant}
      {...props}
    >
      <span className="abyssa-nameplate__wing" data-side="left" aria-hidden="true" />
      <div className="abyssa-nameplate__copy">
        <strong>{name}</strong>
        {secondaryName && <span>{secondaryName}</span>}
      </div>
      <span className="abyssa-nameplate__wing" data-side="right" aria-hidden="true" />
    </div>
  );
}
