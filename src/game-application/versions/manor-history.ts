import * as v from "../../game-core/contracts";
import type { DemoGameRecord } from "./demo-contracts";

/** Couple persistent progression to committed, non-retracted gameplay evidence. */
export function validateManorHistory(record: DemoGameRecord) {
  const facts = record.facts.filter(f => !record.retractedFactIds.includes(f.id));
  const pending = record.snapshot.expedition?.result;
  for (const t of [...record.snapshot.campaign.settlements, ...(pending ? [pending] : [])]) {
    const runFacts = facts.filter(f => f.runRef?.id === t.runId);
    const endings = runFacts.filter(f => f.kind === "expedition-finished");
    const payments = runFacts.filter(f => f.kind === "expedition-settled");
    if (endings.length !== 1 || payments.length !== (t === pending ? 0 : 1) || [...endings, ...payments].some(f => v.canonicalJson(f.payload) !== v.canonicalJson(t))) v.invalid("settlement", "Terminal has no unique committed result");
    if (t.completion) {
      const wins = runFacts.filter(f => f.kind === "encounter-completed" && (f.payload as {outcome: string}).outcome === "victory").map(f => f.encounterId);
      if (v.canonicalJson(wins) !== v.canonicalJson(t.completion.encounterIds)) v.invalid("completion", "Missing encounter wins");
      const completed = runFacts.filter(f => f.kind === "room-completed").map(f => (f.payload as {roomId: string}).roomId);
      if (completed.length !== t.completion.roomIds.length - 1 || completed.some(id => !t.completion!.roomIds.includes(id))) v.invalid("completion", "Missing completed rooms");
    }
  }
  const grant = record.snapshot.campaign.manor!.takeover;
  const takeovers = facts.filter(f => f.kind === "manor-takeover-completed"), rewards = facts.filter(f => f.kind === "reward-granted"), stops = facts.filter(f => f.kind === "manor-program-stopped");
  if ([takeovers, rewards, stops].some(list => list.length !== (grant ? 1 : 0))) v.invalid("takeover", "Progression fact count differs");
  if (grant) {
    const reward = rewards[0].payload as {rewardId: string; gold: number; terminalId: string};
    const takeover = takeovers[0].payload as {progressId: string; runId: string; terminalId: string};
    const stopped = stops[0].payload as {terminalId: string; runId: string; routeId: string; roomIds: string[]; encounterIds: string[]};
    const terminal = record.snapshot.campaign.settlements.find(t => t.id === grant.terminalId)!;
    if (stopped.routeId !== terminal.routeId) v.invalid("takeover", "Stopped route differs");
    if (reward.rewardId !== grant.rewardId || reward.gold !== grant.gold || reward.terminalId !== grant.terminalId || takeover.progressId !== grant.id || takeover.runId !== grant.runId || takeover.terminalId !== grant.terminalId || stopped.terminalId !== grant.terminalId || stopped.runId !== grant.runId || v.canonicalJson({roomIds: stopped.roomIds, encounterIds: stopped.encounterIds}) !== v.canonicalJson(terminal.completion)) v.invalid("takeover", "Grant evidence differs");
    const payment = facts.find(f => f.kind === "expedition-settled" && (f.payload as {id: string}).id === terminal.id)!;
    if ([...takeovers, ...rewards, ...stops].some(f => f.runRef?.id !== grant.runId || f.source.revision !== payment.source.revision)) v.invalid("takeover", "Grant is not atomic with settlement");
  }
  const acknowledgements = facts.filter(f => f.kind === "story-acknowledged");
  const story = record.snapshot.campaign.manor!.story;
  let step = 0, status = "pending";
  for (const fact of acknowledgements) {
    const p = fact.payload as {terminalId:string; step:number; status:string};
    if (!story || p.terminalId !== story.terminalId || (status !== "pending" ? p.step !== step || p.status !== status : !(p.step === step && p.status === status || p.step === step+1 && p.status === "pending" || p.step === 4 && (p.status === "skipped" || step === 4 && p.status === "viewed")))) v.invalid("story", "Invalid acknowledgement history");
    step = p.step; status = p.status;
  }
  if (story && (story.step !== step || story.status !== status)) v.invalid("story", "Cursor differs from acknowledgements");
}
