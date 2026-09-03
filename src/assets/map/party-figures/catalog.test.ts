import { describe, expect, it } from "vitest";
import { PARTY_FIGURE_IDS } from "../../../content/characters/partyFigureCalibration";
import { partyFigureCatalog, partyFigureCatalogById } from "./catalog";

describe("party figure catalog", () => {
  it("maps every shared id to one named PNG and excludes Tibby", () => {
    expect(partyFigureCatalog.map(({ id }) => id)).toEqual(PARTY_FIGURE_IDS);
    expect(new Set(partyFigureCatalog.map(({ id }) => id)).size).toBe(10);
    expect(partyFigureCatalog.map(({ id }) => id)).not.toContain("tibby");

    for (const entry of partyFigureCatalog) {
      expect(entry.name).toBeTruthy();
      expect(entry.url).toMatch(/\.png(?:\?.*)?$/);
      expect(partyFigureCatalogById[entry.id]).toBe(entry);
    }
    expect(partyFigureCatalogById.kael.name).toBe("凯尔");
  });
});
