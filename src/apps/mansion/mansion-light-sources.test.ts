import { describe, expect, it } from "vitest";
import { resolveRoomLight } from "./lighting";
import { mansionLightSources, mansionSourceGlowBounds } from "./mansion-light-sources";
import { regionBounds } from "./mansion-geometry";
import { MANSION_NIGHT_LIGHTS } from "./mansion-scenery";

describe("art-aligned mansion light sources", () => {
  it("anchors both fireplaces in the fireboxes rather than the room-centre chimney", () => {
    expect(mansionLightSources("hall")[0]).toMatchObject({x:1601,y:1271});
    expect(mansionLightSources("kaelHut")[0]).toMatchObject({x:3888,y:1181});
    expect(mansionLightSources("hall")[0].y).toBeGreaterThan(1250);
  });

  it("lights the workshop forge even when the self-running workshop is unoccupied", () => {
    for (const occupied of [false,true]) {
      expect(resolveRoomLight("workshop","night",occupied)).toEqual({tone:"hearth",intensity:.9});
    }
    expect(mansionLightSources("workshop")).toEqual([
      {id:"forge",x:1472,y:1525,core:[18,19],reach:[97,89]}
    ]);
  });

  it("keeps all four library flames blue regardless of occupancy", () => {
    expect(resolveRoomLight("library","night",false)?.tone).toBe("blue");
    expect(resolveRoomLight("library","night",true)?.tone).toBe("blue");
    expect(mansionLightSources("library")).toHaveLength(4);
    const array = mansionLightSources("array");
    expect(resolveRoomLight("array","night",true)?.tone).toBe("arcane");
    expect(array.filter(source => source.tone === "blue")).toHaveLength(2);
  });

  it("keeps both greenhouse herbs, with separate blue and gold emission", () => {
    expect(resolveRoomLight("greenhouse","night",false)).not.toBeNull();
    expect(mansionLightSources("greenhouse")).toMatchObject([
      {id:"blue-herb",x:3373,y:1167,tone:"blue"},
      {id:"gold-herb",x:3420,y:1163,tone:"lamp"}
    ]);
    expect(mansionLightSources("greenhouse")).toHaveLength(2);
  });

  it("emits red along the sealed door seam, binding and two rune strips, without another live glow", () => {
    for (const occupied of [false,true]) {
      expect(resolveRoomLight("seal","night",occupied)).toEqual({tone:"arcane",intensity:.76});
    }
    const sources=mansionLightSources("seal");
    expect(sources.map(source=>source.id)).toEqual(["door-seam","chain-binding","west-runes","east-runes"]);
    expect(sources.every(source=>(source.emission ?? 1)>0)).toBe(true);
    const seam=sources[0];
    expect(seam).toMatchObject({x:2763,y:1788});
    expect(seam.core[0]).toBeLessThan(8);
    expect(seam.reach[0]).toBeLessThan(30);
    expect(sources[2].x).toBeLessThan(seam.x);
    expect(sources[3].x).toBeGreaterThan(seam.x);
  });

  it("does not invent fire on the food tray, sewing machine or unlit lookout", () => {
    for (const id of ["plaza","maid","towerTop"]) {
      expect(resolveRoomLight(id,"night",true)).toBeNull();
      expect(mansionLightSources(id)).toHaveLength(0);
    }
  });

  it("leaves non-night phases and unknown source positions untouched", () => {
    for (const phase of ["dawn","day","dusk"] as const) {
      for (const {region} of MANSION_NIGHT_LIGHTS) expect(resolveRoomLight(region.id,phase,true)).toBeNull();
    }
    expect(mansionLightSources("unknown-room")).toHaveLength(0);
  });

  it("keeps every calibrated source inside its room and every reach larger than its core", () => {
    for (const {region} of MANSION_NIGHT_LIGHTS) {
      const bounds = regionBounds(region), sources = mansionLightSources(region.id);
      expect(sources.length).toBeGreaterThan(0);
      expect(new Set(sources.map(source => source.id)).size).toBe(sources.length);
      for (const source of sources) {
        expect(source.x,`${region.id}:${source.id} x`).toBeGreaterThanOrEqual(bounds.left);
        expect(source.x).toBeLessThanOrEqual(bounds.right);
        expect(source.y,`${region.id}:${source.id} y`).toBeGreaterThanOrEqual(bounds.top);
        expect(source.y).toBeLessThanOrEqual(bounds.bottom);
        expect(source.core.every(size => size > 0 && Number.isFinite(size))).toBe(true);
        expect(source.reach[0]).toBeGreaterThan(source.core[0]);
        expect(source.reach[1]).toBeGreaterThan(source.core[1]);
      }
    }
  });

  it("limits the three live glows to small footprints centred on the same baked sources", () => {
    const animated = MANSION_NIGHT_LIGHTS.filter(item => item.light.flicker);
    expect(animated.map(item => item.region.id).sort()).toEqual(["array","hall","kaelHut"]);
    for (const {region} of animated) {
      const source = mansionLightSources(region.id)[0], glow = mansionSourceGlowBounds(source);
      expect(glow.left + glow.width/2).toBe(source.x);
      expect(glow.top + glow.height/2).toBe(source.y);
      expect(glow.width).toBeLessThan(180);
      expect(glow.height).toBeLessThan(180);
    }
  });
});
