export const ABYSSA_LOGO_PARTS = [
  "stamp",
  "sideOrnaments",
  "titleTop",
  "titleMiddle",
  "titleBottom",
  "questionMark",
  "divider",
  "wordmark"
] as const;

export type AbyssaLogoPartId = (typeof ABYSSA_LOGO_PARTS)[number];

export interface AbyssaLogoPartTransform {
  /** Horizontal offset in SVG view-box units. */
  x: number;
  /** Vertical offset in SVG view-box units. */
  y: number;
  /** Scale around the part's visual centre. */
  scale: number;
  /** Rotation in degrees around the part's visual centre. */
  rotate: number;
  opacity: number;
}

export type AbyssaLogoLayout = Record<AbyssaLogoPartId, AbyssaLogoPartTransform>;

export const ABYSSA_LOGO_PART_LABELS: Record<AbyssaLogoPartId, string> = {
  stamp: "背景图章",
  sideOrnaments: "两侧短线",
  titleTop: "标题第一行",
  titleMiddle: "标题第二行",
  titleBottom: "标题第三行",
  questionMark: "问号与红菱形",
  divider: "中央分隔线",
  wordmark: "底部英文字标"
};

export const DEFAULT_ABYSSA_LOGO_LAYOUT: AbyssaLogoLayout = {
  stamp: { x: 0, y: 0, scale: 1.16, rotate: 0, opacity: 0.37 },
  sideOrnaments: { x: 0, y: -4, scale: 1, rotate: 0, opacity: 1 },
  titleTop: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
  titleMiddle: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
  titleBottom: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
  questionMark: { x: 24, y: 21, scale: 1, rotate: 0, opacity: 1 },
  divider: { x: 0, y: 13, scale: 0.75, rotate: 0, opacity: 1 },
  wordmark: { x: 0, y: -3, scale: 1.03, rotate: 0, opacity: 1 }
};

export function cloneAbyssaLogoLayout(layout: AbyssaLogoLayout = DEFAULT_ABYSSA_LOGO_LAYOUT): AbyssaLogoLayout {
  return Object.fromEntries(
    ABYSSA_LOGO_PARTS.map((id) => [id, { ...layout[id] }])
  ) as AbyssaLogoLayout;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Accepts a partial/older snapshot and fills invalid or missing fields from the
 * defaults. Unknown keys are deliberately ignored so exported files stay safe
 * to import after the component gains more parts.
 */
export function normalizeAbyssaLogoLayout(value: unknown): AbyssaLogoLayout {
  const root = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const source = root.layout && typeof root.layout === "object"
    ? (root.layout as Record<string, unknown>)
    : root;

  return Object.fromEntries(ABYSSA_LOGO_PARTS.map((id) => {
    const fallback = DEFAULT_ABYSSA_LOGO_LAYOUT[id];
    const raw = source[id] && typeof source[id] === "object"
      ? (source[id] as Record<string, unknown>)
      : {};
    return [id, {
      x: finite(raw.x, fallback.x),
      y: finite(raw.y, fallback.y),
      scale: finite(raw.scale, fallback.scale),
      rotate: finite(raw.rotate, fallback.rotate),
      opacity: finite(raw.opacity, fallback.opacity)
    }];
  })) as AbyssaLogoLayout;
}

export function parseAbyssaLogoLayout(text: string): AbyssaLogoLayout {
  return normalizeAbyssaLogoLayout(JSON.parse(text));
}

export function formatAbyssaLogoLayoutJson(layout: AbyssaLogoLayout): string {
  return JSON.stringify({ version: 1, layout: normalizeAbyssaLogoLayout(layout) }, null, 2);
}

export function formatAbyssaLogoLayoutTs(layout: AbyssaLogoLayout): string {
  return [
    'import type { AbyssaLogoLayout } from "@abyssa/ui";',
    "",
    "export const LOGO_LAYOUT: AbyssaLogoLayout = ",
    `${JSON.stringify(normalizeAbyssaLogoLayout(layout), null, 2)};`
  ].join("\n");
}
