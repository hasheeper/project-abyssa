import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(resolve(import.meta.dirname, "./map.css"), "utf8");
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function pxToken(name: string): number {
  const match = RULES.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`token --${name} not found`);
  return Number(match[1]);
}

describe("map frame layout", () => {
  it("keeps the map trim close to the original visual thickness", () => {
    expect(pxToken("abyssa-map-frame-rail")).toBeLessThan(22);
    expect(pxToken("abyssa-map-frame-mat")).toBeLessThan(38);

    /* 1px 会被 map 的 .78024 和外层 Stage 再次缩小，必须留到 2px。 */
    expect(pxToken("abyssa-map-frame-line")).toBeGreaterThanOrEqual(2);
  });

  it("shrinks the board around the map instead of shrinking the map viewport", () => {
    const board = RULES.match(/\.abyssa-map-wood-frame__board\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(board).toMatch(
      /width:\s*calc\([\s\S]*var\(--abyssa-frame-interior-h\)\s*\*\s*5\s*\/\s*3[\s\S]*var\(--abyssa-map-frame-mat\)\s*\*\s*2/
    );
    expect(board).toMatch(
      /height:\s*calc\([\s\S]*var\(--abyssa-frame-interior-h\)[\s\S]*var\(--abyssa-map-frame-mat\)\s*\*\s*2/
    );
    expect(board).toMatch(/padding:\s*var\(--abyssa-map-frame-mat\)/);
    expect(board).not.toContain("--abyssa-frame-pad-top");
  });

  it("draws an uninterrupted four-sided line inside the clipped rails", () => {
    const railOutline =
      RULES.match(/\.abyssa-map-wood-frame__rails::after\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(railOutline).toMatch(/inset:\s*var\(--abyssa-map-frame-rail\)/);
    expect(railOutline).toMatch(
      /border:\s*var\(--abyssa-map-frame-line\)\s+solid\s+#090603/
    );
    expect((RULES.match(/\[data-edge="(?:top|right|bottom|left)"\]/g) ?? [])).toHaveLength(4);
  });

  it("keeps the viewport perimeter above the team and quest dimmer", () => {
    const vignette = RULES.match(/\.abyssa-map-vignette\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(vignette).toMatch(/z-index:\s*9/);
    expect(vignette).toMatch(
      /box-shadow:[\s\S]*inset 0 0 0 var\(--abyssa-map-frame-line\) #765233/
    );
  });
});
