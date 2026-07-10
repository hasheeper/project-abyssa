import type { HTMLAttributes, ReactNode } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface NameplateProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  secondaryName?: ReactNode;
  variant?: AbyssaVariant;
  watermark?: DiamondWatermarkConfig;
}

export function Nameplate({
  name,
  secondaryName,
  variant = "dark",
  watermark,
  className,
  ...props
}: NameplateProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 34, outerOpacity: 0.55, innerOpacity: 0.45 });
  return (
    <div
      className={cx("abyssa-nameplate", className)}
      data-variant={variant}
      {...props}
    >
      <div className="abyssa-nameplate__middle">
        <div className="abyssa-nameplate__inner">
          <div className="abyssa-nameplate__content">
            {watermarkOptions && <DiamondWatermark className="abyssa-nameplate__watermark" {...watermarkOptions} />}
            <strong>{name}</strong>
            {secondaryName && <span>{secondaryName}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
