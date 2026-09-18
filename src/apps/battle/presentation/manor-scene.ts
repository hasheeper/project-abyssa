import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { manorEnemyArt, manorScenes } from "../../../content/presentation/old-manor";
import { resolveBattleUiSkin, type BattleUiSkin } from "../battleUiSkins";
import { PARTY_VISUALS } from "./expedition-visuals";

const locations: Record<string, string> = {
  "old-manor.welcoming-hall": "迎客门厅",
  "old-manor.service-corridor": "服务走廊",
  "old-manor.banquet-hall": "宴会厅",
};
export type ManorScene = {id: string; background: string; location: string; assets: string[]};

/** The displayed room, not the skin or a newer committed room, owns both backgrounds. */
export function manorScene(view: DemoJourneyView, skin: BattleUiSkin = "old-manor"): ManorScene | undefined {
  const id = view.room?.sceneId;
  if (!view.expedition || view.tutorial?.runRef || !id || !locations[id]) return undefined;
  const frame = resolveBattleUiSkin(skin);
  const portraits = PARTY_VISUALS as Record<string, {portrait: string}>;
  const assets = [manorScenes[id], frame.frameOverlayUrl, frame.topOrnamentUrl, frame.cornerOrnamentUrl,
    ...view.party.map(member => portraits[member.id]?.portrait),
    ...(view.battle?.enemies.map(enemy => manorEnemyArt[enemy.definition.artId!]?.url) ?? []),
  ].filter((url): url is string => !!url);
  return {id, background: manorScenes[id], location: locations[id], assets: [...new Set(assets)].sort()};
}
