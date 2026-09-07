import demonCadreCornerOrnament from "../../assets/ui/battle-frame-corner.png";
import demonLordCornerOrnament from "../../assets/ui/battle-frame-corner-red.png";
import heroPartyCornerOrnament from "../../assets/ui/battle-frame-corner-gold.png";
import demonCadreTopOrnament from "../../assets/ui/battle-frame-top.png";
import demonLordTopOrnament from "../../assets/ui/battle-frame-top-red.png";
import heroPartyTopOrnament from "../../assets/ui/battle-frame-top-gold.png";
import oldManorFrameThreads from "../../assets/ui/old-manor/battle-frame-threads.svg";

export type BattleUiSkin = "timber" | "hero-party" | "demon-cadre" | "demon-lord" | "old-manor";

export type BattleUiSkinDefinition = {
  id: BattleUiSkin;
  label: string;
  secondaryLabel: string;
  topOrnamentUrl?: string;
  cornerOrnamentUrl?: string;
  frameOverlayUrl?: string;
  enemyAtmosphere?: "mist";
  edgeWeave?: boolean;
};

/**
 * 战斗皮肤描述整场战斗的编队或场所美术，而不是某一张角色卡的阵营。
 * 混编队伍也只在进入战斗时确定一次，不能随角色力竭而改变外框。
 */
export const BATTLE_UI_SKINS: readonly BattleUiSkinDefinition[] = [
  {
    id: "timber",
    label: "原生木框",
    secondaryLabel: "TIMBER"
  },
  {
    id: "hero-party",
    label: "勇者小队",
    secondaryLabel: "HEROES",
    topOrnamentUrl: heroPartyTopOrnament,
    cornerOrnamentUrl: heroPartyCornerOrnament,
    edgeWeave: true
  },
  {
    id: "demon-cadre",
    label: "四席摄政",
    secondaryLabel: "CADRE",
    topOrnamentUrl: demonCadreTopOrnament,
    cornerOrnamentUrl: demonCadreCornerOrnament,
    edgeWeave: true
  },
  {
    id: "demon-lord",
    label: "魔王亲征",
    secondaryLabel: "SOVEREIGN",
    topOrnamentUrl: demonLordTopOrnament,
    cornerOrnamentUrl: demonLordCornerOrnament,
    edgeWeave: true
  },
  {
    id: "old-manor",
    label: "克雷格旧庄园",
    secondaryLabel: "OLD MANOR",
    frameOverlayUrl: oldManorFrameThreads,
    enemyAtmosphere: "mist"
  }
] as const;

export function resolveBattleUiSkin(id: BattleUiSkin): BattleUiSkinDefinition {
  return BATTLE_UI_SKINS.find((skin) => skin.id === id) ?? BATTLE_UI_SKINS[0];
}

export function getNextBattleUiSkin(id: BattleUiSkin): BattleUiSkin {
  const index = BATTLE_UI_SKINS.findIndex((skin) => skin.id === id);
  return BATTLE_UI_SKINS[(index + 1 + BATTLE_UI_SKINS.length) % BATTLE_UI_SKINS.length]!.id;
}
