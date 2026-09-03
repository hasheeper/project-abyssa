import type { CSSProperties } from "react";
import broadswordIcon from "../../../assets/svg/items/game-icons/broadsword.svg";
import swapBagIcon from "../../../assets/svg/items/game-icons/swap-bag.svg";
import mineralsIcon from "../../../assets/svg/items/game-icons/minerals.svg";
import splitCrossIcon from "../../../assets/svg/6-0-split-cross.svg";
import crossShieldIcon from "../../../assets/svg/ui/game-icon-cross-shield.svg";
import hospitalCrossIcon from "../../../assets/svg/ui/game-icon-hospital-cross.svg";
import magicPalmIcon from "../../../assets/svg/ui/game-icon-magic-palm.svg";
import slashedShieldIcon from "../../../assets/svg/ui/slashed-shield.svg";
import type { DieFaceAction } from "../../../shared/domain/dice/face";
import type { QuestSpoil } from "./sortie-quests";

/* 图标一律走 CSS mask，不用 <img> —— 才能被令牌色着色，
   也才不会出现「用文字符号当图标」。骨架稿里的 ⚔🛡⚕💰○ 全部映射到这里。

   来源与 ExpeditionFlatDieFrame 的 STAMP_ICONS 同一批 SVG（该常量未导出，
   所以这里重新 import 同名文件）。两处必须同源，否则六面展开图上的印记
   与构成表里的图标会是两套画风。 */
export const SORTIE_ACTION_ICONS: Record<DieFaceAction, string> = {
  attack: broadswordIcon,
  guard: crossShieldIcon,
  heal: hospitalCrossIcon,
  coin: swapBagIcon,
  art: magicPalmIcon,
  wild: splitCrossIcon,
  blank: slashedShieldIcon
};

/* 只有素材需要 mask 图标。
   金币与晶石走 .abyssa-currency-amount 的货币形制 —— 那是全仓库统一的
   货币长相（商店、枢纽顶栏都在用），收益行另找 game-icons 会让
   同一种货币在两处呈现两种样子。 */
export const SORTIE_SPOIL_ICONS: Pick<Record<QuestSpoil, string>, "material"> = {
  material: mineralsIcon
};

export function maskStyle(icon: string): CSSProperties {
  return {
    WebkitMaskImage: `url("${icon}")`,
    maskImage: `url("${icon}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain"
  };
}
