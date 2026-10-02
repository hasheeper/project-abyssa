import { GAME_RELEASE, releaseLabel } from "./game-release";

export function ReleaseStamp() {
  const label = releaseLabel();
  return <span aria-label={`游戏版本 ${label}`} title={`提交：${GAME_RELEASE.revision ?? "未知"}`}>{label}</span>;
}
