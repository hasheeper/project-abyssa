import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { characterChronicles, findChronicle } from "./chronicles";
import { characterProfiles } from "./profiles";
import {
  CHRONICLE_CATEGORIES,
  CHRONICLE_MARKERS,
  countChronicleEntries
} from "../../shared/domain/characters/chronicle";

const SOURCE = readFileSync(
  resolve(import.meta.dirname, "./chronicles.ts"),
  "utf8"
);

/** 已录入记事的角色。其余为占位。 */
const AUTHORED = ["lenore", "abyssa", "eustice"];

describe("character chronicles", () => {
  it("covers every archived character exactly once", () => {
    const ids = characterChronicles.map((entry) => entry.characterId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(
      [...characterProfiles.map((profile) => profile.id)].sort()
    );
  });

  it("authors three chronicles and leaves the rest as placeholders", () => {
    for (const id of AUTHORED) {
      const chronicle = findChronicle(id);
      expect(chronicle?.blocks.length, id).toBeGreaterThan(0);
    }

    for (const profile of characterProfiles) {
      if (AUTHORED.includes(profile.id)) continue;
      const chronicle = findChronicle(profile.id);
      expect(chronicle?.blocks, profile.id).toEqual([]);
      // 占位说明各写各的，不用同一句套话。
      expect(chronicle?.placeholderNote, profile.id).toBeTruthy();
    }

    const notes = characterChronicles
      .filter((entry) => entry.blocks.length === 0)
      .map((entry) => entry.placeholderNote);
    expect(new Set(notes).size).toBe(notes.length);
  });

  /* 三副样稿必须把版式与筛选的各种形态都撑出来，否则看不出排版对不对。 */
  it("exercises every marker, category, and both block kinds", () => {
    const blocks = AUTHORED.flatMap((id) => findChronicle(id)!.blocks);

    const kinds = new Set(blocks.map((block) => block.kind));
    expect(kinds).toEqual(new Set(["chapter", "entry"]));

    const markers = new Set(
      blocks
        .filter((block) => block.kind === "entry")
        .map((block) => (block.kind === "entry" ? block.marker ?? "node" : "node"))
    );
    for (const marker of CHRONICLE_MARKERS) {
      expect(markers, `样稿没有覆盖 ${marker}`).toContain(marker);
    }

    const entries = blocks.filter((block) => block.kind === "entry");
    const categories = new Set(
      entries.flatMap((entry) =>
        entry.kind === "entry" ? entry.categories ?? ["daily"] : []
      )
    );
    for (const category of CHRONICLE_CATEGORIES) {
      expect(categories, `样稿没有覆盖 ${category}`).toContain(category);
    }

    // 当前编年史只写现行结果，不再陈列旧条款；引语仍需有样例。
    expect(entries.some((e) => e.kind === "entry" && e.struck)).toBe(false);
    expect(entries.some((e) => e.kind === "entry" && e.voice)).toBe(true);
  });

  it("uses compact volume stamps and normalized day stamps", () => {
    for (const id of AUTHORED) {
      for (const block of findChronicle(id)!.blocks) {
        if (block.kind === "chapter") {
          expect(block.stamp).toMatch(/^卷[一二三四五六七八九十]+$/);
        } else {
          expect(block.stamp).toMatch(/^DAY \d{2}$/);
          expect(block.categories?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives every block a unique id within its character", () => {
    for (const chronicle of characterChronicles) {
      const ids = chronicle.blocks.map((block) => block.id);
      expect(new Set(ids).size, chronicle.characterId).toBe(ids.length);
    }
  });

  /* ============ 不记金币 ============
     饰品的当前状态骰装页已完整呈现(charm.origin 连购入来源都写着)。
     再记一遍「花了多少里拉」既不驱动战斗也不承载人设 ——
     与被删掉的六维评级同类。 */
  it("records no currency flow", () => {
    const strip = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const body = strip(SOURCE);

    expect(body).not.toMatch(/里拉|晶石|金币/);
    for (const chronicle of characterChronicles) {
      for (const block of chronicle.blocks) {
        const text = [
          block.title,
          block.kind === "entry" ? block.body : undefined,
          block.kind === "entry" ? block.voice : undefined
        ]
          .filter(Boolean)
          .join(" ");
        expect(text).not.toMatch(/里拉/);
      }
    }
  });

  /* 样稿不该与概要页互相矛盾:徽标里出现的 Lv.N 不超过该角色的 bond.level。
     这是**内容层的自觉**,断言只看样稿自己 —— 不把两个文件焊死,
     机制变了改内容即可。 */
  it("keeps sample badges within each character's archived bond level", () => {
    for (const id of AUTHORED) {
      const profile = characterProfiles.find((entry) => entry.id === id)!;
      const ceiling = profile.status.bond?.level ?? 0;
      const levels = findChronicle(id)!
        .blocks.flatMap((block) =>
          block.kind === "entry" && block.badge ? [block.badge] : []
        )
        .flatMap((badge) => {
          const match = /^羁绊 Lv\.(\d+)$/.exec(badge);
          return match ? [Number(match[1])] : [];
        });

      expect(levels.length, id).toBeGreaterThan(0);
      expect(Math.max(...levels), id).toBeLessThanOrEqual(ceiling);
    }
  });

  it("counts entries without counting chapter rules", () => {
    const lenore = findChronicle("lenore")!;
    const chapters = lenore.blocks.filter((b) => b.kind === "chapter").length;
    expect(countChronicleEntries(lenore.blocks)).toBe(
      lenore.blocks.length - chapters
    );
  });
});
