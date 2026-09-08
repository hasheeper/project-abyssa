import { GameMenu } from "../shared/ui/patterns/game-menu/GameMenu";
import { useCampaignMenuScene } from "./CampaignMenuScope";
import { activeRunId } from "./session";
import { d5EncounterView } from "../game-runtime/d5-views";
import { DiceActionButton } from "../shared/ui/patterns/action-dock/DiceActionButton";
import { useEffect, useState } from "react";
import { gameContent, playerHistory, type GameFact } from "../game-runtime/views";
import { gameHref, recordLocator } from "./navigation";
import { useGameSession, useGameState } from "./react";
import { GrowthEvents } from "./GrowthEvents";
function factText(fact: GameFact): string | null {
  const p = fact.payload as Record<string, unknown>;
  const name = (id: unknown) => gameContent.characters[String(id)]?.name ?? String(id);
  switch (fact.kind) {
    case "expedition-started": return `出征成员：${(p.partyIds as string[]).map(name).join("、")}`;
    case "damage-applied": return `${p.targetKind === "party-member" ? name(p.targetId) : "敌人"}受到 ${p.applied} 点伤害。`;
    case "healing-applied": return `${name(p.targetId)}恢复 ${p.applied} 点生命。`;
    case "layer-cleared": return `完成第 ${p.layer} 层。`;
    case "expedition-finished": return p.wiped ? "队伍强行撤离。" : "队伍带宝离场。";
    case "expedition-settled": return `已带回 ${p.totalGold} 金币${p.crystal ? "和 1 枚晶石" : ""}。`;
    default: return null;
  }
}
function LegacyCampaignPanel({ report = false, record }: { report?: boolean; record: import("../game-application").GameRecord }) {
  const session = useGameSession();
  const menuScene = useCampaignMenuScene();
  const locator = recordLocator(record), campaign = record.snapshot.campaign;
  const last = campaign.appliedSettlements.at(-1);
  const [reaction, setReaction] = useState<string[]>([]);
  useEffect(() => {
    setReaction([]);
    if (!report || !last) return;
    const facts = playerHistory(record, last.expeditionId);
    const actors = facts.find(f => f.kind === "expedition-started")?.payload as { partyIds?: string[] } | undefined;
    if (!actors?.partyIds?.length) return;
    const coordinator = session.runtime.createReactions(() => { const current = session.getSnapshot().record; return {head: current!.head, expeditionId: current?.schemaVersion === 1 ? current.snapshot.expedition?.id ?? current.snapshot.campaign.appliedSettlements.at(-1)?.expeditionId ?? null : null, sceneId: "mansion"}; });
    const task = coordinator.start({ cueId: `home:${last.id}`, sceneId: "mansion", actorIds: actors.partyIds, emoteIds: [], actionIds: [], timeoutMs: 1200, maxLines: 2, maxCharacters: 120 });
    let active = true;
    void task.result.then(result => { if (active && result.status === "accepted") setReaction(result.output.lines.map(line => line.text)); });
    return () => { active = false; task.cancel(); coordinator.dispose(); };
  }, [session, report, record.head.revision, last?.id]);
  return <><aside className="campaign-panel" aria-label="游戏导航">
    <GameMenu {...menuScene} busy={menuScene.busy || session.getSnapshot().status !== "ready"} navigationHint="离开页面后，可继续当前旅程" navigation={[
      {id:"menu", label:"返回菜单", href:gameHref("menu", locator)},
      {id:"mansion", label:"洋馆", href:gameHref("mansion", locator)},
      {id:"journey", label:record.snapshot.expedition ? record.pendingSettlement ? "完成远征结算" : "继续远征" : "出征编队", href:gameHref(record.snapshot.expedition ? "battle" : "map", locator)},
      {id:"archive", label:"档案", href:gameHref("title")},
    ]}/>
  </aside>
    {report && <aside className="campaign-panel campaign-panel--report" aria-label="远征归来"><h3>远征归来</h3><p data-testid="campaign-funds">公款 {campaign.funds.public} · 小队金币 {campaign.funds.party} · 晶石 {campaign.funds.crystals}</p>
      <p>建设与生产尚未开放</p>
      {last ? <><p>最近远征：第 {last.result.deepestLayer} 层 · 已入账 {last.result.totalGold} 金币</p><ul className="campaign-history">{playerHistory(record, last.expeditionId).flatMap(f => { const text = factText(f); return text ? [<li key={f.id}>{text}</li>] : []; })}</ul></> : <p>还没有完成的远征。</p>}
      {reaction.map((line, i) => <p key={i}>{line}</p>)}
      <details><summary>营地库存（{campaign.inventory.items.length + campaign.inventory.equipment.length}/{campaign.inventory.capacity}）</summary>{[...campaign.inventory.items, ...campaign.inventory.equipment].map(item => <p key={item.instanceId}>{item.definitionId} · {item.instanceId}</p>)}</details>
    </aside>}
  </>;
}

export function CampaignPanel({report = false, onReviewGrowth}: {report?: boolean; onReviewGrowth?:(id:string)=>void}) {
  const session = useGameSession(), {record} = useGameState();
  const menuScene = useCampaignMenuScene();
  if (!record) return null;
  if (record.schemaVersion === 1) return <LegacyCampaignPanel record={record} report={report} />;
  const c = record.snapshot.campaign, e = record.schemaVersion === 4 ? d5EncounterView(record) : record.snapshot.expedition, last = c.settlements.at(-1), locator = recordLocator(record);
  const journey = session.runtime.queries.journey(record);
  const memory = record.schemaVersion === 4 ? session.runtime.queries.memory(record) : null;
  return <><aside className="campaign-panel" aria-label="游戏导航">
    <GameMenu {...menuScene} busy={menuScene.busy || session.getSnapshot().status !== "ready"} navigationHint="离开页面后，可继续当前旅程" navigation={[
      {id:"menu", label:"返回菜单", href:gameHref("menu", locator)},
      {id:"mansion", label:"洋馆", href:gameHref("mansion", locator)},
      {id:"journey", label:memory?.runRef?.kind === "memory" ? "继续回忆" : e ? e.node === "finished" ? "完成远征结算" : "继续远征" : "出征编队", href:gameHref(activeRunId(record) ? "battle" : "map", locator)},
      {id:"archive", label:"档案", href:gameHref("title")},
    ]}/>
  </aside>
    {report && <aside className="campaign-panel campaign-panel--report" aria-label="远征归来"><h3>远征归来</h3><p data-testid="campaign-funds">公款 {c.funds.public} · 小队金币 {c.funds.party} · 晶石 {c.funds.crystals}</p><p>建设与生产尚未开放</p>
      {last ? <><p>最近远征：第 {last.deepestLayer} 层 · {last.outcome === "wipe" ? "队伍力竭撤回" : last.outcome === "cleared" ? last.routeId === "old-manor.first-clear" ? "家宴落幕，庄园已接管" : "维护委托完成" : "从撤离点返回"} · 已入账 {last.totalGold} 金币</p><p>损失散金 {last.lostLooseGold}G · 损失入袋 {last.lostBankedGold}G</p>{journey?.returnFeedback.map((line,i)=><p key={i}>{line}</p>)}</> : <p>还没有完成的远征。</p>}
      {journey?.takeover && <p>首次接管奖励 {journey.takeover.gold}G 已入账。<a href={gameHref("battle", {saveId: locator.saveId, epoch: locator.epoch, expeditionId: journey.takeover.runId})}>{journey.story?.status === "pending" ? "继续家宴落幕" : "回顾家宴落幕"}</a></p>}
      {onReviewGrowth && <GrowthEvents onReview={onReviewGrowth}/>}
      {memory && <section aria-label="玛丽埃塔回忆"><h3>{record.contentRef.contentVersion >= 3 ? "停下来的钟声" : "王座前的提线魔女"}</h3><p>{memory.claim ? "玛丽埃塔已可加入亲征队伍。" : memory.available ? "从玛丽埃塔的记事进入回忆，完成当下对话后开放亲征。" : "完成庄园首通及家宴落幕后开放。"}</p>
        {memory.canBegin && <DiceActionButton label={memory.claim ? "重新挑战回忆" : "谈起旧日回廊"} disabled={session.getSnapshot().status !== "ready"} onClick={() => void session.dispatch({type: "begin-memory", chapterId: memory.chapterId}).then(batch => {if (batch) window.location.assign(gameHref("battle", recordLocator(batch.after)));})}/>}
        {memory.memory?.node === "left" && memory.canRetry && <DiceActionButton label="重新进入回忆" onClick={() => void session.dispatch({type: "retry-memory", runRef: {kind: "memory", id: memory.memory!.id, attempt: memory.memory!.attempt}}).then(batch => {if (batch) window.location.assign(gameHref("battle", recordLocator(batch.after)));})}/>}
        {memory.claim && memory.memory?.node === "completed" && <a href={gameHref("battle", {...locator, memory: {id:memory.memory.id, attempt:memory.memory.attempt}})}>回顾回忆与同行</a>}
        {memory.runRef?.kind === "memory" && <a href={gameHref("battle", locator)}>继续回忆</a>}
      </section>}
      <details><summary>营地配给（{c.supplies.length}/7）</summary>{c.supplies.map(i => <p key={i.instanceId}>{journey?.items.find(d => d.id === i.definitionId)?.name ?? i.definitionId} ×{i.charges}</p>)}<p>{record.schemaVersion === 4 && record.contentRef.contentVersion >= 3 ? "食物与药水出发时补满；战术补给按实际余量携带，最多选四种。" : "出发时，所选四种补齐到配给上限。"}</p></details>
    </aside>}
  </>;
}
