import { createD5BattleEngine, createD5MemoryEngine, type DemoBattleCommand } from "../../game-core/battle";
import { layerReady, routeComplete, roomInstance } from "../../game-core/session";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import type { D5GameRecord, D5Command } from "../versions/d5-contracts";

/** Public-state policy for integration tests. Never patches dice, HP, results or provenance. */
export function nextD5PlayCommand(catalog: ValidatedD5Catalog, record: D5GameRecord, passive = false): D5Command {
  const run = record.snapshot.run;
  if (!run) throw Error("No active test run");
  const ref = run.kind === "memory" ? {kind: "memory" as const, id: run.id, attempt: run.attempt} : {kind: "expedition" as const, id: run.id};
  const state = run.kind === "expedition" ? run.state : run.battle;
  if (!state) throw Error("Not in combat");
  const enc = state.encounter;
  if (enc && (enc.phase === "enemy" || enc.phase === "complete" || enc.phase === "act" && (!enc.formation.length || enc.memory?.defeated)) || run.kind === "expedition" && (layerReady(catalog.data, run.state) || routeComplete(catalog.data, run.state))) return {type: "resume-run", runRef: ref};
  if (run.kind === "expedition" && run.state.node === "finished") return {type: "settle-expedition", runRef: {kind: "expedition", id: run.id}, terminalRef: run.state.result.id};
  const wounded = state.run.party.filter(m => m.hp > 0 && m.hp < m.config.maxHp).sort((a,b) => a.hp - b.hp)[0];
  const item = wounded && state.run.supplies.find(i => i.charges > 0 && (i.definitionId === "item.potion" || i.definitionId === "item.food" && (state.run.foodUses[wounded.id] ?? 0) < 2));
  if (!passive && wounded && item && (!enc || enc.itemsUsed < 2 && (run.kind !== "memory" || enc.phase === "act"))) return {type: "use-item", runRef: ref, instanceId: item.instanceId, target: {kind: "member", id: wounded.id}};
  if (run.kind === "expedition") {
    const ordinaryRef = {kind: "expedition" as const, id: run.id}, roomId = roomInstance(run.state.run);
    if (run.state.node === "event") return {type: "choose-event", runRef: ordinaryRef, roomId, choiceId: run.state.run.layer === 2 ? "skip" : "read", actorId: null};
    if (run.state.node === "exit") return {type: "choose-exit", runRef: ordinaryRef, roomId, choice: "continue"};
    if (run.state.node === "room-complete") return {type: "advance-room", runRef: ordinaryRef, roomId};
  }
  if (!enc) throw Error("Unhandled test state");
  const command = (command: DemoBattleCommand): D5Command => ({type: "battle-command", runRef: ref, command});
  if (enc.phase === "roll") return command({type: "roll"});
  if (passive) return command({type: "end-turn"});
  const battle = {run: state.run, encounter: enc, undo: state.undo};
  const view = run.kind === "memory" ? createD5MemoryEngine(catalog).select(run.battle!) : createD5BattleEngine(catalog).select(battle as import("../../game-core/session").D5BattleState);
  const available = enc.dice.filter(d => !d.spent && !d.sealed && state.run.party.some(p => p.id === d.ownerId && p.hp > 0));
  const unfixed = available.find(d => !d.loaded);
  if (unfixed) return command({type: "toggle-load", actorId: unfixed.ownerId});
  const actions = view.party.flatMap(m => m.actions.options.map(o => {
    const enemy = view.enemies.find(e => e.id === o.targetId), member = view.party.find(p => p.id === o.targetId);
    const threat = member ? view.enemies.filter(e => e.intent?.targetId === member.id).reduce((n,e) => n + e.damage,0) : 0;
    let score = 0;
    const damage = "damage" in o && o.damage && typeof o.damage === "object" && "applied" in o.damage ? Number(o.damage.applied) : o.amount;
    if (o.choice === "attack" && enemy) score = 50 + Math.min(damage, enemy.hp) * 3 + (damage >= enemy.hp ? 30 + enemy.damage * 5 : 0) + (o.secondaryTargetId ? 6 : 0);
    if (o.choice === "heal" && member && o.amount > 0) score = threat >= member.hp ? 140 + o.amount : 20 + o.amount;
    if (o.choice === "guard" && enemy && enemy.damage > 0) score = view.party.some(p => p.id === enemy.intent?.targetId && p.hp <= enemy.damage) ? 120 : 10 + Math.min(o.amount, enemy.damage);
    if (o.choice === "guard-all" && view.enemies.some(e => e.damage > 0)) score = 115;
    return {score, action: {type: "act" as const, actorId: m.id, choice: o.choice, targetId: o.targetId}};
  })).filter(a => a.score > 0).sort((a,b) => b.score-a.score);
  if (actions.length) return command(actions[0].action);
  // End the hand rather than oscillating load/unload across individual policy steps.
  return command({type: "end-turn"});
}
