import developmentConfiguration from "../../../config/game-release.json";

export type GameRelease = Readonly<{
  version: string | null;
  stage: "alpha" | "beta" | "stable" | "development";
  revision: string | null;
  builtAt: string | null;
  development: boolean;
}>;

declare const __ABYSSA_GAME_RELEASE__: GameRelease;

export function resolveGameRelease(injected: GameRelease | undefined, development: boolean): GameRelease {
  if (injected) return {...injected};
  const stage = developmentConfiguration.version.includes("-alpha.") ? "alpha"
    : developmentConfiguration.version.includes("-beta.") ? "beta" : "stable";
  return {
    version: development ? developmentConfiguration.version : null,
    stage: development ? stage : "development",
    revision: null,
    builtAt: null,
    development: true
  };
}

export const GAME_RELEASE: GameRelease = Object.freeze(
  resolveGameRelease(typeof __ABYSSA_GAME_RELEASE__ === "undefined" ? undefined : __ABYSSA_GAME_RELEASE__, import.meta.env.DEV)
);

export function releaseLabel(release: GameRelease = GAME_RELEASE) {
  return `${release.version ? `v${release.version}` : "版本未知"}${release.development ? " · 开发版" : ""}`;
}

export function releaseInformation(release: GameRelease = GAME_RELEASE) {
  return [
    `ABYSSA · ${releaseLabel(release)}`,
    `阶段：${release.stage}`,
    `提交：${release.revision ?? "未知"}`,
    `构建时间：${release.builtAt ?? "未知"}`
  ].join("\n");
}

export function withReleaseIdentity(archive: string) {
  const value: unknown = JSON.parse(archive);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid diagnostic export");
  return JSON.stringify({ ...value, exportedBy: GAME_RELEASE }, null, 2);
}
