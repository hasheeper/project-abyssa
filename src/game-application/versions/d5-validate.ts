import { replayD5Journey, validateD5JourneyEvidence } from "./d5-journey-evidence";
import type { D5ExpeditionState } from "../../game-core/session";
import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { parseD5ProgressEntry, parseD5RunRef, validateD5Snapshot, validateD5EvidenceContent, projectD5Progress } from "../../game-core/session";
import type { D5ProgressEntry, D5ProgressEvent, D5RunReaders, D5RunRef } from "../../game-core/session";
import { parseHead } from "../parse";
import { sameHead } from "../transaction";
import { demoFactId } from "./demo-validate";
import type { D5GameRecord, D5Receipt } from "./d5-contracts";
import { validateD5CombatEvidence, replayD5CombatFact } from "./d5-combat-evidence";
import type { D5CombatEvidence } from "./d5-combat-evidence";
import { createD5MemoryEngine, readD5Battle } from "../../game-core/battle";

export const d5FactId = demoFactId;
export function d5EvidenceRunRef(e: D5ProgressEvent): D5RunRef | null {
  switch (e.type) {
    case "expedition-started": return { kind: "expedition", id: e.runId };
    case "expedition-settled": return { kind: "expedition", id: e.terminal.runId };
    case "memory-inherited": case "memory-started": return { kind: "memory", id: e.runId, attempt: 1 };
    case "memory-retried": return { kind: "memory", id: e.runId, attempt: e.previousAttempt + 1 };
    case "memory-read": case "memory-advanced": case "memory-left": return e.runRef;
    case "memory-ended": return e.terminal.runRef;
    default: return null;
  }
}
const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);

type VerifiedReplay = { catalog: ValidatedD5Catalog; memory: D5RunReaders["memory"]; expedition: D5RunReaders["expedition"]; requireJourneyHistory: boolean | undefined; baseline: D5RunReaders["baseline"]; entries: D5ProgressEntry[]; requests: Set<string>; retracted: string[]; anchors: string[]; lastCombat: D5CombatEvidence | null; lastJourney: D5ExpeditionState | null; projection: ReturnType<typeof projectD5Progress> | null; ordinaryReturns: number };
const verifiedReplays = new WeakMap<D5GameRecord, VerifiedReplay>();
/** A verified immutable prefix can accelerate append validation; bytes, not head alone, must match. */
export function validateD5Record(raw: unknown, catalog: ValidatedD5Catalog, readers: D5RunReaders = {}, prefix?: D5GameRecord): D5GameRecord {
  v.assertJson(raw);
  const r = v.record(raw, "record", ["schemaVersion", "head", "contentRef", "profileId", "snapshot", "commits", "facts", "retractedFactIds", "undoAnchors", "originRef"]);
  v.choice(r.schemaVersion, [4], "schemaVersion");
  if (!same(r.contentRef, catalog.ref)) v.invalid("contentRef", "Catalog identity differs", "content-mismatch");
  const head = parseHead(r.head), profileId = v.id(r.profileId, "profileId");
  if (profileId !== catalog.data.journey!.defaultProfileId) v.invalid("profileId", "Unknown D5 profile");
  if (v.list(r.undoAnchors, "undoAnchors").length) v.invalid("history", "Unsupported anchor format");
  if (r.originRef !== null) {
    if (!readers.resolveOrigin) v.invalid("originRef", "Origin reader is not installed", "content-unavailable");
    const origin = v.record(r.originRef, "originRef", ["kind", "source"]);
    const sourceHead = parseHead(v.record(origin.source, "source").head);
    if (head.saveId === sourceHead.saveId || head.epoch === sourceHead.epoch) v.invalid("originRef", "A copy needs a new save and epoch");
    let ancestor: unknown = origin.source;
    for(let n=0;ancestor && n<9;n++) {
      const a=v.record(ancestor,"origin.source"), h=parseHead(a.head);
      if(h.saveId===head.saveId || h.epoch===head.epoch) v.invalid("originRef","New identity collides with an ancestor");
      ancestor=a.schemaVersion===4 && a.originRef ? v.record(a.originRef,"originRef").source : null;
    }
    readers = {...readers, baseline: readers.resolveOrigin(r.originRef, catalog)};
  } else if (readers.baseline) v.invalid("originRef", "Baseline requires validated source evidence");
  const baseline = readers.baseline;
  const commits = v.list(r.commits, "commits"), facts = v.list(r.facts, "facts");
  if (!commits.length || commits.length !== head.revision + 1) v.invalid("commits", "Broken evidence chain");
  const cached = prefix && verifiedReplays.get(prefix);
  const reuse = cached && cached.catalog === catalog && cached.memory === readers.memory && cached.expedition === readers.expedition && cached.requireJourneyHistory === readers.requireJourneyHistory && prefix.head.saveId === head.saveId && prefix.head.epoch === head.epoch && prefix.head.revision < head.revision && same(r.originRef, prefix.originRef) && same(commits.slice(0, prefix.commits.length), prefix.commits) && same(facts.slice(0, prefix.facts.length), prefix.facts) ? cached : null;
  const retracted = reuse ? [...reuse.retracted] : [], anchors = reuse ? [...reuse.anchors] : [...(baseline?.anchors ?? [])];
  let lastCombat = reuse?.lastCombat ?? null, lastJourney = reuse ? reuse.lastJourney : baseline?.run?.kind === "expedition" ? baseline.run.state : null;
  let projection = reuse?.projection ?? null;
  const requests = new Set(reuse?.requests), entries = reuse ? [...reuse.entries] : [];
  let ordinaryReturns = reuse?.ordinaryReturns ?? baseline?.campaign.settlements.length ?? 0, factIndex = reuse ? prefix!.facts.length : 0;
  for (let revision = reuse ? prefix!.commits.length : 0; revision < commits.length; revision++) {
    const rawCommit = commits[revision];
    const c = v.record(rawCommit, "commit", ["ref", "previous", "requestId", "kind", "factIds"]);
    const source = { ...head, revision }, previous = revision ? { ...head, revision: revision - 1 } : null;
    if (!same(parseHead(c.ref), source) || !same(c.previous, previous)) v.invalid("commit", "Foreign or discontinuous head");
    const request = v.id(c.requestId, "requestId");
    if (requests.has(request)) v.invalid("requestId", "Repeated request in history");
    requests.add(request);
    const group = v.ids(c.factIds,"factIds",2);
    if (!group.length || group.length === 2 && !["combat", "journey"].includes(c.kind as string)) v.invalid("factIds", "Invalid atomic fact group");
    for (let slot = 0; slot < group.length; slot++) {
    const factId = d5FactId(head.saveId, head.epoch, revision, slot);
    if (group[slot] !== factId) v.invalid("factIds", "Unbound or duplicate fact reference");
    const f = v.record(facts[factIndex++], "fact", ["version", "id", "source", "origin", "runRef", "originRef", "worldTime", "kind", "payload", "visibility"]);
    if (f.version !== 4 || f.id !== factId || !same(f.source, source) || f.originRef !== null || f.visibility !== "party") v.invalid("fact", "Invalid evidence identity or origin");
    const time = { day: 1 + Math.floor(ordinaryReturns / 4), phase: (["dawn", "day", "dusk", "night"] as const)[ordinaryReturns % 4] };
    if (!same(f.worldTime, time)) v.invalid("worldTime", "Historical event leaked into ordinary time");
    if (revision === 0) {
      if (c.kind !== "create" || f.kind !== "save-created" || f.origin !== "present" || f.runRef !== null || !same(f.payload, { profileId })) v.invalid("create", "No valid initial proof");
    } else if (f.kind === "journey") {
      const progress = projection ??= projectD5Progress(catalog, entries, readers);
      const proof = replayD5Journey(catalog, f.payload, lastJourney, progress);
      if (c.kind !== "journey" || slot !== 0 || f.origin !== "adventure" || !same(f.runRef, proof.runRef) || (proof.operation.type === "start" ? group.length !== 2 : group.length !== 1 || !same(progress.activeRunRef, proof.runRef))) v.invalid("journey", "Unbound journey transaction");
      if (proof.operation.type === "battle" && proof.operation.command.type === "undo") {
        if (proof.retracts[0] !== anchors.pop()) v.invalid("retracts", "Undo does not retract the last journey action");
        retracted.push(...proof.retracts);
      } else if (proof.before && proof.after.undo.length > proof.before.undo.length) anchors.push(factId);
      else if (!proof.after.undo.length) anchors.length = 0;
      lastJourney = proof.after;
    } else if(f.kind === "combat") {
      const progress = projection ??= projectD5Progress(catalog, entries, readers), payload = v.record(f.payload,"combat fact"), ref = parseD5RunRef(payload.runRef);
      if (readers.requireJourneyHistory && ref.kind === "expedition") v.invalid("combat", "Ordinary combat must belong to its journey chain");
      const inherited = baseline?.run?.kind === "memory" && ref.kind === "memory" && baseline.run.id === ref.id && baseline.run.attempt === ref.attempt ? baseline.run.battle : null;
      const previous = lastCombat && same(lastCombat.runRef,ref) && lastCombat.after.encounter.phase !== "complete" ? lastCombat.after : inherited;
      if(payload.checkpoint !== undefined && (ref.kind === "memory" || previous)) v.invalid("combat.checkpoint","Redundant or forbidden checkpoint");
      const initial = previous ?? (ref.kind === "memory" && progress.memory ? createD5MemoryEngine(catalog).create({runId:ref.id,seed:progress.memory.seed}) : readD5Battle(catalog,payload.checkpoint));
      const proof = replayD5CombatFact(catalog,payload,initial);
      if(c.kind !== "combat" || slot !== 0 || !same(f.runRef, proof.runRef) || !same(proof.runRef, progress.activeRunRef) || f.origin !== (proof.runRef.kind === "memory" ? "memory" : "adventure")) v.invalid("combat", "Combat is not bound to the active run/attempt");
      if(group.length !== (proof.runRef.kind === "memory" && proof.after.encounter.phase === "complete" ? 2 : 1)) v.invalid("combat", "Historical terminal and completion must commit atomically");
      if(proof.runRef.kind === "memory" && progress.memory?.node !== "battle") v.invalid("combat", "No active memory battle");
      if(proof.runRef.kind === "expedition") {
        const departure=entries.find(e=>e.event.type==="expedition-started"&&e.event.runId===proof.runRef.id)?.event;
        if(departure?.type!=="expedition-started"||!same(proof.before.run.progress,departure.progress)||!same(proof.before.run.party.map(m=>m.id),departure.partyIds)||proof.before.run.routeId!==departure.routeId) v.invalid("combat","Battle configuration differs from its frozen departure");
      }
      if(previous) {
        if(!same(previous,proof.before)) v.invalid("combat", "Discontinuous committed battle state");
      } else {
        anchors.length = 0;
        if(proof.before.undo.length) v.invalid("combat", "First transition has unproved undo history");
        if(proof.runRef.kind === "memory" && !same(proof.before,createD5MemoryEngine(catalog).create({runId:proof.runRef.id,seed:progress.memory!.seed}))) v.invalid("combat", "History did not start from its fixed checkpoint");
      }
      const command = proof.operation.kind === "command" ? proof.operation.command.type : "item";
      if(command === "undo") {
        if(proof.retracts[0] !== anchors.pop()) v.invalid("retracts", "Undo does not retract its last action group");
        retracted.push(...proof.retracts);
      } else if(["act","toggle-load","item"].includes(command)) anchors.push(factId);
      else anchors.length = 0;
      lastCombat = proof;
    } else {
      if (f.kind !== "progression") v.invalid("fact.kind", "Unsupported D5 capability");
      const entry = parseD5ProgressEntry({ id: factId, revision, origin: f.origin, event: f.payload });
      if ((c.kind === "journey" ? slot !== 1 || entry.event.type !== "expedition-started" || !lastJourney || lastJourney.run.id !== entry.event.runId : c.kind === "combat" ? slot !== 1 || entry.event.type !== "memory-ended" || !lastCombat || !same(lastCombat.runRef,d5EvidenceRunRef(entry.event)) : c.kind !== entry.event.type) || !same(f.runRef, d5EvidenceRunRef(entry.event))) v.invalid("fact", "Evidence does not belong to its transaction/run");
      if (entry.event.type === "expedition-started" && lastJourney && (entry.event.runId !== lastJourney.run.id || entry.event.routeId !== lastJourney.run.routeId || !same(entry.event.progress, lastJourney.run.progress) || !same(entry.event.partyIds, lastJourney.run.party.map(m => m.id)) || !same(entry.event.itemIds, lastJourney.run.supplies.map(i => i.definitionId)))) v.invalid("departure", "Departure differs from execution");
      if (entry.event.type === "expedition-started" && readers.requireJourneyHistory && c.kind !== "journey") v.invalid("departure", "Missing executed departure");
      if (entry.event.type === "expedition-settled" && (readers.requireJourneyHistory || lastJourney) && !same(lastJourney, entry.event.finalRun)) v.invalid("terminal", "Settlement differs from the committed journey");
      if (entry.event.type === "memory-ended" && readers.requireJourneyHistory && c.kind !== "combat") v.invalid("memory", "Completion requires an atomic combat terminal");
      entries.push(entry);
      projection = null;
      if (entry.event.type === "memory-ended" && lastCombat && same(lastCombat.runRef,entry.event.terminal.runRef) && !same(lastCombat.after,entry.event.terminal.finalBattle)) v.invalid("memory.terminal", "Completion differs from committed battle");
      if (["expedition-started","expedition-settled","memory-started","memory-retried","memory-left"].includes(entry.event.type)) { lastCombat = null; anchors.length=0; }
      if (entry.event.type === "expedition-settled") { ordinaryReturns++; lastJourney = null; anchors.length = 0; }
    }
    }
  }
  if(factIndex !== facts.length) v.invalid("facts","Uncommitted facts remain");
  if(!same(r.retractedFactIds,retracted)) v.invalid("retractedFactIds", "Retractions differ from validated action groups");
  if(lastCombat) {
    const snapshot = v.record(r.snapshot,"snapshot"), run = snapshot.run === null ? null : v.record(snapshot.run,"run");
    if(run && (run.kind === "memory" ? run.battle !== null : true)) {
      const current = run.kind === "memory" ? run.battle : (()=>{const s=v.record(run.state,"state");return s.node==="battle"?{run:s.run,encounter:s.encounter,undo:s.undo}:null;})();
      if(current && !same(current,lastCombat.after)) v.invalid("snapshot", "Battle differs from the latest committed transition");
    }
  }
  if (lastJourney) {
    const snapshot = v.record(r.snapshot, "snapshot"), run = v.record(snapshot.run, "run");
    if (run.kind !== "expedition" || !same(run.state, lastJourney)) v.invalid("snapshot", "Journey differs from the committed chain");
  }
  const checked = validateD5Snapshot(catalog, entries, r.snapshot, readers);
  if (readers.requireJourneyHistory && !lastCombat && checked.run?.kind === "memory" && checked.campaign.memory?.node === "battle" && !same(checked.run, baseline?.run ?? null) && !same(checked.run.battle, createD5MemoryEngine(catalog).create({runId: checked.run.id, seed: checked.campaign.memory.seed}))) v.invalid("memory", "Unproved initial battle");
  const record = v.freezeData(structuredClone(raw) as D5GameRecord);
  verifiedReplays.set(record, {catalog, memory: readers.memory, expedition: readers.expedition, requireJourneyHistory: readers.requireJourneyHistory, baseline, entries, requests, retracted, anchors, lastCombat, lastJourney, projection, ordinaryReturns});
  return record;
}

/** Available only for records that passed the strict replay reader in this process. */
export function d5ReplayBasis(record: D5GameRecord) {
  const replay = verifiedReplays.get(record);
  if (!replay) v.invalid("record", "Expected a validated D5 record");
  return {baseline: replay.baseline, anchors: [...replay.anchors]};
}

export function validateD5Receipt(raw: unknown, catalog: ValidatedD5Catalog, readers: D5RunReaders = {}): D5Receipt {
  v.assertJson(raw);
  const r = v.record(raw, "receipt", ["version", "contentRef", "saveId", "epoch", "requestId", "fingerprint", "status", "before", "after", "error", "events", "factIds"], ["combat", "journey"]);
  const journey = r.journey === undefined ? null : validateD5JourneyEvidence(catalog, r.journey);
  if (journey && r.combat) v.invalid("receipt", "Mixed run kinds");
  const combat = r.combat === undefined ? null : validateD5CombatEvidence(catalog,r.combat);
  if (r.version !== 4 || !same(r.contentRef, catalog.ref)) v.invalid("receipt", "Receipt version/content differs");
  const saveId = v.id(r.saveId, "saveId"), epoch = v.id(r.epoch, "epoch"); v.id(r.requestId, "requestId");
  if (!/^[a-f0-9]{64}$/.test(v.text(r.fingerprint, "fingerprint", 64))) v.invalid("fingerprint", "Invalid request fingerprint");
  const status = v.choice(r.status, ["committed", "rejected"], "status");
  const before = r.before === null ? null : parseHead(r.before), after = r.after === null ? null : parseHead(r.after);
  for (const h of [before, after]) if (h && (h.saveId !== saveId || status === "committed" && h.epoch !== epoch)) v.invalid("receipt.head", "Receipt belongs to a different save/epoch");
  const events = v.list(r.events, "events", 1).map(parseD5ProgressEntry), factIds = v.ids(r.factIds, "factIds", 2);
  events.forEach(entry => validateD5EvidenceContent(catalog, entry, readers));
  if (status === "rejected") {
    if (!sameHead(before, after) || events.length || factIds.length || combat || journey || r.error === null) v.invalid("receipt", "Rejected receipt carries effects");
    const e = v.record(r.error, "error", ["code", "path", "message"]);
    v.id(e.code, "error.code"); v.text(e.path, "error.path"); v.text(e.message, "error.message");
  } else {
    const departure = journey?.operation.type === "start";
    const terminal = combat?.runRef.kind === "memory" && combat.after.encounter.phase === "complete";
    if (r.error !== null || !after || after.revision !== (before ? before.revision + 1 : 0) || factIds.length !== (terminal || departure ? 2 : 1) || factIds.some((id,i)=>id!==d5FactId(saveId,epoch,after.revision,i))) v.invalid("receipt", "Commit/result identity differs");
    if (after.revision === 0 ? events.length !== 0 || combat || journey : (combat || journey) && !terminal && !departure ? events.length !== 0 : events.length !== 1 || events[0].revision !== after.revision || events[0].id !== factIds[terminal || departure ? 1 : 0]) v.invalid("receipt.events", "Unbound progression event");
    if (departure && (events[0].event.type !== "expedition-started" || events[0].event.runId !== journey!.after.run.id || !same(events[0].event.progress, journey!.after.run.progress) || !same(events[0].event.partyIds, journey!.after.run.party.map(m => m.id)) || events[0].event.routeId !== journey!.after.run.routeId || !same(events[0].event.itemIds, journey!.after.run.supplies.map(i => i.definitionId)))) v.invalid("receipt", "Departure proof differs");
    if(terminal && (events[0].event.type!=="memory-ended" || !same(events[0].event.terminal.finalBattle,combat!.after) || !same(events[0].event.terminal.runRef,combat!.runRef))) v.invalid("receipt","Completion differs from terminal combat");
  }
  return v.freezeData(structuredClone(raw) as D5Receipt);
}

export function readD5Archive(serialized: string, catalog: ValidatedD5Catalog, readers: D5RunReaders = {}): D5GameRecord {
  const a = v.record(v.parseJson(serialized), "archive", ["archiveVersion", "record"]);
  v.choice(a.archiveVersion, [4], "archiveVersion");
  return validateD5Record(a.record, catalog, readers);
}
