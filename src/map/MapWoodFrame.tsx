import type { ReactNode } from "react";
import { ShopMetalCorner } from "../shop/ShopMetalCorner";

type MapWoodFrameProps = {
  children: ReactNode;
};

export function MapWoodFrame({ children }: MapWoodFrameProps) {
  return (
    <div className="abyssa-map-frame" aria-label="副本地图框架">
      <span className="abyssa-map-wood-frame__rails" aria-hidden="true">
        <i data-edge="top" />
        <i data-edge="right" />
        <i data-edge="bottom" />
        <i data-edge="left" />
      </span>
      <div className="abyssa-map-wood-frame__brass">
        <div className="abyssa-map-wood-frame__board">
          <span className="abyssa-map-wood-frame__corners" aria-hidden="true">
            {(["tl", "tr", "br", "bl"] as const).map((corner) => (
              <ShopMetalCorner key={corner} corner={corner} />
            ))}
          </span>
          {children}
        </div>
      </div>
    </div>
  );
}
