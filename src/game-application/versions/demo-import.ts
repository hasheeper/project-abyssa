import * as v from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { DemoRunState, DemoEncounterState, DemoSupply, DemoLayerResult } from "../../game-core/battle";
import type { DemoTerminal } from "../../game-core/session";
import type { DemoGameRecord } from "./demo-contracts";
import { demoFactId } from "./demo-validate";

/** Collect typed identities, then rewrite only identity-bearing fields. */
export function rebaseDemoRecord(input: DemoGameRecord, saveId: string, epoch: string): DemoGameRecord {
  if (input.head.saveId === saveId || input.head.epoch === epoch) v.invalid("import", "New save and epoch required");
  const ids = new Map<string, string>();
  const token = (id: string) => v.sha256(v.canonicalJson([saveId, epoch, id])).slice(0, 20);
  const add = (id: string, prefix: string) => { if (!ids.has(id)) ids.set(id, `${prefix}${token(id)}`); return ids.get(id)!; };
  const run = (id: string) => add(id, "run:");
  const room = (id: string, runId: string) => add(id, `${run(runId)}:room:`);
  const encounter = (id: string, runId: string) => add(id, `${run(runId)}:encounter:`);
  const enemy = (id: string, enc: string, runId: string) => {
    if (input.schemaVersion === 3) {if (!ids.has(id)) ids.set(id, `${encounter(enc, runId)}:enemy:${id.slice(`${enc}:enemy:`.length)}`); return ids.get(id)!;}
    return add(id, `${encounter(enc, runId)}:enemy:`);
  };
  const supplies = (list: DemoSupply[]) => list.forEach(x => add(x.instanceId, "supply:"));
  const layers = (list: DemoLayerResult[], runId: string) => list.forEach(x => room(x.roomId, runId));
  const terminal = (t: DemoTerminal) => { run(t.runId); add(t.id, "terminal:"); supplies(t.returnedSupplies); layers(t.layerResults, t.runId);
    t.completion?.roomIds.forEach(id => room(id, t.runId)); t.completion?.encounterIds.forEach(id => encounter(id, t.runId));
  };
  const collectRun = (r: DemoRunState) => {
    run(r.id); r.roomIds.flat().forEach(id => room(id, r.id)); r.completedEncounterIds.forEach(id => encounter(id, r.id)); supplies(r.supplies);
  };
  const collectEncounter = (e: DemoEncounterState | null, runId: string) => {
    if (!e) return; encounter(e.id, runId); e.enemies.forEach(x => enemy(x.id, e.id, runId));
  };
  const expedition = input.snapshot.expedition;
  if (expedition) for (const s of [expedition, ...expedition.undo]) { collectRun(s.run); collectEncounter(s.encounter, s.run.id); }
  if (expedition?.result) terminal(expedition.result);
  supplies(input.snapshot.campaign.supplies); input.snapshot.campaign.settlements.forEach(terminal);
  for (const f of input.facts) {
    if (!f.runRef) continue;
    const runId = f.runRef.id, p = f.payload as Record<string, unknown>; run(runId);
    if (typeof p.encounterId === "string") encounter(p.encounterId, runId);
    if (typeof p.roomId === "string") room(p.roomId, runId);
    if (typeof p.instanceId === "string") add(p.instanceId, "supply:");
    if (f.kind === "information-revealed" && typeof p.targetId === "string" && p.targetId.startsWith(`${runId}:room:`)) room(p.targetId, runId);
    if (["expedition-finished", "expedition-settled"].includes(f.kind)) terminal(p as unknown as DemoTerminal);
    if (!f.encounterId) continue;
    encounter(f.encounterId, runId);
    const target = p.target as {kind?: string; id?: string} | undefined;
    for (const id of [f.actorId, p.targetId, p.enemyId, target?.kind === "intent" ? target.id : null]) if (typeof id === "string" && id.startsWith(`${f.encounterId}:enemy:`)) enemy(id, f.encounterId, runId);
  }
  const head = (h: HeadRef): HeadRef => ({saveId, epoch, revision: h.revision});
  for (const c of input.commits) c.factIds.forEach((id, index) => ids.set(id, demoFactId(saveId, epoch, c.ref.revision, index)));
  const mapped = (id: string) => { const next = ids.get(id); if (!next) v.invalid("import.reference", "Unmapped instance identity"); return next; };
  const rewriteSupplies = (list: DemoSupply[]) => list.forEach(x => { x.instanceId = mapped(x.instanceId); });
  const rewriteLayers = (list: DemoLayerResult[]) => list.forEach(x => {x.roomId = mapped(x.roomId);});
  const rewriteTerminal = (t: DemoTerminal) => { t.id = mapped(t.id); t.runId = mapped(t.runId); rewriteSupplies(t.returnedSupplies); rewriteLayers(t.layerResults); if (t.completion) {t.completion.roomIds = t.completion.roomIds.map(mapped); t.completion.encounterIds = t.completion.encounterIds.map(mapped);} };
  const rewriteRun = (r: DemoRunState) => {
    r.id = mapped(r.id); r.roomIds = r.roomIds.map(row => row.map(mapped)); r.completedRoomIds = r.completedRoomIds.map(mapped);
    r.completedEncounterIds = r.completedEncounterIds.map(mapped); rewriteSupplies(r.supplies); rewriteLayers(r.layerResults);
    r.eventResults.forEach(e => {e.roomId = mapped(e.roomId);}); r.revealed = r.revealed.map(id => id.startsWith("layer:") ? id : mapped(id));
  };
  const rewriteEncounter = (e: DemoEncounterState | null) => {
    if (!e) return; e.id = mapped(e.id);
    e.enemies.forEach(x => {x.id = mapped(x.id); if (x.intent?.kind === "repair" && x.intent.targetId) x.intent.targetId = mapped(x.intent.targetId); if (x.origin?.summonerId) x.origin.summonerId = mapped(x.origin.summonerId); if (x.intent?.id) x.intent.id = `${x.id}:intent:${e.round}`;});
    e.formation = e.formation.map(mapped); e.enemyOrder = e.enemyOrder.map(mapped);
  };
  const copy = structuredClone(input), exp = copy.snapshot.expedition;
  if (exp) for (const s of [exp, ...exp.undo]) { rewriteRun(s.run); rewriteEncounter(s.encounter); }
  if (exp?.result) rewriteTerminal(exp.result);
  rewriteSupplies(copy.snapshot.campaign.supplies); copy.snapshot.campaign.settlements.forEach(rewriteTerminal);
  if (copy.snapshot.campaign.activeRunRef) copy.snapshot.campaign.activeRunRef.id = mapped(copy.snapshot.campaign.activeRunRef.id);
  const manor = copy.snapshot.campaign.manor;
  if (manor?.takeover) {manor.takeover.terminalId = mapped(manor.takeover.terminalId); manor.takeover.runId = mapped(manor.takeover.runId);}
  if (manor?.story) manor.story.terminalId = mapped(manor.story.terminalId);
  copy.originRef = {...input.head}; copy.head = head(input.head);
  copy.commits = copy.commits.map(c => ({...c, ref: head(c.ref), previous: c.previous ? head(c.previous) : null, factIds: c.factIds.map(mapped), requestId: `history:${token(c.requestId)}`}));
  copy.facts = copy.facts.map((f, i) => {
    const oldEncounter = f.encounterId, oldRun = f.runRef?.id, p = f.payload as Record<string, unknown>;
    if (f.runRef) f.runRef.id = mapped(f.runRef.id); if (f.encounterId) f.encounterId = mapped(f.encounterId);
    if (f.actorId?.startsWith(`${oldEncounter}:enemy:`)) f.actorId = mapped(f.actorId);
    for (const key of ["targetId", "enemyId"]) if (typeof p[key] === "string" && (p[key].startsWith(`${oldEncounter}:enemy:`) || p[key].startsWith(`${oldRun}:room:`))) p[key] = mapped(p[key]);
    if (typeof p.roomId === "string") p.roomId = mapped(p.roomId);
    if (typeof p.instanceId === "string") p.instanceId = mapped(p.instanceId);
    const target = p.target as {kind?: string; id?: string} | undefined; if (target?.kind === "intent" && target.id) target.id = mapped(target.id);
    if (f.kind === "expedition-started") p.runId = mapped(p.runId as string);
    if (["expedition-finished", "expedition-settled"].includes(f.kind)) rewriteTerminal(p as unknown as DemoTerminal);
    if (f.kind === "encounter-completed" || f.kind === "encounter-started" || f.kind === "banquet-seats-changed") p.encounterId = mapped(p.encounterId as string);
    if (typeof p.terminalId === "string") p.terminalId = mapped(p.terminalId);
    if (["manor-program-stopped", "manor-takeover-completed"].includes(f.kind)) p.runId = mapped(p.runId as string);
    if (f.kind === "manor-program-stopped") {p.roomIds = (p.roomIds as string[]).map(mapped); p.encounterIds = (p.encounterIds as string[]).map(mapped);}
    if (f.kind === "facts-retracted") p.factIds = (p.factIds as string[]).map(mapped);
    return {...f, id: mapped(f.id), source: head(f.source), originRef: input.facts[i].originRef ?? input.facts[i].source};
  });
  copy.retractedFactIds = copy.retractedFactIds.map(mapped); copy.undoAnchors = input.undoAnchors.map(head);
  return copy;
}
