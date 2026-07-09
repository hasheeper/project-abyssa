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
  variant = "dark",
  className,
  ...props
}: NameplateProps) {
  return (
    <div
      className={cx("abyssa-nameplate", className)}
      data-variant={variant}
      {...props}
    >
      <div className="abyssa-nameplate__middle">
        <div className="abyssa-nameplate__inner">
          <div className="abyssa-nameplate__content">
            <strong>{name}</strong>
            {secondaryName && <span>{secondaryName}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
