import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { initialD5Projection } from "../../game-core/session";
import type { D5Baseline, D5RunReaders } from "../../game-core/session";
import type { AnyGameRecord } from "./demo-contracts";
import type { D5GameRecord, D5Receipt, D5Store } from "./d5-contracts";
import { d5FactId, d5ReplayBasis, validateD5Record, validateD5Receipt } from "./d5-validate";
import { applicationError } from "../service";
import { airpAtHome, airpCopyBlocked, emptyAirp } from "./airp-replay";
import { emptyAirpOnline, reduceAirpApplicationCommit } from "../airp/gameplay";
import { inheritAirpPool } from "./airp-inheritance";
import { directCopyBlocked } from "../airp-direct-gameplay/reducer";

/** Called only with an independently validated source, never a supplied projection. */
export function deriveD5Baseline(catalog: ValidatedD5Catalog, source: AnyGameRecord, kind: "copy" | "upgrade" | "cycle"): D5Baseline {
  if (catalog.data.tutorial?.guide && kind !== "copy") v.invalid("source", "The guided release currently supports new saves and exact recovery, not migration", "content-unavailable");
  if (source.schemaVersion !== 3 && source.schemaVersion !== 4) v.invalid("source", "Only full manor saves can continue into D5", "content-unavailable");
  const old = source.snapshot.campaign;
  if (source.schemaVersion === 4 && (source.airpDirector || source.airpGame)) v.invalid("source", "Director archives support exact restore; cross-identity copying is not installed", "content-unavailable");
  if (source.schemaVersion === 4 && source.airpOnline?.connection) v.invalid("source", "An online save requires explicit Session/branch recovery before copying", "online-recovery-required");
  if (source.schemaVersion === 4 && source.airpDirect && directCopyBlocked(source.airpDirect)) v.invalid("source", "Finish generation, reading and memory before copying; automatic saves and full restore remain available", "run-active");
  if (source.schemaVersion === 4 && source.narrative && (airpCopyBlocked(source.narrative) || !airpAtHome(source.snapshot.campaign))) v.invalid("source", "Finish the active AIRP errand before making another save; use full archive restore for recovery", "run-active");
  const extendingOpening = kind === "upgrade" && source.schemaVersion === 4 && source.contentRef.contentVersion === 5 && catalog.ref.contentVersion >= 6 && source.snapshot.campaign.opening?.status !== "skipped" && !!source.snapshot.campaign.opening;
  const preservingMorning = kind === "upgrade" && source.schemaVersion === 4 && source.contentRef.contentVersion === 6 && catalog.ref.contentVersion >= 7;
  if (kind === "copy" && (source.schemaVersion !== 4 || v.canonicalJson(source.contentRef) !== v.canonicalJson(catalog.ref))) v.invalid("source", "Copy must retain its exact Catalog", "content-mismatch");
  if (kind !== "copy" && (old.activeRunRef || old.manor?.story?.status === "pending" || source.schemaVersion === 4 && (source.snapshot.campaign.activeStoryId || source.snapshot.campaign.memory && source.snapshot.campaign.memory.node !== "completed"))) v.invalid("source", "Finish the current expedition, memory and return story before continuing", "run-active");
  if (kind !== "copy" && !extendingOpening && !preservingMorning && source.schemaVersion === 4 && (source.snapshot.campaign.prologue?.status === "playing" || source.snapshot.campaign.opening?.status === "playing")) v.invalid("source", "Finish or skip the prologue first", "run-active");
  if (kind === "upgrade" && (catalog.ref.contentVersion < 3 || source.schemaVersion === 4 && source.contentRef.contentVersion >= catalog.ref.contentVersion)) v.invalid("source", "Unsupported upgrade path", "content-unavailable");
  if (kind === "cycle") {
    if (catalog.ref.contentVersion < 3 || source.schemaVersion !== 4 || !source.snapshot.campaign.chapterClaim || !source.snapshot.campaign.chapterCompletion) v.invalid("source", "Complete the memory and present-day conclusion first", "command-not-available");
    const campaign = initialD5Projection(catalog);
    campaign.inheritedChapter = {completionId:source.snapshot.campaign.chapterCompletion.id,terminalId:source.snapshot.campaign.chapterCompletion.terminalId};
    return {campaign,run:null,departures:[],anchors:[]};
  }
  const campaign = source.schemaVersion === 4 ? structuredClone(source.snapshot.campaign) : {
    ...initialD5Projection(catalog), ...structuredClone(old), manor: structuredClone(old.manor!),
  };
  const inherited = source.schemaVersion === 4 ? d5ReplayBasis(source) : null;
  const departures: D5Baseline["departures"] = structuredClone(inherited?.baseline?.departures ?? []);
  if (source.schemaVersion === 4) {
    for (const f of source.facts) if (f.kind === "progression" && f.payload.type === "expedition-started") {
      const event = f.payload;
      const supplies = campaign.settlements.find(t=>t.runId===event.runId)?.returnedSupplies ?? (source.snapshot.run?.kind === "expedition" && source.snapshot.run.id === event.runId ? source.snapshot.run.state.run.supplies : []);
      departures.push({revision:f.source.revision,event:structuredClone(event),supplyIds:event.itemIds.map(id=>supplies.find(s=>s.definitionId===id)!.instanceId)});
    }
  } else {
    // v3 has no growth grants: each validated return is an eligible pre-upgrade departure.
    for (const terminal of campaign.settlements) {
      const start = source.facts.find(f=>f.kind === "expedition-started" && f.runRef?.id === terminal.runId);
      departures.push({revision:start?.source.revision ?? 0,event:{type:"expedition-started",runId:terminal.runId,routeId:terminal.routeId,partyIds:[...terminal.partyIds],itemIds:terminal.returnedSupplies.map(s=>s.definitionId),progress:structuredClone(campaign.progress)},supplyIds:terminal.returnedSupplies.map(s=>s.instanceId)});
    }
  }
  // Preserve historical ordering relative to the new local revision zero.
  const offset = source.head.revision + 1;
  departures.forEach(d=>{d.revision-=offset;});
  campaign.growthGrants.forEach(g=>{g.revision-=offset;});
  if (campaign.chapterCompletion) campaign.chapterCompletion.revision-=offset;
  if (campaign.chapterClaim) campaign.chapterClaim.revision-=offset;
  if (kind === "upgrade") {
    if (catalog.data.airp && source.schemaVersion === 4 && source.contentRef.contentVersion >= 7) {
      // AIRP adds no tutorial: retain actual completed/exempt progress and opening provenance.
    } else if (extendingOpening) {
      // S1 is an identical prefix. Preserve its choices and resume after its old final page.
      if (campaign.opening?.status === "viewed") campaign.opening = {...campaign.opening,step:67,status:"playing"};
    } else if (!preservingMorning) {
      if (catalog.data.opening) campaign.opening = {step:catalog.data.opening.lastStep,status:"skipped",choices:[]};
      if (catalog.data.prologue) campaign.prologue = {shotId: catalog.data.prologue.shotIds.at(-1)!, status: "skipped"};
    }
    // Previously free tactical leftovers become finite carried stock, never a refill or sale grant.
    campaign.supplies.forEach(s=>{if(catalog.data.economy!.prices[s.definitionId] !== undefined) s.source="supply.demo.shop";});
    if (catalog.data.tutorial && !(catalog.data.airp && source.schemaVersion === 4 && source.contentRef.contentVersion >= 7)) {
      // Existing adventures are exempt, never retroactively labelled as tutorial victories.
      const newOpening = (preservingMorning || extendingOpening) && !departures.length && !campaign.settlements.length && !campaign.progress.appliedGrowthIds.length && !campaign.inventory.length;
      campaign.tutorial = newOpening ? { status: "pending" } : { status: "exempt", reason: "pre-tutorial-save" };
    }
  }
  return {campaign,run:kind === "copy" && source.schemaVersion === 4 ? structuredClone(source.snapshot.run) : null,departures,anchors:kind === "copy" ? [...(inherited?.anchors ?? [])] : [], ...(catalog.data.airp?.version === 2 ? { narrative: inheritAirpPool(source) } : {})};
}

/** New save plus origin proof and receipt are committed atomically. Original save is untouched. */
export function createD5LineageApplication(catalog: ValidatedD5Catalog, store: D5Store, readers: D5RunReaders, readSource: (raw:unknown)=>AnyGameRecord) {
  return async (raw: unknown) => {
    try {
      v.assertJson(raw);
      const r = v.record(raw,"lineage",["saveId","epoch","clientRequestId","kind","source"]);
      const saveId=v.id(r.saveId,"saveId"),epoch=v.id(r.epoch,"epoch"),requestId=v.id(r.clientRequestId,"clientRequestId"),kind=v.choice(r.kind,["copy","upgrade","cycle"],"kind");
      const fingerprint=v.sha256(v.canonicalJson(raw));
      const prior=await store.receipt(saveId,epoch,requestId);
      if(prior) {
        const receipt=validateD5Receipt(prior,catalog,readers);
        if(receipt.saveId!==saveId || receipt.epoch!==epoch || receipt.requestId!==requestId || receipt.fingerprint!==fingerprint) v.invalid("clientRequestId","Request ID reused","request-id-reused");
        return receipt.status === "committed" ? {ok:true as const,receipt,replayed:true} : {ok:false as const,error:receipt.error!};
      }
      const source=readSource(r.source);
      const baseline=deriveD5Baseline(catalog,source,kind);
      if(source.schemaVersion!==3 && source.schemaVersion!==4) v.invalid("source","Unsupported origin");
      const head={saveId,epoch,revision:0},profileId=catalog.data.journey!.defaultProfileId,factId=d5FactId(saveId,epoch,0,0);
      const record:D5GameRecord={schemaVersion:4,head,profileId,contentRef:catalog.ref,snapshot:{campaign:baseline.campaign,run:baseline.run},originRef:{kind,source},retractedFactIds:[],undoAnchors:[],commits:[{ref:head,previous:null,requestId,kind:"create",factIds:[factId]}],facts:[{version:4,id:factId,source:head,origin:"present",runRef:null,originRef:null,worldTime:baseline.campaign.clock,visibility:"party",kind:"save-created",payload:{profileId}}]};
      const receipt:D5Receipt={version:4,contentRef:catalog.ref,saveId,epoch,requestId,fingerprint,status:"committed",before:null,after:head,error:null,events:[],factIds:[factId]};
      if (catalog.data.airp) {
        const reduced = reduceAirpApplicationCommit(catalog, baseline.narrative ?? emptyAirp(catalog), catalog.data.airpOnline ? emptyAirpOnline() : undefined, { head, before: baseline.campaign, after: baseline.campaign, run: baseline.run?.kind === "expedition" ? baseline.run.state : null, facts: record.facts, group: record.facts, retracted: [] }, source.schemaVersion === 4 ? source.airpDirect : undefined);
        record.narrative = reduced.narrative; if (reduced.online) record.airpOnline = reduced.online; if (reduced.direct) record.airpDirect = reduced.direct;
      }
      const committed=await store.commit({saveId,epoch,requestId,fingerprint,expectedHead:null,candidate:validateD5Record(record,catalog,readers),receipt:validateD5Receipt(receipt,catalog,readers)});
      const checked=validateD5Receipt(committed.receipt,catalog,readers);
      return checked.status === "committed" ? {ok:true as const,receipt:checked,replayed:committed.replayed} : {ok:false as const,error:checked.error!};
    } catch(e) {return {ok:false as const,error:applicationError(e)};}
  };
}
