import { useEffect, useRef, useState } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { Stage } from "../../shared/stage";
import { createMapScene } from "./createMapScene";
import { MapWoodFrame } from "./MapWoodFrame";
import { cloneMapLocations } from "./types";

export function MapPage() {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    const controller = createMapScene(container, {
      locations: cloneMapLocations(),
      onReady: () => setLoading(false),
      onError: () => {
        setError(true);
        setLoading(false);
      },
      onLocationSelect: (location) => setSelectedLocation(location.name)
    });
    return () => {
      controller.destroy();
    };
  }, []);

  return (
    <Stage background="var(--abyssa-map-backdrop)">
      <AbyssaProvider className="abyssa-map-page" density="compact">
        {/* 招牌与 shop 同构:absolute 挂墙,不参与流,允许压住画框上沿。 */}
        <header className="abyssa-map-heading">
          <RpgHeader
            className="abyssa-map-heading__bar"
            label="守望者之崖"
            description="守望者之崖"
            variant="dark"
          />
        </header>

        <MapWoodFrame>
          <section className="abyssa-map-viewport" aria-label="守望者之崖副本地图">
            <div ref={sceneContainerRef} className="abyssa-map-scene" />
            <div className="abyssa-map-vignette" aria-hidden="true" />

            {(loading || error) && (
              <div className="abyssa-map-loading" role="status">
                {error ? "素材加载失败，请刷新" : "地图展开中..."}
              </div>
            )}

            {selectedLocation && (
              <div className="abyssa-map-selection" role="status">
                已选择：{selectedLocation}
              </div>
            )}

            <span className="abyssa-map-archive-label" aria-hidden="true">区域档案 · 03</span>
          </section>
        </MapWoodFrame>
      </AbyssaProvider>
    </Stage>
  );
}
