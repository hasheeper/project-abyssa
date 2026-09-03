import {
  PARTY_FIGURE_CALIBRATION_LIMITS,
  PARTY_FIGURE_IDS
} from "../../content/characters/partyFigureCalibration";
import type {
  PartyFigureCalibration,
  PartyFigureCalibrationMap,
  PartyFigureId
} from "../../content/characters/partyFigureCalibration";

/* 已审定默认基线更新后切换存储版本，避免旧草稿盖住新默认值。 */
export const PARTY_FIGURE_STORAGE_KEY = "abyssa.party-figure-studio.v3";
export const PARTY_FIGURE_RANGES = PARTY_FIGURE_CALIBRATION_LIMITS;
export const PARTY_FIGURE_PARTY_LIMIT = 5;
export const PARTY_FIGURE_PARTY_CANVAS = Object.freeze({ width: 880, height: 350 });
export const PARTY_FIGURE_TEAM_NAME_HEIGHT = 24;
export const PARTY_FIGURE_TEAM_NAME_GAP = 8;
export const PARTY_FIGURE_TEAM_IMAGE_RATIO = 1;
export const PARTY_FIGURE_PARTY_SLOTS = Object.freeze([
  Object.freeze({ left: 20, width: 170, height: 285, zIndex: 3 }),
  Object.freeze({ left: 185, width: 170, height: 305, zIndex: 4 }),
  Object.freeze({ left: 350, width: 180, height: 320, zIndex: 5 }),
  Object.freeze({ left: 525, width: 170, height: 305, zIndex: 4 }),
  Object.freeze({ left: 690, width: 180, height: 330, zIndex: 4 })
]);

/** 复刻地图 team 态：名条和间距先占 32px，图片占满剩余 art 高度。 */
export function partyFigurePartySlotMetrics(slotHeight: number) {
  const footerHeight = PARTY_FIGURE_TEAM_NAME_HEIGHT + PARTY_FIGURE_TEAM_NAME_GAP;
  return {
    figureBottomPercent: footerHeight / slotHeight * 100,
    figureHeightPercent:
      (slotHeight - footerHeight) * PARTY_FIGURE_TEAM_IMAGE_RATIO / slotHeight * 100,
    nameHeightPercent: PARTY_FIGURE_TEAM_NAME_HEIGHT / slotHeight * 100
  };
}

function decimalPlaces(step: number) {
  const source = String(step);
  return source.includes(".") ? source.length - source.indexOf(".") - 1 : 0;
}

function snap(value: number, range: { min: number; max: number; step: number }) {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const snapped = Math.round(clamped / range.step) * range.step;
  const rounded = Number(snapped.toFixed(decimalPlaces(range.step)));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** 输入框也走同一套限幅，避免手输值绕过 range 的 min/max。 */
export function normalizePartyFigureCalibration(
  calibration: PartyFigureCalibration
): PartyFigureCalibration {
  return {
    scale: snap(calibration.scale, PARTY_FIGURE_RANGES.scale),
    x: snap(calibration.x, PARTY_FIGURE_RANGES.x),
    y: snap(calibration.y, PARTY_FIGURE_RANGES.y),
    flipX: Boolean(calibration.flipX)
  };
}

export function clonePartyFigureMap(
  source: PartyFigureCalibrationMap
): PartyFigureCalibrationMap {
  return Object.fromEntries(
    PARTY_FIGURE_IDS.map((id) => [id, { ...source[id] }])
  ) as PartyFigureCalibrationMap;
}

export function samePartyFigureCalibration(
  left: PartyFigureCalibration,
  right: PartyFigureCalibration
) {
  return left.scale === right.scale &&
    left.x === right.x &&
    left.y === right.y &&
    left.flipX === right.flipX;
}

export function getDirtyPartyFigureIds(
  current: PartyFigureCalibrationMap,
  baseline: PartyFigureCalibrationMap
): Set<PartyFigureId> {
  return new Set(
    PARTY_FIGURE_IDS.filter((id) => !samePartyFigureCalibration(current[id], baseline[id]))
  );
}

export function updatePartyFigureCalibration(
  source: PartyFigureCalibrationMap,
  id: PartyFigureId,
  next: PartyFigureCalibration
): PartyFigureCalibrationMap {
  return { ...source, [id]: normalizePartyFigureCalibration(next) };
}

export function togglePartyFigure(
  partyIds: readonly PartyFigureId[],
  id: PartyFigureId
): PartyFigureId[] {
  if (partyIds.includes(id)) return partyIds.filter((current) => current !== id);
  if (partyIds.length >= PARTY_FIGURE_PARTY_LIMIT) return [...partyIds];
  return [...partyIds, id];
}

export function makeInitialPartyFigureLineup(): PartyFigureId[] {
  const firstFour = PARTY_FIGURE_IDS.filter((id) => id !== "kael").slice(0, 4);
  return [...firstFour, "kael"];
}
