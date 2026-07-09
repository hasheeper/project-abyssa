import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

export interface AbyssaProviderProps extends HTMLAttributes<HTMLDivElement> {
  accent?: "teal" | "silver";
  density?: "comfortable" | "compact";
}

export function AbyssaProvider({
  accent = "teal",
  density = "comfortable",
  className,
  children,
  ...props
}: AbyssaProviderProps) {
  return (
    <div
      className={cx("abyssa-theme", className)}
      data-accent={accent}
      data-density={density}
      {...props}
    >
      {children}
    </div>
  );
}
