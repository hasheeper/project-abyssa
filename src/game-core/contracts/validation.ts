/** Explicit limits bound imported JSON before recursive schema/reference validation. */
export const DATA_LIMITS = {
  characters: 8 * 1024 * 1024,
  bytes: 8 * 1024 * 1024,
  nodes: 300_000,
  depth: 40,
  collection: 4096,
  checkpoints: 256,
} as const;

export class DataValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "DataValidationError";
  }
}

export function invalid(
  path: string,
  message: string,
  code = "malformed",
): never {
  throw new DataValidationError(code, path, message);
}

export function record(
  value: unknown,
  path: string,
  required: readonly string[] = [],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid(path, "Expected object");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    invalid(path, "Expected plain JSON object");
  const object = value as Record<string, unknown>;
  for (const key of required)
    if (!Object.hasOwn(object, key)) invalid(`${path}.${key}`, "Missing field");
  for (const key of Object.keys(object)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      invalid(`${path}.${key}`, "Reserved key");
    if (
      (required.length || optional.length) &&
      !required.includes(key) &&
      !optional.includes(key)
    )
      invalid(`${path}.${key}`, "Unknown field");
  }
  return object;
}

export function text(
  value: unknown,
  path: string,
  max = 4096,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.length)
  )
    invalid(path, "Invalid string");
  return value;
}

export function id(value: unknown, path: string): string {
  const result = text(value, path, 160);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(result) ||
    ["__proto__", "constructor", "prototype"].includes(result)
  )
    invalid(path, "Invalid ID");
  return result;
}

export function number(
  value: unknown,
  path: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = true,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    invalid(path, "Number outside allowed range");
  return value;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(path, "Expected boolean");
  return value;
}

export function choice<T extends string | number>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (!values.includes(value as T))
    invalid(path, `Expected one of ${values.join(", ")}`);
  return value as T;
}

export function list(
  value: unknown,
  path: string,
  max: number = DATA_LIMITS.collection,
): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    invalid(path, "Invalid array size");
  return value;
}

export function ids(
  value: unknown,
  path: string,
  max: number = DATA_LIMITS.collection,
): string[] {
  const result = list(value, path, max).map((entry, i) =>
    id(entry, `${path}[${i}]`),
  );
  if (new Set(result).size !== result.length) invalid(path, "Duplicate IDs");
  return result;
}

export function reference<T>(
  table: Readonly<Record<string, T>>,
  value: unknown,
  path: string,
): T {
  const key = id(value, path);
  if (!Object.hasOwn(table, key))
    invalid(path, `Unknown ID: ${key}`, "unknown-content");
  return table[key];
}

export function utf8Size(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function assertJson(value: unknown): void {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(entry: unknown, path: string, depth: number): void {
    if (++nodes > DATA_LIMITS.nodes || depth > DATA_LIMITS.depth)
      invalid(path, "JSON complexity limit exceeded");
    if (entry === null || typeof entry === "boolean") return;
    if (typeof entry === "string") {
      text(entry, path, DATA_LIMITS.characters, true);
      return;
    }
    if (typeof entry === "number") {
      number(
        entry,
        path,
        -Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        false,
      );
      return;
    }
    if (typeof entry !== "object") invalid(path, "Expected JSON value");
    if (ancestors.has(entry)) invalid(path, "Circular JSON value");
    ancestors.add(entry);
    if (Array.isArray(entry)) {
      list(entry, path, DATA_LIMITS.nodes).forEach((child, i) =>
        visit(child, `${path}[${i}]`, depth + 1),
      );
    } else {
      for (const [key, child] of Object.entries(record(entry, path)))
        visit(child, `${path}.${key}`, depth + 1);
    }
    ancestors.delete(entry);
  }
  visit(value, "$", 0);
  if (utf8Size(JSON.stringify(value)) > DATA_LIMITS.bytes)
    invalid("$", "JSON size limit exceeded");
}

export function parseJson(serialized: string): unknown {
  if (
    typeof serialized !== "string" ||
    serialized.length > DATA_LIMITS.characters ||
    utf8Size(serialized) > DATA_LIMITS.bytes
  )
    invalid("$", "JSON size limit exceeded");
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    invalid("$", "Invalid JSON");
  }
  assertJson(value);
  return value;
}

/** Canonical key ordering for content fingerprints and idempotency, not state serialization. */
export function canonicalJson(value: unknown): string {
  assertJson(value);
  function encode(entry: unknown): string {
    if (Array.isArray(entry)) return `[${entry.map(encode).join(",")}]`;
    if (entry !== null && typeof entry === "object")
      return `{${Object.keys(entry)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${encode((entry as Record<string, unknown>)[key])}`,
        )
        .join(",")}}`;
    return JSON.stringify(entry);
  }
  return encode(value);
}

export function freezeData<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
