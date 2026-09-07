import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { createD5MemoryEngine } from "../../game-core/battle";
import { createD5ExpeditionEngine, D5_RUN_READERS, d5EventOrigin, projectD5Progress } from "../../game-core/session";
import type { D5ProgressEntry, D5ProgressEvent, D5JourneyOperation, D5RunReaders } from "../../game-core/session";
import type { ReceiptError } from "../contracts";
import { applicationError } from "../service";
import { sameHead } from "../transaction";
import { createD5FoundationApplication } from "./d5-foundation";
import { parseD5Request } from "./d5-parse";
import { d5EvidenceRunRef, d5FactId, d5ReplayBasis, validateD5Receipt, validateD5Record } from "./d5-validate";
import { compactD5CombatEvidence, type D5CombatEvidence } from "./d5-combat-evidence";
import { compactD5Journey, type D5JourneyEvidence } from "./d5-journey-evidence";
import type { D5GameRecord, D5Receipt, D5Request, D5Store } from "./d5-contracts";

export type D5Result = { ok: true; receipt: D5Receipt; replayed: boolean } | { ok: false; error: ReceiptError; receipt?: D5Receipt };
const result = (receipt: D5Receipt, replayed: boolean): D5Result => receipt.status === "committed" ? { ok: true, receipt, replayed } : { ok: false, error: receipt.error!, receipt };
const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
export const d5ProgressEntries = (record: D5GameRecord): D5ProgressEntry[] => record.facts.flatMap(f => f.kind === "progression" ? [{ id: f.id, revision: f.source.revision, origin: f.origin, event: f.payload }] : []);
function undoAnchor(record: D5GameRecord): string {
  const id = d5ReplayBasis(record).anchors.at(-1);
  if (!id) v.invalid("undo", "No committed action to retract", "command-not-available");
  return id;
}

/** D5-D application. Every accepted gameplay step uses the existing atomic save/receipt Port. */
export function createD5Application(catalog: ValidatedD5Catalog, store: D5Store, readers: D5RunReaders = D5_RUN_READERS) {
  const foundation = createD5FoundationApplication(catalog, store, readers);
  const memory = createD5MemoryEngine(catalog), expedition = createD5ExpeditionEngine(catalog);
  let cached: D5GameRecord | undefined;
  async function read(saveId: string) {
    const stored = await store.read(v.id(saveId, "saveId"));
    if (!stored) v.invalid("saveId", "Save not found", "not-found");
    const record = cached && same(stored, cached) ? cached : validateD5Record(stored, catalog, readers, cached);
    if (record.head.saveId !== saveId) v.invalid("saveId", "Stored key differs");
    cached = record;
    return record;
  }
  const checkedReceipt = (raw: unknown) => validateD5Receipt(raw, catalog, readers);
  async function dispatch(raw: unknown, internal = false): Promise<D5Result> {
    let request: D5Request | undefined, current: D5GameRecord | undefined, fingerprint = "";
    try {
      request = parseD5Request(raw, internal); fingerprint = v.sha256(v.canonicalJson(raw));
      const prior = await store.receipt(request.saveId, request.expectedHead.epoch, request.clientRequestId);
      if (prior) {
        const receipt = checkedReceipt(prior);
        if (receipt.saveId !== request.saveId || receipt.epoch !== request.expectedHead.epoch || receipt.requestId !== request.clientRequestId) v.invalid("receipt", "Stored receipt identity differs");
        if (receipt.fingerprint !== fingerprint) v.invalid("clientRequestId", "Request ID reused", "request-id-reused");
        return result(receipt, true);
      }
      current = await read(request.saveId);
      if (!sameHead(current.head, request.expectedHead)) v.invalid("expectedHead", "Stored head differs", "conflict");
      const record = structuredClone(current), command = request.command, campaign = record.snapshot.campaign;
      const ref = campaign.activeRunRef, chapter = catalog.data.progression.chapter;
      const token = v.sha256(v.canonicalJson([current.head, request.clientRequestId]));
      let event: D5ProgressEvent | null = null, combat: D5CombatEvidence | undefined, journey: D5JourneyEvidence | undefined;
      if ("runRef" in command && !same(command.runRef, ref)) {
        // A left attempt has no active run; retry must still match its exact saved attempt.
        if (!(command.type === "retry-memory" && campaign.memory?.node === "left" && same(command.runRef, { kind: "memory", id: campaign.memory.id, attempt: campaign.memory.attempt }))) v.invalid("runRef", "Stale or foreign run/attempt", "no-expedition");
      }
      if (command.type === "purchase-supply") {
        event = {...command, type: "supply-purchased"};
      } else if (command.type === "inherit-memory") {
        event = {type: "memory-inherited", runId: `memory:${token.slice(0,32)}`, chapterId: command.chapterId};
        record.snapshot.run = {kind:"memory", id:event.runId, attempt:1, battle:null};
      } else if (command.type === "start-expedition") {
        const input = { ...command, itemIds: command.itemIds ?? [] };
        const after = expedition.create(campaign, input);
        journey = { runRef: { kind: "expedition", id: after.run.id }, operation: { type: "start", input: { runId: command.runId, routeId: command.routeId, partyIds: command.partyIds, itemIds: input.itemIds, seed: command.seed } }, before: null, after, events: [], retracts: [], departureCampaign: structuredClone(campaign) };
        record.snapshot.run = { kind: "expedition", id: after.run.id, state: after };
        event = { type: "expedition-started", runId: after.run.id, routeId: after.run.routeId, partyIds: command.partyIds, itemIds: input.itemIds, progress: after.run.progress };
      } else if (command.type === "settle-expedition") {
        const run = record.snapshot.run;
        if (run?.kind !== "expedition" || run.state.node !== "finished" || run.state.result.id !== command.terminalRef) v.invalid("terminalRef", "No matching committed terminal");
        event = { type: "expedition-settled", terminal: run.state.result, finalRun: run.state };
        record.snapshot.run = null;
      } else if (command.type === "acknowledge-story") {
        event = { type: "manor-story", terminalId: command.terminalId, step: command.step, choice: command.choice };
      } else if (command.type === "begin-memory") {
        event = { type: "memory-started", runId: `memory:${token.slice(0, 32)}`, chapterId: command.chapterId, templateId: chapter.templateId, seed: Number.parseInt(token.slice(32, 40), 16) };
        record.snapshot.run = { kind: "memory", id: event.runId, attempt: 1, battle: null };
      } else if (command.type === "read-memory") {
        event = { ...command, type: "memory-read" };
      } else if (command.type === "advance-memory") {
        const m = campaign.memory;
        if (command.choice === "continue" && m && m.node in catalog.data.progression.memoryLastSteps && m.step !== catalog.data.progression.memoryLastSteps[m.node as keyof typeof catalog.data.progression.memoryLastSteps]) v.invalid("memory.step", "Dialogue has not reached its exit");
        event = { type: "memory-advanced", runRef: command.runRef, node: command.node };
        const run = record.snapshot.run;
        if (run?.kind !== "memory") v.invalid("memory", "No matching memory");
        run.battle = command.node === "battle" ? memory.create({ runId: run.id, seed: campaign.memory!.seed }) : null;
      } else if (command.type === "retry-memory") {
        event = { type: "memory-retried", runId: command.runRef.id, previousAttempt: command.runRef.attempt };
        record.snapshot.run = { kind: "memory", id: command.runRef.id, attempt: command.runRef.attempt + 1, battle: null };
      } else if (command.type === "leave-memory") {
        event = { type: "memory-left", runRef: command.runRef }; record.snapshot.run = null;
      } else if (command.type === "begin-story") {
        const spec = catalog.data.progression;
        if (command.eventId !== chapter.storyId && command.eventId !== spec.gift.eventId) v.reference(spec.growthEvents, command.eventId, "eventId");
        event = { type: "story-started", sessionId: campaign.stories.find(s => s.eventId === command.eventId)?.id ?? `story:${token.slice(0, 32)}`, eventId: command.eventId, basisId: command.basisId };
      } else if (command.type === "advance-story" || command.type === "complete-story") {
        const session = campaign.stories.find(s => s.id === command.sessionId);
        if (!session) v.invalid("story", "No active story session");
        event = command.type === "advance-story" ? { ...command, type: "story-advanced" } : { type: "story-completed", sessionId: command.sessionId };
        // Only the chapter return story concludes an active memory run; growth/gift events never carry one.
        if (command.type === "complete-story" && session.eventId === chapter.storyId) record.snapshot.run = null;
      } else if (command.type === "equip-equipment" || command.type === "unequip-equipment" || command.type === "transfer-equipment") {
        event = { type: "equipment-moved", instanceId: command.instanceId,
          fromOwnerId: command.type === "equip-equipment" ? null : command.type === "unequip-equipment" ? command.ownerId : command.fromOwnerId,
          toOwnerId: command.type === "equip-equipment" ? command.ownerId : command.type === "unequip-equipment" ? null : command.toOwnerId };
      } else if (record.snapshot.run?.kind === "expedition") {
        const before = record.snapshot.run.state;
        const operation: D5JourneyOperation = command.type === "resume-run" ? { type: "resume" }
          : command.type === "advance-room" ? { type: "advance", roomId: command.roomId }
          : command.type === "choose-event" ? { type: "event", roomId: command.roomId, choice: command.choiceId, actorId: command.actorId }
          : command.type === "choose-exit" ? { type: "exit", roomId: command.roomId, choice: command.choice }
          : command.type === "use-item" ? { type: "item", instanceId: command.instanceId, target: command.target }
          : { type: "battle", command: command.type === "undo" ? { type: "undo" } : command.type === "battle-command" ? command.command : v.invalid("command", "No ordinary operation") };
        const resolved = expedition.dispatch(before, operation);
        journey = { runRef: { kind: "expedition", id: before.run.id }, operation, before, after: resolved.state, events: resolved.events, retracts: command.type === "undo" ? [undoAnchor(current)] : [] };
        record.snapshot.run.state = resolved.state;
      } else if (record.snapshot.run?.kind === "memory" && record.snapshot.run.battle && campaign.memory?.node === "battle") {
        const before = record.snapshot.run.battle;
        const operation: D5CombatEvidence["operation"] = command.type === "use-item" ? { kind: "item", instanceId: command.instanceId, target: command.target }
          : command.type === "battle-command" ? { kind: "command", command: command.command }
          : command.type === "undo" ? { kind: "command", command: { type: "undo" } }
          : command.type === "resume-run" && before.encounter.phase === "enemy" ? { kind: "command", command: { type: before.encounter.cursor < before.encounter.enemyOrder.length ? "resolve-next-enemy" : "next-round" } }
          : command.type === "resume-run" && before.encounter.phase === "act" && before.encounter.memory?.defeated ? { kind: "command", command: { type: "end-turn" } }
          : v.invalid("command", "No mandatory memory continuation", "command-not-available");
        const resolved = operation.kind === "item" ? memory.useItem(before, { instanceId: operation.instanceId, target: operation.target }) : memory.dispatch(before, operation.command);
        combat = { runRef: ref!, operation, before, after: resolved.state, events: resolved.events, retracts: command.type === "undo" ? [undoAnchor(current)] : [] };
        record.snapshot.run.battle = resolved.state;
        if (resolved.state.encounter.phase === "complete") event = { type: "memory-ended", terminal: { id: `memory-terminal:${v.sha256(v.canonicalJson(ref)).slice(0, 32)}`, runRef: { kind: "memory", id: record.snapshot.run.id, attempt: record.snapshot.run.attempt }, chapterId: chapter.id, templateId: chapter.templateId, finalBattle: resolved.state } };
      } else v.invalid("command", "No matching active operation", "command-not-available");

      record.head = { ...record.head, revision: record.head.revision + 1 };
      const source = { ...record.head }, entries = d5ProgressEntries(record), events: D5ProgressEntry[] = [], factIds: string[] = [];
      const fact = (slot: number) => ({ version: 4 as const, id: d5FactId(source.saveId, source.epoch, source.revision, slot), source, originRef: null, worldTime: current!.snapshot.campaign.clock, visibility: "party" as const });
      if (combat) { const f = fact(0); record.facts.push({ ...f, kind: "combat", payload: compactD5CombatEvidence(combat), origin: "memory", runRef: combat.runRef }); factIds.push(f.id); record.retractedFactIds.push(...combat.retracts); }
      if (journey) { const f = fact(0); record.facts.push({ ...f, kind: "journey", payload: compactD5Journey(journey), origin: "adventure", runRef: journey.runRef }); factIds.push(f.id); record.retractedFactIds.push(...journey.retracts); }
      if (event) {
        const f = fact(factIds.length), entry = { id: f.id, revision: source.revision, origin: d5EventOrigin(event.type), event };
        record.facts.push({ ...f, kind: "progression", payload: event, origin: entry.origin, runRef: d5EvidenceRunRef(event) }); factIds.push(f.id); entries.push(entry); events.push(entry);
        record.snapshot.campaign = structuredClone(projectD5Progress(catalog, entries, {...readers, baseline: d5ReplayBasis(current).baseline}));
      }
      record.commits.push({ ref: source, previous: current.head, requestId: request.clientRequestId, kind: journey ? "journey" : combat ? "combat" : event!.type, factIds });
      const candidate = validateD5Record(record, catalog, readers, current);
      const receipt = checkedReceipt({ version: 4, contentRef: catalog.ref, saveId: source.saveId, epoch: source.epoch, requestId: request.clientRequestId, fingerprint, status: "committed", before: current.head, after: source, error: null, events, factIds, ...(combat ? { combat } : {}), ...(journey ? { journey } : {}) });
      const committed = await store.commit({ saveId: source.saveId, epoch: source.epoch, requestId: request.clientRequestId, fingerprint, expectedHead: current.head, candidate, receipt });
      if (committed.receipt.status === "committed" && !committed.replayed) cached = candidate;
      return result(checkedReceipt(committed.receipt), committed.replayed);
    } catch (e) {
      const error = applicationError(e);
      if (!request || !current || !(e instanceof v.DataValidationError) || error.code === "request-id-reused") return { ok: false, error };
      const receipt: D5Receipt = { version: 4, contentRef: catalog.ref, saveId: request.saveId, epoch: request.expectedHead.epoch, requestId: request.clientRequestId, fingerprint, status: "rejected", before: current.head, after: current.head, error, events: [], factIds: [] };
      try {
        const committed = await store.commit({ saveId: request.saveId, epoch: request.expectedHead.epoch, requestId: request.clientRequestId, fingerprint, expectedHead: request.expectedHead, candidate: null, receipt });
        return result(checkedReceipt(committed.receipt), committed.replayed);
      } catch (failure) { return { ok: false, error: applicationError(failure) }; }
    }
  }
  return { ...foundation,
    async open(saveId: string) { try { return {ok: true as const, record: await read(saveId)}; } catch (e) {return {ok: false as const, error: applicationError(e)};} },
    async exportSave(saveId: string) { try { return {ok: true as const, archive: JSON.stringify({archiveVersion: 4, record: await read(saveId)})}; } catch(e) {return {ok: false as const, error: applicationError(e)};} },
    dispatch: (raw: unknown) => dispatch(raw), resumeRun: (raw: unknown) => dispatch(raw, true) };
}
