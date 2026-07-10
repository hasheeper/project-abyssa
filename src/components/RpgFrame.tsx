import type { HTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

export interface RpgFrameProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AbyssaVariant | "transparent";
  padding?: "none" | "sm" | "md" | "lg";
  ornamented?: boolean;
}

export function RpgFrame({
  variant = "dark",
  padding = "md",
  ornamented = true,
  className,
  children,
  ...props
}: RpgFrameProps) {
  return (
    <div
      className={cx("abyssa-frame", className)}
      data-variant={variant}
      data-padding={padding}
      data-ornamented={ornamented || undefined}
      {...props}
    >
      {ornamented && (
        <span className="abyssa-frame__ornaments" aria-hidden="true">
          <i data-corner="tl" />
          <i data-corner="tr" />
          <i data-corner="bl" />
          <i data-corner="br" />
        </span>
      )}
      <DiamondWatermark className="abyssa-frame__watermark" size={48} />
      <div className="abyssa-frame__content">{children}</div>
    </div>
  );
}
