import type { HTMLAttributes, ReactNode } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  variant?: AbyssaVariant;
}

export function SectionHeader({
  title,
  subtitle,
  variant = "dark",
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <header
      className={cx("abyssa-section-header", className)}
      data-variant={variant}
      {...props}
    >
      <span className="abyssa-section-header__line" aria-hidden="true" />
      <div className="abyssa-section-header__copy">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="abyssa-section-header__diamonds" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </header>
  );
}
