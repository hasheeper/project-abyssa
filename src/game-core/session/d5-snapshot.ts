import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import { projectD5Progress, validateD5MemoryBattle } from "./d5-progress";
import type { D5ProgressEntry, D5RunReaders, D5Snapshot } from "./d5-types";

/** Snapshot fields are checked projections of evidence, not a second writable progress authority. */
export function validateD5Snapshot(catalog: ValidatedD5Catalog, entries: D5ProgressEntry[], raw: unknown, readers: D5RunReaders = {}): D5Snapshot {
  v.assertJson(raw);
  const s = v.record(raw, "snapshot", ["campaign", "run"]);
  const campaign = projectD5Progress(catalog, entries, readers), ref = campaign.activeRunRef;
  const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
  if (!same(s.campaign, campaign)) v.invalid("campaign", "Snapshot differs from committed progression evidence");
  if (!ref) {
    if (s.run !== null) v.invalid("run", "Run without an active reference");
  } else if (ref.kind === "expedition") {
    const run = v.record(s.run, "run", ["kind", "id", "state"]);
    if (run.kind !== ref.kind || run.id !== ref.id) v.invalid("run", "Run kind/identity differs");
    if (!readers.expedition) v.invalid("run", "D5 expedition reader is not installed", "content-unavailable");
    const expedition = readers.expedition(catalog, run.state);
    if (expedition.run.id !== ref.id || !same(expedition.run.contentRef, catalog.ref) || !same(expedition.run.progress, campaign.progress)) v.invalid("run", "Departure configuration differs");
    const start = entries.find(e => e.event.type === "expedition-started" && e.event.runId === ref.id)?.event ?? readers.baseline?.departures.find(d=>d.event.runId===ref.id)?.event;
    if (!start || start.type !== "expedition-started" || expedition.run.routeId !== start.routeId || !same(expedition.run.party.map(m => m.id), start.partyIds)) v.invalid("run", "Party/route differs from departure proof");
    const reserved = campaign.inventory.filter(i => i.location.kind === "reserved");
    for (const i of reserved) if (!expedition.run.progress.equipment.some(e => e.instanceId === i.instanceId)) v.invalid("inventory", "Unbound equipment reservation");
  } else {
    const run = v.record(s.run, "run", ["kind", "id", "attempt", "battle"]);
    if (run.kind !== "memory" || run.id !== ref.id || run.attempt !== ref.attempt) v.invalid("run", "Stale or foreign memory attempt");
    const node = campaign.memory!.node;
    if (["present-intro", "history-opening", "teaching", "return-pending"].includes(node)) {
      if (run.battle !== null) v.invalid("memory", "Story node cannot carry an independently mutable battle");
    } else {
      const b = validateD5MemoryBattle(catalog, run.battle, readers, campaign.memory!.seed);
      if (b.run.id !== ref.id) v.invalid("memory", "Battle belongs to another run");
      if (node === "battle" && b.encounter.phase === "complete") v.invalid("memory", "Terminal battle requires its committed completion evidence");
      if (["history-complete", "failed"].includes(node)) {
        const ending = [...entries].reverse().find(e => e.event.type === "memory-ended" && e.event.terminal.runRef.id === ref.id && e.event.terminal.runRef.attempt === ref.attempt);
        const inheritedBattle = readers.baseline?.run?.kind === "memory" && readers.baseline.run.id === ref.id && readers.baseline.run.attempt === ref.attempt ? readers.baseline.run.battle : null;
        if (ending ? ending.event.type !== "memory-ended" || !same(b, ending.event.terminal.finalBattle) : !same(b,inheritedBattle)) v.invalid("memory", "Terminal snapshot differs from completion proof");
      }
    }
  }
  return v.freezeData(structuredClone(raw) as D5Snapshot);
}
