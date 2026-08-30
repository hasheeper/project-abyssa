import type { CSSProperties } from "react";
import plainDagger from "../../assets/svg/items/game-icons/plain-dagger.svg";
import crossShield from "../../assets/svg/ui/game-icon-cross-shield.svg";
import hospitalCross from "../../assets/svg/ui/game-icon-hospital-cross.svg";
import swapBag from "../../assets/svg/items/game-icons/swap-bag.svg";
import magicPalm from "../../assets/svg/ui/game-icon-magic-palm.svg";
import crossedSwords from "../../assets/svg/ui/crossed-swords.svg";
import slashedShield from "../../assets/svg/ui/slashed-shield.svg";
import heartDrop from "../../assets/svg/8-1-heart-drop.svg";
import explosionRays from "../../assets/svg/2-1-explosion-rays.svg";
import timeBomb from "../../assets/svg/items/game-icons/time-bomb.svg";
import skeletalHand from "../../assets/svg/7-0-skeletal-hand.svg";
import gooExplosion from "../../assets/svg/4-1-goo-explosion.svg";
import splitCross from "../../assets/svg/6-0-split-cross.svg";

/*
 * 战斗界面的图形词表。界面内不出现任何 emoji：
 * 全部战斗动词、意图类别与状态标记都走同一套 mask 图形，
 * 因此可以统一继承 currentColor、描边与投影，质感与骰面一致。
 */

export type GlyphName =
  | "attack"
  | "guard"
  | "heal"
  | "coin"
  | "art"
  | "wild"
  | "blank"
  | "intent-attack"
  | "intent-charge"
  | "intent-seal"
  | "intent-countdown"
  | "intent-summon"
  | "heart"
  | "blocked";

const GLYPH_SOURCES: Record<GlyphName, string> = {
  attack: plainDagger,
  guard: crossShield,
  heal: hospitalCross,
  coin: swapBag,
  art: magicPalm,
  wild: splitCross,
  blank: gooExplosion,
  "intent-attack": crossedSwords,
  "intent-charge": explosionRays,
  "intent-seal": skeletalHand,
  "intent-countdown": timeBomb,
  "intent-summon": gooExplosion,
  heart: heartDrop,
  blocked: slashedShield
};

type GlyphProps = {
  name: GlyphName;
  className?: string;
};

export function ExpeditionGlyph({ name, className }: GlyphProps) {
  return (
    <i
      className={["abyssa-expedition-glyph", className].filter(Boolean).join(" ")}
      data-glyph={name}
      style={{ "--glyph-source": `url("${GLYPH_SOURCES[name]}")` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
