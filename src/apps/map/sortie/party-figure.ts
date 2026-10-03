import type { CSSProperties } from "react";
import {
  DEFAULT_PARTY_FIGURE_CALIBRATION,
  partyFigureCalibrations,
  type PartyFigureId
} from "../../../content/characters/partyFigureCalibration";

/** 地图队伍 Q 版立绘的共享校准，交给 CSS 变量：地图上的队伍与名单牌上的立牌
 *  吃同一组值（立牌就是这张立绘刀模切下来的，画布不变）。
 *  校准值以百分数存储；CSS 变量保留单位，避免组件与样式各自解释一遍。 */
export function partyFigureStyle(characterId: string): CSSProperties {
  const calibration =
    partyFigureCalibrations[characterId as PartyFigureId] ??
    DEFAULT_PARTY_FIGURE_CALIBRATION;

  return {
    "--sortie-figure-scale": calibration.scale,
    "--sortie-figure-x": `${calibration.x}%`,
    "--sortie-figure-y": `${calibration.y}%`,
    "--sortie-figure-flip-x": calibration.flipX ? -1 : 1
  } as CSSProperties;
}
