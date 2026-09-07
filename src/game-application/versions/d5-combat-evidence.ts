import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { createD5BattleEngine, createD5MemoryEngine, parseDemoBattleCommand } from "../../game-core/battle";
import type { DemoBattleCommand, DemoEvent } from "../../game-core/battle";
import { parseD5RunRef, parseDemoItemTarget } from "../../game-core/session";
import type { D5BattleState, D5MemoryBattleState, D5RunRef, DemoItemTarget } from "../../game-core/session";

export type D5CombatEvidence = {
  runRef: D5RunRef;
  operation: {kind: "command"; command: DemoBattleCommand} | {kind: "item"; instanceId: string; target: DemoItemTarget};
  before: D5BattleState | D5MemoryBattleState;
  after: D5BattleState | D5MemoryBattleState;
  events: DemoEvent[];
  retracts: string[];
};
export type D5CombatFactPayload = Omit<D5CombatEvidence,"before"|"after"> & {
  beforeDigest: string; afterDigest: string;
  /** Ordinary encounter entry only. Memory entry is reconstructed from the fixed seed/template. */
  checkpoint?: D5BattleState;
};
export function compactD5CombatEvidence(proof:D5CombatEvidence, checkpoint=false):D5CombatFactPayload {
  return {runRef:proof.runRef,operation:proof.operation,beforeDigest:v.sha256(v.canonicalJson(proof.before)),afterDigest:v.sha256(v.canonicalJson(proof.after)),events:proof.events,retracts:proof.retracts,...(checkpoint?{checkpoint:proof.before as D5BattleState}:{})};
}
function reconstruct(catalog: ValidatedD5Catalog, p: Record<string, unknown>, before: unknown): D5CombatEvidence {
  const ref = parseD5RunRef(p.runRef), op = v.record(p.operation, "operation");
  const kind = v.choice(op.kind, ["command", "item"], "operation.kind");
  v.record(op, "operation", kind === "command" ? ["kind", "command"] : ["kind", "instanceId", "target"]);
  const operation: D5CombatEvidence["operation"] = kind === "command"
    ? {kind, command: parseDemoBattleCommand(op.command)}
    : {kind, instanceId: v.id(op.instanceId, "instanceId"), target: parseDemoItemTarget(op.target)};
  const retracts = v.ids(p.retracts, "retracts", 1);
  if (retracts.length !== (operation.kind === "command" && operation.command.type === "undo" ? 1 : 0)) v.invalid("retracts", "Only an undo retracts exactly one prior action group");
  let result: {state: D5BattleState | D5MemoryBattleState; events: DemoEvent[]};
  // Both engine entry points strictly read unknown input before executing; these casts select the typed API only.
  if (ref.kind === "memory") {
    const engine = createD5MemoryEngine(catalog);
    result = operation.kind === "command" ? engine.dispatch(before as D5MemoryBattleState, operation.command)
      : engine.useItem(before as D5MemoryBattleState, {instanceId: operation.instanceId, target: operation.target});
  } else {
    if (operation.kind !== "command") v.invalid("operation", "Ordinary journey item transactions are installed with D");
    result = createD5BattleEngine(catalog).dispatch(before as D5BattleState, operation.command);
  }
  if (result.state.run.id !== ref.id || v.canonicalJson(result.events) !== v.canonicalJson(p.events)) v.invalid("combat", "Run identity or events differ from deterministic execution");
  return {runRef: ref, operation, before: before as D5CombatEvidence["before"], after: result.state, events: result.events, retracts};
}
export function replayD5CombatFact(catalog: ValidatedD5Catalog, raw: unknown, before: D5CombatEvidence["before"]): D5CombatEvidence {
  const p = v.record(raw, "combat fact", ["runRef", "operation", "beforeDigest", "afterDigest", "events", "retracts"], ["checkpoint"]);
  for (const key of ["beforeDigest", "afterDigest"]) if (!/^[a-f0-9]{64}$/.test(v.text(p[key], key, 64))) v.invalid(key, "Invalid combat digest");
  if (p.beforeDigest !== v.sha256(v.canonicalJson(before))) v.invalid("combat", "Discontinuous committed battle state");
  const proof = reconstruct(catalog, p, before);
  if (p.afterDigest !== v.sha256(v.canonicalJson(proof.after))) v.invalid("combat", "Result digest differs from execution");
  return proof;
}
/** Re-execute a committed transition, rather than trusting a client-authored event/result list. */
export function validateD5CombatEvidence(catalog: ValidatedD5Catalog, raw: unknown): D5CombatEvidence {
  v.assertJson(raw);
  const p = v.record(raw, "combat", ["runRef", "operation", "before", "after", "events", "retracts"]);
  const proof = reconstruct(catalog, p, p.before);
  if (v.canonicalJson(proof.after) !== v.canonicalJson(p.after)) v.invalid("combat", "State differs from deterministic execution");
  return v.freezeData(structuredClone(proof));
}
