import { MoneyText } from "../shared/ui/primitives/Money";
import { useMemo, useState } from "react";
import type { AnyGameRecord } from "../game-application";
import { navigateTo } from "../shared/routing/location";
import { JournalDisclosure } from "./JournalPrimitives";
import { JOURNAL_STATUS } from "./journal-format";
import { CampaignJournal, JournalLink, type CampaignReportControls } from "./CampaignJournal";
import { CampaignReturnRecord, ReturnDepth, type JournalCredit } from "./CampaignReturnRecord";
import { DeparturePreparation } from "./DeparturePreparation";
import { useDepartureLoadout } from "./useDepartureLoadout";
import { activeRunId } from "./session";
import { growthJournalEntries } from "./GrowthEvents";
import { airpJournalEntries } from "./AirpJournalEntries";
import { directorJournalEntries } from "./airp-director/DirectorJournal";
import { AirpOnlineControls } from "./AirpOnlineControls";
import { JournalBrowser, journalActions, type JournalEntry } from "./JournalBrowser";
import "./airp.css";
import { useGameSession, useGameState } from "./react";
import { shopLootPresentation } from "../content/presentation/shop-loot";
import { appraisalHref } from "./shop-navigation";
import { gameHref, recordLocator } from "./navigation";
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
  const enterMemory = (command: Parameters<typeof session.dispatch>[0]) => void session.dispatch(command).then(batch => {
    if (batch) navigateTo(gameHref("battle", recordLocator(batch.after)));
  });
  const memoryActions = memory && journalActions(
    memory.canBegin && {label: memory.claim ? "重新挑战回忆" : "谈起旧日回廊", disabled: busy, onClick: () => enterMemory({type:"begin-memory",chapterId:memory.chapterId})},
    memory.memory?.node === "left" && memory.canRetry && {label: "重新进入回忆", disabled: busy,
      onClick: () => enterMemory({type:"retry-memory",runRef:{kind:"memory",id:memory.memory!.id,attempt:memory.memory!.attempt}})},
    memory.claim && memory.memory?.node === "completed" && {label: "回顾回忆与同行", href: gameHref("battle", {...locator,memory:{id:memory.memory.id,attempt:memory.memory.attempt}})},
    memory.runRef?.kind === "memory" && {label: "继续回忆", href: gameHref("battle", locator)},
  );
  const entries: JournalEntry[] = [];
  const pendingLoot = pendingAppraisalGroups(record.schemaVersion === 4 ? record.snapshot.campaign.loot ?? [] : [], journey?.appraisalLoot);
  if (pendingLoot.length) entries.push({id: "shop:pending-appraisal", title: "待鉴定的收获", source: "缇比", place: "杂货铺",
    category: "appraisal", status: JOURNAL_STATUS.appraise, group: "current", actionable: true,
    lead: "请缇比看看，再决定出售或留下。",
    items: {label: "尚未鉴定", rows: pendingLoot.map(item => ({id: item.id, icon: item.icon, name: item.name, note: item.appearance, quantity: item.quantity}))},
    actions: [{label: "前往鉴定", emphasis: "primary", href: appraisalHref(locator)}]});
  if (last) entries.push({id: `return:${last.runId}`, title: outcome, source: "小队", category: "return", status: JOURNAL_STATUS.settled,
    detail: <ReturnDepth layer={last.deepestLayer}/>, group: "archive",
    custom: <CampaignReturnRecord settlement={last} credits={credits}>
      {last.returnedLoot?.map(item => <p key={item.instanceId}>带回物品：{journey?.appraisalLoot[item.instanceId]?.unknownName ?? shopLootPresentation[item.definitionId].unknownName} × {shopLootPresentation[item.definitionId].quantity ?? 1} · 已领取</p>)}
      {journey?.returnFeedback.map((line, index) => <p key={index}>{line}</p>)}
      {journey?.takeover && journey.takeover.runId !== last.runId && <p className="journal-record__note">首次接管奖励 <MoneyText value={journey.takeover.gold}/> 已入账。</p>}
    </CampaignReturnRecord>,
    actions: journalActions(journey?.takeover && {label: journey.story?.status === "pending" ? "继续家宴落幕" : "回顾家宴落幕",
      href: gameHref("battle",{saveId:locator.saveId,epoch:locator.epoch,expeditionId:journey.takeover.runId})})});
  entries.push(...growthJournalEntries(growth, session, busy,
    gameHref("character-status",locator,{characterId:"eustice",tab:"dice",from:"menu"}),
    onReviewGrowth ? id => {onViewChange(null); onReviewGrowth(id);} : undefined));
  entries.push(...airpJournalEntries(narrative, session, busy));
  if (!tutorial || !["pending", "active"].includes(tutorial.progress.status))
    entries.push(...directorJournalEntries(record, session, busy, () => onViewChange(null)));
  if (memory) entries.push({id: memory.chapterId, title: memoryTitle, source: "玛丽埃塔", category: "memory", place: "旧日回廊",
    status: !memory.available ? JOURNAL_STATUS.locked : memory.claim ? JOURNAL_STATUS.done : memory.runRef?.kind === "memory" ? JOURNAL_STATUS.resume : JOURNAL_STATUS.available,
    group: !memory.available ? "locked" : memory.claim ? "archive" : "current",
    actionable: !memory.claim && (memory.canBegin || memory.canRetry),
    ...memory.available ? {lead: memory.claim ? "玛丽埃塔已可加入亲征队伍。" : "从玛丽埃塔的记事进入回忆，完成当下对话后开放亲征。", actions: memoryActions || []}
      : {condition: "完成庄园首通及家宴落幕后开放。"}});
  const rank = {current: 0, archive: 1, locked: 2};
  entries.sort((a,b) => rank[a.group] - rank[b.group] || Number(!!b.actionable) - Number(!!a.actionable));
  return <>
    {renderEntries?.(entries.filter(e => e.actionable || e.ongoing).length)}
    <CampaignJournal browser open={view === "journal"} onClose={() => onViewChange(null)} onPresentChange={present => onPresentChange?.("journal", present)} title="日志" returnFocusRef={returnFocusRefs?.journal}>
      <JournalBrowser entries={entries} selectedId={selectedId} onSelect={setSelectedId}
        empty={<section className="campaign-journal__empty"><h3>旅途尚未留下足迹</h3><p>完成远征后，带回的收获与归来记录会留在这里。</p><JournalLink href={gameHref("map",locator)} label="前往出征编队"/></section>}
        tools={narrative?.version === 2 && <>
          {!!narrative.memories.length && <JournalDisclosure label="共同记忆">{narrative.memories.map(m => <p key={m.id}>{m.summary}</p>)}</JournalDisclosure>}
          {narrative.online && <JournalDisclosure label="叙事连接"><AirpOnlineControls allowConnect/></JournalDisclosure>}
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
