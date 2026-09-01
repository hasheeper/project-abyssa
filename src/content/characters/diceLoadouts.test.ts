import { describe, expect, it } from "vitest";
import { characterDiceLoadouts, findDiceLoadout } from "./diceLoadouts";
import { characterProfiles } from "./profiles";
import {
  CHARM_SLOT_COUNT,
  awakeFaces,
  countSuit
} from "../../shared/domain/dice/face";

const AUTHORED = ["lenore", "abyssa", "eustice"];

describe("character dice loadouts", () => {
  it("covers every archive character exactly once", () => {
    const ids = characterDiceLoadouts.map((loadout) => loadout.characterId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(characterProfiles.map((p) => p.id).sort());
  });

  /* 本期只做两人,其余是占位。占位是正当状态:战斗引擎只认五人。 */
  it("authors two full loadouts and leaves the rest as placeholders", () => {
    for (const loadout of characterDiceLoadouts) {
      if (AUTHORED.includes(loadout.characterId)) {
        expect(loadout.faces).toHaveLength(6);
        expect(loadout.placeholderNote).toBeUndefined();
      } else {
        expect(loadout.faces).toHaveLength(0);
        expect(loadout.placeholderNote).toBeTruthy();
      }
    }
  });

  it("gives every authored die six faces with pips one to six", () => {
    for (const id of AUTHORED) {
      const { faces } = findDiceLoadout(id)!;
      expect([...faces].map((f) => f.face).sort()).toEqual([1, 2, 3, 4, 5, 6]);
      expect([...faces].map((f) => f.pip).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  /* 设计铁律:主色 4 面、副色 2 面。 */
  it("splits every authored die four primary and two secondary suit faces", () => {
    for (const id of AUTHORED) {
      const loadout = findDiceLoadout(id)!;
      expect(loadout.primarySuit).toBeTruthy();
      expect(loadout.secondarySuit).toBeTruthy();
      expect(loadout.primarySuit).not.toBe(loadout.secondarySuit);
      expect(countSuit(loadout.faces, loadout.primarySuit!)).toBe(4);
      expect(countSuit(loadout.faces, loadout.secondarySuit!)).toBe(2);
    }
  });

  /* 两人都在淬火线上,必须有沉眠面 —— 否则「修行痕迹」在版面上就消失了。 */
  it("keeps asleep faces out of hand scoring", () => {
    for (const id of AUTHORED) {
      const { faces } = findDiceLoadout(id)!;
      const asleep = faces.filter((f) => f.fate === "asleep");
      expect(asleep.length).toBeGreaterThan(0);
      expect(awakeFaces(faces)).toHaveLength(6 - asleep.length);
    }
  });

  it("respects the charm slot count and links rewrites to a real charm", () => {
    for (const loadout of characterDiceLoadouts) {
      const charms = loadout.charms ?? [];
      expect(charms.length).toBeLessThanOrEqual(CHARM_SLOT_COUNT);
      expect(new Set(charms.map((c) => c.id)).size).toBe(charms.length);

      for (const face of loadout.faces) {
        if (face.chamedBy) {
          // 改写必须指向真实存在的挂坠,且记录了原值。
          expect(charms.some((c) => c.id === face.chamedBy)).toBe(true);
          expect(face.basePower).toBeDefined();
          expect(face.power).toBeGreaterThan(face.basePower!);
        }
        if (face.basePower !== undefined) expect(face.chamedBy).toBeTruthy();
      }
    }
  });

  /* 尤斯缇丝的六面必须与战斗引擎同源。
     content 不许 import apps(模块边界),所以这里写死引擎的值做镜像断言;
     引擎侧若改了词表,这条会失败,提醒两边同步。
     引擎:src/apps/battle/content/characters.ts:23-34 */
  it("mirrors the battle engine faces for eustice", () => {
    const engine = [
      { pip: 1, action: "attack", power: 1 },
      { pip: 2, action: "attack", power: 2 },
      { pip: 3, action: "attack", power: 2 },
      { pip: 4, action: "attack", power: 3 },
      { pip: 5, action: "guard", power: 2 },
      { pip: 6, action: "blank", power: 0 }
    ];
    const faces = [...findDiceLoadout("eustice")!.faces].sort((a, b) => a.pip - b.pip);

    faces.forEach((face, index) => {
      const ref = engine[index]!;
      expect(face.pip).toBe(ref.pip);
      expect(face.action).toBe(ref.action);
      // 被饰品改写的面比对**原值**,未改写的直接比 power。
      expect(face.basePower ?? face.power).toBe(ref.power);
    });
  });

  /* 勇者小队走鎏金线,四天王走淬火线 —— 两条成长弧在数据上必须能区分:
       勇者:命数生来就醒,只有摆烂面沉眠,战面数值普通
       天王:多面沉眠待淬,战面超模 */
  it("distinguishes the gilding arc from the quenching arc", () => {
    const eustice = findDiceLoadout("eustice")!;
    const abyssa = findDiceLoadout("abyssa")!;

    // 勇者只有一面沉眠,且那面是空面(摆烂面)。
    const eusticeAsleep = eustice.faces.filter((f) => f.fate === "asleep");
    expect(eusticeAsleep).toHaveLength(1);
    expect(eusticeAsleep[0]!.action).toBe("blank");

    // 天王沉眠更多。
    expect(abyssa.faces.filter((f) => f.fate === "asleep").length).toBeGreaterThan(
      eusticeAsleep.length
    );

    // 天王战面超模,勇者不超模。
    const peak = (l: typeof eustice) => Math.max(...l.faces.map((f) => f.power));
    expect(peak(abyssa)).toBeGreaterThan(peak(eustice));

    // 勇者是圣辉主色。
    expect(eustice.primarySuit).toBe("holy");
  });

  /* 两副骰的沉眠数各不相同 —— 这是「修行进度不一样」的可读证据。 */
  it("gives the two authored dice different dormant counts", () => {
    const lenore = findDiceLoadout("lenore")!;
    const abyssa = findDiceLoadout("abyssa")!;
    expect(lenore.faces.filter((f) => f.fate === "asleep")).toHaveLength(2);
    expect(abyssa.faces.filter((f) => f.fate === "asleep")).toHaveLength(3);
    // 魔王战面超模:最高战面必须高于蕾诺尔。
    const peak = (l: typeof lenore) => Math.max(...l.faces.map((f) => f.power));
    expect(peak(abyssa)).toBeGreaterThan(peak(lenore));
  });

  /* 数据里不许出现 emoji —— 上一版 "格挡 2 → 3" 写成了盾牌 emoji。 */
  it("uses plain text rather than pictographs in authored copy", () => {
    const pictographic =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}]/u;
    for (const loadout of characterDiceLoadouts) {
      for (const face of loadout.faces) {
        expect(face.note ?? "").not.toMatch(pictographic);
      }
      for (const charm of loadout.charms ?? []) {
        expect(charm.effect).not.toMatch(pictographic);
        expect(charm.origin ?? "").not.toMatch(pictographic);
        expect(charm.lore ?? "").not.toMatch(pictographic);
      }
      expect(loadout.pact ?? "").not.toMatch(pictographic);
    }
  });
});
