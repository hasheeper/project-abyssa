import { assertJson, assertJsonStructure, canonicalJson, DATA_LIMITS, invalid, number, record, utf8Size } from "./validation";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type PooledJson = { format: "abyssa-save-pool"; version: 1; pool: Json[]; root: Json };
const marker = "\u0000", reference = `${marker}@`, escape = `${marker}=`;
// Disk/import budget remains 8 MiB. Independently bound materialization of a
// pooled save; this is not a larger budget for ordinary JSON or model responses.
export const SAVE_EXPANDED_BYTES = 64 * 1024 * 1024;
const size = (value: unknown) => utf8Size(JSON.stringify(value));

/** Exact structural/string interning. Persistence MUST retain key insertion
 * order too: historical prompt frames embed JSON.stringify of domain objects. */
export const poolSaveJson = (value: unknown): PooledJson => encodeSaveJson(value, false);
function encodeSaveJson(value: unknown, canonical: boolean): PooledJson {
  assertJsonStructure(value);
  const pool: Json[] = [], indices = new Map<string, number>(), stringSizes = new Map<string, number>();
  let expanded = 0;
  const count = (bytes: number) => {
    expanded += bytes;
    if (expanded > SAVE_EXPANDED_BYTES) invalid("$", "Save expansion size limit exceeded");
  };
  function encode(entry: Json): Json {
    let encoded: Json;
    if (typeof entry === "string") {
      let bytes = stringSizes.get(entry);
      if (bytes === undefined) { bytes = size(entry); stringSizes.set(entry, bytes); }
      count(bytes);
      encoded = entry.startsWith(marker) ? escape + entry : entry;
    } else if (Array.isArray(entry)) {
      count(2 + Math.max(0, entry.length - 1)); encoded = entry.map(encode);
    } else if (entry !== null && typeof entry === "object") {
      const keys = Object.keys(entry); if (canonical) keys.sort(); count(2 + Math.max(0, keys.length - 1));
      encoded = Object.fromEntries(keys.map(key => { count(size(key) + 1); return [key, encode(entry[key])]; }));
    } else { count(size(entry)); encoded = entry; }
    const key = JSON.stringify(encoded);
    if (key.length < 256) return encoded;
    let index = indices.get(key);
    if (index === undefined) { index = pool.length; indices.set(key, index); pool.push(encoded); }
    return reference + index;
  }
  const root = encode(value as Json);
  const result: PooledJson = { format: "abyssa-save-pool", version: 1, pool, root };
  assertJson(result);
  return result;
}

export function isPooledJson(value: unknown): value is PooledJson {
  return !!value && typeof value === "object" && "format" in value && value.format === "abyssa-save-pool";
}

/** Validate reference graph and expanded budgets BEFORE allocating any copies.
 * References only point backward; cycles, forward/missing references and token
 * ambiguity are rejected. Every occurrence gets independent mutable containers. */
export function unpoolSaveJson(value: unknown): unknown {
  assertJson(value);
  const envelope = record(value, "pooledSave", ["format", "version", "pool", "root"]);
  if (envelope.format !== "abyssa-save-pool" || envelope.version !== 1 || !Array.isArray(envelope.pool)) invalid("pooledSave", "Unknown save encoding");
  const pool = envelope.pool as Json[];
  type Cost = { bytes: number; nodes: number; depth: number };
  const costs: Cost[] = [];
  function token(entry: string, before: number): number | string {
    if (!entry.startsWith(marker)) return entry;
    if (entry.startsWith(escape + marker)) return entry.slice(escape.length);
    if (!/^\u0000@(0|[1-9]\d*)$/.test(entry)) invalid("pooledSave", "Invalid save reference token");
    return number(Number(entry.slice(reference.length)), "pooledSave.reference", 0, before - 1);
  }
  function measure(entry: Json, before: number): Cost {
    if (typeof entry === "string") {
      const result = token(entry, before);
      return typeof result === "number" ? costs[result] : { bytes: size(result), nodes: 1, depth: 0 };
    }
    const children = Array.isArray(entry) ? entry : entry && typeof entry === "object" ? Object.values(entry) : null;
    if (!children) return { bytes: size(entry), nodes: 1, depth: 0 };
    const cost = { bytes: 2 + Math.max(0, children.length - 1), nodes: 1, depth: 0 };
    if (!Array.isArray(entry)) cost.bytes += Object.keys(entry!).reduce((n, key) => n + size(key) + 1, 0);
    for (const child of children) {
      const next = measure(child, before);
      cost.bytes += next.bytes; cost.nodes += next.nodes; cost.depth = Math.max(cost.depth, next.depth + 1);
      check(cost);
    }
    return cost;
  }
  function check(cost: Cost) {
    if (cost.bytes > SAVE_EXPANDED_BYTES || cost.nodes > DATA_LIMITS.nodes || cost.depth > DATA_LIMITS.depth) invalid("pooledSave", "Save expansion limit exceeded");
  }
  pool.forEach((entry, index) => {
    // Encoder never emits reference-only dictionary entries. Reject aliases so
    // a tiny semantic tree cannot hide an arbitrarily deep reference chain.
    if (typeof entry === "string" && typeof token(entry, index) === "number") invalid("pooledSave", "Reference-only dictionary entry");
    const cost = measure(entry, index); check(cost); costs.push(cost);
  });
  check(measure(envelope.root as Json, pool.length));
  function decode(entry: Json, before: number): Json {
    if (typeof entry === "string") {
      const result = token(entry, before);
      return typeof result === "number" ? decode(pool[result], result) : result;
    }
    if (Array.isArray(entry)) return entry.map(child => decode(child, before));
    return entry && typeof entry === "object" ? Object.fromEntries(Object.entries(entry).map(([key, child]) => [key, decode(child, before)])) : entry;
  }
  return decode(envelope.root as Json, pool.length);
}

/** Comparison/fingerprint of pooled saves, not a replacement for model/request
 * canonicalization. Its versioned representation is stable across key ordering. */
export const canonicalSaveJson = (value: unknown): string => canonicalJson(encodeSaveJson(value, true));
