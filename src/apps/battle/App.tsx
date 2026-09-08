import { CampaignMenuScope } from "../../game-client/CampaignMenuScope";
import { useState } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { Stage } from "../../shared/stage";
import { SceneArrivalTitle } from "../../shared/transition";
import { activeRunId } from "../../game-client/session";
import { ManorBattleBinding } from "./ManorBattleBinding";
import { ExpeditionBattleScreen } from "./ExpeditionBattleScreen";
import type { BattleUiSkin } from "./battleUiSkins";
import { GameProvider, GameGate, useGameSession, useGameState } from "../../game-client/react";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { gameHref, recordLocator, locatorMatchesRun } from "../../game-client/navigation";
import { useSceneTransition } from "../../shared/transition";

export function App() {
  return <GameProvider><GameGate><BattleRoute /></GameGate></GameProvider>;
}
function BattleRoute() {
  const session = useGameSession(), game = useGameState(), record = game.record!;
  const { navigate } = useSceneTransition();
  const [uiSkin, setUiSkin] = useState<BattleUiSkin>(record.schemaVersion !== 1 ? "old-manor" : "timber");
  const expeditionId = session.locator.expeditionId;
  const run = record.schemaVersion === 4 ? record.snapshot.run : record.snapshot.expedition;
  const memorySession = record.schemaVersion === 4 ? record.snapshot.campaign.memory : null;
  const memoryMatches = !!memorySession && session.locator.memory?.id === memorySession.id && session.locator.memory.attempt === memorySession.attempt;
  const memoryBattle = record.schemaVersion === 4 && record.snapshot.run?.kind === "memory" && !!record.snapshot.run.battle;
  const memoryReading = memoryMatches && (!memoryBattle || memorySession?.node !== "battle");
  const settled = record.schemaVersion === 1 ? record.snapshot.campaign.appliedSettlements.find(entry => entry.expeditionId === expeditionId)?.result : record.snapshot.campaign.settlements.find(entry => entry.runId === expeditionId);
  const reviewingOtherRun = (record.schemaVersion === 3 || record.schemaVersion === 4) && run && activeRunId(record) !== expeditionId && settled && "outcome" in settled && settled.outcome === "cleared";
  const settle = async () => {
    const before = session.getSnapshot().record;
    if (!before) return;
    if (before.schemaVersion !== 1) {
      const e = before.schemaVersion === 4 ? before.snapshot.run?.kind === "expedition" ? before.snapshot.run.state : null : before.snapshot.expedition;
      if (e?.node !== "finished" || e.run.id !== expeditionId) return;
      await session.dispatch({type: "settle-expedition", runRef: {kind: "expedition", id: e.run.id}, terminalRef: e.result.id});
    } else {
      const pending = before.pendingSettlement;
      if (!pending || pending.expeditionId !== expeditionId) return;
      await session.dispatch({type: "settle-expedition", expeditionId: pending.expeditionId, terminalRef: pending.terminalRef});
    }
    const current = session.getSnapshot().record;
    if (current && !activeRunId(current)) navigate(gameHref("mansion", recordLocator(current)), {destination: "守望者之崖洋馆", channel: "正在返回"});
  };

  return (
    <Stage
      background="var(--abyssa-battle-backdrop)"
      canvasClassName={record.schemaVersion === 1 ? `abyssa-battle-stage abyssa-battle-stage--${uiSkin}` : undefined}
    >
      {!memoryReading && <SceneArrivalTitle
        eyebrow={record.schemaVersion !== 1 ? "ABYSSAL EXPEDITION · OLD MANOR" : "ABYSSAL EXPEDITION · RIFT 01"}
        title={memoryMatches ? record.contentRef.contentVersion >= 3 ? "停下来的钟声" : "王座前的提线魔女" : record.schemaVersion !== 1 ? "克雷格旧庄园" : "混沌领域"}
        tone="gold"
      />}
      <CampaignMenuScope>
        {record.schemaVersion !== 1 && (memoryMatches || reviewingOtherRun || run && locatorMatchesRun(record, session.locator) || !run && settled && "outcome" in settled && settled.outcome === "cleared")
          ? <ManorBattleBinding reviewing={!!reviewingOtherRun} inspectHref={id => gameHref("character-status", recordLocator(record), {characterId:id,tab:"summary",from:"battle"})} uiSkin={uiSkin} onUiSkinChange={setUiSkin} onSettle={() => void settle()} saving={game.status !== "ready"}/>
          : <AbyssaProvider className="abyssa-expedition-theme" data-battle-ui-skin={uiSkin}>
            {record.schemaVersion === 1 && run && locatorMatchesRun(record, session.locator)
              ? <ExpeditionBattleScreen inspectHref={id => gameHref("character-status",recordLocator(record),{characterId:id,tab:"summary",from:"battle"})} uiSkin={uiSkin} onUiSkinChange={setUiSkin} onSettle={() => void settle()} saving={game.status !== "ready"}/>
              : <section className="game-client-gate game-client-gate--scene"><h2>{settled ? "远征已入账" : "请从地图编队进入远征"}</h2><p>{settled ? `已带回 ${settled.totalGold} 金币，最深抵达第 ${settled.deepestLayer} 层。` : session.locator.memory ? "这条回忆链接已失效，请从洋馆恢复当前章节。" : run ? "已有另一趟远征，请从继续远征入口返回。" : "当前没有活动远征。"}</p></section>}
            <CampaignPanel/>
          </AbyssaProvider>}
      </CampaignMenuScope>
    </Stage>
  );
}
