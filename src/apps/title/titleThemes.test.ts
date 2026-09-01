import { describe, expect, it } from "vitest";
import {
  DEFAULT_TITLE_THEME,
  TITLE_THEMES,
  getNextTitleTheme,
  resolveTitleTheme
} from "./titleThemes";

describe("title themes", () => {
  it("ships exactly the three requested skins", () => {
    expect(TITLE_THEMES.map((theme) => theme.id)).toEqual([
      "crimson",
      "black-gold",
      "verdigris"
    ]);
  });

  it("defaults to crimson because the CG art is measurably crimson", () => {
    // cg-b-1 / cg-b-2 的饱和像素 22.3% / 24.7% 落在 345°..360°,
    // 青蓝区间合计 <0.2%。默认必须与素材一致,否则首屏就在打架。
    expect(DEFAULT_TITLE_THEME).toBe("crimson");
    expect(TITLE_THEMES[0].id).toBe(DEFAULT_TITLE_THEME);
  });

  it("cycles through every skin and returns to the start", () => {
    let id = DEFAULT_TITLE_THEME;
    const seen = [id];
    for (let step = 0; step < TITLE_THEMES.length - 1; step += 1) {
      id = getNextTitleTheme(id);
      seen.push(id);
    }

    expect(new Set(seen).size).toBe(TITLE_THEMES.length);
    expect(getNextTitleTheme(id)).toBe(DEFAULT_TITLE_THEME);
  });

  it("gives every skin a distinct canvas dark enough to sit under the CG", () => {
    const canvases = TITLE_THEMES.map((theme) => theme.canvas);
    expect(new Set(canvases).size).toBe(TITLE_THEMES.length);

    for (const theme of TITLE_THEMES) {
      expect(theme.canvas).toMatch(/^#[0-9a-f]{6}$/);
      // CG 实测暗部是 #010102;画布必须比它更深或相当,否则 CG 会“浮”起来。
      const channels = [1, 3, 5].map((i) => parseInt(theme.canvas.slice(i, i + 2), 16));
      expect(Math.max(...channels)).toBeLessThan(16);
    }
  });

  it("falls back to the first skin for an unknown id", () => {
    expect(resolveTitleTheme("nope" as never).id).toBe(TITLE_THEMES[0].id);
  });

  it("labels every skin in both scripts", () => {
    for (const theme of TITLE_THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.secondaryLabel).toMatch(/^[A-Z ]+$/);
    }
  });
});
