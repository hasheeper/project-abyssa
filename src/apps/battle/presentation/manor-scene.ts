import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { expeditionEnemyArt, expeditionScenes } from "../../../content/presentation/expedition-art";
import { resolveBattleUiSkin, type BattleUiSkin } from "../battleUiSkins";
import { PARTY_VISUALS } from "./expedition-visuals";

export type ManorScene = {id: string; background: string; location: string; assets: string[]};

/** The displayed room, not the skin or a newer committed room, owns both backgrounds. */
export function manorScene(view: DemoJourneyView, skin?: BattleUiSkin): ManorScene | undefined {
  const id = view.room?.sceneId;
  if (!view.expedition || view.tutorial?.runRef || !id || !expeditionScenes[id]) return undefined;
  return sceneAssets(id, view.party.map(member => member.id),
    view.battle?.enemies.map(enemy => expeditionEnemyArt(enemy.definition)?.url).filter((url): url is string => !!url) ?? [],
    skin ?? view.routes[view.expedition.run.routeId]?.skin ?? "old-manor");
}

/** A restored result owns its terminal room even when another expedition is active. */
export function settlementScene(view: DemoJourneyView, terminal: NonNullable<DemoJourneyView["lastSettlement"]>, skin?: BattleUiSkin): ManorScene | undefined {
  const route = view.routes[terminal.routeId];
  const id = view.settlementScenes[terminal.runId] ?? route?.lastSceneId;
  if (!id || !expeditionScenes[id]) return undefined;
  return sceneAssets(id, terminal.partyIds, [], skin ?? route?.skin ?? "old-manor");
}

function sceneAssets(id: string, partyIds: string[], enemies: string[], skin: BattleUiSkin): ManorScene {
  const scene = expeditionScenes[id];
  const frame = resolveBattleUiSkin(skin);
  const portraits = PARTY_VISUALS as Record<string, {portrait: string}>;
  const assets = [scene.background, frame.frameOverlayUrl, frame.topOrnamentUrl, frame.cornerOrnamentUrl,
    ...partyIds.map(id => portraits[id]?.portrait), ...enemies,
  ].filter((url): url is string => !!url);
  return {id, ...scene, assets: [...new Set(assets)].sort()};
}
