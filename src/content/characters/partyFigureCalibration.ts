/**
 * 地图队伍 Q 版立绘的共享调校契约。
 *
 * x / y 使用百分数本身：4 表示 4%，不是 0.04。
 * 正 x 向右，正 y 向上；渲染端应以脚底中心（50% 100%）为变换原点。
 * 本文件不依赖任何 app 或 tool，地图和调校工作台共同消费这里的数据。
 */

export const PARTY_FIGURE_IDS = [
  "abyssa",
  "alvitr",
  "elora",
  "eustice",
  "kael",
  "kororo",
  "lenore",
  "marietta",
  "norma",
  "vivienne"
] as const;

export type PartyFigureId = (typeof PARTY_FIGURE_IDS)[number];

export interface PartyFigureCalibration {
  scale: number;
  x: number;
  y: number;
  flipX: boolean;
}

export type PartyFigureCalibrationMap = Record<PartyFigureId, PartyFigureCalibration>;

export type ReadonlyPartyFigureCalibrationMap = {
  readonly [Id in PartyFigureId]: Readonly<PartyFigureCalibration>;
};

export interface PartyFigureCalibrationRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export type PartyFigureCalibrationValidationResult =
  | { readonly ok: true; readonly value: PartyFigureCalibrationMap }
  | { readonly ok: false; readonly errors: readonly string[] };

export const PARTY_FIGURE_CALIBRATION_LIMITS = Object.freeze({
  scale: Object.freeze({ min: 0.75, max: 1.25, step: 0.01 }),
  x: Object.freeze({ min: -15, max: 15, step: 0.5 }),
  y: Object.freeze({ min: -15, max: 15, step: 0.5 })
}) satisfies Readonly<Record<"scale" | "x" | "y", PartyFigureCalibrationRange>>;

export const DEFAULT_PARTY_FIGURE_CALIBRATION = Object.freeze({
  scale: 1,
  x: 0,
  y: 0,
  flipX: false
}) satisfies Readonly<PartyFigureCalibration>;

const PARTY_FIGURE_ID_SET: ReadonlySet<string> = new Set(PARTY_FIGURE_IDS);
const CALIBRATION_KEYS = ["scale", "x", "y", "flipX"] as const;
const CALIBRATION_KEY_SET: ReadonlySet<string> = new Set(CALIBRATION_KEYS);
const TYPESCRIPT_EXPORT_PATTERN = /(?:^|\n)\s*export\s+const\s+partyFigureCalibrations\s*=/m;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freezeCalibrationMap(
  source: PartyFigureCalibrationMap
): ReadonlyPartyFigureCalibrationMap {
  for (const id of PARTY_FIGURE_IDS) Object.freeze(source[id]);
  return Object.freeze(source);
}

function makeDefaultCalibrationMap(): PartyFigureCalibrationMap {
  return Object.fromEntries(
    PARTY_FIGURE_IDS.map((id) => [id, { ...DEFAULT_PARTY_FIGURE_CALIBRATION }])
  ) as PartyFigureCalibrationMap;
}

export const defaultPartyFigureCalibrations = freezeCalibrationMap(
  makeDefaultCalibrationMap()
);

/** 地图与工作台共同使用的已审定默认基线。 */
export const partyFigureCalibrations = freezeCalibrationMap({
  abyssa: { scale: 0.98, x: 0, y: -2.5, flipX: false },
  alvitr: { scale: 1.11, x: 4, y: 0, flipX: true },
  elora: { scale: 1, x: 5.5, y: 0, flipX: true },
  eustice: { scale: 1, x: 0, y: 0, flipX: false },
  kael: { scale: 0.97, x: 0, y: 0, flipX: false },
  kororo: { scale: 1.03, x: 0, y: 0, flipX: true },
  lenore: { scale: 0.96, x: 0, y: 0, flipX: false },
  marietta: { scale: 0.96, x: 0, y: 0, flipX: false },
  norma: { scale: 0.92, x: -2.5, y: 0, flipX: false },
  vivienne: { scale: 1.02, x: 0, y: 0, flipX: false }
});

export function clonePartyFigureCalibrations(
  source: ReadonlyPartyFigureCalibrationMap = partyFigureCalibrations
): PartyFigureCalibrationMap {
  return Object.fromEntries(
    PARTY_FIGURE_IDS.map((id) => {
      const value = source[id];
      return [id, {
        scale: value.scale,
        x: value.x,
        y: value.y,
        flipX: value.flipX
      }];
    })
  ) as PartyFigureCalibrationMap;
}

function validateNumber(
  value: unknown,
  path: string,
  range: PartyFigureCalibrationRange,
  errors: string[]
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
    return;
  }
  if (value < range.min || value > range.max) {
    errors.push(`${path} must be between ${range.min} and ${range.max}`);
  }
}

export function validatePartyFigureCalibrationMap(
  value: unknown
): PartyFigureCalibrationValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["calibrations must be an object"] };
  }

  for (const key of Object.keys(value)) {
    if (!PARTY_FIGURE_ID_SET.has(key)) errors.push(`unknown character id: ${key}`);
  }

  for (const id of PARTY_FIGURE_IDS) {
    const entry = value[id];
    if (!isRecord(entry)) {
      errors.push(`${id} must be an object`);
      continue;
    }

    for (const key of Object.keys(entry)) {
      if (!CALIBRATION_KEY_SET.has(key)) errors.push(`${id}.${key} is not supported`);
    }
    for (const key of CALIBRATION_KEYS) {
      if (!(key in entry)) errors.push(`${id}.${key} is required`);
    }

    validateNumber(entry.scale, `${id}.scale`, PARTY_FIGURE_CALIBRATION_LIMITS.scale, errors);
    validateNumber(entry.x, `${id}.x`, PARTY_FIGURE_CALIBRATION_LIMITS.x, errors);
    validateNumber(entry.y, `${id}.y`, PARTY_FIGURE_CALIBRATION_LIMITS.y, errors);
    if (typeof entry.flipX !== "boolean") errors.push(`${id}.flipX must be a boolean`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: clonePartyFigureCalibrations(value as PartyFigureCalibrationMap)
  };
}

export function isPartyFigureCalibrationMap(
  value: unknown
): value is PartyFigureCalibrationMap {
  return validatePartyFigureCalibrationMap(value).ok;
}

export function assertPartyFigureCalibrationMap(
  value: unknown
): asserts value is PartyFigureCalibrationMap {
  const result = validatePartyFigureCalibrationMap(value);
  if (!result.ok) {
    throw new Error(`Invalid party figure calibrations: ${result.errors.join("; ")}`);
  }
}

function orderedCalibrationMap(
  source: ReadonlyPartyFigureCalibrationMap
): PartyFigureCalibrationMap {
  assertPartyFigureCalibrationMap(source);
  return clonePartyFigureCalibrations(source);
}

export function stringifyPartyFigureCalibrationJson(
  source: ReadonlyPartyFigureCalibrationMap = partyFigureCalibrations
): string {
  return `${JSON.stringify(orderedCalibrationMap(source), null, 2)}\n`;
}

export function parsePartyFigureCalibrationJson(
  source: string
): PartyFigureCalibrationMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid party figure calibration JSON: ${message}`);
  }
  assertPartyFigureCalibrationMap(parsed);
  return clonePartyFigureCalibrations(parsed);
}

export function stringifyPartyFigureCalibrationTypeScript(
  source: ReadonlyPartyFigureCalibrationMap = partyFigureCalibrations
): string {
  const json = stringifyPartyFigureCalibrationJson(source).trimEnd();
  return `export const partyFigureCalibrations = ${json} as const;\n`;
}

function extractExportedJsonObject(source: string): string {
  const exportMatch = TYPESCRIPT_EXPORT_PATTERN.exec(source);
  if (!exportMatch) {
    throw new Error("TypeScript export must declare partyFigureCalibrations");
  }

  const objectStart = source.indexOf("{", exportMatch.index + exportMatch[0].length);
  if (objectStart < 0) throw new Error("TypeScript export is missing its object literal");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(objectStart, index + 1);
    }
  }

  throw new Error("TypeScript export has an unterminated object literal");
}

export function parsePartyFigureCalibrationTypeScript(
  source: string
): PartyFigureCalibrationMap {
  return parsePartyFigureCalibrationJson(extractExportedJsonObject(source));
}
