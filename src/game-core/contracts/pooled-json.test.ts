import { describe, expect, it } from "vitest";
import { assertJson, DATA_LIMITS } from "./validation";
import { canonicalSaveJson, poolSaveJson, unpoolSaveJson, SAVE_EXPANDED_BYTES, type PooledJson } from "./pooled-json";

describe("lossless save pooling", () => {
  it("deduplicates exact cards, frames and subtrees without editing even whitespace", () => {
    const card = { id: "actor", text: " 原卡\n\n「テスト（测试）」 \t".repeat(200) }, frame = { cards: [card], context: { facts: ["already read"] } };
    const raw = { original: frame, retry: structuredClone(frame), output: "正文  \n\n", empty: [null, {}, []], token: "\0@0", escaped: "\0=\0@2" };
    const pooled = poolSaveJson(raw);
    expect(JSON.stringify(pooled).length).toBeLessThan(JSON.stringify(raw).length * .7);
    const decoded = unpoolSaveJson(pooled) as typeof raw;
    expect(decoded).toEqual(raw);
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(raw));
    decoded.retry.cards[0].text = "changed";
    expect(decoded.original.cards[0].text).toBe(card.text);
    expect(raw.retry.cards[0].text).toBe(card.text);
  });
  it("keeps deterministic fingerprints across key insertion orders", () => {
    expect(canonicalSaveJson({b: {z: 1, a: "x".repeat(500)}, a: true})).toBe(canonicalSaveJson({a: true, b: {a: "x".repeat(500), z: 1}}));
  });
  it("charges repeated source once, while ordinary JSON still rejects >8 MiB", () => {
    const card = "界".repeat(700_000), raw = [card, card, card, card, card];
    expect(() => assertJson(raw)).toThrow("JSON size limit");
    const pooled = poolSaveJson(raw);
    expect(new TextEncoder().encode(JSON.stringify(pooled)).length).toBeLessThan(DATA_LIMITS.bytes);
    expect(unpoolSaveJson(pooled)).toEqual(raw);
  });
  it("rejects unique content over the unchanged physical budget", () => {
    expect(() => poolSaveJson("界".repeat(3_000_000))).toThrow("JSON size limit");
  });
  it.each(["\0@0", "\0@1", "\0@-1", "\0@01", "\0=x"])('rejects invalid/forward/circular token %j', token => {
    expect(() => unpoolSaveJson({format: "abyssa-save-pool", version: 1, pool: [[token]], root: "\0@0"})).toThrow();
  });
  it("preflights expansion bombs before materializing referenced copies", () => {
    const pooled: PooledJson = {format: "abyssa-save-pool", version: 1, pool: ["x".repeat(1_000_000)], root: Array.from({length: Math.ceil(SAVE_EXPANDED_BYTES / 1_000_000) + 1}, () => "\0@0")};
    expect(() => unpoolSaveJson(pooled)).toThrow("expansion limit");
    const dag: PooledJson = {format: "abyssa-save-pool", version: 1, pool: [[]], root: "\0@19"};
    for (let i = 1; i < 20; i++) dag.pool.push([`\0@${i-1}`, `\0@${i-1}`]);
    expect(() => unpoolSaveJson(dag)).toThrow("expansion limit");
  });
  it("retains structural JSON validation and rejects malicious dictionary keys", () => {
    const loop: unknown[] = []; loop.push(loop);
    expect(() => poolSaveJson(loop)).toThrow("Circular");
    expect(() => poolSaveJson({invalid: undefined})).toThrow("Expected JSON");
    expect(() => unpoolSaveJson(JSON.parse('{"format":"abyssa-save-pool","version":1,"pool":[],"root":{"__proto__":{}}}'))).toThrow("Reserved key");
    expect(() => unpoolSaveJson({format: "abyssa-save-pool", version: 2, pool: [], root: null})).toThrow("Unknown save encoding");
    expect(() => unpoolSaveJson({format: "abyssa-save-pool", version: 1, pool: ["x", "\0@0"], root: "\0@1"})).toThrow("Reference-only");
  });
});
