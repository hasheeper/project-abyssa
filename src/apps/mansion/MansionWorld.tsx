import type {
  PointerEventHandler,
  ReactNode,
  RefObject,
  WheelEventHandler
} from "react";
import type { MansionLayer } from "../../shared/domain/mansion/regions";
import {
  MANSION_WORLD_HEIGHT,
  MANSION_WORLD_WIDTH,
  MANSION_ROOM_DETAILS,
  fallbackRoomDetail,
  type MansionCharacter
} from "./data";
import type { RoomLight } from "./lighting";
import {
  DialogueBubble,
  MARKER_SIZE,
  ProductionIcon,
  PromoteIcon,
  RepairIcon
} from "./MansionMarkers";
import { getMansionAvatar } from "./MansionRoomViews";
import {
  UNDERGROUND_BOTTOM,
  UNDERGROUND_LEFT,
  UNDERGROUND_RIGHT,
  UNDERGROUND_TOP,
  WORLD_DISPLAY_WIDTH,
  WORLD_SCALE,
  cleanRegionLabel,
  markerSlot,
  regionBounds,
  regionLabelY,
  type Point,
  type SceneRegion
} from "./mansion-geometry";
import {
  MAX_FACILITY_LEVEL,
  REPAIR_STEPS
} from "./mansion-state";

export interface CharacterPlacement extends Point {
  character: MansionCharacter;
  roomId: string;
}

export type MansionRoomLight = {
  region: SceneRegion;
  light: RoomLight;
};

export type MansionWorldProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  roomFocused: boolean;
  inert: boolean | undefined;
  roomCamera: { x: number; y: number; zoom: number };
  visibleLayers: MansionLayer[];
  loadedLayerCount: number;
  useCompositeFallback: boolean;
  loading: boolean;
  sceneRegions: SceneRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  readyProduction: ReadonlySet<string>;
  levels: Readonly<Record<string, number>>;
  repairProgress: Readonly<Record<string, number>>;
  damaged: ReadonlySet<string>;
  upgrading: Readonly<Record<string, number>>;
  characterPlacements: CharacterPlacement[];
  roomLights: MansionRoomLight[];
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onWheel: WheelEventHandler<HTMLDivElement>;
  onLayerLoad: (layerId: string) => void;
  onLayerError: (layerId: string) => void;
  onHoverRegion: (regionId: string | null) => void;
  onOpenRegion: (regionId: string) => void;
  onCollectProduction: (roomId: string) => void;
  onActivateCharacter: (character: MansionCharacter) => void;
};

export function MansionWorld({
  viewportRef,
  dragging,
  roomFocused,
  inert,
  roomCamera,
  visibleLayers,
  loadedLayerCount,
  useCompositeFallback,
  loading,
  sceneRegions,
  selectedRegionId,
  hoveredRegionId,
  readyProduction,
  levels,
  repairProgress,
  damaged,
  upgrading,
  characterPlacements,
  roomLights,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onLayerLoad,
  onLayerError,
  onHoverRegion,
  onOpenRegion,
  onCollectProduction,
  onActivateCharacter
}: MansionWorldProps) {
  return (
    <main
      ref={viewportRef}
      className={`mansion-viewport${dragging ? " is-dragging" : ""}${roomFocused ? " is-room-focused" : ""}`}
      aria-label="守望者之崖洋馆总览"
      inert={inert}
      aria-hidden={inert}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="mansion-world-pan"
        style={{
          width: WORLD_DISPLAY_WIDTH,
          transform: `translate3d(${roomCamera.x}px, ${roomCamera.y}px, 0) scale(${roomCamera.zoom})`
        }}
      >
        <div className="mansion-world-plane" style={{ transform: `scale(${WORLD_SCALE})` }}>
          <div className="mansion-sky" aria-hidden="true" />
          {useCompositeFallback ? (
            <img
              className="mansion-world-composite"
              src={`${import.meta.env.BASE_URL}mansion-map/composite-reference.png`}
              alt=""
              draggable={false}
            />
          ) : visibleLayers.map((layer) => (
            <img
              key={layer.id}
              className="mansion-world-layer"
              src={`${import.meta.env.BASE_URL}mansion-map/${layer.src}`}
              alt=""
              draggable={false}
              onLoad={() => onLayerLoad(layer.id)}
              onError={() => onLayerError(layer.id)}
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
            className="mansion-region-layer"
            viewBox={`0 0 ${MANSION_WORLD_WIDTH} ${MANSION_WORLD_HEIGHT}`}
            aria-label="可交互房间"
          >
            {sceneRegions.map((region) => {
              const selected = selectedRegionId === region.id;
              const detail = MANSION_ROOM_DETAILS[region.id] ?? fallbackRoomDetail(region.kind);
              const bounds = regionBounds(region);
              const labelX = (bounds.left + bounds.right) / 2;
              const labelY = regionLabelY(region);
              const commonProps = {
                className: `mansion-region${selected ? " is-selected" : ""}${
                  hoveredRegionId === region.id ? " is-hovered" : ""
                }${detail.state === "sealed" ? " is-sealed" : ""}`,
                tabIndex: 0,
                role: "button",
                "aria-label": `查看${cleanRegionLabel(region.label)}`,
                "aria-pressed": selected,
                "data-no-pan": true,
                onPointerEnter: () => {
                  if (!selectedRegionId) onHoverRegion(region.id);
                },
                onPointerMove: () => {
                  if (!selectedRegionId && hoveredRegionId !== region.id) {
                    onHoverRegion(region.id);
                  }
                },
                onPointerLeave: () => {
                  if (hoveredRegionId === region.id) onHoverRegion(null);
                },
                onClick: () => onOpenRegion(region.id),
                onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenRegion(region.id);
                  }
                }
              };

              return (
                <g key={region.id} {...commonProps}>
                  {region.shape === "rectangle" ? (
                    <rect
                      x={region.rect.x * MANSION_WORLD_WIDTH}
                      y={region.rect.y * MANSION_WORLD_HEIGHT}
                      width={region.rect.width * MANSION_WORLD_WIDTH}
                      height={region.rect.height * MANSION_WORLD_HEIGHT}
                    />
                  ) : (
                    <polygon
                      points={region.points
                        .map((point) =>
                          `${point.x * MANSION_WORLD_WIDTH},${point.y * MANSION_WORLD_HEIGHT}`
                        )
                        .join(" ")}
                    />
                  )}
                  <text x={labelX} y={labelY}>{cleanRegionLabel(region.label)}</text>
                </g>
              );
            })}
          </svg>

          {sceneRegions.map((region) => {
            const detail = MANSION_ROOM_DETAILS[region.id];
            if (!detail) return null;
            const pins: Array<{
              kind: "production" | "repair" | "promote";
              node: ReactNode;
            }> = [];

            if (detail.production && readyProduction.has(region.id)) {
              pins.push({
                kind: "production",
                node: (
                  <button
                    type="button"
                    className="mansion-marker mansion-marker--production"
                    data-no-pan
                    aria-label={`收取${cleanRegionLabel(region.label)}的${detail.production.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCollectProduction(region.id);
                    }}
                  >
                    <ProductionIcon icon={detail.production.icon} />
                    <b className="mansion-marker__badge">{detail.production.amount}</b>
                  </button>
                )
              });
            }

            const roomLevel = levels[region.id] ?? detail.level;
            if (
              detail.upgradeCost &&
              detail.fund &&
              (repairProgress[region.id] ?? 0) >= REPAIR_STEPS &&
              roomLevel < MAX_FACILITY_LEVEL
            ) {
              pins.push({
                kind: "promote",
                node: (
                  <button
                    type="button"
                    className="mansion-marker mansion-marker--promote"
                    data-no-pan
                    aria-label={`${cleanRegionLabel(region.label)}可升级至 Lv.${roomLevel + 1}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenRegion(region.id);
                    }}
                  >
                    <PromoteIcon />
                  </button>
                )
              });
            }

            const isDamaged = damaged.has(region.id);
            const isUpgrading = Boolean(upgrading[region.id]);
            if (
              (isDamaged || isUpgrading) &&
              (repairProgress[region.id] ?? 0) < REPAIR_STEPS &&
              roomLevel < MAX_FACILITY_LEVEL
            ) {
              pins.push({
                kind: "repair",
                node: (
                  <button
                    type="button"
                    className="mansion-marker mansion-marker--repair"
                    data-state={isUpgrading ? "working" : "damaged"}
                    data-no-pan
                    aria-label={isUpgrading
                      ? `${cleanRegionLabel(region.label)}修缮中，还需 ${upgrading[region.id]} 相位`
                      : `${cleanRegionLabel(region.label)}出现损坏，查看修缮`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenRegion(region.id);
                    }}
                  >
                    <RepairIcon />
                    {isUpgrading && (
                      <b className="mansion-marker__badge">{upgrading[region.id]}</b>
                    )}
                  </button>
                )
              });
            }

            return pins.map((pin, index) => {
              const slot = markerSlot(region, index, MARKER_SIZE);
              return (
                <span
                  key={`${pin.kind}-${region.id}`}
                  className="mansion-marker-slot"
                  style={{ left: slot.x, top: slot.y }}
                >
                  {pin.node}
                </span>
              );
            });
          })}

          {characterPlacements.map(({ character, roomId, x, y }) => {
            const avatar = getMansionAvatar(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={`mansion-character${
                  hoveredRegionId === roomId ? " is-room-muted" : ""
                }`}
                data-faction={character.faction}
                data-room={roomId}
                data-no-pan
                style={{ left: x, top: y }}
                aria-label={`与${character.name}交谈`}
                onClick={(event) => {
                  event.stopPropagation();
                  onActivateCharacter(character);
                }}
              >
                <span className="mansion-character__disc">
                  {avatar ? (
                    <img src={avatar} alt="" draggable={false} />
                  ) : (
                    <b aria-hidden="true">{character.name.slice(0, 1)}</b>
                  )}
                </span>
                <span className="mansion-character__bubble" aria-hidden="true">
                  <DialogueBubble />
                </span>
                <span className="mansion-character__name">{character.name}</span>
              </button>
            );
          })}

          <div
            className="mansion-underground"
            aria-hidden="true"
            style={{
              left: UNDERGROUND_LEFT,
              top: UNDERGROUND_TOP,
              width: UNDERGROUND_RIGHT - UNDERGROUND_LEFT,
              height: UNDERGROUND_BOTTOM - UNDERGROUND_TOP
            }}
          />
          <div className="mansion-phase-light" aria-hidden="true" />

          {roomLights.length > 0 && (
            <div className="mansion-lights" aria-hidden="true">
              {roomLights.map(({ region, light }) => {
                const bounds = regionBounds(region);
                return (
                  <span
                    key={`light-${region.id}`}
                    className="mansion-light"
                    data-tone={light.tone}
                    data-flicker={light.flicker}
                    style={{
                      left: bounds.left,
                      top: bounds.top,
                      width: bounds.right - bounds.left,
                      height: bounds.bottom - bounds.top,
                      opacity: light.intensity
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="mansion-loading" role="status" data-no-pan>
          <span />洋馆剖面装配中 · {loadedLayerCount}/{visibleLayers.length || "—"}
        </div>
      )}
    </main>
  );
}
