import type { ReactNode } from "react";
import type { BattleLedgerContent } from "./presentation/ExpeditionBattleLedger";
import { useGameSession, useGameState } from "../../game-client/react";
import { expeditionScenes } from "../../content/presentation/expedition-art";
import { ExpeditionBattleSurface } from "./presentation/ExpeditionBattleSurface";
import { ExpeditionBattleSidebar, type ExpeditionBattleSidebarProps } from "./presentation/ExpeditionBattleSidebar";
import type { ExpeditionBattleScreenProps } from "./ExpeditionBattleScreen";

/** Numerical settlement only. The scene director presents the ending in full ADV. */
export function ManorConclusion({record, overlay, renderLedger, ...props}: Omit<ExpeditionBattleScreenProps, "onSettle"> & {record: import("../../game-application").AnyGameRecord; overlay: ReactNode; renderLedger?: BattleLedgerContent}) {
  const session=useGameSession(), game=useGameState();
  const v=session.runtime.queries.journey(record)!;
  const terminal=record.schemaVersion!==1 ? record.snapshot.campaign.settlements.find(t=>t.runId===session.locator.expeditionId) : null;
  const route = v.routes[terminal?.routeId ?? v.defaultRouteId];
  const scene = expeditionScenes[terminal && v.settlementScenes[terminal.runId] || route.lastSceneId];
  const location = route.name;
  const busy=game.status!=="ready";
  const sidebarProps = {
    partyIds: terminal?.partyIds ?? [],
    reaction: null,
    title: route.ending === "plain" ? "EXPEDITION" : "MANOR YIELD",
    layers: route.depthFactors,
    renderLedger,
    engine: {location,layer:terminal?.deepestLayer??1,round:0,gold:0,bagGold:terminal?.totalGold??0,deepestLayer:terminal?.deepestLayer??1,log:[]},
    handFactor: 1,
    layerFactor: terminal?.layerResults.at(-1)?.depthPercent ? terminal.layerResults.at(-1)!.depthPercent / 100 : 1,
    earthFactor: 1,
    projected: 0,
    layerClearPending: false,

  } satisfies ExpeditionBattleSidebarProps;
  return <ExpeditionBattleSurface {...props} onSettle={()=>{}} title={location} label={`${location}战斗界面`}
    party={[]} presentedEnemies={[]} phase="complete" layerClearPending={false} isRolling={false} interactive={false} heldActor={null}
    attackFx={null} supportFx={null} enemyTurnFx={null} isPresentationBusy={()=>busy}
    handleMemberCardClick={()=>{}} handleEnemyClick={()=>{}} handleIntentClick={()=>{}} dicePanel={null}
    sceneStyle={{backgroundImage:`var(--battle-scene-tint), var(--battle-scene-curtain), url("${scene.background}")`}}
    sidebar={<ExpeditionBattleSidebar {...sidebarProps} />}
    overlays={overlay}
  />;
}
