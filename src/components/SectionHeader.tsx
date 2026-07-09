import type { RpgHeaderProps } from "./RpgHeader";
import { cx } from "../utils/cx";
import { RpgHeader } from "./RpgHeader";

export interface SectionHeaderProps
  extends Omit<RpgHeaderProps, "label" | "description"> {
  title: string;
  subtitle?: string;
}

/** @deprecated Use RpgHeader instead. */
export function SectionHeader({
  title,
  subtitle,
  variant = "dark",
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <RpgHeader
      label={title}
      description={subtitle}
      variant={variant}
      className={cx("abyssa-section-header", className)}
      {...props}
    />
  );
}
