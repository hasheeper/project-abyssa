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
      expect(character.status.stats).toHaveLength(6);
      expect(character.status.traits).toHaveLength(2);
      for (const trait of character.status.traits ?? []) {
        expect(trait.iconUrl).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?.*)?)/);
      }
    }
    expect(characterProfiles.find((character) => character.id === "abyssa")?.outfits).toHaveLength(2);
  });
});
