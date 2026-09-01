import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
  WheelEvent
} from "react";
import type {
  MansionPsdManifest,
  MansionRectangle,
  MansionRegion,
  NormalizedRectangle
} from "../../shared/domain/mansion/regions";
import {
  REGION_COLORS
} from "./region-editor-types";
import type {
  DraftRectangle,
  DraftRegion,
  RectangleCorner,
  ViewTransform
} from "./region-editor-types";

interface MansionRegionCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  manifest: MansionPsdManifest;
  enabledLayers: ReadonlySet<string>;
  rectangles: MansionRectangle[];
  regions: MansionRegion[];
  selectedRectangleId: string | null;
  selectedId: string | null;
  rectangleDraft: DraftRectangle | null;
  rectanglePreview: NormalizedRectangle | null;
  draft: DraftRegion | null;
  view: ViewTransform;
  handleViewportPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleViewportPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  finishPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleWheel: (event: WheelEvent<HTMLDivElement>) => void;
  setSelectedRectangleId: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  moveRectangleCorner: (
    event: ReactPointerEvent<SVGCircleElement>,
    rectangleId: string,
    corner: RectangleCorner
  ) => void;
  moveVertex: (
    event: ReactPointerEvent<SVGCircleElement>,
    regionId: string,
    pointIndex: number
  ) => void;
  completeDraft: () => void;
}

export function MansionRegionCanvas({
  viewportRef,
  manifest,
  enabledLayers,
  rectangles,
  regions,
  selectedRectangleId,
  selectedId,
  rectangleDraft,
  rectanglePreview,
  draft,
  view,
  handleViewportPointerDown,
  handleViewportPointerMove,
  finishPan,
  handleWheel,
  setSelectedRectangleId,
  setSelectedId,
  moveRectangleCorner,
  moveVertex,
  completeDraft
}: MansionRegionCanvasProps) {
  return (
        <div
          ref={viewportRef}
          className={`mansion-editor__viewport ${draft || rectangleDraft ? "is-drawing" : ""}`}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={finishPan}
          onPointerCancel={finishPan}
          onWheel={handleWheel}
        >
          <div
            className="mansion-editor__canvas"
            style={{
              width: manifest.width,
              height: manifest.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
            }}
          >
            {manifest.layers.map((layer) => enabledLayers.has(layer.id) && (
              <img
                key={layer.id}
                className="mansion-editor__layer"
                src={`${import.meta.env.BASE_URL}mansion-map/${layer.src}`}
                alt=""
                draggable={false}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.width,
                  height: layer.height,
                  opacity: layer.opacity,
                  zIndex: layer.order
                }}
              />
            ))}

            <svg
              className="mansion-editor__regions"
              viewBox={`0 0 ${manifest.width} ${manifest.height}`}
              aria-label="洋馆区域标注"
            >
              {rectangles.map((rectangle) => {
                const color = REGION_COLORS[rectangle.kind];
                const x = rectangle.rect.x * manifest.width;
                const y = rectangle.rect.y * manifest.height;
                const width = rectangle.rect.width * manifest.width;
                const height = rectangle.rect.height * manifest.height;
                const selected = rectangle.id === selectedRectangleId;
                const corners = [
                  ["tl", x, y],
                  ["tr", x + width, y],
                  ["br", x + width, y + height],
                  ["bl", x, y + height]
                ] as const;
                return (
                  <g key={rectangle.id}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={selected ? 0.28 : 0.14}
                      stroke={color}
                      strokeWidth={selected ? 4 : 2}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(event) => {
                        if (draft || rectangleDraft) return;
                        event.stopPropagation();
                        setSelectedRectangleId(rectangle.id);
                        setSelectedId(null);
                      }}
                    />
                    {selected && corners.map(([corner, cx, cy]) => (
                      <circle
                        key={`${rectangle.id}-${corner}`}
                        cx={cx}
                        cy={cy}
                        r={8 / view.scale}
                        fill="#fff8e8"
                        stroke={color}
                        strokeWidth={3 / view.scale}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            moveRectangleCorner(event, rectangle.id, corner);
                          }
                        }}
                      />
                    ))}
                  </g>
                );
              })}

              {regions.map((region) => {
                const color = REGION_COLORS[region.kind];
                const points = region.points
                  .map((point) => `${point.x * manifest.width},${point.y * manifest.height}`)
                  .join(" ");
                const selected = region.id === selectedId;
                return (
                  <g key={region.id}>
                    <polygon
                      points={points}
                      fill={color}
                      fillOpacity={selected ? 0.28 : 0.14}
                      stroke={color}
                      strokeWidth={selected ? 4 : 2}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(event) => {
                        if (draft || rectangleDraft) return;
                        event.stopPropagation();
                        setSelectedId(region.id);
                        setSelectedRectangleId(null);
                      }}
                    />
                    {selected && region.points.map((point, index) => (
                      <circle
                        key={`${region.id}-${index}`}
                        cx={point.x * manifest.width}
                        cy={point.y * manifest.height}
                        r={8 / view.scale}
                        fill="#fff8e8"
                        stroke={color}
                        strokeWidth={3 / view.scale}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            moveVertex(event, region.id, index);
                          }
                        }}
                      />
                    ))}
                  </g>
                );
              })}

              {rectangleDraft && rectanglePreview && (
                <rect
                  x={rectanglePreview.x * manifest.width}
                  y={rectanglePreview.y * manifest.height}
                  width={rectanglePreview.width * manifest.width}
                  height={rectanglePreview.height * manifest.height}
                  fill={REGION_COLORS[rectangleDraft.kind]}
                  fillOpacity={0.22}
                  stroke={REGION_COLORS[rectangleDraft.kind]}
                  strokeWidth={3}
                  strokeDasharray="10 7"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {draft && draft.points.length > 0 && (
                <g>
                  <polyline
                    points={draft.points
                      .map((point) => `${point.x * manifest.width},${point.y * manifest.height}`)
                      .join(" ")}
                    fill={draft.points.length >= 3 ? REGION_COLORS[draft.kind] : "none"}
                    fillOpacity={0.18}
                    stroke={REGION_COLORS[draft.kind]}
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                  {draft.points.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x * manifest.width}
                      cy={point.y * manifest.height}
                      r={(index === 0 ? 11 : 6) / view.scale}
                      fill={index === 0 ? "#fff3bd" : REGION_COLORS[draft.kind]}
                      stroke="#201a16"
                      strokeWidth={2 / view.scale}
                      onPointerDown={index === 0 ? (event) => {
                        event.stopPropagation();
                        completeDraft();
                      } : undefined}
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>

          <div className="mansion-editor__hint">
            矩形：按住拖拽 · 多边形：逐点点击 · 空格/中键移动画布 · Esc 取消
          </div>
        </div>
  );
}
