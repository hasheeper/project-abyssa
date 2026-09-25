import { MoneyText, formatMoney } from "../shared/ui/primitives/Money";
import { GameSystemMenu } from "./GameSystemMenu";
import { useCampaignMenuScene } from "./CampaignMenuScope";
import { activeRunId } from "./session";
import { d5EncounterView } from "../game-runtime/d5-views";
import { useEffect, useState } from "react";
import { gameContent, playerHistory, type GameFact } from "../game-runtime/views";
import { gameHref, recordLocator } from "./navigation";
import { useGameSession, useGameState } from "./react";
import { CampaignJournal, type CampaignReportControls } from "./CampaignJournal";
import { CampaignReport } from "./CampaignReport";

function factText(fact: GameFact): string | null {
  const p = fact.payload as Record<string, unknown>;
  const name = (id: unknown) => gameContent.characters[String(id)]?.name ?? String(id);
  switch (fact.kind) {
    case "expedition-started": return `出征成员：${(p.partyIds as string[]).map(name).join("、")}`;
    case "damage-applied": return `${p.targetKind === "party-member" ? name(p.targetId) : "敌人"}受到 ${p.applied} 点伤害。`;
    case "healing-applied": return `${name(p.targetId)}恢复 ${p.applied} 点生命。`;
    case "layer-cleared": return `完成第 ${p.layer} 层。`;
    case "expedition-finished": return p.wiped ? "队伍强行撤离。" : "队伍带宝离场。";
    case "expedition-settled": return `已带回 ${formatMoney(Number(p.totalGold), 100)}${p.crystal ? "和 1 枚晶石" : ""}。`;
    default: return null;
  }
}
function LegacyCampaignPanel({ report, record }: { report?: CampaignReportControls; record: import("../game-application").GameRecord }) {
  const session = useGameSession();
  const menuScene = useCampaignMenuScene();
  const locator = recordLocator(record), campaign = record.snapshot.campaign;
  const last = campaign.appliedSettlements.at(-1);
  const showReport = !!report;
  const [reaction, setReaction] = useState<string[]>([]);
  useEffect(() => {
    setReaction([]);
    if (!showReport || !last) return;
    const facts = playerHistory(record, last.expeditionId);
    const actors = facts.find(f => f.kind === "expedition-started")?.payload as { partyIds?: string[] } | undefined;
    if (!actors?.partyIds?.length) return;
    const coordinator = session.runtime.createReactions(() => { const current = session.getSnapshot().record; return {head: current!.head, expeditionId: current?.schemaVersion === 1 ? current.snapshot.expedition?.id ?? current.snapshot.campaign.appliedSettlements.at(-1)?.expeditionId ?? null : null, sceneId: "mansion"}; });
    const task = coordinator.start({ cueId: `home:${last.id}`, sceneId: "mansion", actorIds: actors.partyIds, emoteIds: [], actionIds: [], timeoutMs: 1200, maxLines: 2, maxCharacters: 120 });
    let active = true;
    void task.result.then(result => { if (active && result.status === "accepted") setReaction(result.output.lines.map(line => line.text)); });
    return () => { active = false; task.cancel(); coordinator.dispose(); };
  }, [session, showReport, record.head.revision, last?.id]);
  return <><aside className="campaign-panel" aria-label="游戏导航">
    <GameSystemMenu record={record} runtime={session.runtime} {...menuScene} busy={!!report?.view || menuScene.busy || session.getSnapshot().status !== "ready"} navigationHint="离开页面后，可继续当前旅程" navigation={[
      {id:"menu", label:"返回菜单", shortLabel:"MENU", href:gameHref("menu", locator)},
      {id:"mansion", label:"洋馆", href:gameHref("mansion", locator)},
      {id:"journey", label:record.snapshot.expedition ? record.pendingSettlement ? "完成远征结算" : "继续远征" : "出征编队", shortLabel:record.snapshot.expedition ? record.pendingSettlement ? "CLAIM" : "RESUME" : "SORTIE", href:gameHref(record.snapshot.expedition ? "battle" : "map", locator)},
      {id:"archive", label:"返回标题", shortLabel:"TITLE", href:gameHref("title")},
    ]}/>
  </aside>
    {report && <>
    {report.renderEntries?.(0)}
    <CampaignJournal open={report.view === "journal"} onClose={() => report.onViewChange(null)} onPresentChange={present => report.onPresentChange?.("journal", present)} title="日志" returnFocusRef={report.returnFocusRefs?.journal}>
    <section aria-label="远征归来"><h3>远征归来</h3><p data-testid="campaign-funds">公款 <MoneyText value={campaign.funds.public}/> · 小队资金 <MoneyText value={campaign.funds.party}/> · 晶石 {campaign.funds.crystals}</p>
      {last ? <><p>最近远征：第 {last.result.deepestLayer} 层 · 已入账 <MoneyText value={last.result.totalGold}/></p><ul className="campaign-history">{playerHistory(record, last.expeditionId).flatMap(f => { const text = factText(f); return text ? [<li key={f.id}>{text}</li>] : []; })}</ul></> : <p>还没有完成的远征。</p>}
      {reaction.map((line, i) => <p key={i}>{line}</p>)}
      <details><summary>营地库存（{campaign.inventory.items.length + campaign.inventory.equipment.length}/{campaign.inventory.capacity}）</summary>{[...campaign.inventory.items, ...campaign.inventory.equipment].map(item => <p key={item.instanceId}>{item.definitionId} · {item.instanceId}</p>)}</details>
    </section>
    </CampaignJournal>
    <CampaignJournal open={report.view === "preparation"} onClose={() => report.onViewChange(null)} onPresentChange={present => report.onPresentChange?.("preparation", present)} title="整备" returnFocusRef={report.returnFocusRefs?.preparation}>
      <section className="campaign-journal__empty" aria-label="旧版出征整备">
        <h3>出征整备</h3><p>此旧版档案不支持行囊预选，请前往出征编队。</p>
        <a href={gameHref(record.snapshot.expedition ? "battle" : "map", locator)}>{record.snapshot.expedition ? "继续远征" : "出征编队"}</a>
      </section>
    </CampaignJournal>
    </>}
  </>;
}

export function CampaignPanel({report, onReviewGrowth}: {report?: CampaignReportControls; onReviewGrowth?:(id:string)=>void}) {
  const session = useGameSession(), {record} = useGameState();
  const menuScene = useCampaignMenuScene();
  if (!record) return null;
  if (record.schemaVersion === 1) return <LegacyCampaignPanel record={record} report={report}/>;
  const e = record.schemaVersion === 4 ? d5EncounterView(record) : record.snapshot.expedition, locator = recordLocator(record);
  const memory = record.schemaVersion === 4 ? session.runtime.queries.memory(record) : null;
  const tutorial = session.runtime.queries.tutorial(record);
  const inTutorial = !!tutorial?.runRef && tutorial.runRef.id === session.locator.expeditionId;
  return <><aside className="campaign-panel" aria-label="游戏导航">
    <GameSystemMenu record={record} runtime={session.runtime} {...menuScene} busy={!!report?.view || menuScene.busy || session.getSnapshot().status !== "ready"} navigationHint={inTutorial ? "教学进度会保留，可从标题继续" : "离开页面后，可继续当前旅程"} navigation={[
      ...(!inTutorial ? [
        {id:"menu", label:"返回菜单", shortLabel:"MENU", href:gameHref("menu", locator)},
        {id:"mansion", label:"洋馆", href:gameHref("mansion", locator)},
        {id:"journey", label:memory?.runRef?.kind === "memory" ? "继续回忆" : e ? e.node === "finished" ? "完成远征结算" : "继续远征" : "出征编队", shortLabel:memory?.runRef?.kind === "memory" ? "MEMORY" : e ? e.node === "finished" ? "CLAIM" : "RESUME" : "SORTIE", href:gameHref(activeRunId(record) ? "battle" : "map", locator)},
      ] : []),
      {id:"archive", label:"返回标题", shortLabel:"TITLE", href:gameHref("title")},
    ]}/>
  </aside>
    {report && <CampaignReport record={record} {...report} onReviewGrowth={onReviewGrowth}/>}
  </>;
}
