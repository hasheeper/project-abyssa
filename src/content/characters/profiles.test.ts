import { describe, expect, it } from "vitest";
import { characterProfiles } from "./profiles";

describe("character archive content", () => {
  it("provides the complete non-user character archive roster", () => {
    expect(characterProfiles.map(({ id, number }) => ({ id, number }))).toEqual([
      { id: "eustice", number: "00" },
      { id: "elora", number: "01" },
      { id: "kororo", number: "02" },
      { id: "norma", number: "03" },
      { id: "abyssa", number: "04" },
      { id: "marietta", number: "05" },
      { id: "alvitr", number: "06" },
      { id: "lenore", number: "07" },
      { id: "vivienne", number: "08" }
    ]);

    for (const character of characterProfiles) {
      expect(character.portraitUrl).toMatch(/\.png$/);
      expect(character.portraitAlt).toBe(`${character.name}角色立绘`);
      expect(character.thumbnailUrl).toMatch(/\.png$/);
      expect(character.thumbnailAlt).toBe(`${character.name}头像`);
      expect(character.status.fields).toHaveLength(4);
      /* 六维评级已删除:它既不驱动战斗(引擎只认 FaceDef.power 与 pip),
         也不承载人设。剧情检定的修正值改为隐藏常数,只在检定行现场
         以叙事化标签显示。档案不得把它加回来。 */
      expect(character.status.stats).toBeUndefined();
      expect(character.status.bond).toMatchObject({
        progressMax: 100,
        slots: 5
      });
      expect(character.status.bond?.level).toBeGreaterThanOrEqual(1);
      expect(character.status.bond?.level).toBeLessThanOrEqual(5);
      expect(character.status.bond?.progress).toBeGreaterThanOrEqual(0);
      expect(character.status.bond?.progress).toBeLessThanOrEqual(100);
      expect(character.status.statusChips).toHaveLength(2);
      for (const chip of character.status.statusChips ?? []) {
        expect(chip.icon ?? chip.iconUrl).toBeTruthy();
        if (chip.iconUrl) {
          expect(chip.iconUrl).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?.*)?)/);
        }
      }
      expect(character.status.pact?.currentStage).toBe(character.id === "abyssa" ? 3 : 2);
      expect(character.status.pact?.name).toBeTruthy();
      expect(character.status.pact?.iconUrl).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?.*)?)/);
      expect(character.status.pact?.trigger).toBeTruthy();
      expect(character.status.pact?.currentTerm).toBeTruthy();
      expect(character.status.traits).toHaveLength(2);
      for (const trait of character.status.traits ?? []) {
        expect(trait.iconUrl).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?.*)?)/);
      }
    }
    expect(new Set(characterProfiles.map((character) => character.status.pact?.iconUrl)).size)
      .toBe(characterProfiles.length);
    expect(characterProfiles.find((character) => character.id === "abyssa")?.outfits).toHaveLength(2);
  });
});
