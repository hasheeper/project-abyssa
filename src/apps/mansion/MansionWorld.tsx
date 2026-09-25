import { memo, useEffect, useMemo, type CSSProperties } from "react";
import type {
  PointerEventHandler,
  ReactNode,
  RefObject
} from "react";
import type { MansionArtwork } from "./mansion-assets";
import {
  MANSION_WORLD_HEIGHT,
  MANSION_WORLD_WIDTH,
  MANSION_ROOM_DETAILS,
  fallbackRoomDetail,
  type MansionProduction,
  type MansionCharacter
} from "./data";
import type { RoomLight } from "./lighting";
import { mansionLightSources, mansionSourceGlowBounds } from "./mansion-light-sources";
import {
  DialogueBubble,
  MARKER_SIZE,
  ProductionIcon,
  PromoteIcon,
  RepairIcon
} from "./MansionMarkers";
import { getMansionAvatar } from "./MansionRoomViews";
import { MansionMapArt } from "./MansionMapArt";
import {
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
  eventSignal?: {card: {form: string}; status: string; actionPhase: number | null; role: string};
}

export type MansionRoomLight = {
  region: SceneRegion;
  light: RoomLight;
};

export type MansionWorldProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  hoverSuppressed: boolean;
  onResumeHover: () => void;
  roomFocused: boolean;
  inert: boolean | undefined;
  roomCamera: { x: number; y: number; zoom: number };
  artwork: MansionArtwork | null;
  sceneRegions: SceneRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  readyProduction: ReadonlySet<string>;
  production?: Readonly<Record<string, Pick<MansionProduction, "label" | "amount" | "icon">>>;
  levels: Readonly<Record<string, number>>;
  repairProgress: Readonly<Record<string, number>>;
  damaged: ReadonlySet<string>;
  upgrading: Readonly<Record<string, number>>;
  characterPlacements: CharacterPlacement[];
  roomLights: MansionRoomLight[];
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onWheel: (event: WheelEvent) => void;
  onHoverRegion: (regionId: string | null) => void;
  onOpenRegion: (regionId: string) => void;
  onCollectProduction: (roomId: string) => void;
  onActivateCharacter: (character: MansionCharacter) => void;
};

export const MansionWorld = memo(function MansionWorld({
  viewportRef,
  dragging,
  hoverSuppressed,
  onResumeHover,
  roomFocused,
  inert,
  roomCamera,
  artwork,
  sceneRegions,
  selectedRegionId,
  hoveredRegionId,
  readyProduction,
  production,
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
  onHoverRegion,
  onOpenRegion,
  onCollectProduction,
  onActivateCharacter
}: MansionWorldProps) {
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport || inert)return;
    // React delegates wheel events passively; this viewport owns horizontal pan.
    viewport.addEventListener("wheel",onWheel,{passive:false});
    return ()=>viewport.removeEventListener("wheel",onWheel);
  },[viewportRef,onWheel,inert]);
  // Input ownership/camera updates do not rebuild the illustrated world tree.
  const plane = useMemo(() => (
        <div className="mansion-world-plane">
          <MansionMapArt artwork={artwork} />

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

            const output = production ? production[region.id] : detail.production;
            if (output && readyProduction.has(region.id)) {
              pins.push({
                kind: "production",
                node: (
                  <button
                    type="button"
                    className="mansion-marker mansion-marker--production"
                    data-no-pan
                    aria-label={`收取${cleanRegionLabel(region.label)}的${output.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCollectProduction(region.id);
                    }}
                  >
                    <ProductionIcon icon={output.icon} />
                    <b className="mansion-marker__badge">{output.amount}</b>
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
                      ? `${cleanRegionLabel(region.label)}施工中，还需 ${upgrading[region.id]} 相位`
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

          {characterPlacements.map(({ character, roomId, x, y, eventSignal }, index) => {
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
                data-event-active={!!eventSignal && !(eventSignal.actionPhase !== null && eventSignal.role === "action") || undefined}
                data-no-pan
                style={{ left: x, top: y, "--mansion-resident-order": index % 5 } as CSSProperties}
                aria-label={`与${character.name}交谈`}
                onClick={(event) => {
                  event.stopPropagation();
                  onActivateCharacter(character);
                }}
              >
                <span className="mansion-character__disc">
                  {avatar ? (
                    <img src={avatar} alt="" draggable={false} loading="eager" decoding="async" />
                  ) : (
                    <b aria-hidden="true">{character.name.slice(0, 1)}</b>
                  )}
                </span>
                {eventSignal && !(eventSignal.actionPhase !== null && eventSignal.role === "action") && <span className="mansion-character__bubble" data-event-kind={eventSignal.card.form} data-event-state={eventSignal.status} aria-hidden="true">
                  <DialogueBubble />
                  <b className="mansion-character__event-mark">{eventSignal.status === "ready" ? "✓" : eventSignal.status === "feedback" ? "↩" : eventSignal.card.form === "sortie" ? "!" : eventSignal.card.form === "liaison" ? "↗" : eventSignal.card.form === "household" ? "◇" : "·"}</b>
                </span>}
                <span className="mansion-character__name">{character.name}</span>
              </button>
            );
          })}

          {roomLights.map(({ region, light }) => {
            const source = mansionLightSources(region.id)[0];
            if (!source || source.emission === 0) return null;
            return (
              <span
                key={`light-${region.id}`}
                className="mansion-ambient-glow"
                aria-hidden="true"
                data-source={`${region.id}:${source.id}`}
                data-tone={source.tone ?? light.tone}
                style={mansionSourceGlowBounds(source)}
              />
            );
          })}
        </div>
  ), [artwork, sceneRegions, selectedRegionId, hoveredRegionId, readyProduction, production, levels,
    repairProgress, damaged, upgrading, characterPlacements, roomLights,
    onHoverRegion, onOpenRegion, onCollectProduction, onActivateCharacter]);
  return (
    <main
      ref={viewportRef}
      className={`mansion-viewport${dragging ? " is-dragging" : ""}${roomFocused ? " is-room-focused" : ""}`}
      aria-label="守望者之崖洋馆总览"
      data-hover-suspended={hoverSuppressed || undefined}
      inert={inert}
      aria-hidden={inert}
      onPointerDown={onPointerDown}
      onPointerMoveCapture={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onKeyDownCapture={onResumeHover}
    >
      <div
        className="mansion-world-pan"
        style={{
          width: MANSION_WORLD_WIDTH,
          transform: `translate(${roomCamera.x}px, ${roomCamera.y}px) scale(${WORLD_SCALE * roomCamera.zoom})`
        }}
      >
        {plane}
      </div>
    </main>
  );
});
