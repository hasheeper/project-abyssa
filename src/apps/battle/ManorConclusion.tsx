import { useGameSession, useGameState } from "../../game-client/react";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { useSceneTransition } from "../../shared/transition";
import { manorScenes } from "../../content/presentation/old-manor";
import { DiceActionButton } from "../../shared/ui/patterns/action-dock/DiceActionButton";
import { ExpeditionBattleSurface } from "./presentation/ExpeditionBattleSurface";
import { ExpeditionBattleSidebar, type ExpeditionBattleSidebarProps } from "./presentation/ExpeditionBattleSidebar";
import type { ExpeditionBattleScreenProps } from "./ExpeditionBattleScreen";

/** Numerical settlement only. The scene director presents the ending in full ADV. */
export function ManorConclusion({record, onReview, ...props}: Omit<ExpeditionBattleScreenProps, "onSettle"> & {record: import("../../game-application").AnyGameRecord; onReview: () => void}) {
  const session=useGameSession(), game=useGameState(), {navigate}=useSceneTransition();
  const v=session.runtime.queries.journey(record)!;
  const terminal=record.schemaVersion!==1 ? record.snapshot.campaign.settlements.find(t=>t.runId===session.locator.expeditionId) : null;
  const story=v.story?.terminalId===terminal?.id ? v.story : null;
  const busy=game.status!=="ready";
  const home=()=>navigate(gameHref("mansion",recordLocator(record)),{destination:"守望者之崖洋馆",channel:"正在返回"});
  const title=story ? "家宴结束" : "维护完成";
  const sidebarProps = {
    partyIds: terminal?.partyIds ?? [],
    reaction: null,
    title: "MANOR YIELD",
    layers: v.depthFactors,
    engine: {location:"克雷格旧庄园",layer:5,round:0,gold:0,bagGold:terminal?.totalGold??0,deepestLayer:5,log:[]},
    handFactor: 1,
    layerFactor: 2,
    earthFactor: 1,
    projected: 0,
    layerClearPending: false,

  } satisfies ExpeditionBattleSidebarProps;
  return <ExpeditionBattleSurface {...props} onSettle={()=>{}} title="克雷格旧庄园" label="克雷格旧庄园战斗界面"
    party={[]} presentedEnemies={[]} phase="complete" layerClearPending={false} isRolling={false} interactive={false} heldActor={null}
    attackFx={null} supportFx={null} enemyTurnFx={null} registerEnemyNode={()=>{}} isPresentationBusy={()=>busy}
    handleMemberCardClick={()=>{}} handleEnemyClick={()=>{}} handleIntentClick={()=>{}} dicePanel={null}
    sceneStyle={{backgroundImage:`var(--battle-scene-tint), var(--battle-scene-curtain), url("${manorScenes["old-manor.banquet-hall"]}")`}}
    sidebar={<ExpeditionBattleSidebar {...sidebarProps} />}
    overlays={<div className="abyssa-expedition-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="abyssa-expedition-modal" data-wide><h3>{title}</h3>
        <div className="abyssa-expedition-modal__body">
          <p>{story ? "登记簿已经合上，庄园维护委托与回忆篇现已开放。" : "支线已清理完毕，可以回馆休整。"}</p><p className="abyssa-expedition-modal__highlight">本趟已入账 <strong data-currency="gold">{terminal?.totalGold}G</strong>{story && <>；首次接管奖励 <strong data-currency="gold">{v.takeover!.gold}G</strong> 已另行入账</>}。</p>
        </div>
        <div className="abyssa-expedition-modal__actions">
          <DiceActionButton label="返回洋馆" primary disabled={busy} onClick={home}/>{story && <DiceActionButton label="回顾家宴落幕" onClick={onReview}/>}
        </div>
      </div>
    </div>}
  />;
}
