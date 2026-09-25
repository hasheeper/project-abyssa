import { MoneyText } from "../shared/ui/primitives/Money";
import { useMemo, useState } from "react";
import type { AnyGameRecord } from "../game-application";
import { navigateTo } from "../shared/routing/location";
import { JournalButton } from "./JournalPrimitives";
import { CampaignJournal, JournalLink, type CampaignReportControls } from "./CampaignJournal";
import { CampaignReturnRecord, type JournalCredit } from "./CampaignReturnRecord";
import { DeparturePreparation } from "./DeparturePreparation";
import { useDepartureLoadout } from "./useDepartureLoadout";
import { activeRunId } from "./session";
import { growthJournalEntries } from "./GrowthEvents";
import { airpJournalEntries } from "./AirpJournalEntries";
import { directorJournalEntries } from "./airp-director/DirectorJournal";
import { AirpOnlineControls } from "./AirpOnlineControls";
import { JournalBrowser, JournalRecordHeading, type JournalEntry } from "./JournalBrowser";
import "./airp.css";
import { useGameSession, useGameState } from "./react";
import { shopLootPresentation } from "../content/presentation/shop-loot";
import { appraisalHref } from "./shop-navigation";
import { gameHref, recordLocator } from "./navigation";
import { JournalAppraisal } from "./JournalAppraisal";
import { pendingAppraisalGroups } from "./journal-appraisal";

type ModernRecord = Exclude<AnyGameRecord, {schemaVersion: 1}>;
export function CampaignReport({record, view, onViewChange, onPresentChange, returnFocusRefs, renderEntries, onReviewGrowth}: CampaignReportControls & {
  record: ModernRecord; onReviewGrowth?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const session = useGameSession(), {status} = useGameState(), busy = status !== "ready";
  const campaign = record.snapshot.campaign, last = campaign.settlements.at(-1), locator = recordLocator(record);
  // A selected journal row or loadout checkbox is not a new campaign snapshot.
  const {journey, memory, growth, narrative, tutorial} = useMemo(() => ({
    journey: session.runtime.queries.journey(record), memory: session.runtime.queries.memory(record),
    growth: session.runtime.queries.progression(record), narrative: session.runtime.queries.narrative(record),
    tutorial: session.runtime.queries.tutorial(record),
  }), [record, session]);
  const loadout = useDepartureLoadout(record, journey);
  const outcome = !last ? "" : last.outcome === "wipe" ? "队伍力竭撤回" : last.outcome !== "cleared" ? "从撤离点返回"
    : last.routeId === "intro.tide-cave.first" ? "岩窟货物已追回" : last.routeId === "old-manor.first-clear" ? "家宴落幕，庄园已接管" : "远征顺利完成";
  const credits: JournalCredit[] = [];
  if (last && last.routeId === tutorial?.routeId && tutorial.progress.status === "completed")
    credits.push({id:"quest",label:"委托酬金",gold:tutorial.reward.gold});
  if (last && journey?.takeover?.runId === last.runId)
    credits.push({id:"takeover",label:"接管奖励",gold:journey.takeover.gold});
  const memoryTitle = record.contentRef.contentVersion >= 3 ? "停下来的钟声" : "王座前的提线魔女";
  const memoryContent = memory && <>
    <JournalRecordHeading title={memoryTitle} meta={`玛丽埃塔 · 回忆 · ${memory.claim ? "已完成" : "旧日回廊"}`}/>
    <p>{memory.claim ? "玛丽埃塔已可加入亲征队伍。" : "从玛丽埃塔的记事进入回忆，完成当下对话后开放亲征。"}</p>
    <div className="journal-record__actions">
      {memory.canBegin && <JournalButton disabled={busy} onClick={() => void session.dispatch({type:"begin-memory",chapterId:memory.chapterId}).then(batch => {
        if (batch) navigateTo(gameHref("battle", recordLocator(batch.after)));
      })}>{memory.claim ? "重新挑战回忆" : "谈起旧日回廊"}</JournalButton>}
      {memory.memory?.node === "left" && memory.canRetry && <JournalButton disabled={busy} onClick={() => void session.dispatch({type:"retry-memory",runRef:{kind:"memory",id:memory.memory!.id,attempt:memory.memory!.attempt}}).then(batch => {
        if (batch) navigateTo(gameHref("battle", recordLocator(batch.after)));
      })}>重新进入回忆</JournalButton>}
      {memory.claim && memory.memory?.node === "completed" && <a href={gameHref("battle", {...locator,memory:{id:memory.memory.id,attempt:memory.memory.attempt}})}>回顾回忆与同行</a>}
      {memory.runRef?.kind === "memory" && <a href={gameHref("battle", locator)}>继续回忆</a>}
    </div>
  </>;
  const entries: JournalEntry[] = [];
  const pendingLoot = pendingAppraisalGroups(record.schemaVersion === 4 ? record.snapshot.campaign.loot ?? [] : [], journey?.appraisalLoot);
  if (pendingLoot.length) entries.push({id: "shop:pending-appraisal", title: "待鉴定的收获", meta: `缇比的杂货铺 · ${pendingLoot.reduce((count, item) => count + item.quantity, 0)} 件`, kind: "return", group: "current", actionable: true,
    content: <JournalAppraisal items={pendingLoot} href={appraisalHref(locator)}/>});
  if (last) entries.push({id: `return:${last.runId}`, title: outcome, meta: "最近归来 · 已结算", kind: "return", group: "archive",
    content: <CampaignReturnRecord title={outcome} settlement={last} credits={credits}>
      {last.returnedLoot?.map(item => <p key={item.instanceId}>带回物品：{journey?.appraisalLoot[item.instanceId]?.unknownName ?? shopLootPresentation[item.definitionId].unknownName} × {shopLootPresentation[item.definitionId].quantity ?? 1} · 已领取</p>)}
      {journey?.returnFeedback.map((line, index) => <p key={index}>{line}</p>)}
      {journey?.takeover && <p className="campaign-journal__note">
        {journey.takeover.runId !== last.runId && <>首次接管奖励 <MoneyText value={journey.takeover.gold}/> 已入账。 </>}
        <a href={gameHref("battle",{saveId:locator.saveId,epoch:locator.epoch,expeditionId:journey.takeover.runId})}>{journey.story?.status === "pending" ? "继续家宴落幕" : "回顾家宴落幕"}</a>
      </p>}
    </CampaignReturnRecord>});
  entries.push(...growthJournalEntries(growth, session, busy,
    gameHref("character-status",locator,{characterId:"eustice",tab:"dice",from:"menu"}),
    onReviewGrowth ? id => {onViewChange(null); onReviewGrowth(id);} : undefined));
  entries.push(...airpJournalEntries(narrative, session, busy));
  entries.push(...directorJournalEntries(record, session, busy, () => onViewChange(null)));
  if (memory) entries.push({id: memory.chapterId, title: memoryTitle,
    meta: `玛丽埃塔 · ${!memory.available ? "尚未开放" : memory.claim ? "已完成" : "回忆"}`,
    kind: "memory", group: !memory.available ? "locked" : memory.claim ? "archive" : "current",
    actionable: !memory.claim && (memory.canBegin || memory.canRetry),
    content: memory.available ? memoryContent : <><JournalRecordHeading title={memoryTitle} meta="玛丽埃塔 · 尚未开放"/><p>完成庄园首通及家宴落幕后开放。</p></>});
  const rank = {current: 0, archive: 1, locked: 2};
  entries.sort((a,b) => rank[a.group] - rank[b.group] || Number(!!b.actionable) - Number(!!a.actionable));
  return <>
    {renderEntries?.(entries.filter(e => e.actionable || e.ongoing).length)}
    <CampaignJournal browser open={view === "journal"} onClose={() => onViewChange(null)} onPresentChange={present => onPresentChange?.("journal", present)} title="日志" returnFocusRef={returnFocusRefs?.journal}>
      <JournalBrowser entries={entries} selectedId={selectedId} onSelect={setSelectedId}
        empty={<section className="campaign-journal__empty"><h3>旅途尚未留下足迹</h3><p>完成远征后，带回的收获与归来记录会留在这里。</p><JournalLink href={gameHref("map",locator)} label="前往出征编队"/></section>}
        tools={narrative?.version === 2 && <>
          {!!narrative.memories.length && <details><summary>共同记忆</summary>{narrative.memories.map(m => <p key={m.id}>{m.summary}</p>)}</details>}
          {narrative.online && <details><summary>叙事连接</summary><AirpOnlineControls allowConnect/></details>}
          {narrative.capacityStopped && <p role="status">叙事档案容量已满，暂停补充新事件。已有记录仍会保留。</p>}
        </>}/>
    </CampaignJournal>
    <CampaignJournal open={view === "preparation"} onClose={() => onViewChange(null)} onPresentChange={present => onPresentChange?.("preparation", present)} title="整备" returnFocusRef={returnFocusRefs?.preparation}>
    <DeparturePreparation items={journey?.items ?? []} quantities={loadout.quantities} onQuantity={journey?.facilities ? loadout.setQuantity : undefined} selectedIds={loadout.ids} onChange={loadout.setIds} itemLimit={loadout.itemLimit}
      lockedReason={busy ? "正在保存或恢复进度" : activeRunId(record) ? "远征期间不能调整行囊" : undefined}
      storageUnavailable={loadout.storageUnavailable} funds={campaign.funds} mapHref={gameHref("map",locator)}
      equipmentHref={gameHref("character-status",locator,{characterId:"eustice",tab:"dice",from:"menu"})} shopHref={gameHref("shop",locator)}/>
    </CampaignJournal>
  </>;
}
