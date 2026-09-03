import type { CSSProperties } from "react";
import type {
  PartyFigureCalibration,
  PartyFigureCalibrationMap,
  PartyFigureId
} from "../../content/characters/partyFigureCalibration";
import type { PartyFigureCatalogEntry } from "../../assets/map/party-figures/catalog";
import {
  PARTY_FIGURE_PARTY_CANVAS,
  PARTY_FIGURE_PARTY_SLOTS,
  partyFigurePartySlotMetrics
} from "./party-figure-model";

export type PartyFigurePreviewMode = "single" | "party";
export type PartyFigureBackground = "dark" | "parchment" | "grid";

const PARTY_SLOT_COUNT = 5;

function calibrationStyle(calibration: PartyFigureCalibration): CSSProperties {
  const horizontalScale = calibration.flipX ? -calibration.scale : calibration.scale;
  return {
    transform: `translate(${calibration.x}%, ${-calibration.y}%) scale(${horizontalScale}, ${calibration.scale})`
  };
}

function FigureImage({
  entry,
  calibration,
  label
}: {
  entry: PartyFigureCatalogEntry;
  calibration: PartyFigureCalibration;
  label?: string;
}) {
  return (
    <span
      className="party-figure-preview__image-frame"
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <img
        className="party-figure-preview__image"
        src={entry.url}
        alt=""
        draggable={false}
        style={calibrationStyle(calibration)}
      />
    </span>
  );
}

function Guides({ mode }: { mode: PartyFigurePreviewMode }) {
  return (
    <span className="party-figure-preview__guides" data-mode={mode} aria-hidden="true">
      <i data-guide="x" />
      <i data-guide="y" />
      <i data-guide="baseline" />
      <b>BASELINE</b>
    </span>
  );
}

export interface PartyFigurePreviewProps {
  mode: PartyFigurePreviewMode;
  background: PartyFigureBackground;
  showBaseline: boolean;
  activeId: PartyFigureId;
  partyIds: readonly PartyFigureId[];
  catalog: readonly PartyFigureCatalogEntry[];
  calibrations: PartyFigureCalibrationMap;
  onSelect: (id: PartyFigureId) => void;
}

export function PartyFigurePreview({
  mode,
  background,
  showBaseline,
  activeId,
  partyIds,
  catalog,
  calibrations,
  onSelect
}: PartyFigurePreviewProps) {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const active = byId.get(activeId)!;

  if (mode === "single") {
    return (
      <section className="party-figure-preview" aria-label="单图对齐预览">
        <div
          className="party-figure-preview__canvas party-figure-preview__canvas--single"
          data-background={background}
        >
          <span className="party-figure-preview__coordinate-note">
            X+ → 右移 · Y+ ↑ 上移 · 原点 50% 100%
          </span>
          <FigureImage
            entry={active}
            calibration={calibrations[active.id]}
            label={`${active.name} 对齐预览`}
          />
          {showBaseline && <Guides mode="single" />}
          <span className="party-figure-preview__caption">
            <b>{active.name}</b>
            <small>{active.id} · 512 × 512</small>
          </span>
        </div>
      </section>
    );
  }

  const slots = Array.from({ length: PARTY_SLOT_COUNT }, (_, index) => {
    const id = partyIds[index];
    return id ? byId.get(id) : undefined;
  });

  return (
    <section className="party-figure-preview" aria-label="五人编队对比预览">
      <div
        className="party-figure-preview__canvas party-figure-preview__canvas--party"
        data-background={background}
      >
        <span className="party-figure-preview__coordinate-note">
          X+ → 右移 · Y+ ↑ 上移 · 原点 50% 100%
        </span>
        <ol className="party-figure-preview__party-list">
          {slots.map((entry, index) => {
            const slot = PARTY_FIGURE_PARTY_SLOTS[index];
            const metrics = partyFigurePartySlotMetrics(slot.height);
            return (
              <li
                className="party-figure-preview__party-slot"
                data-empty={!entry || undefined}
                data-active={entry?.id === activeId || undefined}
                key={entry?.id ?? `empty-${index}`}
                style={
                  {
                    "--party-slot-left": `${slot.left / PARTY_FIGURE_PARTY_CANVAS.width * 100}%`,
                    "--party-slot-width": `${slot.width / PARTY_FIGURE_PARTY_CANVAS.width * 100}%`,
                    "--party-slot-height": `${slot.height / PARTY_FIGURE_PARTY_CANVAS.height * 100}%`,
                    "--party-slot-figure-bottom": `${metrics.figureBottomPercent}%`,
                    "--party-slot-figure-height": `${metrics.figureHeightPercent}%`,
                    "--party-slot-name-height": `${metrics.nameHeightPercent}%`,
                    zIndex: slot.zIndex
                  } as CSSProperties
                }
              >
                {entry ? (
                  <button
                    type="button"
                    aria-label={`编辑 ${entry.name}`}
                    onClick={() => onSelect(entry.id)}
                  >
                    <FigureImage entry={entry} calibration={calibrations[entry.id]} />
                    <span>{entry.name}</span>
                  </button>
                ) : (
                  <span className="party-figure-preview__empty">{index + 1}</span>
                )}
              </li>
            );
          })}
        </ol>
        {showBaseline && <Guides mode="party" />}
        <span className="party-figure-preview__caption">
          <b>五人编队对比</b>
          <small>880 × 350 参考舞台 · 点击角色继续调整</small>
        </span>
      </div>
    </section>
  );
}
