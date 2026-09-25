import type { CSSProperties } from "react";

export type ShopEntranceProfile = "standard" | "handoff";
export const SHOP_REVEAL_MS = 240;
const scores = {
  standard: {
    scene: [0, 1040], counter: [0, 760], material: [0, 200], foreground: [0, 1000],
    navigation: [60, 620], banner: [100, 700], sign: [220, 580], commands: [280, 360],
    actor: [220, 700], balances: [380, 320], categories: [320, 300], meta: [480, 300],
    rows: [320, 360], emblem: [420, 480], copy: [480, 400], checkout: [600, 380], nameplate: [600, 360],
    commandStep: 60, rowStep: 36, travel: 1, sceneScale: 1.024, rest: 80,
  },
  handoff: {
    scene: [0, 400], counter: [0, 360], material: [0, 120], foreground: [0, 400],
    navigation: [0, 320], banner: [0, 340], sign: [20, 320], commands: [80, 200],
    actor: [0, 320], balances: [100, 260], categories: [80, 260], meta: [140, 220],
    rows: [120, 220], emblem: [120, 240], copy: [150, 230], checkout: [200, 240], nameplate: [160, 240],
    commandStep: 24, rowStep: 16, travel: .3, sceneScale: 1, rest: 40,
  },
} as const;
const tracks = ["scene", "counter", "material", "foreground", "navigation", "banner", "sign", "commands", "actor",
  "balances", "categories", "meta", "rows", "emblem", "copy", "checkout", "nameplate"] as const;

/** One score controls CSS and completion. Staggers are capped to the seven visible rows. */
export function shopEntrance(profile: ShopEntranceProfile) {
  const score = scores[profile];
  const variables: Record<string, string | number> = {
    "--shop-reveal-duration": `${SHOP_REVEAL_MS}ms`, "--entrance-travel": score.travel, "--entrance-scene-scale": score.sceneScale,
  };
  const ends = tracks.map(track => {
    const [delay, duration] = score[track];
    variables[`--entrance-${track}-delay`] = `${delay}ms`;
    variables[`--entrance-${track}-duration`] = `${duration}ms`;
    return delay + duration + (track === "rows" ? 6 * score.rowStep : track === "commands" ? 2 * score.commandStep : 0);
  });
  variables["--entrance-command-step"] = `${score.commandStep}ms`;
  variables["--entrance-row-step"] = `${score.rowStep}ms`;
  return {durationMs: Math.max(...ends) + score.rest, style: variables as CSSProperties};
}

export const shopEntranceKeys = ["Tab", "Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
