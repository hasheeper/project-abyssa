import type { ReactNode } from "react";
import { MetalCorner } from "../../shared/ui/decorations/MetalCorner";
import { cx } from "../../shared/lib/cx";

type MapWoodFrameProps = {
  children: ReactNode;
};

const CORNERS = ["tl", "tr", "br", "bl"] as const;

/** 四段斜接木轨 + 一圈连续内线；粗细取 --abyssa-map-frame-rail。
 *  地图画框与委托书共用，委托书只把令牌改小。 */
export function MapWoodRails() {
  return (
    <span className="abyssa-map-wood-frame__rails" aria-hidden="true">
      <i data-edge="top" />
      <i data-edge="right" />
      <i data-edge="bottom" />
      <i data-edge="left" />
    </span>
  );
}

/** 四角黄铜角件；宽度取 --abyssa-map-frame-corner。 */
export function MapMetalCorners({ className }: { className?: string }) {
  return (
    <span className={cx("abyssa-map-wood-frame__corners", className)} aria-hidden="true">
      {CORNERS.map((corner) => (
        <MetalCorner key={corner} corner={corner} />
      ))}
    </span>
  );
}

export function MapWoodFrame({ children }: MapWoodFrameProps) {
  return (
    <div className="abyssa-map-frame" aria-label="副本地图框架">
      <MapWoodRails />
      <div className="abyssa-map-wood-frame__brass">
        <div className="abyssa-map-wood-frame__board">
          <MapMetalCorners />
          {children}
        </div>
      </div>
    </div>
  );
}
