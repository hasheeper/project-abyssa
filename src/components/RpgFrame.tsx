import type { HTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface RpgFrameProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AbyssaVariant | "transparent";
  padding?: "none" | "sm" | "md" | "lg";
  ornamented?: boolean;
  watermark?: DiamondWatermarkConfig;
}

export function RpgFrame({
  variant = "dark",
  padding = "md",
  ornamented = true,
  watermark,
  className,
  children,
  ...props
}: RpgFrameProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 48, outerOpacity: 0.5, innerOpacity: 0.4 });
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
      {watermarkOptions && <DiamondWatermark className="abyssa-frame__watermark" {...watermarkOptions} />}
      <div className="abyssa-frame__content">{children}</div>
    </div>
  );
}
